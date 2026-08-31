const axios = require('axios');
const Pet = require('../models/Pet');
const HealthRecord = require('../models/HealthRecord');
const Roadmap = require('../models/Roadmap');
const AIInsight = require('../models/AIInsight');
const PDFDocument = require('pdfkit');
const {
    SYSTEM_SAFETY_INSTRUCTION,
    MEDICAL_DISCLAIMER_TEXT,
    checkDirectMedicationSafety,
    validateAndSanitizeAIResponse
} = require('../services/aiSafety');

/**
 * AI Controller
 * Handles generic chat, personalized pet health guidance, symptom triage, emergency guidance, and roadmaps
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

        // Fast-path guardrail check for direct medication queries
        const directMedSafeResponse = checkDirectMedicationSafety(message);
        if (directMedSafeResponse) {
            return res.status(200).json({
                success: true,
                data: { message: directMedSafeResponse },
            });
        }

        let systemPrompt = '';

        if (isDoctorMode) {
            // High-context Pet Profile Mode
            let petContext = "You are the PetVitals AI Pet Care Assistant with access to the user's specific pet data for educational guidance.";

            if (petId) {
                const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
                if (pet) {
                    petContext += `\n\nPET PROFILE:
- Name: ${pet.name}
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years
- Weight: ${pet.weight || 'Unknown'} ${pet.weightUnit || 'kg'}
- Notes: ${pet.notes || 'None'}`;

                    const healthRecords = await HealthRecord.find({ petId }).sort({ date: -1 }).limit(5);
                    if (healthRecords.length > 0) {
                        petContext += `\n\nRECENT MEDICAL HISTORY (from records):`;
                        healthRecords.forEach(record => {
                            petContext += `\n- ${new Date(record.date).toLocaleDateString()}: ${record.title} (${record.type})`;
                            if (record.diagnosis) petContext += ` | Recorded Dx: ${record.diagnosis}`;
                            if (record.treatment) petContext += ` | Recorded Tx: ${record.treatment}`;
                        });
                    }
                }
            } else {
                const pets = await Pet.find({ userId: req.user.id, isActive: true });
                if (pets.length > 0) {
                    petContext += `\n\nUSER'S PETS: ${pets.map(p => `${p.name} (${p.type})`).join(', ')}`;
                    petContext += `\n\nAsk the user which pet they are inquiring about to provide relevant guidance.`;
                }
            }

            systemPrompt = `${petContext}

${SYSTEM_SAFETY_INSTRUCTION}

GOAL: Provide supportive, educational pet health guidance. Clearly distinguish between mild situations and potential emergencies.
CLEAN FORMATTING: No asterisks, use bullet points (•), be professional, compassionate, and precise.`;

        } else {
            // Generic AI Mode
            systemPrompt = `You are a helpful AI Pet Care Assistant provided by PetVitals. Use a friendly and supportive tone.
${SYSTEM_SAFETY_INSTRUCTION}
Provide general educational advice about pets. If a situation sounds potentially urgent or serious, immediately instruct the user to contact an emergency veterinarian.
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

        const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: messages,
                temperature: 0.6,
                max_tokens: 1024,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let aiMessage = response.data.choices[0].message.content;
        aiMessage = validateAndSanitizeAIResponse(aiMessage, message, 'chat');

        res.status(200).json({
            success: true,
            data: { message: aiMessage },
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

        const prompt = `You are an AI Pet Wellness & Nutrition Specialist.
Generate a high-proficiency, structured 30-day Health & Wellness Roadmap for this pet:
NAME: ${pet.name}
SPECIES: ${pet.type}
BREED: ${pet.breed || 'Unknown'}
AGE: ${pet.calculatedAge || pet.age || 'Unknown'} years
WEIGHT: ${pet.weight} ${pet.weightUnit || 'kg'}
HISTORY: ${healthRecords.map(r => r.title).join(', ')}${previousContext}

${SYSTEM_SAFETY_INSTRUCTION}

THE ROADMAP MUST INCLUDE:
1. Wellness Score (1-100): An estimate of overall wellness based on available owner records.
2. Top 3 Wellness Priorities: Specific daily care or enrichment areas to focus on.
3. Week-by-Week Action Plan: 4 weeks of specific, safe wellness goals.
4. AI Meal & Nutrition Guidance: General caloric guidelines, wholesome ingredient suggestions, and a feeding schedule suitable for ${pet.type}. Advise consulting a veterinarian for significant dietary changes.
5. Exercise & Mental Stimulation: Specific daily routine (walks, play, enrichment) tailored for this breed.
6. Symptom Watchlist: General signs to monitor based on breed tendencies and age that warrant a vet consultation.

CLEAN FORMATTING:
- DO NOT use asterisks (**) or markdown bolding.
- Use clear headers like [1. WELLNESS SCORE].
- Use bullet points (•) for lists.
- Maintain a helpful, educational, and professional tone.`;

        const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let roadmapContent = response.data.choices[0].message.content;
        roadmapContent = validateAndSanitizeAIResponse(roadmapContent, '', 'roadmap');

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
 * @desc    AI Symptom Checker - Triage symptoms and provide urgency classification & guidance
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

        const prompt = `You are an AI Pet Care Assistant providing symptom triage and educational guidance.
Analyze these reported symptoms for educational guidance:

PET PROFILE:
- Name: ${pet.name}
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years
- Weight: ${pet.weight} ${pet.weightUnit || 'kg'}
- Recent History: ${healthRecords.map(r => r.title).join(', ')}

SYMPTOMS REPORTED:
${symptoms}

DURATION: ${duration || 'Not specified'}

${SYSTEM_SAFETY_INSTRUCTION}

PROVIDE:
1. URGENCY LEVEL: Explicitly classify as one of:
   - MONITOR (Mild symptoms suitable for close home monitoring)
   - CONTACT A VETERINARIAN (Non-emergency concern that requires professional veterinary evaluation)
   - URGENT VETERINARY ATTENTION (Potentially serious condition requiring immediate veterinary or ER care)
2. POSSIBLE ASSOCIATIONS: List 2-3 conditions that can be associated with these symptoms.
   IMPORTANT: Never provide a definitive diagnosis or say "Your pet has X". Always use phrasing like: "These symptoms can be associated with several conditions. A licensed veterinarian can evaluate your pet in person to determine the underlying cause."
3. IMMEDIATE ACTIONS: Safe, practical supportive steps the owner can take right now.
4. VETERINARY CONSULTATION: When to see a vet and what questions to ask.
5. HOME MONITORING: What changes or vital signs to watch closely.

FORMATTING: No asterisks, use bullet points (•), be clear, empathetic, and calming.`;

        const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.5,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let analysis = response.data.choices[0].message.content;
        analysis = validateAndSanitizeAIResponse(analysis, symptoms, 'symptom_check');

        // Extract standardized urgency level
        let urgency = 'CONTACT A VETERINARIAN';
        if (/URGENT VETERINARY ATTENTION|EMERGENCY|HIGH/i.test(analysis)) {
            urgency = 'URGENT VETERINARY ATTENTION';
        } else if (/MONITOR|LOW/i.test(analysis)) {
            urgency = 'MONITOR';
        } else {
            urgency = 'CONTACT A VETERINARIAN';
        }

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
 * @desc    AI Behavior & Training Plan
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

        const prompt = `You are an AI Pet Care Assistant specializing in positive-reinforcement training and behavioral guidance.

PET PROFILE:
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years

BEHAVIOR ISSUE:
${behaviorIssue}

${SYSTEM_SAFETY_INSTRUCTION}

PROVIDE A COMPREHENSIVE POSITIVE TRAINING GUIDE:
1. BEHAVIOR OBSERVATION: Potential triggers or patterns based on age and breed tendencies.
   IMPORTANT: Do not make definitive medical or psychiatric diagnoses (e.g. do not say "Your dog has anxiety"). Use phrasing like: "This behavior can sometimes be associated with stress or anxiety, but a veterinarian or qualified behavior professional can evaluate the underlying cause."
2. 7-DAY POSITIVE TRAINING PLAN: Day-by-day positive reinforcement drills with clear, gentle steps.
3. DO's and DON'Ts: Key training mistakes to avoid.
4. PROGRESS MARKERS: Positive signs that indicate improvement.
5. WHEN TO SEEK PROFESSIONAL HELP: When to consult a certified trainer, veterinary behaviorist, or vet to rule out underlying pain/medical causes.

FORMATTING: No asterisks, use bullet points (•), be encouraging, practical, and specific.`;

        const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let trainingPlan = response.data.choices[0].message.content;
        trainingPlan = validateAndSanitizeAIResponse(trainingPlan, behaviorIssue, 'behavior');

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

        const totalSpent = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
        const expenseBreakdown = expenses?.map(e => `${e.category}: ${currency} ${e.amount}`).join(', ') || 'No data';

        const prompt = `You are a Pet Care Financial & Budgeting Assistant.

PET PROFILE:
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years

CURRENT SPENDING:
Total: ${currency} ${totalSpent}
Breakdown: ${expenseBreakdown}

${SYSTEM_SAFETY_INSTRUCTION}

PROVIDE:
1. SPENDING ANALYSIS: General perspective on typical care costs for this breed/age.
2. COST-SAVING OPPORTUNITIES: 3-5 specific ways to economize on food, toys, and supplies without compromising pet health or veterinary care.
3. ANNUAL PROJECTION: Estimated yearly spending based on current patterns.
4. BUDGET RECOMMENDATIONS: Suggested monthly allocation across essentials, enrichment, and a veterinary emergency fund.
5. PREVENTATIVE CARE VALUE: How regular veterinary checkups help avoid costly emergencies.

NOTE: All financial figures must be in ${currency}.
FORMATTING: No asterisks, use bullet points (•), be practical and money-conscious.`;

        const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let optimization = response.data.choices[0].message.content;
        optimization = validateAndSanitizeAIResponse(optimization, '', 'expense');

        res.status(200).json({
            success: true,
            data: { optimization, totalSpent }
        });
    } catch (error) {
        console.error('Expense Optimizer Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to optimize expenses' });
    }
};

/**
 * @desc    AI Nutrition Advisor - Recommend food based on health data
 * @route   POST /api/ai/nutrition-advice
 * @access  Private
 */
