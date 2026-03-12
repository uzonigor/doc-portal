const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// ============================================
// SUBMISSION CONTROLLER
// ============================================

// Mock baza podataka (kasnije zameni sa pravom bazom)
let submissions = [];

// Konfiguriši email (TODO: dodaj u .env)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// GET - Sve submission-e (admin)
exports.getAllSubmissions = async (req, res) => {
    try {
        res.json({
            success: true,
            total: submissions.length,
            submissions: submissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// GET - Specifičan submission po ID-u
exports.getSubmissionById = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const submission = submissions.find(s => s.id === submissionId);
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                error: 'Submission nije pronađen'
            });
        }
        
        res.json({
            success: true,
            submission: submission
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// POST - Novi submission
exports.createSubmission = async (req, res) => {
    try {
        const { phase, companyName, documents } = req.body;
        
        if (!phase || !companyName) {
            return res.status(400).json({
                success: false,
                error: 'Phase i companyName su obavezni'
            });
        }
        
        const submission = {
            id: uuidv4(),
            phase: phase,
            companyName: companyName,
            documents: documents || [],
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        submissions.push(submission);
        
        res.status(201).json({
            success: true,
            message: 'Submission je kreiran',
            submission: submission
        });
        
        console.log(`📝 Novi submission: ${submission.id} (${companyName})`);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// PUT - Ažuriraj submission
exports.updateSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const updates = req.body;
        
        const submission = submissions.find(s => s.id === submissionId);
        if (!submission) {
            return res.status(404).json({
                success: false,
                error: 'Submission nije pronađen'
            });
        }
        
        // Ažuriraj samo dozvoljene polja
        const allowedUpdates = ['companyName', 'documents', 'status'];
        allowedUpdates.forEach(field => {
            if (updates.hasOwnProperty(field)) {
                submission[field] = updates[field];
            }
        });
        
        submission.updatedAt = new Date().toISOString();
        
        res.json({
            success: true,
            message: 'Submission je ažuriran',
            submission: submission
        });
        
        console.log(`✏️ Submission ažuriran: ${submissionId}`);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// POST - Pošalji submission operatoru (email)
exports.sendSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const submission = submissions.find(s => s.id === submissionId);
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                error: 'Submission nije pronađen'
            });
        }
        
        // Proveri da li su svi dokumenti dostupni
        if (!submission.documents || submission.documents.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nema dokumenata za slanje'
            });
        }
        
        // TODO: Pošalji email sa dokumentacijom
        // Sada je samo mock
        const emailContent = `
            <h2>Novi Submission - Faza ${submission.phase}</h2>
            <p><strong>Kompanija:</strong> ${submission.companyName}</p>
            <p><strong>Dokumenti:</strong> ${submission.documents.length}</p>
            <p><strong>Vreme:</strong> ${new Date().toISOString()}</p>
        `;
        
        // await emailTransporter.sendMail({
        //     from: process.env.EMAIL_USER,
        //     to: process.env.EMAIL_TO_OPERATOR,
        //     subject: `Novi Submission - Faza ${submission.phase}`,
        //     html: emailContent
        // });
        
        submission.status = 'sent';
        submission.sentAt = new Date().toISOString();
        
        res.json({
            success: true,
            message: 'Submission je poslat operatoru',
            submission: submission
        });
        
        console.log(`📧 Submission poslat: ${submissionId}`);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// GET - Status submission-a
exports.getSubmissionStatus = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const submission = submissions.find(s => s.id === submissionId);
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                error: 'Submission nije pronađen'
            });
        }
        
        res.json({
            success: true,
            submission: {
                id: submission.id,
                status: submission.status,
                phase: submission.phase,
                documentsCount: submission.documents.length,
                createdAt: submission.createdAt,
                sentAt: submission.sentAt || null
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// DELETE - Obriši submission (draft)
exports.deleteSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const index = submissions.findIndex(s => s.id === submissionId);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Submission nije pronađen'
            });
        }
        
        const deleted = submissions.splice(index, 1);
        
        res.json({
            success: true,
            message: 'Submission je obrisan',
            submission: deleted[0]
        });
        
        console.log(`🗑️ Submission obrisan: ${submissionId}`);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
