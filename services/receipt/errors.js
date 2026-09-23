const UNREADABLE_MESSAGE =
    'We couldn\'t read this receipt. The photo may be blurry, too dark, cropped, or not a receipt. Take a clearer photo with the whole receipt in frame, or enter the expense manually.';

function receiptError(message, statusCode, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

module.exports = {
    UNREADABLE_MESSAGE,
    receiptError,
};
