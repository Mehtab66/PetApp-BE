const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { createExpenseValidator, updateExpenseValidator } = require('../validators/expenseValidator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Protect all routes
router.use(protect);

// Routes
router.post('/', createExpenseValidator, validate, expenseController.createExpense);
router.get('/pet/:petId', expenseController.getExpensesByPet);
router.get('/pet/:petId/stats', expenseController.getExpenseStats);
router.get('/stats/global', expenseController.getGlobalStats);
router.get('/:id', expenseController.getExpenseById);
router.put('/:id', updateExpenseValidator, validate, expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
