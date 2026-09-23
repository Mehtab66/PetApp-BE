const { UNREADABLE_MESSAGE, receiptError } = require('./errors');

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * DonutProcessor.token2json, applied to the sequence produced with <s_receipt>.
 * https://github.com/huggingface/transformers/blob/main/src/transformers/models/donut/processing_donut.py
 */
function token2json(tokens, isInnerValue = false) {
    const output = {};
    let remaining = tokens || '';

    while (remaining) {
        const before = remaining;
        const startMatch = /<s_/i.exec(remaining);
        if (!startMatch) break;

        const fromStart = remaining.slice(startMatch.index);
        const closeIndex = fromStart.indexOf('>');
        if (closeIndex === -1) break;

        const startToken = fromStart.slice(0, closeIndex + 1);
        const key = startToken.slice('<s_'.length, -1);
        const endMatch = new RegExp(`</s_${escapeRegExp(key)}>`, 'i').exec(remaining);

        if (!endMatch) {
            remaining = remaining.split(startToken).join('');
        } else {
            const endToken = endMatch[0];
            const contentMatch = new RegExp(
                `${escapeRegExp(startToken)}([\\s\\S]*?)${escapeRegExp(endToken)}`,
                'i'
            ).exec(remaining);

            if (contentMatch) {
                const content = contentMatch[1].trim();
                if (content.includes('<s_') && content.toLowerCase().includes('</s_')) {
                    const value = token2json(content, true);
                    const isEmptyObject = value && !Array.isArray(value) && Object.keys(value).length === 0;
                    const isEmptyArray = Array.isArray(value) && value.length === 0;
                    if (value && !isEmptyObject && !isEmptyArray) {
                        output[key] = Array.isArray(value) && value.length === 1 ? value[0] : value;
                    }
                } else if (content) {
                    const leaves = content
                        .split('<sep/>')
                        .map((leaf) => leaf.trim())
                        .filter(Boolean);
                    if (leaves.length === 1) output[key] = leaves[0];
                    else if (leaves.length > 1) output[key] = leaves;
                }
            }

            const endAt = remaining.toLowerCase().indexOf(endToken.toLowerCase());
            remaining = remaining.slice(endAt + endToken.length).trim();
            if (remaining.startsWith('<sep/>')) {
                const rest = token2json(remaining.slice('<sep/>'.length), true);
                if (Array.isArray(rest)) return [output, ...rest];
                if (rest && typeof rest === 'object' && Object.keys(rest).length) return [output, rest];
                return [output];
            }
        }

        if (remaining === before) break;
    }

    if (Object.keys(output).length) {
        return isInnerValue ? [output] : output;
    }
    return isInnerValue ? [] : {};
}

function cleanValue(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
        const items = value.map(cleanValue).filter((item) => item !== undefined);
        return items.length ? items : undefined;
    }
    if (value && typeof value === 'object') {
        const cleaned = {};
        Object.entries(value).forEach(([key, nested]) => {
            const next = cleanValue(nested);
            if (next !== undefined) cleaned[key] = next;
        });
        return Object.keys(cleaned).length ? cleaned : undefined;
    }
    return undefined;
}

function hasMeaningfulContent(value) {
    if (typeof value === 'string') return /[A-Za-z0-9]{2,}/.test(value);
    if (Array.isArray(value)) return value.some(hasMeaningfulContent);
    if (value && typeof value === 'object') return Object.values(value).some(hasMeaningfulContent);
    return false;
}

function stripTaskPrompt(sequence) {
    return String(sequence || '').trim().replace(/^<s_receipt>/i, '').trim();
}

function parseDonutSequence(sequence) {
    const stripped = stripTaskPrompt(sequence).slice(0, 20000);
    if (!stripped || !stripped.includes('<s_')) {
        throw receiptError(UNREADABLE_MESSAGE, 422, 'UNREADABLE_RECEIPT');
    }

    let parsed = token2json(stripped, false);
    if (Array.isArray(parsed)) {
        parsed = parsed.length === 1 ? parsed[0] : { items: parsed };
    }

    const receipt = cleanValue(parsed);
    if (!receipt || !hasMeaningfulContent(receipt)) {
        throw receiptError(UNREADABLE_MESSAGE, 422, 'UNREADABLE_RECEIPT');
    }

    return receipt;
}

module.exports = {
    parseDonutSequence,
    token2json,
};
