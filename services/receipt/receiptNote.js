const axios = require('axios');
const { receiptError } = require('./errors');

const CATEGORIES = ['Food', 'Health', 'Toys', 'Grooming', 'Accessories', 'Insurance', 'Training', 'Other'];

const MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];

function parseModelJson(content) {
    if (!content || typeof content !== 'string') return null;
    const fenced = content.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = (fenced ? fenced[1] : content).trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
        return JSON.parse(raw.slice(start, end + 1));
    } catch (error) {
        return null;
    }
}

function hasToken(text, value) {
    return new RegExp(`(^|\\D)0?${value}(\\D|$)`).test(text);
}

function dateSupportedByText(isoDate, text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;

    const lower = text.toLowerCase();
    const monthName = MONTHS[month - 1];
    const dayOk = hasToken(text, day);
    const monthOk = hasToken(text, month) || lower.includes(monthName) || lower.includes(monthName.slice(0, 3));
    const yearOk = lower.includes(String(year)) || new RegExp(`(^|\\D)${String(year).slice(2)}(\\D|$)`).test(text);
    return dayOk && monthOk && yearOk;
}

function amountSupportedByText(amount, text) {
    const compact = text.replace(/\s/g, '');
    const fixed = amount.toFixed(2);
    const variants = [
        fixed,
        fixed.replace('.', ','),
        fixed.replace(/\.00$/, ''),
        fixed.replace(/\.00$/, '').replace('.', ','),
        String(amount),
    ];
    return variants.some((variant) => variant && compact.includes(variant));
}

function titleSupportedByText(title, text) {
    const words = title
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 3);
    if (!words.length) return false;
    const lower = text.toLowerCase();
    return words.every((word) => lower.includes(word));
}

function cleanReceiptFields(parsed, sourceText) {
    const note = typeof parsed?.note === 'string' ? parsed.note.replace(/\*/g, '').trim() : '';
    if (!note) {
        throw receiptError(
            'We read the receipt but could not turn it into a note. Please try again or enter the expense manually.',
            502,
            'RECEIPT_SCAN_FAILED'
        );
    }

    let title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    if (!title || title.length > 80 || !titleSupportedByText(title, sourceText)) {
        title = null;
    }

    let amount = null;
    const numericAmount = typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount);
    if (Number.isFinite(numericAmount) && numericAmount > 0 && amountSupportedByText(numericAmount, sourceText)) {
        amount = Math.round(numericAmount * 100) / 100;
    }

    let date = null;
    if (typeof parsed.date === 'string' && dateSupportedByText(parsed.date, sourceText)) {
        const parsedDate = new Date(`${parsed.date}T12:00:00`);
        if (!Number.isNaN(parsedDate.getTime()) && parsedDate <= new Date()) {
            date = parsed.date;
        }
    }

    const category = CATEGORIES.includes(parsed.category) ? parsed.category : null;

    return {
        note: note.slice(0, 2000),
        title,
        amount,
        date,
        category,
    };
}

/**
 * Turns structured receipt JSON into a note.
 * Callers must not pass the receipt image.
 */
async function generateReceiptNote(receipt) {
    const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
    if (!apiKey) {
        throw receiptError(
            'We read the receipt, but note formatting is unavailable right now. Please enter the expense manually.',
            503,
            'RECEIPT_SCAN_FAILED'
        );
    }

    const receiptJson = JSON.stringify(receipt);
    const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            model: 'openai/gpt-oss-120b',
            temperature: 0.1,
            max_tokens: 700,
            messages: [
                {
                    role: 'system',
                    content: `Turn structured receipt JSON into a clean note for a pet expense tracker.
Use only values present in the JSON. Never invent a merchant, item, price, date, tax, or total.
If a field is missing, leave it out.
Keep the note short and readable. No markdown.

Reply with JSON only:
{"note":"plain text note","title":null,"amount":null,"date":null,"category":null}
title: merchant or main purchase copied from the JSON, else null
amount: final total as a number, else null
date: YYYY-MM-DD only if a date is present, else null
category: one of ${CATEGORIES.join(', ')}, else null`,
                },
                {
                    role: 'user',
                    content: `Receipt JSON:\n${receiptJson}`,
                },
            ],
        },
        {
            timeout: 30000,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    const parsed = parseModelJson(content);
    if (!parsed) {
        throw receiptError(
            'We read the receipt but could not turn it into a note. Please try again or enter the expense manually.',
            502,
            'RECEIPT_SCAN_FAILED'
        );
    }

    return cleanReceiptFields(parsed, receiptJson);
}

module.exports = {
    generateReceiptNote,
};
