const express = require('express');
const router = express.Router();
const { getNearbyVets, searchVets } = require('../controllers/vetController');

router.get('/nearby', getNearbyVets);
router.get('/search', searchVets);

module.exports = router;
