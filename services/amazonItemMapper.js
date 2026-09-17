const PRODUCT_RESOURCES = [
    'browseNodeInfo.browseNodes',
    'customerReviews.starRating',
    'customerReviews.count',
    'images.primary.large',
    'images.primary.highRes',
    'images.variants.large',
    'images.variants.highRes',
    'itemInfo.title',
    'itemInfo.features',
    'itemInfo.byLineInfo',
    'itemInfo.productInfo',
    'itemInfo.manufactureInfo',
    'itemInfo.classifications',
    'itemInfo.technicalInfo',
    'parentASIN',
    'offersV2.listings.price',
    'offersV2.listings.availability',
    'offersV2.listings.condition',
    'offersV2.listings.merchantInfo',
    'offersV2.listings.dealDetails',
];

function displayValue(field) {
    if (field == null || field === '') return null;
    if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') {
        return field;
    }
    return field.displayValue ?? field.DisplayValue ?? field.value ?? field.Value ?? null;
}

function pickImageUrl(imageSizeGroup) {
    if (!imageSizeGroup) return null;
    return (
        imageSizeGroup.hiRes?.url ||
        imageSizeGroup.highRes?.url ||
        imageSizeGroup.large?.url ||
        imageSizeGroup.medium?.url ||
        imageSizeGroup.small?.url ||
        imageSizeGroup.HiRes?.URL ||
        imageSizeGroup.Large?.URL ||
        null
    );
}

function extractImages(item) {
    const urls = [];
    const seen = new Set();
    const add = (url) => {
        if (url && !seen.has(url)) {
            seen.add(url);
            urls.push(url);
        }
    };

    add(pickImageUrl(item?.images?.primary || item?.Images?.Primary));
    const variants = item?.images?.variants || item?.Images?.Variants || [];
    variants.forEach((variant) => add(pickImageUrl(variant)));
    return urls;
}

