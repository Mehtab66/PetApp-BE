const amazonService = require('../services/amazonService');
const Click = require('../models/Click');
const { buildPetSearch, rankAndFilter } = require('../services/petSearchQuery');

/**
 * @desc    Search Amazon products
 * @route   GET /api/amazon/search
 * @access  Private
 */
exports.searchAmazon = async (req, res, next) => {
    try {
        const { q, petType, petBreed, page } = req.query;
        const petSearch = buildPetSearch({ petType, petBreed, search: q });
        if (!petSearch.keyword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a search keyword or select a pet'
            });
        }

        const pageNum = Math.min(Math.max(parseInt(page, 10) || 1, 1), 10);
        const amazonPage = await amazonService.searchPage(petSearch.keyword, {
            page: pageNum,
            sortBy: 'Relevance',
        });
        const products = rankAndFilter(amazonPage.products, petSearch.profile);

        res.status(200).json({
            success: true,
            count: products.length,
            data: {
                products,
                page: pageNum,
                hasMore: Boolean(amazonPage.hasMore),
            }
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
 * @desc    Get a single Amazon product by ASIN via Creators API GetItems
 * @route   GET /api/amazon/items/:asin
 * @access  Private
 */
exports.getAmazonItem = async (req, res, next) => {
    try {
        const product = await amazonService.getProductByAsin(req.params.asin);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Amazon product not found',
            });
        }

        res.status(200).json({
            success: true,
            data: { product },
        });
    } catch (error) {
        console.error('Amazon GetItem Controller Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch Amazon product details',
        });
    }
};

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
