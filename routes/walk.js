const express = require('express');
const {
    getWalkLogs,
    saveWalkLog,
    toggleFavoriteStatus,
    deleteWalkLog
} = require('../controllers/walkController');

const router = express.Router();

const { protect } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(protect);

router.route('/:petId')
    .get(getWalkLogs)
    .post(saveWalkLog);

router.route('/:id')
    .delete(deleteWalkLog);

router.route('/:id/favorite')
    .put(toggleFavoriteStatus);

module.exports = router;
