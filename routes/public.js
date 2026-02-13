const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

/**
 * Public Routes
 * Accessible without authentication
 */

// @route   GET /scan/:tagId
// @desc    Get pet profile by tag ID (HTML View)
// @access  Public
router.get('/scan/:tagId', publicController.renderScanPage);

// @route   GET /api/public/pet/:tagId
// @desc    Get pet profile by tag ID
// @access  Public
router.get('/pet/:tagId', publicController.getPetByTagId);

// @route   POST /api/public/pet/:tagId/scan
// @desc    Report pet scan location
// @access  Public
// router.post('/pet/:tagId/scan', publicController.reportScan);

module.exports = router;
