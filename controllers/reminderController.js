const Reminder = require('../models/Reminder');
const Pet = require('../models/Pet');

/**
 * Reminder Controller
 * Handles reminder CRUD operations
 */

/**
 * @desc    Get all reminders for authenticated user
 * @route   GET /api/reminders
 * @access  Private
 */
exports.getAllReminders = async (req, res, next) => {
    try {
        const { status, petId } = req.query;

        const query = { userId: req.user.id };

        // Filter by completion status
        if (status === 'completed') {
            query.isCompleted = true;
        } else if (status === 'pending') {
            query.isCompleted = false;
        }

        // Filter by pet
        if (petId) {
            query.petId = petId;
        }

        const reminders = await Reminder.find(query)
            .populate('petId', 'name type photo')
            .sort({ date: 1, time: 1 });

        res.status(200).json({
            success: true,
            count: reminders.length,
            data: { reminders },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single reminder
 * @route   GET /api/reminders/:id
 * @access  Private
 */
exports.getReminderById = async (req, res, next) => {
    try {
        const reminder = await Reminder.findOne({
            _id: req.params.id,
            userId: req.user.id,
        }).populate('petId', 'name type photo');

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found',
            });
        }

        res.status(200).json({
            success: true,
            data: { reminder },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create reminder
 * @route   POST /api/reminders
 * @access  Private
 */
exports.createReminder = async (req, res, next) => {
    try {
        // Verify pet belongs to user
        const pet = await Pet.findOne({
            _id: req.body.petId,
            userId: req.user.id,
        });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found',
            });
        }

        const reminderData = {
            ...req.body,
            userId: req.user.id,
        };

        const reminder = await Reminder.create(reminderData);

        // Populate pet details
        await reminder.populate('petId', 'name type photo');

        res.status(201).json({
            success: true,
            message: 'Reminder created successfully',
            data: { reminder },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update reminder
 * @route   PUT /api/reminders/:id
 * @access  Private
 */
exports.updateReminder = async (req, res, next) => {
    try {
        let reminder = await Reminder.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found',
            });
        }

        // If updating petId, verify new pet belongs to user
        if (req.body.petId && req.body.petId !== reminder.petId.toString()) {
            const pet = await Pet.findOne({
                _id: req.body.petId,
                userId: req.user.id,
            });

            if (!pet) {
                return res.status(404).json({
                    success: false,
                    message: 'Pet not found',
                });
            }
        }

        reminder = await Reminder.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        ).populate('petId', 'name type photo');

        res.status(200).json({
            success: true,
            message: 'Reminder updated successfully',
            data: { reminder },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete reminder
 * @route   DELETE /api/reminders/:id
 * @access  Private
 */
exports.deleteReminder = async (req, res, next) => {
    try {
        const reminder = await Reminder.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found',
            });
        }

        await Reminder.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Reminder deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mark reminder as completed
 * @route   PATCH /api/reminders/:id/complete
 * @access  Private
 */
exports.markCompleted = async (req, res, next) => {
    try {
        const reminder = await Reminder.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found',
            });
        }

        await reminder.markCompleted();
        await reminder.populate('petId', 'name type photo');

        res.status(200).json({
            success: true,
            message: 'Reminder marked as completed',
            data: { reminder },
        });
    } catch (error) {
        next(error);
    }
};
