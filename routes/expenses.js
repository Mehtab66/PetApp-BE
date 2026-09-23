const express = require('express');
const multer = require('multer');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { createExpenseValidator, updateExpenseValidator } = require('../validators/expenseValidator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const receiptUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error('Please upload a photo of the receipt (JPG, PNG, or WEBP).'));
    },
}).single('receipt');

const handleReceiptUpload = (req, res, next) => {
    receiptUpload(req, res, (err) => {
        if (!err) return next();
        const tooLarge = err.code === 'LIMIT_FILE_SIZE';
        return res.status(400).json({
            success: false,
            message: tooLarge
                ? 'That photo is too large. Please use an image under 5 MB.'
                : (err.message || 'Could not upload that photo.'),
        });
    });
};

// Protect all routes
router.use(protect);

// Routes
router.post('/receipt', handleReceiptUpload, expenseController.processReceipt);
router.post('/', createExpenseValidator, validate, expenseController.createExpense);
router.get('/pet/:petId', expenseController.getExpensesByPet);
router.get('/pet/:petId/stats', expenseController.getExpenseStats);
router.get('/stats/global', expenseController.getGlobalStats);
router.get('/:id', expenseController.getExpenseById);
router.put('/:id', updateExpenseValidator, validate, expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