exports.nutritionAdvice = async (req, res, next) => {
    try {
        const { petId, healthGoals, currentDiet } = req.body;

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        const healthRecords = await HealthRecord.find({ petId }).sort({ date: -1 }).limit(10);

        const prompt = `You are an AI Pet Care Assistant providing educational pet nutrition and diet guidance.
Analyze the nutritional considerations for this pet:

PET PROFILE:
- Species: ${pet.type}
- Breed: ${pet.breed || 'Unknown'}
- Age: ${pet.calculatedAge || pet.age || 'Unknown'} years
- Weight: ${pet.weight} ${pet.weightUnit || 'kg'}
- Recent Medical History: ${healthRecords.map(r => r.title).join(', ')}

CURRENT DIET: ${currentDiet || 'Not specified'}
HEALTH GOALS: ${healthGoals || 'General wellness and maintenance'}

${SYSTEM_SAFETY_INSTRUCTION}

PROVIDE:
1. GENERAL NUTRITIONAL OVERVIEW: Key nutritional requirements for this life stage and breed.
2. DIETARY CONSIDERATIONS: Wholesome ingredients, macronutrient balance, and food categories (e.g. high-protein, age-appropriate formulas).
3. FEEDING ROUTINE: General portion sizing and daily feeding frequency recommendations.
4. FOODS TO AVOID: Toxic and unsafe ingredients for this species (e.g. chocolate, onions, grapes, xylitol).
5. VETERINARY ADVICE: Explicitly state that for pets with known medical conditions or before making significant dietary transitions, the owner should discuss changes with their veterinarian.

FORMATTING: No asterisks, use bullet points (•), be informative and professional.`;

        const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let advice = response.data.choices[0].message.content;
        advice = validateAndSanitizeAIResponse(advice, '', 'nutrition');

        res.status(200).json({
            success: true,
            data: { advice }
        });
    } catch (error) {
        console.error('Nutrition Advice Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate nutrition advice' });
    }
};

