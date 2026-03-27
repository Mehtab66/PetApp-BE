const mongoose = require('mongoose');

/**
 * Marketplace Item Model
 * Stores Amazon products for the in-app marketplace (PA API / scraped / manual)
 */
const marketplaceItemSchema = new mongoose.Schema({
    // --- Amazon Identity ---
    asin: {
        type: String,
        trim: true,
        unique: true,
        sparse: true, // Allow multiple docs without ASIN (manual entries)
        index: true,
    },

    // --- Core Product Info ---
    title: {
        type: String,
        required: [true, 'Please provide product title'],
        trim: true,
        maxlength: [200, 'Title cannot be more than 200 characters'],
    },
    description: {
        type: String,
        maxlength: [2000, 'Description cannot be more than 2000 characters'],
        default: '',
    },
    brand: {
        type: String,
        trim: true,
        default: '',
    },

    // --- Pricing ---
    price: {
        type: Number,
        required: [true, 'Please provide price'],
        min: 0,
        default: 0,
    },
    currency: {
        type: String,
        default: 'USD',
    },

    // --- Categorization ---
    category: {
        type: String,
        required: [true, 'Please provide category'],
        enum: [
            'Food & Treats',
            'Toys',
            'Beds & Furniture',
            'Clothing & Accessories',
            'Health & Grooming',
            'Training & Travel',
            'Other'
        ],
        default: 'Other',
    },

    // --- Media ---
    images: [{
        type: String,
    }],

    // --- Amazon Affiliate ---
    affiliateLink: {
        type: String,
        trim: true,
        required: [true, 'Please provide the Amazon product link'],
    },

    // --- Ratings & Reviews ---
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
    },
    reviewsCount: {
        type: Number,
        min: 0,
        default: 0,
    },

    // --- Amazon Features ---
    prime: {
        type: Boolean,
        default: false,
    },

    // --- Metadata ---
    source: {
        type: String,
        enum: ['pa-api', 'scraped', 'manual'],
        default: 'manual',
    },
    status: {
        type: String,
        enum: ['Available', 'Archived'],
        default: 'Available',
    },
    views: {
        type: Number,
        default: 0,
    },
    lastSyncedAt: {
        type: Date,
        default: null,
    },

}, {
    timestamps: true,
});

// Indexes
marketplaceItemSchema.index({ title: 'text', description: 'text', brand: 'text' });
marketplaceItemSchema.index({ category: 1, status: 1 });
marketplaceItemSchema.index({ price: 1 });

module.exports = mongoose.model('MarketplaceItem', marketplaceItemSchema);
