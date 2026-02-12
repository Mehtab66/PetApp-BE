const express = require('express');
const router = express.Router();
const { getChatResponse, getHealthRoadmap } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.post('/chat', getChatResponse);
router.post('/roadmap/:petId', getHealthRoadmap);

module.exports = router;
