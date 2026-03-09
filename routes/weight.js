const express = require('express');
const router = express.Router();
const weightController = require('../controllers/weightController');
const { protect } = require('../middleware/auth');

/**
 * Weight Tracking Routes
 */

// @route   GET /api/weight/:petId
router.get('/:petId', protect, weightController.getWeightLogs);

// @route   POST /api/weight/:petId
router.post('/:petId', protect, weightController.addWeightLog);

// @route   GET /api/weight/:petId/analyze
router.get('/:petId/analyze', protect, weightController.analyzeWeightTrend);

module.exports = router;
