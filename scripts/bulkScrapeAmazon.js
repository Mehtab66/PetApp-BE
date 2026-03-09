/**
 * Bulk Scraping Script for Amazon Pet Products
 * 
 * This script iterates through all supported pet types and product categories,
 * fetches items from Amazon PA-API, and saves them to the MarketplaceItem model.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const amazonService = require('../services/amazonService.js');
const MarketplaceItem = require('../models/MarketplaceItem.js');
const User = require('../models/User.js');

// Load environment variables
dotenv.config();

// Configuration
const PET_TYPES = [
    'Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Hamster', 'Guinea Pig', 
    'Turtle', 'Snake', 'Lizard', 'Frog', 'Horse', 'Ferret', 'Chinchilla', 
    'Hedgehog', 'Parrot', 'Chicken', 'Duck', 'Goat', 'Pig', 'Cow', 'Sheep', 
    'Mouse', 'Rat', 'Gerbil', 'Tarantula', 'Hermit Crab', 'Gecko', 'Iguana', 'Bearded Dragon'
];

const CATEGORIES = [
    { search: 'food', model: 'Food & Treats' },
    { search: 'toys', model: 'Toys' },
    { search: 'bed', model: 'Beds & Furniture' },
    { search: 'grooming', model: 'Health & Grooming' },
    { search: 'harness', model: 'Training & Travel' }
];

async function runBulkScrape() {
    try {
        console.log('🚀 Starting Bulk Scrape...');

        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petcare');
        console.log('✅ Connected to MongoDB');

        // 2. Get or Create a "System" User for affiliate products
        let systemUser = await User.findOne({ email: 'system@petapp.com' });
        if (!systemUser) {
            systemUser = await User.create({
                name: 'PetApp Affiliate System',
                email: 'system@petapp.com',
                password: 'secure_system_password_123', // Should be changed
                isVerified: true
            });
            console.log('👤 Created System User');
        }

        // 3. Main Loop
        for (const pet of PET_TYPES) {
            for (const cat of CATEGORIES) {
                const query = `${pet} ${cat.search}`;
                console.log(`🔍 Searching Amazon for: "${query}"...`);

                try {
                    const products = await amazonService.searchProducts(query);
                    console.log(`📦 Found ${products.length} products for "${query}"`);

                    for (const product of products) {
                        // Check if already exists
                        const existing = await MarketplaceItem.findOne({ affiliateLink: product.link });
                        if (existing) {
                            console.log(`⏭️ Skipping existing: ${product.title.substring(0, 30)}...`);
                            continue;
                        }

                        // Create Marketplace Item
                        await MarketplaceItem.create({
                            sellerId: systemUser._id,
                            title: product.title,
                            description: `High-quality ${cat.search} for your ${pet}. Highly rated with ${product.reviewsCount} reviews on Amazon.`,
                            price: product.price,
                            currency: 'USD',
                            category: cat.model,
                            condition: 'New',
                            images: [product.image],
                            location: { type: 'Point', coordinates: [0, 0] }, // Default center
                            address: 'Online / Amazon',
                            status: 'Available',
                            affiliateLink: product.link,
                            isAffiliate: true
                        });
                    }
                } catch (scrapeError) {
                    console.error(`❌ Error scraping "${query}":`, scrapeError.message);
                }

                // Wait 2 seconds between queries to avoid hitting Amazon API limits
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        console.log('✨ Bulk Scrape Completed Successfully!');
        process.exit(0);

    } catch (error) {
        console.error('💥 Critical Error:', error);
        process.exit(1);
    }
}

runBulkScrape();
