const amazonService = require('./amazonService');
const { toMarketplaceItem } = require('./amazonItemMapper');
const { affiliateUrlForAsin, withAffiliateTag } = require('./affiliateLink');

const OWN_ASIN = 'B0GY9WCGHM';
const OWN_SEARCH = 'Astro Buddies';
const OWN_BRAND_TERMS = ['astro buddies', 'astrobuddies', 'astropet', 'astro pet'];
const OWN_SPECIES = new Set(['dog']);

const PINNED_PRODUCT = {
    id: OWN_ASIN,
    asin: OWN_ASIN,
    title: 'Astro Buddies 360° Tangle-Free Strong Dual Retractable Dogs Leash | LED Dog Leashes with One-Hand Brake & Lock For 2 Dogs',
    brand: 'Astro Buddies',
    price: 64.99,
    priceDisplay: '$64.99',
    rating: 2.8,
    reviewsCount: 44,
    category: 'Training & Travel',
    image: `https://images-na.ssl-images-amazon.com/images/P/${OWN_ASIN}.01.L.jpg`,
    images: [
        `https://images-na.ssl-images-amazon.com/images/P/${OWN_ASIN}.01.L.jpg`,
        `https://m.media-amazon.com/images/P/${OWN_ASIN}.jpg`,
    ],
    features: [
        'Walk two dogs with two fully independent 10ft/3m nylon leashes and separate one-hand brake and lock controls.',
        '360° swivel rotating head helps keep the leads from twisting when dogs move in different directions.',
        'Built-in LED front light and reflective stitching on both cords for night walks.',
        'Fits small to medium dogs; durable ABS body with an ergonomic grip.',
        'Includes a poop bag dispenser and accessory clip so you carry less gear.',
    ],
    description: 'Astro Buddies dual retractable leash for two small to medium dogs, with independent brakes, a 360° swivel, LED light, and a built-in waste-bag dispenser.',
    link: affiliateUrlForAsin(OWN_ASIN),
};

function productText(product) {
    return `${product?.brand || ''} ${product?.title || ''}`.toLowerCase();
}

function isOwnBrand(product) {
    const text = productText(product);
    const asin = String(product?.asin || product?.id || '').toUpperCase();
    if (asin === OWN_ASIN) return true;
    return OWN_BRAND_TERMS.some((term) => text.includes(term));
}

function markOwn(product) {
    if (!product) return null;
    const mapped = toMarketplaceItem(product, { category: product.category || 'Training & Travel' });
    if (!mapped) return null;
    mapped.isOwnProduct = true;
    mapped.affiliateLink = withAffiliateTag(mapped.affiliateLink || product.link, mapped.asin);
    return mapped;
}

function uniqueByAsin(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = String(item?.asin || item?._id || '').toUpperCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function loadLivePinned() {
    const product = await amazonService.getProductByAsin(OWN_ASIN);
    return product && isOwnBrand(product) ? product : null;
}

async function searchOwnCatalog() {
    const page = await amazonService.searchPage(OWN_SEARCH, {
        page: 1,
        sortBy: 'Relevance',
    });
    return (page.products || []).filter(isOwnBrand);
}

async function getOwnProducts() {
    const products = [];

    try {
        const livePinned = await loadLivePinned();
        products.push(livePinned || PINNED_PRODUCT);
    } catch (error) {
        console.error('[OWN_PRODUCTS] Pinned lookup failed:', error.message || error);
        products.push(PINNED_PRODUCT);
    }

    try {
        const extras = await searchOwnCatalog();
        extras.forEach((product) => products.push(product));
    } catch (error) {
        console.error('[OWN_PRODUCTS] Brand search failed:', error.message || error);
    }

    const listed = uniqueByAsin(products.map(markOwn).filter(Boolean));
    listed.sort((a, b) => {
        if (a.asin === OWN_ASIN) return -1;
        if (b.asin === OWN_ASIN) return 1;
        return 0;
    });
    return listed;
}

function shouldShowOwnProducts({ petType, search, ownOnly } = {}) {
    if (ownOnly) return true;
    const species = String(petType || '').trim().toLowerCase();
    if (species && !OWN_SPECIES.has(species)) return false;

    const query = String(search || '').trim().toLowerCase();
    if (!query) return true;
    return (
        OWN_BRAND_TERMS.some((term) => query.includes(term)) ||
        query.includes('asto') ||
        query.includes('leash') ||
        query.includes('walk') ||
        query.includes('retractable')
    );
}

function mergeOwnProducts(items, ownItems) {
    const ownAsins = new Set(ownItems.map((item) => item.asin).filter(Boolean));
    const rest = (items || []).filter((item) => !ownAsins.has(item.asin));
    return [...ownItems, ...rest];
}

module.exports = {
    getOwnProducts,
    isOwnBrand,
    shouldShowOwnProducts,
    mergeOwnProducts,
    OWN_ASIN,
};
