const AmazonPaapi = require('amazon-paapi');
const NodeCache = require('node-cache');

// Aggressive cache: 24 hours (86400 seconds)
// Price/availability doesn't need to be real-time for an affiliate app
const myCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

// Keep track of ongoing requests to prevent "cache stampede" 
// (multiple users searching same term simultaneously)
const pendingRequests = new Map();

// Global cooldown to ensure we don't hit Amazon more than once every 2 seconds
let lastApiHitTimestamp = 0;
const MIN_COOLDOWN_MS = 2000;

const amazonService = {
    searchProducts: async (keyword) => {
        const cleanKeyword = keyword.trim().toLowerCase();
        if (!cleanKeyword) return [];

        const cacheKey = `search_${cleanKeyword.replace(/\s+/g, '_')}`;

        // 1. Check Memory Cache
        const cachedResults = myCache.get(cacheKey);
        if (cachedResults) {
            console.log('🚀 Returning CACHED Amazon results for:', cleanKeyword);
            return cachedResults;
        }

        // 2. Coalescing: Check if a request for this keyword is already in flight
        if (pendingRequests.has(cacheKey)) {
            console.log('⏳ Joining existing ongoing request for:', cleanKeyword);
            return pendingRequests.get(cacheKey);
        }

        // 3. Perform the search
        const performSearch = async () => {
            try {
                // Rate Limiting / Cooldown
                const now = Date.now();
                if (now - lastApiHitTimestamp < MIN_COOLDOWN_MS) {
                    await new Promise(r => setTimeout(r, MIN_COOLDOWN_MS - (now - lastApiHitTimestamp)));
                }

                // API Key check
                if (!process.env.AMAZON_ACCESS_KEY || process.env.AMAZON_ACCESS_KEY.includes('YOUR_KEY')) {
                    console.log('⚠️ Valid Amazon API Key not found. Falling back to mock data.');
                    return amazonService.getMockData(cleanKeyword);
                }

                lastApiHitTimestamp = Date.now();
                console.log('📡 Calling Amazon PA-API for:', cleanKeyword);

                const commonParameters = {
                    'AccessKey': process.env.AMAZON_ACCESS_KEY,
                    'SecretKey': process.env.AMAZON_SECRET_KEY,
                    'PartnerTag': process.env.AMAZON_PARTNER_TAG,
                    'PartnerType': 'Associates',
                    'Marketplace': 'www.amazon.com',
                    'Region': 'us-east-1'
                };

                const requestParameters = {
                    'Keywords': cleanKeyword,
                    'SearchIndex': 'PetSupplies',
                    'ItemCount': 10,
                    'Resources': [
                        'ItemInfo.Title',
                        'Images.Primary.Large',
                        'Offers.Listings.Price',
                        'CustomerReviews.Count',
                        'CustomerReviews.StarRating'
                    ]
                };

                const data = await AmazonPaapi.SearchItems(commonParameters, requestParameters);

                if (!data || !data.SearchResult || !data.SearchResult.Items) {
                    console.warn('Amazon Search returned empty or invalid data.');
                    return amazonService.getMockData(cleanKeyword);
                }

                const results = data.SearchResult.Items.map(item => ({
                    id: item.ASIN,
                    title: item.ItemInfo.Title.DisplayValue,
                    image: item.Images.Primary.Large.URL,
                    price: parseFloat((item.Offers?.Listings?.[0]?.Price?.DisplayAmount || '0').replace(/[^0-9.]/g, '')) || 0,
                    rating: item.CustomerReviews?.StarRating || 'N/A',
                    reviewsCount: item.CustomerReviews?.Count || 0,
                    link: item.DetailPageURL
                }));

                myCache.set(cacheKey, results);
                return results;

            } catch (err) {
                console.error('❌ Amazon Service Error:', err.message || err);
                // ALWAYS return mock data on failure to prevent 500 errors
                return amazonService.getMockData(cleanKeyword);
            } finally {
                pendingRequests.delete(cacheKey);
            }
        };

        const requestPromise = performSearch();
        pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    },

    getMockData: (q) => [
        {
            id: 'B08F2V1Y62',
            title: `${q.charAt(0).toUpperCase() + q.slice(1)} Premium Nutritious Pet Food`,
            image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500',
            price: 34.99,
            rating: 4.8,
            reviewsCount: 1250,
            link: 'https://www.amazon.com/dp/B08F2V1Y62'
        },
        {
            id: 'B07H8N3Q2G',
            title: `${q.charAt(0).toUpperCase() + q.slice(1)} Interactive Durable Chew Toy`,
            image: 'https://images.unsplash.com/photo-1576201836106-041d501f3c5e?w=500',
            price: 12.50,
            rating: 4.5,
            reviewsCount: 890,
            link: 'https://www.amazon.com/dp/B07H8N3Q2G'
        },
        {
            id: 'B01N26A18Q',
            title: `Orthopedic ${q.charAt(0).toUpperCase() + q.slice(1)} Bed for Dogs`,
            image: 'https://images.unsplash.com/photo-1591946614421-1fbf121fca3c?w=500',
            price: 89.00,
            rating: 4.9,
            reviewsCount: 2100,
            link: 'https://www.amazon.com/dp/B01N26A18Q'
        }
    ]
};

module.exports = amazonService;

