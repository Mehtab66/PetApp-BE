const mongoose = require('mongoose');

/**
 * Marketplace Item Model
 * Stores items listed by users for sale/adoption
 */
const marketplaceItemSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Please provide item title'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
        type: String,
        required: [true, 'Please provide item description'],
        maxlength: [1000, 'Description cannot be more than 1000 characters'],
    },
    price: {
        type: Number,
        required: [true, 'Please provide price'],
        min: 0,
    },
    currency: {
        type: String,
        default: 'USD',
    },
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
            'Pets',
            'Other'
        ],
    },
    condition: {
        type: String,
        enum: ['New', 'Used - Like New', 'Used - Good', 'Used - Fair'],
        default: 'New',
    },
    images: [{
        type: String,
    }],
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere'
        }
    },
    address: {
        type: String,
        required: [true, 'Please provide address string'],
    },
    status: {
        type: String,
        enum: ['Available', 'Sold', 'Archived'],
        default: 'Available',
    },
    views: {
        type: Number,
        default: 0,
    },
    affiliateLink: {
        type: String,
        trim: true,
    },
    isAffiliate: {
        type: Boolean,
        default: true,
    }
}, {
    timestamps: true,
});

// Index for geo-spatial queries
marketplaceItemSchema.index({ location: '2dsphere' });
// General text search index
marketplaceItemSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('MarketplaceItem', marketplaceItemSchema);
