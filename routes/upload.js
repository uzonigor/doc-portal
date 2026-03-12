const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const uploadController = require('../controllers/uploadController');

// ============================================
// MULTER CONFIGURATION
// ============================================

// Kreiraj uploads folder ako ne postoji
const fs = require('fs');
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generiši jedinstveno ime
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Dozvoljeni tipovi fajlova
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Tip fajla ${file.mimetype} nije dozvoljen. Dozvoljeni: PDF, JPG, PNG`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || 10485760) // 10MB default
    }
});

// ============================================
// UPLOAD ROUTES
// ============================================

// Uploaduj jedan fajl
router.post('/single', upload.single('document'), uploadController.uploadSingle);

// Uploaduj više fajlova
router.post('/multiple', upload.array('documents', 10), uploadController.uploadMultiple);

// Prosledi fajl
router.get('/:filename', uploadController.downloadFile);

// Obriši fajl
router.delete('/:filename', uploadController.deleteFile);

// Error handler za multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'FILE_TOO_LARGE') {
            return res.status(400).json({
                error: 'File too large',
                message: `Maksimalna veličina fajla je ${process.env.MAX_FILE_SIZE / 1024 / 1024}MB`
            });
        }
        return res.status(400).json({
            error: error.message
        });
    }
    
    if (error) {
        return res.status(400).json({
            error: error.message
        });
    }
    
    next();
});

module.exports = router;