function extractPrice(item) {
    const listing = item?.offersV2?.listings?.[0] || item?.OffersV2?.Listings?.[0];
    const money = listing?.price?.money || listing?.Price?.Money;
    if (!money) {
        return { amount: null, display: null, savings: null, savingsPercent: null };
    }

    let amount = null;
    const rawAmount = money.amount ?? money.Amount;
    if (rawAmount != null && rawAmount !== '') {
        const numeric = Number(rawAmount);
        amount = Number.isNaN(numeric) ? null : numeric;
    }

    const savingsObj = listing?.price?.savings || listing?.Price?.Savings;
    const savingsDisplay = savingsObj?.money?.displayAmount
        || savingsObj?.Money?.DisplayAmount
        || savingsObj?.displayAmount
        || null;
    const savingsPercent = savingsObj?.percentage ?? savingsObj?.Percentage ?? null;

    return {
        amount,
        display: money.displayAmount || money.DisplayAmount || (amount != null ? `$${amount.toFixed(2)}` : null),
        savings: savingsDisplay,
        savingsPercent,
    };
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

function extractFeatures(item) {
    const features = item?.itemInfo?.features || item?.ItemInfo?.Features;
    const values = features?.displayValues || features?.DisplayValues || features?.displayValue;
    if (Array.isArray(values)) return values.filter(Boolean);
    if (typeof values === 'string' && values.trim()) return [values.trim()];
    return [];
}

function formatDimension(dim) {
    if (!dim) return null;
    const value = dim.displayValue ?? dim.DisplayValue;
    const unit = dim.unit ?? dim.Unit;
    if (value == null) return null;
    return unit ? `${value} ${unit}` : String(value);
}

function extractSpecs(item) {
    const info = item?.itemInfo?.productInfo || item?.ItemInfo?.ProductInfo || {};
    const manufacture = item?.itemInfo?.manufactureInfo || item?.ItemInfo?.ManufactureInfo || {};
    const classifications = item?.itemInfo?.classifications || item?.ItemInfo?.Classifications || {};
    const specs = [];
    const push = (label, value) => {
        if (value != null && String(value).trim()) specs.push({ label, value: String(value).trim() });
    };

    push('Color', displayValue(info.color || info.Color));
    push('Size', displayValue(info.size || info.Size));
    const unitCount = info.unitCount?.displayValue ?? info.unitCount?.value ?? info.UnitCount?.DisplayValue;
    push('Item count', unitCount);
    const dims = info.itemDimensions || info.ItemDimensions || {};
    push('Height', formatDimension(dims.height || dims.Height));
    push('Length', formatDimension(dims.length || dims.Length));
    push('Width', formatDimension(dims.width || dims.Width));
    push('Weight', formatDimension(dims.weight || dims.Weight));
    push('Model', displayValue(manufacture.model || manufacture.Model));
    push('Part number', displayValue(manufacture.itemPartNumber || manufacture.ItemPartNumber));
    push('Warranty', displayValue(manufacture.warranty || manufacture.Warranty));
    push('Product group', displayValue(classifications.productGroup || classifications.ProductGroup));
    if (item?.asin || item?.ASIN) push('ASIN', item.asin || item.ASIN);
    if (item?.parentASIN || item?.ParentASIN) push('Parent ASIN', item.parentASIN || item.ParentASIN);
    return specs;
}

function extractCategory(item) {
    const nodes = item?.browseNodeInfo?.browseNodes || item?.BrowseNodeInfo?.BrowseNodes || [];
    const node = nodes[0];
    return node?.displayName || node?.DisplayName || node?.contextFreeName || null;
}

function mapCreatorItem(item) {
    const asin = item?.asin || item?.ASIN;
    const title = displayValue(item?.itemInfo?.title || item?.ItemInfo?.Title);
    const url = item?.detailPageURL || item?.DetailPageURL;
    if (!asin || !title || !url) return null;

    const images = extractImages(item);
    const price = extractPrice(item);
    const features = extractFeatures(item);
    const listing = item?.offersV2?.listings?.[0] || item?.OffersV2?.Listings?.[0];
    const brand = displayValue(item?.itemInfo?.byLineInfo?.brand)
        || displayValue(item?.itemInfo?.byLineInfo?.manufacturer)
        || displayValue(item?.itemInfo?.manufactureInfo?.name)
        || displayValue(item?.ItemInfo?.ByLineInfo?.Brand);

    const reviewsCount = item?.customerReviews?.count
        ?? item?.CustomerReviews?.Count
        ?? 0;
    const dealBadge = listing?.dealDetails?.badge || listing?.DealDetails?.Badge || null;

    return {
        id: asin,
        asin,
        title,
        image: images[0] || null,
        images,
        price: price.amount,
        priceDisplay: price.display,
        savings: price.savings,
        savingsPercent: price.savingsPercent,
        rating: extractRating(item),
        reviewsCount,
        features,
        description: features.length ? features.join('\n') : null,
        brand: brand || null,
        category: extractCategory(item),
        availability: listing?.availability?.message || listing?.Availability?.Message || null,
        condition: listing?.condition?.value
            || listing?.condition?.subCondition
            || listing?.Condition?.Value
            || 'New',
        merchant: listing?.merchantInfo?.name || listing?.MerchantInfo?.Name || null,
        dealBadge,
        specs: extractSpecs(item),
        link: url,
    };
}

function toMarketplaceItem(product, extras = {}) {
    if (!product) return null;
    const images = (product.images && product.images.length)
        ? product.images
        : [product.image].filter(Boolean);

    return {
        _id: `amazon_${product.asin || product.id}`,
        asin: product.asin || product.id,
        title: product.title,
        description: product.description
            || (product.features && product.features.length ? product.features.join('\n') : ''),
        brand: product.brand || '',
        price: product.price,
        priceDisplay: product.priceDisplay || null,
        currency: 'USD',
        category: extras.category || product.category || 'Other',
        condition: product.condition || 'New',
        images,
        features: product.features || [],
        specs: product.specs || [],
        address: 'Online',
        affiliateLink: product.link,
        isAffiliate: true,
        rating: product.rating,
        reviewsCount: product.reviewsCount || 0,
        availability: product.availability || null,
        merchant: product.merchant || null,
        savings: product.savings || null,
        savingsPercent: product.savingsPercent || null,
        dealBadge: product.dealBadge || null,
        source: 'creators-api',
        status: 'Available',
        views: 0,
        isExternal: true,
    };
}

module.exports = {
    PRODUCT_RESOURCES,
    mapCreatorItem,
    toMarketplaceItem,
};
