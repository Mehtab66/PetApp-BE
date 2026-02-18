const Pet = require('../models/Pet');
const axios = require('axios');
const path = require('path');
/**
 * @desc    Get activity ideas for a pet based on breed and age using AI (Grok)
 * @route   GET /api/pets/:id/activities
 * @access  Private
 */
exports.getPetActivities = async (req, res, next) => {
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

        const ageDetails = pet.age ? `${pet.age} years old` : 'age unknown';
        const prompt = `Suggest 5 fun and engaging activities tailored specifically for a ${ageDetails} ${pet.breed || ''} ${pet.type}. 
        Format your response as a valid JSON array of objects, where each object has:
        - "title": A short, catchy title for the activity.
        - "description": A brief description of how to do the activity (1-2 sentences).
        - "duration": Estimated duration (e.g., "15-30 mins").
        - "difficulty": "Easy", "Medium", or "Hard".
        - "benefits": A short string listing strict benefits (e.g., "Mental stimulation, Exercise").
        
        Do not include any markdown formatting (like \`\`\`json), just the raw JSON string.`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a pet activity expert. You provide specific, safe, and engaging activity ideas for pets tailored to their breed, age, and type. You always respond with valid JSON arrays.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let content = response.data.choices[0].message.content;

        // Clean up potential markdown formatting if the model disobeys
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        let activities;
        try {
            activities = JSON.parse(content);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Raw Content:', content);
            // Fallback if JSON parsing fails
            activities = [
                {
                    title: "Fetch",
                    description: "Classic game of fetch with a ball or toy.",
                    duration: "15-20 mins",
                    difficulty: "Easy",
                    benefits: "Exercise, Bonding"
                },
                {
                    title: "Hide and Seek",
                    description: "Hide treats around the room and let your pet find them.",
                    duration: "10-15 mins",
                    difficulty: "Easy",
                    benefits: "Mental Stimulation"
                }
            ];
        }

        res.status(200).json({
            success: true,
            data: { activities },
        });

    } catch (error) {
        if (error.response) {
            console.error('Groq API Error Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Groq API Error:', error.message);
        }

        res.status(error.response?.status || 500).json({
            success: false,
            message: 'Failed to fetch activity ideas',
            error: error.message
        });
    }
};
