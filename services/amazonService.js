const NodeCache = require('node-cache');
const { SearchItemsRequestContent } = require('amazon-creators-api');
const creatorsApi = require('../config/creatorsApi');

const CACHE_TTL_SECONDS = 45 * 60;
const EMPTY_CACHE_TTL_SECONDS = 5 * 60;
const MIN_COOLDOWN_MS = 1000;

const myCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 120 });
const pendingRequests = new Map();

let lastApiHitTimestamp = 0;
let circuitOpenUntil = 0;

function extractItems(response) {
    const body = response && response.searchResult ? response : response?.data;
    const searchResult = body?.searchResult || body?.SearchResult || {};
    return searchResult.items || searchResult.Items || [];
}

function extractNumericPrice(item) {
    const listings = item?.offersV2?.listings || [];
    const price = listings[0]?.price;
    if (!price) return null;

    const money = price.money || {};
    if (money.amount != null && money.amount !== '') {
        const numeric = Number(money.amount);
        return Number.isNaN(numeric) ? null : numeric;
    }

    if (!money.displayAmount) return null;
    const parsed = parseFloat(String(money.displayAmount).replace(/[^0-9.]/g, ''));
    return Number.isNaN(parsed) ? null : parsed;
}

function extractRating(item) {
    const starRating = item?.customerReviews?.starRating;
    if (starRating == null) return null;
    if (typeof starRating === 'number') return starRating;
    const value = starRating.value;
    if (value == null || value === '') return null;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
}

function mapItem(item) {
    const asin = item?.asin;
    const title = item?.itemInfo?.title?.displayValue;
    const url = item?.detailPageURL;
    if (!asin || !title || !url) return null;

    const primary = item?.images?.primary;
    return {
        id: asin,
        title,
        image: primary?.large?.url || primary?.medium?.url || null,
        price: extractNumericPrice(item),
        rating: extractRating(item),
        reviewsCount: item?.customerReviews?.count || 0,
        link: url,
    };
}

async function respectCooldown() {
    const now = Date.now();
    if (now - lastApiHitTimestamp < MIN_COOLDOWN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_COOLDOWN_MS - (now - lastApiHitTimestamp)));
    }
}

const amazonService = {
    searchProducts: async (keyword) => {
        const cleanKeyword = (keyword || '').trim().toLowerCase();
        if (!cleanKeyword) return [];

        if (Date.now() < circuitOpenUntil) {
            console.log('[AMAZON_LOG] Circuit breaker open — skipping Creators API call');
            return [];
        }

        const cacheKey = `search_${cleanKeyword.replace(/\s+/g, '_')}`;
        const cachedResults = myCache.get(cacheKey);
        if (cachedResults) {
            console.log(`[AMAZON_LOG] Cache hit for "${cleanKeyword}"`);
            return cachedResults;
        }

        if (pendingRequests.has(cacheKey)) {
            return pendingRequests.get(cacheKey);
        }

        const performSearch = async () => {
            try {
                if (!creatorsApi.isConfigured()) {
                    console.warn('[AMAZON_LOG] Creators API is not configured. Set CREATORS_CREDENTIAL_ID, CREATORS_CREDENTIAL_SECRET, CREATORS_CREDENTIAL_VERSION, and CREATORS_PARTNER_TAG.');
                    return [];
                }

                await respectCooldown();
                lastApiHitTimestamp = Date.now();
                console.log(`[AMAZON_LOG] Searching Creators API for "${cleanKeyword}"`);

                const request = new SearchItemsRequestContent();
                request.partnerTag = creatorsApi.getPartnerTag();
                request.keywords = cleanKeyword;
                request.searchIndex = 'PetSupplies';
                request.itemCount = 10;
                request.resources = [
                    'images.primary.medium',
                    'images.primary.large',
                    'itemInfo.title',
                    'offersV2.listings.price',
                    'customerReviews.starRating',
                    'customerReviews.count',
                ];

                const api = creatorsApi.getApi();
                const data = await api.searchItems(creatorsApi.getMarketplace(), request);
                const results = extractItems(data).map(mapItem).filter(Boolean);

                myCache.set(
                    cacheKey,
                    results,
                    results.length > 0 ? CACHE_TTL_SECONDS : EMPTY_CACHE_TTL_SECONDS
                );
                return results;
            } catch (err) {
                const errorMessage = err.message || String(err);
                console.error('[AMAZON_LOG] Creators API error:', errorMessage);

                if (/unauthorized|authentication|forbidden|401|403/i.test(errorMessage)) {
                    circuitOpenUntil = Date.now() + 15 * 60 * 1000;
                    console.warn('[AMAZON_LOG] Auth failed — pausing Amazon search for 15 minutes');
                }

                if (/too many requests|throttle|429/i.test(errorMessage)) {
                    circuitOpenUntil = Date.now() + 5 * 60 * 1000;
                }

                return [];
            } finally {
                pendingRequests.delete(cacheKey);
            }
        };

        const requestPromise = performSearch();
        pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    },
};

console.log('[AMAZON_LOG] Search backend: Creators API (PA-API disabled)');

module.exports = amazonService;
