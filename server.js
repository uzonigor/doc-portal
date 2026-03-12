require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const formsRouter = require('./routes/forms');
const uploadRouter = require('./routes/upload');
const submissionsRouter = require('./routes/submissions');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS - dozvoli zahteve sa frontenda
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:5000'],
    credentials: true
}));

// Parsuj JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Služi statičke fajlove (HTML, CSS, JS, slike)
app.use(express.static(path.join(__dirname, '.')));

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'Backend radi!',
        timestamp: new Date().toISOString()
    });
});

// Forms routes
app.use('/api/forms', formsRouter);

// Upload routes
app.use('/api/upload', uploadRouter);

// Submissions routes
app.use('/api/submissions', submissionsRouter);

// ============================================
// FRONTEND ROUTES
// ============================================

// Služi index.html za sve ostale rute (SPA fallback)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.path} ne postoji`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Server Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Došlo je do greške na serveru' 
            : err.stack
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════╗
    ║  GO4 - DOC Portal Backend          ║
    ║  Server je pokrenut na port ${PORT}  ║
    ║  http://localhost:${PORT}            ║
    ╚════════════════════════════════════╝
    `);
});

module.exports = app;
