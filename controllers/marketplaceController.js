const MarketplaceItem = require('../models/MarketplaceItem');
const amazonService = require('../services/amazonService');

/**
 * @desc    Get all marketplace items with filters
 * @route   GET /api/marketplace
 * @access  Private
 */
exports.getItems = async (req, res, next) => {
    try {
        const { category, search, minPrice, maxPrice, sortBy } = req.query;

        // Only show available Amazon products
        let query = { status: 'Available' };

        if (category && category !== 'All' && category !== '') query.category = category;
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }
        if (search) query.$text = { $search: search };

        let sortOption = { createdAt: -1 };
        if (sortBy === 'price_low') sortOption = { price: 1 };
        else if (sortBy === 'price_high') sortOption = { price: -1 };
        else if (sortBy === 'rating') sortOption = { rating: -1 };

        let items = await MarketplaceItem.find(query).sort(sortOption);

        // DYNAMIC AMAZON INJECTION:
        // If the DB has fewer than 5 results for this query, supplement with live Amazon results
        if (search || items.length < 5) {
            const amazonKeyword = search
                || (category && category !== 'All' ? `pet ${category}` : 'pet supplies best sellers');

            console.log(`[MARKETPLACE] Supplementing with Amazon results for: "${amazonKeyword}"`);
            const amazonProducts = await amazonService.searchProducts(amazonKeyword);

            // Map Amazon products to the new schema format for the frontend
            const existingAsins = new Set(items.map(i => i.asin).filter(Boolean));
            const formattedAmazonItems = amazonProducts
                .filter(p => !existingAsins.has(p.id)) // avoid duplicates
                .map(p => ({
                    _id: `amazon_${p.id}`,
                    asin: p.id,
                    title: p.title,
                    description: `Rated ${p.rating}⭐ by ${p.reviewsCount} customers on Amazon.`,
                    brand: p.brand || '',
                    price: p.price,
                    currency: 'USD',
                    category: category && category !== 'All' ? category : 'Other',
                    images: [p.image],
                    affiliateLink: p.link,
                    rating: p.rating,
                    reviewsCount: p.reviewsCount,
                    prime: p.prime || false,
                    source: 'pa-api',
                    status: 'Available',
                    views: 0,
                    isExternal: true // temporary/live result not stored in DB
                }));

            items = [...items, ...formattedAmazonItems];
        }

        res.status(200).json({
            success: true,
            count: items.length,
            data: { items }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single item
 * @route   GET /api/marketplace/:id
 * @access  Private
 */
exports.getItem = async (req, res, next) => {
    try {
        // External/live Amazon items have no DB record
        if (req.params.id.startsWith('amazon_')) {
            return res.status(200).json({
                success: true,
                data: {
                    item: {
                        _id: req.params.id,
                        isExternal: true,
                        title: 'Amazon Product',
                        description: 'Click "Buy on Amazon" to see full product details.',
                        price: 0,
                        images: []
                    }
                }
            });
        }

        const item = await MarketplaceItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Track views
        item.views += 1;
        await item.save();

        res.status(200).json({
            success: true,
            data: { item }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Manually create/seed a product (Admin use)
 * @route   POST /api/marketplace
 * @access  Private (Admin)
 */
exports.createItem = async (req, res, next) => {
    try {
        const itemData = req.body.data ? JSON.parse(req.body.data) : req.body;
        const images = req.files ? req.files.map(file => file.path) : (itemData.images || []);

        const item = await MarketplaceItem.create({
            ...itemData,
            images,
            source: itemData.source || 'manual',
        });

        res.status(201).json({
            success: true,
            data: { item }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update a product (Admin use)
 * @route   PUT /api/marketplace/:id
 * @access  Private (Admin)
 */
exports.updateItem = async (req, res, next) => {
    try {
        let item = await MarketplaceItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const itemData = req.body.data ? JSON.parse(req.body.data) : req.body;

        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.path);
            itemData.images = [...(item.images || []), ...newImages];
        }

        item = await MarketplaceItem.findByIdAndUpdate(req.params.id, itemData, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: { item }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete a product (Admin use)
 * @route   DELETE /api/marketplace/:id
 * @access  Private (Admin)
 */
exports.deleteItem = async (req, res, next) => {
    try {
        const item = await MarketplaceItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        await item.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Product removed'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Search products live on Amazon (without saving to DB)
 * @route   GET /api/marketplace/amazon/search
 * @access  Private
 */
exports.searchAmazonProducts = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ success: false, message: 'Search term required' });
        }

        const products = await amazonService.searchProducts(q);

        res.status(200).json({
            success: true,
            count: products.length,
            data: { products }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Import Amazon products into DB (persist them)
 * @route   POST /api/marketplace/amazon/import
 * @access  Private (Admin)
 */
exports.importSelectedProducts = async (req, res, next) => {
    try {
        const { products } = req.body;

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No products provided for import'
            });
        }

        const importedItems = [];
        const skippedAsins = [];

        for (const prod of products) {
            // Skip if ASIN already exists in DB
            if (prod.id || prod.asin) {
                const asin = prod.id || prod.asin;
                const exists = await MarketplaceItem.findOne({ asin });
                if (exists) {
                    skippedAsins.push(asin);
                    continue;
                }
            }

            const newItem = await MarketplaceItem.create({
                asin: prod.id || prod.asin || null,
                title: prod.title,
                description: prod.description || `Rated ${prod.rating}⭐ by ${prod.reviewsCount || 0} customers on Amazon.`,
                brand: prod.brand || '',
                price: prod.price || 0,
                currency: 'USD',
                category: prod.category || 'Other',
                images: prod.image ? [prod.image] : (prod.images || []),
                affiliateLink: prod.link || prod.affiliateLink || '',
                rating: prod.rating || 0,
                reviewsCount: prod.reviewsCount || 0,
                prime: prod.prime || false,
                source: 'pa-api',
                status: 'Available',
                lastSyncedAt: new Date(),
            });

            importedItems.push(newItem);
        }

        res.status(201).json({
            success: true,
            count: importedItems.length,
            skipped: skippedAsins.length,
            message: `Imported ${importedItems.length} product(s). Skipped ${skippedAsins.length} duplicate(s).`,
            data: { items: importedItems }
        });
    } catch (error) {
        next(error);
    }
};
