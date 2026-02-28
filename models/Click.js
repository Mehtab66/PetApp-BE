const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: String,
        required: true
    },
    productTitle: String,
    affiliateLink: String,
    source: {
        type: String,
        default: 'Amazon_Search'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Click', clickSchema);
