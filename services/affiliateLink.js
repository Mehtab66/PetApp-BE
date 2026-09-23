const creatorsApi = require('../config/creatorsApi');

const DEFAULT_TAG = 'thehotsllc-20';

function getAffiliateTag() {
    const tag = (creatorsApi.getPartnerTag && creatorsApi.getPartnerTag()) || '';
    return tag || DEFAULT_TAG;
}

function affiliateUrlForAsin(asin) {
    const cleanAsin = String(asin || '').replace(/^amazon_/i, '').trim();
    if (!cleanAsin) return '';
    const tag = encodeURIComponent(getAffiliateTag());
    return `https://www.amazon.com/dp/${cleanAsin}?tag=${tag}&linkCode=osi&th=1&psc=1`;
}

function withAffiliateTag(url, asin) {
    const tag = getAffiliateTag();
    if (!url) return affiliateUrlForAsin(asin);

    try {
        const parsed = new URL(url);
        if (/amazon\./i.test(parsed.hostname)) {
            parsed.searchParams.set('tag', tag);
            if (!parsed.searchParams.get('linkCode')) {
                parsed.searchParams.set('linkCode', 'osi');
            }
            return parsed.toString();
        }
        return url;
    } catch {
        return affiliateUrlForAsin(asin) || url;
    }
}

module.exports = {
    getAffiliateTag,
    affiliateUrlForAsin,
    withAffiliateTag,
};
