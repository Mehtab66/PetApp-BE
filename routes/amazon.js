const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { searchAmazon, trackClick } = require('../controllers/amazonController');
const { protect } = require('../middleware/auth');

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many search requests, please try again later.'
    }
});

router.use(protect);

router.get('/search', limiter, searchAmazon);
router.post('/click', trackClick);

module.exports = router;
