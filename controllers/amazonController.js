const amazonService = require('../services/amazonService');
const Click = require('../models/Click');

/**
 * @desc    Search Amazon products
 * @route   GET /api/amazon/search
 * @access  Private
 */
exports.searchAmazon = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a search keyword'
            });
        }

        const products = await amazonService.searchProducts(q);

        res.status(200).json({
            success: true,
            count: products.length,
            data: { products }
        });
    } catch (error) {
        console.error('Amazon Search Controller Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products from Amazon'
        });
    }
};

/**
 * @desc    Track click on affiliate link
 * @route   POST /api/amazon/click
 * @access  Private
 */
exports.trackClick = async (req, res, next) => {
    try {
        const { productId, productTitle, affiliateLink } = req.body;

        const click = await Click.create({
            userId: req.user.id,
            productId,
            productTitle,
            affiliateLink
        });

        res.status(201).json({
            success: true,
            data: click
        });
    } catch (error) {
        next(error);
    }
};
