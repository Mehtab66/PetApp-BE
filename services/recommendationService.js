const NodeCache = require('node-cache');
const { SearchItemsRequestContent } = require('amazon-creators-api');
const creatorsApi = require('../config/creatorsApi');
const { getConditionConfig, getConditionKeys, buildKeywords } = require('./conditionCatalog');

const CACHE_TTL_SECONDS = 45 * 60;
const EMPTY_CACHE_TTL_SECONDS = 5 * 60;
const MIN_COOLDOWN_MS = 1000;

const cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 120 });
const pendingRequests = new Map();

let lastApiHitTimestamp = 0;
let circuitOpenUntil = 0;
let consecutiveThrottleErrors = 0;

class RecommendationError extends Error {
    constructor(message, statusCode = 502, retryAfterMs = null) {
        super(message);
        this.name = 'RecommendationError';
        this.statusCode = statusCode;
        this.retryAfterMs = retryAfterMs;
    }
}

function cacheKey(conditionKey, petType) {
    const type = (petType || 'all').trim().toLowerCase() || 'all';
    const marketplace = creatorsApi.getMarketplace();
    return `rec:${conditionKey}:${type}:${marketplace}`;
}

function extractItems(response) {
    const body = response && response.searchResult ? response : response?.data;
    const searchResult = body?.searchResult || body?.SearchResult || {};
    return searchResult.items || searchResult.Items || [];
}

function extractPrice(item) {
    const listings = item?.offersV2?.listings || item?.OffersV2?.Listings || [];
    const listing = listings[0];
    if (!listing) return null;

    const price = listing.price || listing.Price;
    if (!price) return null;

    const money = price.money || price.Money;
    const displayAmount = money?.displayAmount || money?.DisplayAmount;
    if (displayAmount) return displayAmount;

    const amount = money?.amount ?? money?.Amount;
    if (amount == null || amount === '') return null;

    const numeric = Number(amount);
    if (Number.isNaN(numeric)) return null;

    const currency = money?.currency || money?.Currency || 'USD';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numeric);
    } catch (_err) {
        return `$${numeric.toFixed(2)}`;
    }
}

function extractRating(item) {
    const starRating = item?.customerReviews?.starRating || item?.CustomerReviews?.StarRating;
    if (starRating == null) return null;
    if (typeof starRating === 'number') return starRating;
    const value = starRating.value ?? starRating.Value;
    if (value == null || value === '') return null;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
}

function extractImage(item) {
    const primary = item?.images?.primary || item?.Images?.Primary;
    return (
        primary?.large?.url ||
        primary?.Large?.URL ||
        primary?.medium?.url ||
        primary?.Medium?.URL ||
        primary?.small?.url ||
        null
    );
}

function buildAffiliateUrl(item) {
    if (item?.detailPageURL) return item.detailPageURL;
    if (item?.DetailPageURL) return item.DetailPageURL;

    const asin = item?.asin || item?.ASIN;
    if (!asin) return null;

    const marketplace = creatorsApi.getMarketplace();
    const tag = creatorsApi.getPartnerTag();
    const tagQuery = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return `https://${marketplace}/dp/${asin}${tagQuery}`;
}

function mapItem(item) {
    const asin = item?.asin || item?.ASIN;
    const title = item?.itemInfo?.title?.displayValue || item?.ItemInfo?.Title?.DisplayValue;
    const url = buildAffiliateUrl(item);

    if (!asin || !title || !url) return null;

    return {
        asin,
        title,
        image: extractImage(item),
        price: extractPrice(item),
        rating: extractRating(item),
        url,
    };
}

function parseRetryAfterMs(error) {
    const header = error?.response?.headers?.['retry-after'] || error?.response?.header?.['retry-after'];
    if (header) {
        const seconds = Number(header);
        if (!Number.isNaN(seconds) && seconds > 0) {
            return seconds * 1000;
        }
    }
    return 60 * 1000;
}

