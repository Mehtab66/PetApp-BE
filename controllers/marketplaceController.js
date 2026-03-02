const MarketplaceItem = require('../models/MarketplaceItem');
const User = require('../models/User');
const amazonService = require('../services/amazonService');

/**
 * @desc    Get all marketplace items with filters
 * @route   GET /api/marketplace
 * @access  Private
 */
exports.getItems = async (req, res, next) => {
    try {
        const { lat, lng, radius, category, search, minPrice, maxPrice, condition, sortBy } = req.query;
        // Only show Amazon/Affiliate products, eliminate user listings
        let query = { status: 'Available', isAffiliate: true };

        if (category && category !== 'All' && category !== '') query.category = category;
        if (condition && condition !== 'All') query.condition = condition;
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }
        if (search) query.$text = { $search: search };

        let items = await MarketplaceItem.find(query)
            .populate('sellerId', 'name photo')
            .sort(sortBy === 'price_low' ? { price: 1 } : sortBy === 'price_high' ? { price: -1 } : { createdAt: -1 });

        // DYNAMIC AMAZON INJECTION:
        // If searching or browsing global items, fetch fresh results from Amazon to supplement the database
        // This ensures the user always sees products even if we haven't imported them yet.
        if ((!radius || radius === 'Anywhere') && (search || (items.length < 5))) {
            const amazonKeyword = search || (category && category !== 'All' ? `pet ${category}` : 'pet best sellers');

            console.log(`[MARKETPLACE] Supplementing results with Amazon products for: "${amazonKeyword}"`);
            const amazonProducts = await amazonService.searchProducts(amazonKeyword);

            // Map Amazon products to MarketplaceItem format for the frontend
            const formattedAmazonItems = amazonProducts.map(p => ({
                _id: `amazon_${p.id}`,
                title: p.title,
                description: `Amazon Choice: ${p.title}. Rated ${p.rating} by ${p.reviewsCount} users.`,
                price: p.price,
                category: category || 'Other',
                condition: 'New',
                images: [p.image],
                address: 'Amazon Global',
                isAffiliate: true,
                affiliateLink: p.link,
                rating: p.rating,
                reviewsCount: p.reviewsCount,
                isExternal: true // Flag to handle differently in UI if needed
            }));

            // Merge results, avoiding duplicates if possible (by title or ASIN)
            const existingTitles = new Set(items.map(i => i.title.toLowerCase()));
            const uniqueAmazonItems = formattedAmazonItems.filter(ai => !existingTitles.has(ai.title.toLowerCase()));

            items = [...items, ...uniqueAmazonItems];
        }

        // MAGIC SEEDER (Fallback if everything else fails)
        if (items.length === 0 && !search && (!category || category === 'All')) {
            console.log('✨ Marketplace empty, seeding featured items...');
            const featured = [
                {
                    title: 'Interactive Dog Puzzle Toy - Level 2',
                    description: 'Keep your dog engaged and mentally stimulated with this hidden treat puzzle.',
                    price: 24.99,
                    category: 'Toys',
                    condition: 'New',
                    images: ['https://images.unsplash.com/photo-1541591415600-9820bf58299c?w=500'],
                    address: 'Amazon Global',
                    location: { type: 'Point', coordinates: [0, 0] },
                    isAffiliate: true,
                    affiliateLink: 'https://amzn.to/example1',
                    status: 'Available',
                    sellerId: req.user.id
                }
            ];
            for (const f of featured) {
                const newItem = await MarketplaceItem.create(f);
                items.push(newItem);
            }
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
        if (req.params.id.startsWith('amazon_')) {
            // This is a virtual Amazon item from the search supplement
            return res.status(200).json({
                success: true,
                data: {
                    item: {
                        _id: req.params.id,
                        isAffiliate: true,
                        isExternal: true,
                        title: 'Amazon Product',
                        description: 'Please click "Buy on Amazon" to see full details.',
                        price: 0,
                        images: []
                    }
                }
            });
        }

        const item = await MarketplaceItem.findById(req.params.id)
            .populate('sellerId', 'name photo email phone');

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

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
 * @desc    Create new item
 * @route   POST /api/marketplace
 * @access  Private
 */
exports.createItem = async (req, res, next) => {
    try {
        const itemData = JSON.parse(req.body.data);
        const images = req.files ? req.files.map(file => file.path) : [];

        const item = await MarketplaceItem.create({
            ...itemData,
            images,
            sellerId: req.user.id
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
 * @desc    Update item
 * @route   PUT /api/marketplace/:id
 * @access  Private
 */
exports.updateItem = async (req, res, next) => {
    try {
        let item = await MarketplaceItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        if (item.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this item'
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
 * @desc    Delete item
 * @route   DELETE /api/marketplace/:id
 * @access  Private
 */
exports.deleteItem = async (req, res, next) => {
    try {
        const item = await MarketplaceItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        if (item.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this item'
            });
        }

        await item.remove();

        res.status(200).json({
            success: true,
            message: 'Item removed'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get current user Listings
 * @route   GET /api/marketplace/my/listings
 * @access  Private
 */
exports.getMyListings = async (req, res, next) => {
    try {
        const items = await MarketplaceItem.find({ sellerId: req.user.id });

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
 * @desc    Search products on Amazon
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
            data: { products }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Import selected Amazon products
 * @route   POST /api/marketplace/amazon/import
 * @access  Private
 */
exports.importSelectedProducts = async (req, res, next) => {
    try {
        const { products } = req.body;

        if (!products || !Array.isArray(products)) {
            return res.status(400).json({
                success: false,
                message: 'No products provided for import'
            });
        }

        const importedItems = [];

        for (const prod of products) {
            const newItem = await MarketplaceItem.create({
                title: prod.title,
                description: prod.description || `High quality product from Amazon.`,
                price: prod.price,
                category: prod.category || 'Other',
                condition: 'New',
                images: [prod.image],
                address: 'Online',
                location: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                sellerId: req.user.id,
                affiliateLink: prod.link,
                isAffiliate: true,
                status: 'Available'
            });
            importedItems.push(newItem);
        }

        res.status(201).json({
            success: true,
            count: importedItems.length,
            message: `Successfully imported ${importedItems.length} products.`
        });
    } catch (error) {
        next(error);
    }
};
