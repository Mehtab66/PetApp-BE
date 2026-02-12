const axios = require('axios');

/**
 * AI Controller
 * Handles pet health related AI queries
 */

/**
 * @desc    Get AI response for pet health query
 * @route   POST /api/ai/chat
 * @access  Private
 */
exports.getChatResponse = async (req, res, next) => {
    try {
        const { message, petId, history } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required',
            });
        }

        // System prompt to guide the AI
        const systemPrompt = `You are an expert Pet Health AI Assistant. 
Your goal is to provide accurate, helpful, and empathetic advice regarding pet health, nutrition, behavior, and general care.
Always prioritize the pet's well-being.
If a situation sounds urgent or life-threatening, strongly recommend immediate veterinary consultation.

CLEAN FORMATTING RULES:
- DO NOT use asterisks (**) for bolding or lists.
- DO NOT use markdown symbols that make the text look cluttered.
- Use clear, simple paragraphs.
- Use plain bullet points (•) or dashes (-) for lists if needed.
- Keep the tone friendly and professional.
- If information about a specific pet is provided, tailor your advice to that pet's species, breed, and age.`;


        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add history if available
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            });
        }

        // Add current message
        messages.push({ role: 'user', content: message });

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile', // Updated to latest recommended model
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

        // Clean up any remaining asterisks or excessive markdown symbols for a cleaner UI
        aiMessage = aiMessage.replace(/\*\*/g, '').replace(/\*/g, '');

        res.status(200).json({
            success: true,
            data: {
                message: aiMessage.trim()
            },
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
