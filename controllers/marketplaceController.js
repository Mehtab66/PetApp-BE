const MarketplaceItem = require('../models/MarketplaceItem');
const User = require('../models/User');

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

        // ... filters ...
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

        // MAGIC SEEDER: If the store is empty, automatically seed some best-selling products
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
                    sellerId: req.user.id // Assign to current user as placeholder
                },
                {
                    title: 'Memory Foam Orthopedic Pet Bed',
                    description: 'Ultra-soft memory foam with a removable, washable cover. Perfect for senior pets.',
                    price: 79.00,
                    category: 'Beds & Furniture',
                    condition: 'New',
                    images: ['https://images.unsplash.com/photo-1591946614421-1fbf121fca3c?w=500'],
                    address: 'Amazon Global',
                    location: { type: 'Point', coordinates: [0, 0] },
                    isAffiliate: true,
                    affiliateLink: 'https://amzn.to/example2',
                    status: 'Available',
                    sellerId: req.user.id
                },
                {
                    title: 'Natural Grain-Free Salmon & Sweet Potato',
                    description: 'High-protein, grain-free formula for sensitive stomachs.',
                    price: 45.99,
                    category: 'Food & Treats',
                    condition: 'New',
                    images: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500'],
                    address: 'Amazon Global',
                    location: { type: 'Point', coordinates: [0, 0] },
                    isAffiliate: true,
                    affiliateLink: 'https://amzn.to/example3',
                    status: 'Available',
                    sellerId: req.user.id
                }
            ];

            // Create items and add them to the local 'items' array
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
        const item = await MarketplaceItem.findById(req.params.id)
            .populate('sellerId', 'name photo email phone');

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        // Increment views
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

        // Make sure user is owner
        if (item.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this item'
            });
        }

        const itemData = req.body.data ? JSON.parse(req.body.data) : req.body;

        // Handle images if any
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
 * @desc    Search products on Amazon (Simulated / PA-API placeholder)
 * @route   GET /api/marketplace/amazon/search
 * @access  Private
 */
exports.searchAmazonProducts = async (req, res, next) => {
    try {
        const { q } = req.query;

        // Mock data for "WOW" effect and demonstration
        // In production, this would call Amazon PA-API or a 3rd party service
        const mockProducts = [
            {
                id: 'B08F2V1N62',
                title: `${q || 'Pet'} Healthy Grain-Free Dry Dog Food`,
                description: 'Natural ingredients, high protein, and essential vitamins for your pup.',
                price: 45.99,
                image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&q=80&w=500',
                link: 'https://www.amazon.com/dp/B08F2V1N62',
                category: 'Food & Treats',
                rating: 4.8
            },
            {
                id: 'B07H8N3Q2G',
                title: `Interactive ${q || 'Pet'} Plush Chew Toy`,
                description: 'Durable, squeaky, and perfect for aggressive chewers.',
                price: 12.50,
                image: 'https://images.unsplash.com/photo-1576201836106-041d501f3c5e?auto=format&fit=crop&q=80&w=500',
                link: 'https://www.amazon.com/dp/B07H8N3Q2G',
                category: 'Toys',
                rating: 4.5
            },
            {
                id: 'B01N26A18Q',
                title: `Orthopedic ${q || 'Pet'} Bed for Large Dogs`,
                description: 'Memory foam base providing maximum comfort and joint support.',
                price: 89.00,
                image: 'https://images.unsplash.com/photo-1591946614421-1fbf121fca3c?auto=format&fit=crop&q=80&w=500',
                link: 'https://www.amazon.com/dp/B01N26A18Q',
                category: 'Beds & Furniture',
                rating: 4.9
            },
            {
                id: 'B07ZPCMK78',
                title: `Self-Cleaning ${q || 'Pet'} Slicker Brush`,
                description: 'Effective tool for deshedding and grooming cats and dogs.',
                price: 15.99,
                image: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&q=80&w=500',
                link: 'https://www.amazon.com/dp/B07ZPCMK78',
                category: 'Health & Grooming',
                rating: 4.7
            }
        ];

        res.status(200).json({
            success: true,
            data: { products: mockProducts }
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
                description: prod.description,
                price: prod.price,
                category: prod.category || 'Other',
                condition: 'New',
                images: [prod.image],
                address: 'Online',
                location: {
                    type: 'Point',
                    coordinates: [0, 0] // Default for online/global items
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
