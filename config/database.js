const dns = require('dns');
const mongoose = require('mongoose');

// Node 22+/24 on Windows often times out mongodb+srv TXT/SRV lookups
// against the local resolver (queryTxt ETIMEOUT). Prefer IPv4 + public DNS.
dns.setDefaultResultOrder('ipv4first');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
    console.warn('⚠️  Could not override DNS servers:', err.message);
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Database connection configuration
 * Handles MongoDB connection with proper error handling and reconnection logic
 */
const connectDB = async (attempt = 1) => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI is missing from environment variables');
        process.exit(1);
    }

    try {
        const conn = await mongoose.connect(uri, {
            family: 4,
            serverSelectionTimeoutMS: 30000,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

        mongoose.connection.on('error', (err) => {
            console.error(`❌ MongoDB connection error: ${err}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });
    } catch (error) {
        console.error(`❌ Error connecting to MongoDB (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);

        if (attempt < MAX_RETRIES) {
            console.log(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await sleep(RETRY_DELAY_MS);
            return connectDB(attempt + 1);
        }

        console.error(
            '❌ Could not reach MongoDB Atlas. Check that:\n' +
            '   1. This machine has internet access\n' +
            '   2. Atlas Network Access allows your current IP (or 0.0.0.0/0 for dev)\n' +
            '   3. MONGODB_URI in .env is the full Atlas connection string'
        );
        process.exit(1);
    }
};

module.exports = connectDB;
