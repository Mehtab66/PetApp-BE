const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'petvitals/pets',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        public_id: (req, file) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            return `${req.user.id}-${uniqueSuffix}`;
        }
    },
});

const upload = multer({ storage: storage });

const handleUploadError = (err, req, res, next) => {
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
    next();
};

module.exports = {
    uploadSingle: upload.single('photo'),
    handleUploadError,
};
