const HealthRecord = require('../models/HealthRecord');
const Pet = require('../models/Pet');

/**
 * Health Record Controller
 * Handles health record CRUD operations
 */

/**
 * @desc    Get all health records for a pet
 * @route   GET /api/health/:petId
 * @access  Private
 */
exports.getHealthRecords = async (req, res, next) => {
    try {
        // Verify pet belongs to user
        const pet = await Pet.findOne({
            _id: req.params.petId,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found',
            });
        }

        const records = await HealthRecord.find({ petId: req.params.petId })
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: records.length,
            data: { records },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single health record
 * @route   GET /api/health/record/:id
 * @access  Private
 */
exports.getHealthRecordById = async (req, res, next) => {
    try {
        const record = await HealthRecord.findById(req.params.id)
            .populate('petId', 'name type');

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Health record not found',
            });
        }

        // Verify pet belongs to user
        const pet = await Pet.findOne({
            _id: record.petId,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this record',
            });
        }

        res.status(200).json({
            success: true,
            data: { record },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create health record
 * @route   POST /api/health/:petId
 * @access  Private
 */
exports.createHealthRecord = async (req, res, next) => {
    try {
        // Verify pet belongs to user
        const pet = await Pet.findOne({
            _id: req.params.petId,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found',
            });
        }

        const recordData = {
            ...req.body,
            petId: req.params.petId,
        };

        const record = await HealthRecord.create(recordData);

        res.status(201).json({
            success: true,
            message: 'Health record created successfully',
            data: { record },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update health record
 * @route   PUT /api/health/record/:id
 * @access  Private
 */
exports.updateHealthRecord = async (req, res, next) => {
    try {
        let record = await HealthRecord.findById(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Health record not found',
            });
        }

        // Verify pet belongs to user
        const pet = await Pet.findOne({
            _id: record.petId,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this record',
            });
        }

        record = await HealthRecord.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Health record updated successfully',
            data: { record },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete health record
 * @route   DELETE /api/health/record/:id
 * @access  Private
 */
exports.deleteHealthRecord = async (req, res, next) => {
    try {
        const record = await HealthRecord.findById(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Health record not found',
            });
        }

        // Verify pet belongs to user
        const pet = await Pet.findOne({
            _id: record.petId,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this record',
            });
        }

        await HealthRecord.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Health record deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};