function classifyApiError(error) {
    const status = error?.status || error?.statusCode || error?.response?.status;
    const message = error?.message || String(error);

    if (status === 429 || /too many requests|throttle/i.test(message)) {
        consecutiveThrottleErrors += 1;
        const retryAfterMs = parseRetryAfterMs(error);
        if (consecutiveThrottleErrors >= 3) {
            circuitOpenUntil = Date.now() + Math.max(retryAfterMs, 5 * 60 * 1000);
        }
        return new RecommendationError(
            'Amazon is rate-limiting requests. Please try again shortly.',
            429,
            retryAfterMs
        );
    }

    if (status === 401 || status === 403 || /unauthorized|forbidden|authentication/i.test(message)) {
        return new RecommendationError('Amazon Creators API authentication failed.', 502);
    }

    if (status === 400 || /invalid|validation/i.test(message)) {
        return new RecommendationError('Amazon rejected the product search request.', 502);
    }

    return new RecommendationError('Unable to fetch Amazon recommendations right now.', 502);
}

async function respectCooldown() {
    const now = Date.now();
    if (now - lastApiHitTimestamp < MIN_COOLDOWN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_COOLDOWN_MS - (now - lastApiHitTimestamp)));
    }
}

async function searchAmazon(conditionKey, petType) {
    if (!creatorsApi.isConfigured()) {
        throw new RecommendationError(
            'Amazon Creators API is not configured. Add live credentials on the server.',
            503
        );
    }

    if (Date.now() < circuitOpenUntil) {
        throw new RecommendationError(
            'Amazon recommendations are temporarily paused after repeated rate limits.',
            429,
            circuitOpenUntil - Date.now()
        );
    }

    const config = getConditionConfig(conditionKey);
    const keywords = buildKeywords(conditionKey, petType);
    const api = creatorsApi.getApi();

    await respectCooldown();
    lastApiHitTimestamp = Date.now();

    const request = new SearchItemsRequestContent();
    request.partnerTag = creatorsApi.getPartnerTag();
    request.keywords = keywords;
    request.searchIndex = config.searchIndex;
    request.itemCount = 8;
    request.resources = [
        'images.primary.medium',
        'images.primary.large',
        'itemInfo.title',
        'offersV2.listings.price',
        'customerReviews.starRating',
    ];

    const response = await api.searchItems(creatorsApi.getMarketplace(), request);

    consecutiveThrottleErrors = 0;
    circuitOpenUntil = 0;

    return extractItems(response).map(mapItem).filter(Boolean);
}

async function getRecommendations(conditionKey, petType) {
    const normalizedKey = String(conditionKey || '').trim();
    if (!getConditionConfig(normalizedKey)) {
        throw new RecommendationError(
            `Unknown condition. Valid keys: ${getConditionKeys().join(', ')}`,
            400
        );
    }

    const key = cacheKey(normalizedKey, petType);
    const cached = cache.get(key);
    if (cached) {
        return {
            condition: normalizedKey,
            products: cached.products,
            cached: true,
            cacheTtlSeconds: cache.getTtl(key)
                ? Math.max(0, Math.round((cache.getTtl(key) - Date.now()) / 1000))
                : CACHE_TTL_SECONDS,
        };
    }

    if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
    }

    const pending = (async () => {
        try {
            const products = await searchAmazon(normalizedKey, petType);
            cache.set(
                key,
                { products },
                products.length > 0 ? CACHE_TTL_SECONDS : EMPTY_CACHE_TTL_SECONDS
            );
            return {
                condition: normalizedKey,
                products,
                cached: false,
                cacheTtlSeconds: products.length > 0 ? CACHE_TTL_SECONDS : EMPTY_CACHE_TTL_SECONDS,
            };
        } catch (error) {
            const mapped = error instanceof RecommendationError ? error : classifyApiError(error);
            throw mapped;
        } finally {
            pendingRequests.delete(key);
        }
    })();

    pendingRequests.set(key, pending);
    return pending;
}

module.exports = {
    getRecommendations,
    RecommendationError,
    CACHE_TTL_SECONDS,
};
