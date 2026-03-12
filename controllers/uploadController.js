const fs = require('fs');
const path = require('path');

// ============================================
// UPLOAD CONTROLLER
// ============================================

// Uploaduj jedan fajl
exports.uploadSingle = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Nema fajla za upload'
            });
        }
        
        res.json({
            success: true,
            message: 'Fajl je uspešno uploadovan',
            file: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                uploadedAt: new Date().toISOString()
            }
        });
        
        console.log(`📄 Fajl uploadovan: ${req.file.filename}`);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Uploaduj više fajlova
exports.uploadMultiple = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nema fajlova za upload'
            });
        }
        
        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString()
        }));
        
        res.json({
            success: true,
            message: `${req.files.length} fajlova je uspešno uploadovano`,
            files: uploadedFiles
        });
        
        console.log(`📦 ${req.files.length} fajlova uploadovano`);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Preuzmi fajl
exports.downloadFile = async (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(__dirname, '../uploads', filename);
        
        // Proveri sigurnost - sprečavanje path traversal
        if (!filepath.startsWith(path.resolve(__dirname, '../uploads'))) {
            return res.status(403).json({
                success: false,
                error: 'Pristup odbijen'
            });
        }
        
        // Proveri da li fajl postoji
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                error: 'Fajl nije pronađen'
            });
        }
        
        res.download(filepath, filename);
        console.log(`⬇️ Fajl preuzet: ${filename}`);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Obriši fajl
exports.deleteFile = async (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(__dirname, '../uploads', filename);
        
        // Proveri sigurnost
        if (!filepath.startsWith(path.resolve(__dirname, '../uploads'))) {
            return res.status(403).json({
                success: false,
                error: 'Pristup odbijen'
            });
        }
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                error: 'Fajl nije pronađen'
            });
        }
        
        fs.unlinkSync(filepath);
        
        res.json({
            success: true,
            message: 'Fajl je obrisan',
            filename: filename
        });
        
        console.log(`🗑️ Fajl obrisan: ${filename}`);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
