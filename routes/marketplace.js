const express = require('express');
const router = express.Router();
const {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    searchAmazonProducts,
    importSelectedProducts
} = require('../controllers/marketplaceController');
const { protect } = require('../middleware/auth');
const { uploadMarketplace, handleUploadError } = require('../middleware/upload');

router.use(protect);

// Browse/search products
router.route('/')
    .get(getItems)
    .post(uploadMarketplace, handleUploadError, createItem); // Admin: manually add a product

// Amazon live search (no DB save)
router.get('/amazon/search', searchAmazonProducts);

// Admin: import Amazon search results into DB
router.post('/amazon/import', importSelectedProducts);

// Single product
router.route('/:id')
    .get(getItem)
    .put(uploadMarketplace, handleUploadError, updateItem)
    .delete(deleteItem);

module.exports = router;
