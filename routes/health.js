const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
    createHealthRecordValidator,
    petIdParamValidator,
    recordIdParamValidator,
} = require('../validators/healthValidator');
const { uploadRecords, handleUploadError } = require('../middleware/upload');

/**
 * Health Record Routes
 * Handles health record CRUD operations
 */

// @route   GET /api/health/:petId
// @desc    Get all health records for a pet
// @access  Private
router.get(
    '/:petId',
    protect,
    petIdParamValidator,
    validate,
    healthController.getHealthRecords
);

// @route   POST /api/health/:petId
// @desc    Create health record
// @access  Private
router.post(
    '/:petId',
    protect,
    petIdParamValidator,
    uploadRecords,
    handleUploadError,
    createHealthRecordValidator,
    validate,
    healthController.createHealthRecord
);

// @route   GET /api/health/record/:id
// @desc    Get single health record
// @access  Private
router.get(
    '/record/:id',
    protect,
    recordIdParamValidator,
    validate,
    healthController.getHealthRecordById
);

// @route   PUT /api/health/record/:id
// @desc    Update health record
// @access  Private
router.put(
    '/record/:id',
    protect,
    recordIdParamValidator,
    uploadRecords,
    handleUploadError,
    createHealthRecordValidator,
    validate,
    healthController.updateHealthRecord
);

// @route   DELETE /api/health/record/:id
// @desc    Delete health record
// @access  Private
router.delete(
    '/record/:id',
    protect,
    recordIdParamValidator,
    validate,
    healthController.deleteHealthRecord
);

module.exports = router;
