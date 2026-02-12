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
IMPORTANT: You are a VETERINARY AI. If the user asks about topics unrelated to pets, animals, or veterinary medicine (e.g., cars, politics, coding, general life advice), kindly refuse and ask them to provide a pet-related prompt.
CLEAN FORMATTING: No asterisks, use bullet points (•), be professional and precise.`;

        } else {
            // Generic AI Mode
            systemPrompt = `You are a helpful Pet Care Assistant. Use a friendly tone. 
Provide general advice about pets. If a situation sounds urgent, suggest a vet.
IMPORTANT: You are specific to PET CARE. If the user asks about non-pet topics (e.g., cars, politics, coding, general life advice), kindly refuse and ask them to provide a pet-related prompt.
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

/**
 * @desc    AI Symptom Checker - Analyze pet symptoms and provide urgency rating
 * @route   POST /api/ai/symptom-check
 * @access  Private
 */
exports.symptomCheck = async (req, res, next) => {
    try {
        const { petId, symptoms, duration } = req.body;

        if (!symptoms) {
            return res.status(400).json({ success: false, message: 'Symptoms are required' });
        }

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        const healthRecords = await HealthRecord.find({ petId }).sort({ date: -1 }).limit(5);

        const prompt = `You are an expert Veterinary Diagnostician.
Analyze these symptoms for a pet:

PET PROFILE:
- Name: ${pet.name}
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years
- Weight: ${pet.weight} ${pet.weightUnit}
- Recent History: ${healthRecords.map(r => r.title).join(', ')}

SYMPTOMS REPORTED:
${symptoms}

DURATION: ${duration || 'Not specified'}

PROVIDE:
1. URGENCY LEVEL: Rate as LOW, MEDIUM, HIGH, or EMERGENCY
2. POSSIBLE CAUSES: List 2-3 most likely causes
3. IMMEDIATE ACTIONS: What the owner should do right now
4. VET VISIT: Should they see a vet? When?
5. HOME CARE: Any safe home remedies or monitoring tips

FORMATTING: No asterisks, use bullet points (•), be clear and calming.`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let analysis = response.data.choices[0].message.content;
        analysis = analysis.replace(/\*\*/g, '').replace(/\*/g, '');

        // Extract urgency level
        const urgencyMatch = analysis.match(/URGENCY LEVEL:\s*(LOW|MEDIUM|HIGH|EMERGENCY)/i);
        const urgency = urgencyMatch ? urgencyMatch[1].toUpperCase() : 'MEDIUM';

        res.status(200).json({
            success: true,
            data: { analysis, urgency }
        });
    } catch (error) {
        console.error('Symptom Check Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to analyze symptoms' });
    }
};

/**
 * @desc    AI Photo Analysis - Analyze pet photo for health issues
 * @route   POST /api/ai/photo-analysis
 * @access  Private
 */
exports.photoAnalysis = async (req, res, next) => {
    try {
        const { petId, photoUrl, concernArea } = req.body;

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        // Note: For full vision analysis, you'd use OpenAI Vision or Google Gemini Vision
        // For now, we'll provide a text-based analysis prompt
        const prompt = `You are a Veterinary Visual Diagnostician.

The owner has ${photoUrl ? 'uploaded a photo' : 'provided details'} of their ${pet.type} (${pet.breed}) focusing on: ${concernArea || 'general health check'}.

Based on common visual indicators for ${pet.type}s, provide:

1. WHAT TO LOOK FOR: Key visual signs of health issues in ${concernArea || 'this area'}
2. NORMAL VS ABNORMAL: Describe what's normal vs concerning
3. COMMON ISSUES: List 3 common problems visible in photos for this breed
4. NEXT STEPS: Should they monitor, take more photos, or see a vet?

Note: Remind them that photo analysis has limitations and in-person vet exams are most accurate.

FORMATTING: No asterisks, use bullet points (•).`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let analysis = response.data.choices[0].message.content;
        analysis = analysis.replace(/\*\*/g, '').replace(/\*/g, '');

        res.status(200).json({
            success: true,
            data: { analysis }
        });
    } catch (error) {
        console.error('Photo Analysis Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to analyze photo' });
    }
};

/**
 * @desc    AI Behavior Decoder & Training Plan
 * @route   POST /api/ai/behavior-training
 * @access  Private
 */
exports.behaviorTraining = async (req, res, next) => {
    try {
        const { petId, behaviorIssue } = req.body;

        if (!behaviorIssue) {
            return res.status(400).json({ success: false, message: 'Behavior issue is required' });
        }

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        const prompt = `You are a Certified Animal Behaviorist.

PET PROFILE:
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years

BEHAVIOR ISSUE:
${behaviorIssue}

PROVIDE A COMPREHENSIVE TRAINING PLAN:

1. ROOT CAUSE ANALYSIS: Why is this happening? (breed tendencies, age factors)
2. 7-DAY TRAINING PLAN: Day-by-day exercises with specific instructions
3. DO's and DON'Ts: Critical mistakes to avoid
4. PROGRESS MARKERS: How to know if it's working
5. WHEN TO GET HELP: Signs you need a professional trainer

FORMATTING: No asterisks, use bullet points (•), be encouraging and specific.`;

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

        let trainingPlan = response.data.choices[0].message.content;
        trainingPlan = trainingPlan.replace(/\*\*/g, '').replace(/\*/g, '');

        res.status(200).json({
            success: true,
            data: { trainingPlan }
        });
    } catch (error) {
        console.error('Behavior Training Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate training plan' });
    }
};

/**
 * @desc    AI Expense Optimizer - Analyze spending and suggest savings
 * @route   POST /api/ai/expense-optimizer
 * @access  Private
 */
exports.expenseOptimizer = async (req, res, next) => {
    try {
        const { petId, expenses, currency = 'USD' } = req.body;

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        // Calculate totals from expenses
        const totalSpent = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
        const expenseBreakdown = expenses?.map(e => `${e.category}: ${currency} ${e.amount}`).join(', ') || 'No data';

        const prompt = `You are a Pet Care Financial Advisor.

PET PROFILE:
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years

CURRENT SPENDING:
Total: ${currency} ${totalSpent}
Breakdown: ${expenseBreakdown}

PROVIDE:

1. SPENDING ANALYSIS: Is this normal for this breed/age?
2. COST-SAVING OPPORTUNITIES: 3-5 specific ways to reduce costs without compromising care
3. ANNUAL PROJECTION: Estimated yearly costs based on current spending
4. BUDGET RECOMMENDATIONS: Ideal monthly budget breakdown
5. HIDDEN COSTS: Common expenses owners forget to budget for

NOTE: All financial figures must be in ${currency}.

FORMATTING: No asterisks, use bullet points (•), be practical and money-conscious.`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let optimization = response.data.choices[0].message.content;
        optimization = optimization.replace(/\*\*/g, '').replace(/\*/g, '');

        res.status(200).json({
            success: true,
            data: { optimization, totalSpent }
        });
    } catch (error) {
        console.error('Expense Optimizer Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to optimize expenses' });
    }
};