/**
 * @desc    AI Pet Emergency Guide - Safety guidance for emergencies and toxic substances
 * @route   POST /api/ai/first-aid
 * @access  Private
 */
exports.firstAidGuidance = async (req, res, next) => {
    try {
        const { petId, emergencyType, itemInvolved } = req.body;

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });

        let context = pet ? `for a ${pet.type} (${pet.breed || 'Unknown'})` : 'for a pet';

        const prompt = `You are an AI Pet Care Assistant providing emergency safety guidance ${context}.

EMERGENCY / SITUATION: ${emergencyType}
ITEM INVOLVED (if any): ${itemInvolved || 'None'}

${SYSTEM_SAFETY_INSTRUCTION}

GUIDELINES:
1. EMERGENCY VETERINARY PRIORITIZATION: If this is an acute or potentially serious situation, prominently instruct:
   - "Contact an emergency veterinarian immediately."
   - "Find the nearest open veterinary hospital or animal poison control hotline."
2. STABILIZATION & SAFETY:
   - Provide safe, non-invasive first aid steps to keep the pet calm and safe while arranging emergency veterinary care.
   - List critical WHAT NOT TO DO actions (e.g. do not induce vomiting unless explicitly directed by a veterinarian or poison helpline, do not give human medication).
3. TOXICITY WARNING: If a toxic substance is involved, identify common risks and symptoms to watch for.
4. LIMITATIONS: Clearly state that first aid is only for temporary stabilization and is never a substitute for hands-on emergency veterinary treatment. Never claim home treatment is definitely safe.

FORMATTING: Use clear uppercase headers (without asterisks), use bullet points (•), be calm, clear, and prioritize emergency vet contact.`;

        const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.4,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let guidance = response.data.choices[0].message.content;
        guidance = validateAndSanitizeAIResponse(guidance, emergencyType, 'first_aid');

        res.status(200).json({
            success: true,
            data: { guidance }
        });
    } catch (error) {
        console.error('First Aid Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate emergency guidance' });
    }
};

