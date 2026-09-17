const NodeCache = require('node-cache');
const { SearchItemsRequestContent, GetItemsRequestContent } = require('amazon-creators-api');
const creatorsApi = require('../config/creatorsApi');
const { PRODUCT_RESOURCES, mapCreatorItem } = require('./amazonItemMapper');

const CACHE_TTL_SECONDS = 45 * 60;
const EMPTY_CACHE_TTL_SECONDS = 5 * 60;
const MIN_COOLDOWN_MS = 1000;

const myCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 120 });
const pendingRequests = new Map();

let lastApiHitTimestamp = 0;
let circuitOpenUntil = 0;

function extractSearchItems(response) {
    const body = response && response.searchResult ? response : response?.data;
    const searchResult = body?.searchResult || body?.SearchResult || {};
    return searchResult.items || searchResult.Items || [];
}

function extractGetItems(response) {
    const body = response?.itemsResult || response?.data?.itemsResult || response;
    const items = body?.items || body?.Items || [];
    return items;
}

async function respectCooldown() {
    const now = Date.now();
    if (now - lastApiHitTimestamp < MIN_COOLDOWN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_COOLDOWN_MS - (now - lastApiHitTimestamp)));
    }
}

function handleApiError(err, context) {
    const errorMessage = err.message || String(err);
    console.error(`[AMAZON_LOG] ${context}:`, errorMessage);

    if (/unauthorized|authentication|forbidden|401|403/i.test(errorMessage)) {
        circuitOpenUntil = Date.now() + 15 * 60 * 1000;
        console.warn('[AMAZON_LOG] Auth failed — pausing Amazon calls for 15 minutes');
    }
    if (/too many requests|throttle|429/i.test(errorMessage)) {
        circuitOpenUntil = Date.now() + 5 * 60 * 1000;
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
        if (cachedResults) return cachedResults;
        if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

        const performSearch = async () => {
            try {
                if (!creatorsApi.isConfigured()) {
                    console.warn('[AMAZON_LOG] Creators API is not configured.');
                    return [];
                }

                await respectCooldown();
                lastApiHitTimestamp = Date.now();

                const request = new SearchItemsRequestContent();
                request.partnerTag = creatorsApi.getPartnerTag();
                request.keywords = cleanKeyword;
                request.searchIndex = 'PetSupplies';
                request.itemCount = 10;
                request.resources = PRODUCT_RESOURCES;

                const api = creatorsApi.getApi();
                const data = await api.searchItems(creatorsApi.getMarketplace(), request);
                const results = extractSearchItems(data).map(mapCreatorItem).filter(Boolean);

                myCache.set(cacheKey, results, results.length > 0 ? CACHE_TTL_SECONDS : EMPTY_CACHE_TTL_SECONDS);
                results.forEach((product) => {
                    if (product?.asin) {
                        myCache.set(`item_${product.asin}`, product, CACHE_TTL_SECONDS);
                    }
                });
                return results;
            } catch (err) {
                handleApiError(err, 'SearchItems failed');
                return [];
            } finally {
                pendingRequests.delete(cacheKey);
            }
        };

        const requestPromise = performSearch();
        pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    },

    getProductByAsin: async (asin) => {
        const cleanAsin = String(asin || '').replace(/^amazon_/i, '').trim();
        if (!cleanAsin) return null;

        if (Date.now() < circuitOpenUntil) return null;

        const cacheKey = `item_${cleanAsin}`;
        const cached = myCache.get(cacheKey);
        if (cached) return cached;
        if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

        const performLookup = async () => {
            try {
                if (!creatorsApi.isConfigured()) return null;

                await respectCooldown();
                lastApiHitTimestamp = Date.now();

                const request = new GetItemsRequestContent(creatorsApi.getPartnerTag(), [cleanAsin]);
                request.resources = PRODUCT_RESOURCES;

                const api = creatorsApi.getApi();
                const data = await api.getItems(creatorsApi.getMarketplace(), request);
                const item = extractGetItems(data)[0];
                const mapped = item ? mapCreatorItem(item) : null;

                if (mapped) myCache.set(cacheKey, mapped, CACHE_TTL_SECONDS);
                return mapped;
            } catch (err) {
                handleApiError(err, `GetItems failed for ${cleanAsin}`);
                return null;
            } finally {
                pendingRequests.delete(cacheKey);
            }
        };

        const requestPromise = performLookup();
        pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    },
};

console.log('[AMAZON_LOG] Search backend: Creators API (PA-API disabled)');

module.exports = amazonService;
