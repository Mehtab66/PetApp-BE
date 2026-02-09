const Expense = require('../models/Expense');
const Pet = require('../models/Pet');

// Create new expense
exports.createExpense = async (req, res, next) => {
    try {
        const { petId, title, category, amount, date, notes } = req.body;

        // Verify pet belongs to user
        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found or unauthorized'
            });
        }

        const expense = await Expense.create({
            userId: req.user.id,
            petId,
            title,
            category,
            amount,
            date: date || Date.now(),
            notes
        });

        res.status(201).json({
            success: true,
            data: { expense }
        });
    } catch (error) {
        next(error);
    }
};

// Get all expenses for a pet
exports.getExpensesByPet = async (req, res, next) => {
    try {
        const { petId } = req.params;
        const { month, year } = req.query;

        // Verify pet belongs to user
        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found or unauthorized'
            });
        }

        let query = { petId };

        // Filter by month/year if provided
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            query.date = {
                $gte: startDate,
                $lte: endDate
            };
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31);
            query.date = {
                $gte: startDate,
                $lte: endDate
            };
        }

        const expenses = await Expense.find(query).sort({ date: -1 });

        // Calculate total
        const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

        res.status(200).json({
            success: true,
            count: expenses.length,
            data: {
                expenses,
                summary: {
                    total: totalAmount,
                    period: month && year ? `${month}/${year}` : (year ? `${year}` : 'All time')
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get single expense
exports.getExpenseById = async (req, res, next) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { expense }
        });
    } catch (error) {
        next(error);
    }
};

// Update expense
exports.updateExpense = async (req, res, next) => {
    try {
        const { title, category, amount, date, notes } = req.body;

        let expense = await Expense.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        // Update fields
        if (title) expense.title = title;
        if (category) expense.category = category;
        if (amount) expense.amount = amount;
        if (date) expense.date = date;
        if (notes !== undefined) expense.notes = notes;

        await expense.save();

        res.status(200).json({
            success: true,
            data: { expense }
        });
    } catch (error) {
        next(error);
    }
};

// Delete expense
exports.deleteExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Get spending analytics
exports.getExpenseStats = async (req, res, next) => {
    try {
        const { petId } = req.params;
        const { period } = req.query; // 'month' or 'year', defaults to current month

        // Verify pet
        const pet = await Pet.findOne({ _id: petId, userId: req.user.id });
        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet not found'
            });
        }

        const now = new Date();
        let startDate, endDate;

        if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        } else {
            // Default to current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        const stats = await Expense.aggregate([
            {
                $match: {
                    petId: pet._id,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const totalSpent = stats.reduce((acc, curr) => acc + curr.total, 0);

        res.status(200).json({
            success: true,
            data: {
                stats,
                totalSpent,
                period: period || 'month',
                startDate,
                endDate
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get global expense stats (all pets)
exports.getGlobalStats = async (req, res, next) => {
    try {
        const period = req.query.period || 'month';
        const now = new Date();
        let startDate, endDate;

        if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        } else {
            // Default to current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        // 1. Get all user's pets
        const pets = await Pet.find({ userId: req.user.id });
        const petIds = pets.map(p => p._id);

        // 2. Aggregate expenses by pet
        // We need to match expenses for ANY of user's pets in the date range
        const stats = await Expense.aggregate([
            {
                $match: {
                    petId: { $in: petIds },
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$petId',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // 3. Map back to pet names and add budget info
        const petStats = pets.map(pet => {
            // Find stat for this pet
            // Note: _id in aggregate result is an ObjectId, need to compare properly
            const stat = stats.find(s => s._id.toString() === pet._id.toString());

            return {
                _id: pet._id,
                name: pet.name,
                type: pet.type,
                photo: pet.photo,
                monthlyBudget: pet.monthlyBudget || 0,
                totalSpent: stat ? stat.total : 0,
                transactionCount: stat ? stat.count : 0
            };
        });

        // Calculate grand total
        const totalSpent = petStats.reduce((sum, p) => sum + p.totalSpent, 0);

        res.status(200).json({
            success: true,
            data: {
                totalSpent,
                petStats,
                period,
                startDate,
                endDate
            }
        });
    } catch (error) {
        next(error);
    }
};
