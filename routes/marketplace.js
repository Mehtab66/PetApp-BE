const express = require('express');
const router = express.Router();
const {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    getMyListings,
    searchAmazonProducts,
    importSelectedProducts
} = require('../controllers/marketplaceController');
const { protect } = require('../middleware/auth');
const { uploadMarketplace, handleUploadError } = require('../middleware/upload');

router.use(protect);

router.route('/')
    .get(getItems)
    .post(uploadMarketplace, handleUploadError, createItem);

router.get('/my/listings', getMyListings);
router.get('/amazon/search', searchAmazonProducts);
router.post('/amazon/import', importSelectedProducts);

router.route('/:id')
    .get(getItem)
    .put(uploadMarketplace, handleUploadError, updateItem)
    .delete(deleteItem);

module.exports = router;
