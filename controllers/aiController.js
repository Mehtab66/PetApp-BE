const axios = require('axios');
const Pet = require('../models/Pet');
const HealthRecord = require('../models/HealthRecord');
const Roadmap = require('../models/Roadmap');

/**
 * AI Controller
 * Handles generic chat, AI Doctor, and Pet Roadmap features
 */

/**
 * @desc    Get AI response for pet health query
 * @route   POST /api/ai/chat
 * @access  Private
 */
exports.getChatResponse = async (req, res, next) => {
    try {
        const { message, petId, history, isDoctorMode } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required',
            });
        }

        let systemPrompt = '';

        if (isDoctorMode) {
            // High-context Doctor Mode
            let petContext = 'You are AI Dr. Pet, a specialized veterinary AI who has access to the user\'s specific pet data.';

            if (petId) {
                const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
                if (pet) {
                    petContext += `\n\nPATIENT PROFILE:
- Name: ${pet.name}
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years
- Weight: ${pet.weight || 'Unknown'} ${pet.weightUnit}
- Health Notes: ${pet.notes || 'None'}`;

                    const healthRecords = await HealthRecord.find({ petId }).sort({ date: -1 }).limit(5);
                    if (healthRecords.length > 0) {
                        petContext += `\n\nRECENT MEDICAL HISTORY:`;
                        healthRecords.forEach(record => {
                            petContext += `\n- ${new Date(record.date).toLocaleDateString()}: ${record.title} (${record.type})`;
                            if (record.diagnosis) petContext += ` | Dx: ${record.diagnosis}`;
                            if (record.treatment) petContext += ` | Tx: ${record.treatment}`;
                        });
                    }
                }
            } else {
                const pets = await Pet.find({ userId: req.user.id, isActive: true });
                if (pets.length > 0) {
                    petContext += `\n\nUSER'S PETS: ${pets.map(p => `${p.name} (${p.type})`).join(', ')}`;
                    petContext += `\n\nAsk the user which pet they are inquiring about to provide specific medical advice.`;
                }
            }

            systemPrompt = `${petContext}

GOAL: Provide clinical-grade (but safe) veterinary advice. Analyze records if provided.
CLEAN FORMATTING: No asterisks, use bullet points (•), be professional and precise.`;

        } else {
            // Generic AI Mode
            systemPrompt = `You are a helpful Pet Care Assistant. Use a friendly tone. 
Provide general advice about pets. If a situation sounds urgent, suggest a vet.
CLEAN FORMATTING: No asterisks, use bullet points (•), use clear paragraphs.`;
        }

        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            });
        }

        messages.push({ role: 'user', content: message });

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let aiMessage = response.data.choices[0].message.content;
        aiMessage = aiMessage.replace(/\*\*/g, '').replace(/\*/g, '');

        res.status(200).json({
            success: true,
            data: { message: aiMessage.trim() },
        });
    } catch (error) {
        console.error('AI Chat Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: 'Failed to get AI response',
            error: error.message
        });
    }
};

/**
 * @desc    Generate or get 30-day AI Health Roadmap for a pet
 * @route   POST /api/ai/roadmap/:petId
 * @access  Private
 */
exports.getHealthRoadmap = async (req, res, next) => {
    try {
        const { petId } = req.params;
        const { forceNew } = req.body;

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        // Check for existing latest roadmap
        const existingRoadmap = await Roadmap.findOne({ petId, isLatest: true });

        if (existingRoadmap && !forceNew) {
            return res.status(200).json({
                success: true,
                data: {
                    roadmap: existingRoadmap.content,
                    isExisting: true,
                    createdAt: existingRoadmap.createdAt
                }
            });
        }

        const healthRecords = await HealthRecord.find({ petId }).sort({ date: -1 }).limit(10);

        let previousContext = '';
        if (existingRoadmap && forceNew) {
            const daysSinceOld = Math.floor((new Date() - new Date(existingRoadmap.createdAt)) / (1000 * 60 * 60 * 24));
            previousContext = `\n\nPREVIOUS PLAN CONTEXT:
The user previously followed a plan generated ${daysSinceOld} days ago. 
Old Plan Summary: ${existingRoadmap.content.substring(0, 300)}...
Please provide an updated plan that builds upon the previous progress or adjusts based on the ${daysSinceOld} days passed.`;
        }

        const prompt = `You are an expert Veterinary Strategist & Pet Nutritionist.
Generate a high-proficiency, structured 30-day Health & Meal Roadmap for this pet:
NAME: ${pet.name}
SPECIES: ${pet.type}
BREED: ${pet.breed || 'Unknown'}
AGE: ${pet.calculatedAge || pet.age || 'Unknown'} years
WEIGHT: ${pet.weight} ${pet.weightUnit}
HISTORY: ${healthRecords.map(r => r.title).join(', ')}${previousContext}

THE ROADMAP MUST INCLUDE:
1. Vitality Score (1-100): An assessment of current health based on data.
2. Top 3 Health Priorities: Specific clinical or behavioral areas to focus on.
3. Week-by-Week Action Plan: 4 weeks of specific health goals.
4. AI Meal Plan (High Precision): Daily calories, ingredients recommendation, and a "Meal Schedule" based on ${pet.type} requirements.
5. Exercise & Mental Stimulation: Specific routine (walks, play, training) for this breed.
6. Symptom Watchlist: What specific red flags to look for based on this pet's breed and age.

CLEAN FORMATTING:
- DO NOT use asterisks (**) or markdown bolding.
- Use clear headers like [1. VITALITY SCORE].
- Use bullet points (•) for lists.
- Maintain a professional, expert veterinary tone.`;


        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.7,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let roadmapContent = response.data.choices[0].message.content;
        roadmapContent = roadmapContent.replace(/\*\*/g, '').replace(/\*/g, '');

        // Mark previous plans as not latest
        await Roadmap.updateMany({ petId }, { isLatest: false });

        // Save new roadmap
        const newRoadmap = await Roadmap.create({
            userId: req.user.id,
            petId: petId,
            content: roadmapContent,
            isLatest: true
        });

        res.status(200).json({
            success: true,
            data: {
                roadmap: newRoadmap.content,
                isExisting: false,
                createdAt: newRoadmap.createdAt
            }
        });
    } catch (error) {
        console.error('AI Roadmap Error:', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: 'Failed to generate roadmap',
            error: error.message
        });
    }
};
