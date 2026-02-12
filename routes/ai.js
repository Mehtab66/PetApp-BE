const express = require('express');
const router = express.Router();
const { getChatResponse } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.post('/chat', getChatResponse);

module.exports = router;
