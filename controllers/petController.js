const Pet = require('../models/Pet');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

/**
 * Pet Controller
 * Handles pet profile CRUD operations
 */

/**
 * @desc    Get breeds for a pet type using AI (Grok)
 * @route   GET /api/pets/breeds/:type
 * @access  Private
 */
exports.getBreedsByType = async (req, res, next) => {
    try {
        const { type } = req.params;

        if (!type) {
            return res.status(400).json({
                success: false,
                message: 'Pet type is required',
            });
        }

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a pet breed expert. Return ONLY a comma-separated list of popular and existing breeds for the given pet type. No introductory text, no numbered lists, just the names separated by commas. If there are many, return the top 50.'
                    },
                    {
                        role: 'user',
                        content: `List all breeds around the world for the pet type: ${type}.`
                    }
                ],
                temperature: 0
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const breedsContent = response.data.choices[0].message.content;
        const breeds = breedsContent.split(',')
            .map(breed => breed.trim())
            .filter(breed => breed.length > 0);

        res.status(200).json({
            success: true,
            data: { breeds },
        });
    } catch (error) {
        if (error.response) {
            console.error('Groq API Error Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Groq API Error:', error.message);
        }

        res.status(error.response?.status || 500).json({
            success: false,
            message: 'Failed to fetch breeds from AI',
            error: error.message
        });
    }
};

/**
 * @desc    Get all pets for authenticated user
 * @route   GET /api/pets
 * @access  Private
 */
exports.getAllPets = async (req, res, next) => {
    try {
        const pets = await Pet.find({ userId: req.user.id, isActive: true })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: pets.length,
            data: { pets },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single pet by ID
 * @route   GET /api/pets/:id
 * @access  Private
 */
exports.getPetById = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found',
            });
        }

        res.status(200).json({
            success: true,
            data: { pet },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create new pet
 * @route   POST /api/pets
 * @access  Private
 */
exports.createPet = async (req, res, next) => {
    try {
        const petData = {
            ...req.body,
            userId: req.user.id,
        };

        const pet = await Pet.create(petData);

        res.status(201).json({
            success: true,
            message: 'Pet created successfully',
            data: { pet },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update pet
 * @route   PUT /api/pets/:id
 * @access  Private
 */
exports.updatePet = async (req, res, next) => {
    try {
        let pet = await Pet.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found',
            });
        }

        pet = await Pet.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Pet updated successfully',
            data: { pet },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete pet
 * @route   DELETE /api/pets/:id
 * @access  Private
 */
exports.deletePet = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found',
            });
        }

        // Soft delete
        pet.isActive = false;
        await pet.save();

        res.status(200).json({
            success: true,
            message: 'Pet deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Upload pet photo
 * @route   POST /api/pets/:id/photo
 * @access  Private
 */
exports.uploadPhoto = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found',
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a file',
            });
        }

        // Update pet with new photo path (Cloudinary URL)
        pet.photo = req.file.path;
        await pet.save();

        res.status(200).json({
            success: true,
            message: 'Photo uploaded successfully',
            data: {
                pet,
                photoUrl: pet.photo,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Assign or generate tag ID for a pet
 * @route   PUT /api/pets/:id/tag
 * @access  Private
 */
const crypto = require('crypto');

exports.assignTagId = async (req, res, next) => {
    try {
        let pet = await Pet.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found',
            });
        }

        if (!pet.tagId) {
            pet.tagId = crypto.randomBytes(4).toString('hex').toUpperCase();
        }

        await pet.save();

        res.status(200).json({
            success: true,
            message: 'Tag ID assigned successfully',
            data: { tagId: pet.tagId },
        });
    } catch (error) {
        next(error);
    }
};

