const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getRecommendations } = require('../controllers/recommendationController');
const { protect } = require('../middleware/auth');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many recommendation requests, please try again later.',
        data: [],
    },
});

router.use(protect);
router.get('/', limiter, getRecommendations);

module.exports = router;
