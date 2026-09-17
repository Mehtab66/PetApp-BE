const { ApiClient, TypedDefaultApi } = require('amazon-creators-api');

const PLACEHOLDER_PATTERN = /^(YOUR[_-]|dummy|placeholder|changeme)/i;

function isConfigured() {
    const id = process.env.CREATORS_CREDENTIAL_ID || '';
    const secret = process.env.CREATORS_CREDENTIAL_SECRET || '';
    const version = process.env.CREATORS_CREDENTIAL_VERSION || '';
    const partnerTag = getPartnerTag();

    if (!id || !secret || !version || !partnerTag) {
        return false;
    }

    return ![id, secret].some((value) => PLACEHOLDER_PATTERN.test(value.trim()));
}

let cachedClient = null;
let cachedApi = null;
let cachedFingerprint = '';

function getMarketplace() {
    return process.env.CREATORS_MARKETPLACE || 'www.amazon.com';
}

function getPartnerTag() {
    const creatorsTag = (process.env.CREATORS_PARTNER_TAG || '').trim();
    if (creatorsTag && !PLACEHOLDER_PATTERN.test(creatorsTag)) {
        return creatorsTag;
    }
    return (process.env.AMAZON_PARTNER_TAG || '').trim();
}

function getApi() {
    if (!isConfigured()) {
        return null;
    }

    const fingerprint = [
        process.env.CREATORS_CREDENTIAL_ID,
        process.env.CREATORS_CREDENTIAL_SECRET,
        process.env.CREATORS_CREDENTIAL_VERSION,
    ].join('|');

    if (cachedApi && cachedFingerprint === fingerprint) {
        return cachedApi;
    }

    const client = new ApiClient();
    client.credentialId = process.env.CREATORS_CREDENTIAL_ID;
    client.credentialSecret = process.env.CREATORS_CREDENTIAL_SECRET;
    client.version = process.env.CREATORS_CREDENTIAL_VERSION;

    cachedClient = client;
    cachedApi = new TypedDefaultApi(client);
    cachedFingerprint = fingerprint;
    return cachedApi;
}

module.exports = {
    isConfigured,
    getApi,
    getMarketplace,
    getPartnerTag,
};
