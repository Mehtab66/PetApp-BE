const WeightLog = require('../models/WeightLog');
const Pet = require('../models/Pet');
const axios = require('axios');

/**
 * @desc    Get all weight logs for a specific pet
 * @route   GET /api/weight/:petId
 * @access  Private
 */
exports.getWeightLogs = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({ _id: req.params.petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        const logs = await WeightLog.find({ petId: req.params.petId })
            .sort({ date: 1 }); // Chronological order for charting

        res.status(200).json({
            success: true,
            count: logs.length,
            data: { logs },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Add a new weight log
 * @route   POST /api/weight/:petId
 * @access  Private
 */
exports.addWeightLog = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({ _id: req.params.petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        const { weight, unit, date, notes } = req.body;

        const weightLog = await WeightLog.create({
            petId: req.params.petId,
            userId: req.user.id,
            weight,
            unit: unit || pet.weightUnit, // Default to pet's preferred unit
            date: date || Date.now(),
            notes
        });

        // Also update the Pet's current weight to match the latest log
        pet.weight = weight;
        pet.weightUnit = unit || pet.weightUnit;
        await pet.save();

        res.status(201).json({
            success: true,
            data: weightLog,
        });
    } catch (error) {
        next(error);
    }
};


/**
 * @desc    Analyze pet weight trend using AI
 * @route   GET /api/weight/:petId/analyze
 * @access  Private
 */
exports.analyzeWeightTrend = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({ _id: req.params.petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        const logs = await WeightLog.find({ petId: req.params.petId }).sort({ date: 1 });

        if (logs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No weight data available to analyze. Please add some weight logs first.'
            });
        }

        // Calculate age from dateOfBirth if available, else fall back to stored age field
        let ageDetails = 'age unknown';
        if (pet.dateOfBirth) {
            const today = new Date();
            const birth = new Date(pet.dateOfBirth);
            let years = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years--;
            const months = ((today.getFullYear() - birth.getFullYear()) * 12) + (today.getMonth() - birth.getMonth());
            if (years < 1) {
                ageDetails = `${Math.max(months, 1)} month${months !== 1 ? 's' : ''} old`;
            } else {
                ageDetails = `${years} year${years !== 1 ? 's' : ''} old`;
            }
        } else if (pet.age) {
            ageDetails = `${pet.age} years old`;
        }

        const currentWeight = pet.weight ? `Current weight on file: ${pet.weight} ${pet.weightUnit}.` : '';
        const breedInfo = pet.breed ? `${pet.breed} ` : '';
        const genderInfo = pet.gender && pet.gender !== 'Unknown' ? `, ${pet.gender}` : '';
        const weightHistory = logs.map(l => `${l.weight} ${l.unit} on ${l.date.toISOString().split('T')[0]}`).join(', ');

        const prompt = `You are an expert veterinary assistant AI.
        The pet's name is ${pet.name}, a ${ageDetails}${genderInfo} ${breedInfo}${pet.type}. ${currentWeight}
        Weight history (chronological): ${weightHistory}.

        Tasks:
        1. Comment on whether the weight trend (gaining, losing, stable) looks healthy for ${pet.name}'s age, breed, and size.
        2. Note whether the current weight appears to be in a healthy range for a ${breedInfo}${pet.type} of this age.
        3. Give one brief, practical tip if relevant.

        Write 2-3 sentences addressed to the owner, mentioning ${pet.name} by name. Be warm, encouraging, and concise. Do NOT diagnose medical conditions. Do NOT use markdown.`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a supportive and knowledgeable veterinary AI assistant.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.5,
                max_tokens: 150
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let analysis = response.data.choices[0].message.content.trim();

        res.status(200).json({
            success: true,
            data: { analysis },
        });

    } catch (error) {
        console.error('Weight Analysis Error:', error.message || error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze weight trend',
            error: error.message
        });
    }
};
