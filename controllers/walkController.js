const WalkLog = require('../models/WalkLog');
const Pet = require('../models/Pet');

// @desc    Get all walk logs for a pet
// @route   GET /api/walks/:petId
// @access  Private
exports.getWalkLogs = async (req, res) => {
    try {
        const pet = await Pet.findById(req.params.petId);

        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        // Ensure user owns the pet
        if (pet.userId.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized to access this pet\'s data' });
        }

        const walks = await WalkLog.find({ petId: req.params.petId }).sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: walks.length,
            data: { walks }
        });
    } catch (err) {
        console.error('Error in getWalkLogs:', err);
        res.status(500).json({ success: false, message: 'Server Error', error: err.message });
    }
};

// @desc    Save a new walk log
// @route   POST /api/walks/:petId
// @access  Private
exports.saveWalkLog = async (req, res) => {
    try {
        const { distance, duration, path, date, notes } = req.body;

        const pet = await Pet.findById(req.params.petId);

        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        // Ensure user owns the pet
        if (pet.userId.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized to log walks for this pet' });
        }

        const walk = await WalkLog.create({
            petId: req.params.petId,
            userId: req.user.id,
            distance,
            duration,
            path,
            date: date || Date.now(),
            notes
        });

        res.status(201).json({
            success: true,
            data: { walk }
        });
    } catch (err) {
        console.error('Error in saveWalkLog:', err);
        res.status(500).json({ success: false, message: 'Server Error', error: err.message });
    }
};

// @desc    Toggle favorite status of a walk
// @route   PUT /api/walks/:id/favorite
// @access  Private
exports.toggleFavoriteStatus = async (req, res) => {
    try {
        let walk = await WalkLog.findById(req.params.id);

        if (!walk) {
            return res.status(404).json({ success: false, message: 'Walk log not found' });
        }

        // Ensure user owns the walk log
        if (walk.userId.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized to update this walk log' });
        }

        walk.isFavorite = !walk.isFavorite;
        await walk.save();

        res.status(200).json({
            success: true,
            data: { walk }
        });
    } catch (err) {
        console.error('Error in toggleFavoriteStatus:', err);
        res.status(500).json({ success: false, message: 'Server Error', error: err.message });
    }
};

// @desc    Delete a walk log
// @route   DELETE /api/walks/:id
// @access  Private
exports.deleteWalkLog = async (req, res) => {
    try {
        const walk = await WalkLog.findById(req.params.id);

        if (!walk) {
            return res.status(404).json({ success: false, message: 'Walk log not found' });
        }

        // Ensure user owns the walk log
        if (walk.userId.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized to delete this walk log' });
        }

        await walk.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Walk log removed'
        });
    } catch (err) {
        console.error('Error in deleteWalkLog:', err);
        res.status(500).json({ success: false, message: 'Server Error', error: err.message });
    }
};
