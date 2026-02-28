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

        // 2. Check for Request Coalescing
        // If someone is already searching for this EXACT term, wait for their result
        if (pendingRequests.has(cacheKey)) {
            console.log('⏳ Joining existing ongoing request for:', cleanKeyword);
            return pendingRequests.get(cacheKey);
        }

        // 3. Create a New Request with Coalescing
        const searchPromise = (async () => {
            try {
                // Respect Global Cooldown
                const now = Date.now();
                const timeSinceLastHit = now - lastApiHitTimestamp;
                if (timeSinceLastHit < MIN_COOLDOWN_MS) {
                    const waitTime = MIN_COOLDOWN_MS - timeSinceLastHit;
                    console.log(`🐢 Global Cooldown: Waiting ${waitTime}ms before hitting Amazon...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }

                // If keys are missing, return mock data immediately
                if (!process.env.AMAZON_ACCESS_KEY || process.env.AMAZON_ACCESS_KEY === 'YOUR_KEY' || process.env.AMAZON_ACCESS_KEY.length < 5) {
                    console.warn('⚠️ AMAZON_ACCESS_KEY invalid or missing, using mock data.');
                    return amazonService.getMockData(cleanKeyword);
                }

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

                lastApiHitTimestamp = Date.now();
                console.log('📡 Hitting Official Amazon PA-API for:', cleanKeyword);

                const data = await AmazonPaapi.SearchItems(commonParameters, requestParameters);

                if (!data || !data.SearchResult || !data.SearchResult.Items) {
                    return amazonService.getMockData(cleanKeyword);
                }

                const results = data.SearchResult.Items.map(item => {
                    const priceStr = item.Offers?.Listings?.[0]?.Price?.DisplayAmount || '0';
                    const priceNum = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;

                    return {
                        id: item.ASIN,
                        title: item.ItemInfo.Title.DisplayValue,
                        image: item.Images.Primary.Large.URL,
                        price: priceNum,
                        rating: item.CustomerReviews?.StarRating || 'N/A',
                        reviewsCount: item.CustomerReviews?.Count || 0,
                        link: item.DetailPageURL
                    };
                });

                // Store in cache
                myCache.set(cacheKey, results);
                return results;

            } catch (error) {
                console.error('❌ Amazon PA-API Error:', error.message || error);
                // On error (Rate limit, Auth failure, etc), fallback to high-quality mock data 
                // so the user experience is never broken
                return amazonService.getMockData(cleanKeyword);
            } finally {
                // Cleanup pending requests map
                pendingRequests.delete(cacheKey);
            }
        })();

        // Track this promise so others can join it
        pendingRequests.set(cacheKey, searchPromise);
        return searchPromise;
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

