import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// PUT /api/templates/:projektId/:docNum - Spremi template verziju u bazu
router.put('/:projektId/:docNum', async (req, res) => {
    try {
        const { projektId, docNum } = req.params;
        const { content } = req.body;
        
        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Sadržaj šablona ne može biti prazan' });
        }
        
        // Provjeri da li projekat postoji
        const projekt = await prisma.projekat.findUnique({
            where: { id: parseInt(projektId) }
        });
        
        if (!projekt) {
            return res.status(404).json({ error: 'Projekat nije pronađen' });
        }
        
        // Spremi ili ažuriraj template verziju
        const templateVersion = await prisma.templateVersion.upsert({
            where: {
                projektaId_docNum: {
                    projektaId: parseInt(projektId),
                    docNum: docNum
                }
            },
            update: {
                content: content
            },
            create: {
                projektaId: parseInt(projektId),
                docNum: docNum,
                content: content
            }
        });
        
        res.json({
            success: true,
            message: 'Template je spreman u bazu',
            templateVersion: templateVersion
        });
        
    } catch (error) {
        console.error('Error saving template:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/templates/:projektId/:docNum - Učitaj custom template verziju iz baze
router.get('/:projektId/:docNum', async (req, res) => {
    try {
        const { projektId, docNum } = req.params;
        
        const templateVersion = await prisma.templateVersion.findUnique({
            where: {
                projektaId_docNum: {
                    projektaId: parseInt(projektId),
                    docNum: docNum
                }
            }
        });
        
        if (templateVersion) {
            res.json({
                content: templateVersion.content,
                custom: true,
                updatedAt: templateVersion.updatedAt
            });
        } else {
            res.status(404).json({ error: 'Nema prilagođenog šablona' });
        }
        
    } catch (error) {
        console.error('Error loading template:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/templates/:projektId/:docNum - Obriši custom template verziju
router.delete('/:projektId/:docNum', async (req, res) => {
    try {
        const { projektId, docNum } = req.params;
        
        await prisma.templateVersion.delete({
            where: {
                projektaId_docNum: {
                    projektaId: parseInt(projektId),
                    docNum: docNum
                }
            }
        });
        
        res.json({
            success: true,
            message: 'Template verzija je obrisana'
        });
        
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Template nije pronađen' });
        }
        console.error('Error deleting template:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
