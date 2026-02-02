const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');
const { protect } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const validate = require('../middleware/validate');
const {
    createPetValidator,
    updatePetValidator,
    petIdValidator,
} = require('../validators/petValidator');

/**
 * Pet Routes
 * Handles pet profile CRUD operations
 */

// @route   GET /api/pets
// @desc    Get all pets for authenticated user
// @access  Private
router.get('/', protect, petController.getAllPets);

// @route   POST /api/pets
// @desc    Create new pet
// @access  Private
router.post(
    '/',
    protect,
    createPetValidator,
    validate,
    petController.createPet
);

// @route   GET /api/pets/:id
// @desc    Get single pet by ID
// @access  Private
router.get(
    '/:id',
    protect,
    petIdValidator,
    validate,
    petController.getPetById
);

// @route   PUT /api/pets/:id
// @desc    Update pet
// @access  Private
router.put(
    '/:id',
    protect,
    updatePetValidator,
    validate,
    petController.updatePet
);

// @route   DELETE /api/pets/:id
// @desc    Delete pet
// @access  Private
router.delete(
    '/:id',
    protect,
    petIdValidator,
    validate,
    petController.deletePet
);

// @route   POST /api/pets/:id/photo
// @desc    Upload pet photo
// @access  Private
router.post(
    '/:id/photo',
    protect,
    petIdValidator,
    validate,
    uploadSingle,
    handleUploadError,
    petController.uploadPhoto
);

module.exports = router;
