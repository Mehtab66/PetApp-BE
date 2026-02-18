const express = require('express');
const router = express.Router();
const {
    getChatResponse,
    getHealthRoadmap,
    symptomCheck,
    behaviorTraining,
    expenseOptimizer,
    nutritionAdvice,
    firstAidGuidance,
    breedCareTips
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Existing routes
router.post('/chat', getChatResponse);
router.post('/roadmap/:petId', getHealthRoadmap);

// New AI Features
router.post('/symptom-check', symptomCheck);
router.post('/behavior-training', behaviorTraining);
router.post('/expense-optimizer', expenseOptimizer);
router.post('/nutrition-advice', nutritionAdvice);
router.post('/first-aid', firstAidGuidance);
router.post('/breed-care', breedCareTips);

module.exports = router;
