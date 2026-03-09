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

        const ageDetails = pet.age ? `${pet.age} years old` : 'age unknown';
        const weightHistory = logs.map(l => `${l.weight} ${l.unit} on ${l.date.toISOString().split('T')[0]}`).join(', ');

        const prompt = `You are an expert veterinary assistant AI.
        Assess the weight history for a ${ageDetails} ${pet.breed || ''} ${pet.type}.
        The recorded weight history (in chronological order) is: ${weightHistory}.
        
        Is this weight trend healthy? Are they at a healthy weight overall for their breed/age?
        Provide a short, empathetic, and encouraging 2-3 sentence summary addressed to the owner. Do not diagnose medical conditions, just assess the trend.
        DO NOT include markdown, just return plain text.`;

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
