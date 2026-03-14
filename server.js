import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Prisma routes
import kupciRouter from './routes/kupci.js';
import projektiRouter from './routes/projekti.js';
import fazeRouter from './routes/faze.js';

// Import legacy routes (ako trebaju)
// import formsRouter from './routes/forms.js';
// import uploadRouter from './routes/upload.js';
// import submissionsRouter from './routes/submissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS - dozvoli zahteve sa frontenda
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com', 'https://your-render-app.onrender.com'] 
        : ['http://localhost:3000', 'http://localhost:5000'],
    credentials: true
}));

// Parsuj JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Služi statičke fajlove (HTML, CSS, JS, slike)
app.use(express.static(path.join(__dirname, '.')));

// ============================================
// API ROUTES - PRISMA
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'Backend radi!',
        database: 'PostgreSQL + Prisma',
        timestamp: new Date().toISOString()
    });
});

// Kupci routes
app.use('/api/kupci', kupciRouter);

// Projekti routes
app.use('/api/projekti', projektiRouter);

// Faze routes
app.use('/api/faze', fazeRouter);

// ============================================
// FRONTEND ROUTES
// ============================================

// Landing page (početna stranica)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Upravljanje kupcima
app.get('/kupci', (req, res) => {
    res.sendFile(path.join(__dirname, 'kupci.html'));
});

// Način 1 - Do 10,8 kW - Lista projekata
app.get('/doc-portal-1', (req, res) => {
    res.sendFile(path.join(__dirname, 'doc-portal-1.html'));
});

// Način 1 - Portal sa 5 faza - Dinamički projekat
app.get('/doc-portal-1/portal/:projectId', (req, res) => {
    res.sendFile(path.join(__dirname, 'doc-portal-1-portal.html'));
});

// Način 2 - Do 50 kW
app.get('/doc-portal-2', (req, res) => {
    res.sendFile(path.join(__dirname, 'doc-portal-2.html'));
});

// Način 3 - 50-150 kW
app.get('/doc-portal-3', (req, res) => {
    res.sendFile(path.join(__dirname, 'doc-portal-3.html'));
});

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
    ║  PostgreSQL + Prisma               ║
    ║  Server je pokrenut na port ${PORT}  ║
    ║  http://localhost:${PORT}            ║
    ╚════════════════════════════════════╝
    `);
});

export default app;