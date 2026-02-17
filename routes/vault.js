const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { exportMedicalHistoryPDF, toggleVaultSharing } = require('../controllers/vaultController');

router.get('/pet/:petId/export', protect, exportMedicalHistoryPDF);
router.post('/pet/:petId/share', protect, toggleVaultSharing);

module.exports = router;
