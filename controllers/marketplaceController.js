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
        let query = { status: 'Available' };

        // Category filter
        if (category && category !== 'All' && category !== '') {
            query.category = category;
        }

        // Condition filter
        if (condition && condition !== 'All') {
            query.condition = condition;
        }

        // Price range filter
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        // Text search
        if (search) {
            query.$text = { $search: search };
        }

        // Location filter
        if (lat && lng && radius && radius !== 'Anywhere') {
            const radInKm = parseFloat(radius);
            if (!isNaN(radInKm)) {
                // Use $geoWithin with $centerSphere for reliable distance filtering 
                // and to allow custom sorting (unlike $near which forces distance sort)
                query.location = {
                    $geoWithin: {
                        $centerSphere: [
                            [parseFloat(lng), parseFloat(lat)],
                            radInKm / 6378.1 // Convert km to radians
                        ]
                    }
                };
            }
        }

        // Sorting logic
        let sortOption = { createdAt: -1 }; // Default: Newest first
        if (sortBy === 'price_low') sortOption = { price: 1 };
        else if (sortBy === 'price_high') sortOption = { price: -1 };
        else if (sortBy === 'oldest') sortOption = { createdAt: 1 };
        else if (sortBy === 'views') sortOption = { views: -1 };

        const items = await MarketplaceItem.find(query)
            .populate('sellerId', 'name photo')
            .sort(sortOption);

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
