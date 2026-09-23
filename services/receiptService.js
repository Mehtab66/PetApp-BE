const { receiptError } = require('./receipt/errors');
const { generateReceiptNote } = require('./receipt/receiptNote');

const EXTRACTORS = {
    donut: () => require('./receipt/donutExtractor'),
};

function getReceiptExtractor() {
    const name = (process.env.RECEIPT_EXTRACTOR || 'donut').trim().toLowerCase();
    const load = EXTRACTORS[name];
    if (!load) {
        throw receiptError(
            'Receipt scanning is not configured. You can still add this expense manually.',
            503,
            'MODEL_UNAVAILABLE'
        );
    }
    return load();
}

/**
 * Receipt image → extractor JSON → LLM note.
 * The image is never sent to the LLM. Note generation only receives JSON.
 */
async function processReceiptImage(imageBuffer) {
    const receipt = await getReceiptExtractor().extractReceipt(imageBuffer);
    try {
        return await generateReceiptNote(receipt);
    } catch (error) {
        if (error.statusCode) throw error;
        console.error('Receipt note error:', error.response?.data || error.message);
        throw receiptError(
            'We read the receipt but could not turn it into a note. Please try again or enter the expense manually.',
            502,
            'RECEIPT_SCAN_FAILED'
        );
    }
}

module.exports = {
    processReceiptImage,
};