/**
 * @desc    AI Breed Care Guide - Educational breed characteristics and care considerations
 * @route   POST /api/ai/breed-care
 * @access  Private
 */
exports.breedCareTips = async (req, res, next) => {
    try {
        const { petId } = req.body;

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        const prompt = `You are an AI Pet Care Assistant providing breed-specific educational information and general care tips.

SPECIES: ${pet.type}
BREED: ${pet.breed || 'Unknown'}
AGE: ${pet.calculatedAge || pet.age || 'Unknown'} years

${SYSTEM_SAFETY_INSTRUCTION}

PROVIDE:
1. BREED CHARACTERISTICS: General personality, energy levels, and temperament tendencies.
2. GROOMING & COAT CARE: Coat brushing, bathing frequency, and ear/nail hygiene tips.
3. EXERCISE & ACTIVITY: Daily activity needs and recommended play styles.
4. HEALTH CONSIDERATIONS (PROBABILISTIC):
   IMPORTANT: Use probabilistic wording: "Some pets of this breed may be more prone to..." instead of "This breed will develop...". Do not make guaranteed health claims or diagnoses.
5. POSITIVE TRAINING TIPS: Recommended motivational strategies for this breed type.
6. LIFE STAGE WELLNESS: General care advice for their current age stage (${pet.calculatedAge || pet.age} years).

FORMATTING: No asterisks, use bullet points (•), be informative and breed-specific.`;

        const apiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.6,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let guide = response.data.choices[0].message.content;
        guide = validateAndSanitizeAIResponse(guide, '', 'breed_care');

        res.status(200).json({
            success: true,
            data: { guide }
        });
    } catch (error) {
        console.error('Breed Care Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate breed care tips' });
    }
};

/**
 * @desc    Save AI Insight for PDF export
 * @route   POST /api/ai/save-insight
 * @access  Private
 */
exports.saveAIInsight = async (req, res, next) => {
    try {
        const { petId, title, content, type } = req.body;

        if (!petId || !title || !content || !type) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        const insight = await AIInsight.create({
            userId: req.user.id,
            petId,
            title,
            content,
            type
        });

        res.status(201).json({
            success: true,
            data: { insightId: insight._id }
        });
    } catch (error) {
        console.error('Save Insight Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to save insight' });
    }
};

/**
 * @desc    Export AI Insight as PDF with compliance disclaimer
 * @route   GET /api/ai/export-pdf/:insightId
 * @access  Private (Token in query allowed)
 */
exports.exportAIInsightPDF = async (req, res, next) => {
    try {
        const insight = await AIInsight.findById(req.params.insightId)
            .populate('petId')
            .populate('userId', 'name email');

        if (!insight) {
            return res.status(404).json({ success: false, message: 'Insight not found or expired' });
        }

        // Check ownership
        if (insight.userId._id.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const pet = insight.petId;
        const doc = new PDFDocument({ margin: 50 });

        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfData = Buffer.concat(buffers);
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=${pet.name}_AI_${insight.type}.pdf`,
                'Content-Length': pdfData.length
            }).end(pdfData);
        });

        // Header
        doc.fillColor('#6366f1').fontSize(22).text('PetVitals AI Report', { align: 'center' });
        doc.moveDown(0.5);

        // Title
        doc.fillColor('#000').fontSize(16).text(insight.title, { underline: true });
        doc.moveDown(0.5);

        // Pet Info
        doc.fontSize(11).fillColor('#444');
        doc.text(`Pet: ${pet.name} (${pet.type})`);
        doc.text(`Breed: ${pet.breed || 'Unknown'}`);
        doc.text(`Generated Date: ${new Date(insight.createdAt).toLocaleDateString()}`);
        doc.moveDown();

        // Divider
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ddd').stroke();
        doc.moveDown();

        // Content
        doc.fillColor('#333').fontSize(11).text(insight.content, {
            lineGap: 4,
            paragraphGap: 10,
            align: 'left'
        });
        doc.moveDown(1.5);

        // Required Medical Disclaimer Box
        doc.fillColor('#b45309').fontSize(9).text(`IMPORTANT MEDICAL DISCLAIMER:\n${MEDICAL_DISCLAIMER_TEXT}`, {
            align: 'center',
            lineGap: 2
        });

        // Footer
        doc.fontSize(9).fillColor('#999').text(
            `Generated by PetVitals AI Assistant • Owner: ${insight.userId.name}`,
            50,
            doc.page.height - 40,
            { align: 'center' }
        );

        doc.end();
    } catch (error) {
        console.error('AI PDF Export Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
};
