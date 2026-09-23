const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { receiptError } = require('./errors');
const { parseDonutSequence } = require('./parseDonutReceipt');

const WORKER_SCRIPT = path.join(__dirname, '../../python/donut_worker.py');
const READY_TIMEOUT_MS = Number(process.env.DONUT_READY_TIMEOUT_MS) || 15 * 60 * 1000;
const INFERENCE_TIMEOUT_MS = Number(process.env.DONUT_INFERENCE_TIMEOUT_MS) || 3 * 60 * 1000;

let worker = null;
let readyPromise = null;
let stdoutBuffer = '';
const pending = new Map();
let queue = Promise.resolve();
let requestSeq = 0;

function statusFor(code) {
    if (code === 'UNREADABLE_RECEIPT') return 422;
    if (code === 'MODEL_UNAVAILABLE') return 503;
    return 502;
}

function failFromWorker(message, code) {
    return receiptError(
        message || 'Receipt scanning failed. Please try again or enter the expense manually.',
        statusFor(code),
        code || 'RECEIPT_SCAN_FAILED'
    );
}

function rejectAll(error) {
    pending.forEach(({ reject, timer }) => {
        clearTimeout(timer);
        reject(error);
    });
    pending.clear();
}

function handleLine(line) {
    let message;
    try {
        message = JSON.parse(line);
    } catch (error) {
        return;
    }

    if (Object.prototype.hasOwnProperty.call(message, 'ready')) {
        return;
    }

    const waiter = pending.get(message.id);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    pending.delete(message.id);
    if (message.ok && message.sequence) {
        waiter.resolve(message.sequence);
        return;
    }
    waiter.reject(failFromWorker(message.message, message.code));
}

function attachWorker(child) {
    child.stdout.on('data', (chunk) => {
        stdoutBuffer += chunk.toString('utf8');
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || '';
        lines.filter(Boolean).forEach(handleLine);
    });

    child.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8').trim();
        if (text) console.error('[donut]', text);
    });

    child.on('exit', () => {
        worker = null;
        readyPromise = null;
        stdoutBuffer = '';
        rejectAll(failFromWorker(
            'The receipt model stopped unexpectedly. Please try again or enter the expense manually.',
            'MODEL_UNAVAILABLE'
        ));
    });
}

function startWorker() {
    if (readyPromise) return readyPromise;

    const python = process.env.DONUT_PYTHON || 'python';
    readyPromise = new Promise((resolve, reject) => {
        let settled = false;
        const child = spawn(python, ['-u', WORKER_SCRIPT], {
            env: {
                ...process.env,
                DONUT_MODEL_ID: process.env.DONUT_MODEL_ID || 'AdamCodd/donut-receipts-extract',
                DONUT_TASK_PROMPT: process.env.DONUT_TASK_PROMPT || '<s_receipt>',
                PYTHONIOENCODING: 'utf-8',
                PYTHONUNBUFFERED: '1',
                HF_HUB_DISABLE_PROGRESS_BARS: '1',
                TRANSFORMERS_VERBOSITY: 'error',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill();
            readyPromise = null;
            reject(failFromWorker(
                'The receipt model took too long to start. You can still add this expense manually.',
                'MODEL_UNAVAILABLE'
            ));
        }, READY_TIMEOUT_MS);

        const finish = (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (error) {
                readyPromise = null;
                reject(error);
                return;
            }
            worker = child;
            attachWorker(child);
            resolve(child);
        };

        child.once('error', (error) => {
            const missing = error.code === 'ENOENT';
            finish(failFromWorker(
                missing
                    ? 'Python was not found, so the local receipt model cannot run. Install Python and PetApp-BE/python/requirements.txt, or enter the expense manually.'
                    : 'The local receipt model could not be started. You can still add this expense manually.',
                'MODEL_UNAVAILABLE'
            ));
        });

        let bootBuffer = '';
        const onBoot = (chunk) => {
            bootBuffer += chunk.toString('utf8');
            const lines = bootBuffer.split(/\r?\n/);
            bootBuffer = lines.pop() || '';
            lines.filter(Boolean).forEach((line) => {
                let message;
                try {
                    message = JSON.parse(line);
                } catch (error) {
                    return;
                }
                if (!Object.prototype.hasOwnProperty.call(message, 'ready')) return;
                child.stdout.off('data', onBoot);
                stdoutBuffer = bootBuffer;
                if (message.ready) {
                    finish();
                } else {
                    finish(failFromWorker(message.message, message.code || 'MODEL_UNAVAILABLE'));
                }
            });
        };

        child.stdout.on('data', onBoot);
        child.stderr.on('data', (chunk) => {
            const text = chunk.toString('utf8').trim();
            if (text) console.error('[donut]', text);
        });
        child.once('exit', (code) => {
            if (!settled) {
                finish(failFromWorker(
                    'The local receipt model stopped before it was ready. You can still add this expense manually.',
                    'MODEL_UNAVAILABLE'
                ));
            }
            if (code) console.error('[donut] worker exited', code);
        });
    });

    return readyPromise;
}

function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.then(() => undefined, () => undefined);
    return run;
}

async function extractSequence(imageBuffer) {
    const child = await startWorker();
    const id = `r${Date.now()}-${requestSeq += 1}`;
    const imagePath = path.join(os.tmpdir(), `petapp-receipt-${id}.img`);
    await fs.promises.writeFile(imagePath, imageBuffer);

    try {
        const sequence = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(failFromWorker(
                    'Reading this receipt took too long. Try a smaller photo, or enter the expense manually.',
                    'RECEIPT_SCAN_FAILED'
                ));
            }, INFERENCE_TIMEOUT_MS);
            pending.set(id, { resolve, reject, timer });
            child.stdin.write(`${JSON.stringify({ id, imagePath })}\n`);
        });
        return sequence;
    } finally {
        fs.promises.unlink(imagePath).catch(() => undefined);
    }
}

/**
 * Receipt extractor contract: image buffer in, structured receipt JSON out.
 * Swap this module without changing note generation.
 */
async function extractReceipt(imageBuffer) {
    if (!imageBuffer || !imageBuffer.length) {
        throw receiptError('Please choose a receipt photo.', 400, 'UNREADABLE_RECEIPT');
    }

    const sequence = await enqueue(() => extractSequence(imageBuffer));
    return parseDonutSequence(sequence);
}

module.exports = {
    extractReceipt,
};
