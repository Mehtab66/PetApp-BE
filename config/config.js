/**
 * Application configuration
 * Centralized configuration management
 */
module.exports = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,

    // Database
    db: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/petcare',
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expire: process.env.JWT_EXPIRE || '7d',
    },

    // File Upload
    upload: {
        maxSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
        path: process.env.UPLOAD_PATH || './uploads',
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    },

    // CORS
   cors: {
    origins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['*']  // Allow all in development
  },
};
