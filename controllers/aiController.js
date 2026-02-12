const axios = require('axios');
const Pet = require('../models/Pet');
const HealthRecord = require('../models/HealthRecord');

/**
 * AI Controller
 * Handles both generic and personalized AI queries
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
