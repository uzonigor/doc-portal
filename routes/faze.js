import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// GET - Preuzmi sve faze za projekat
router.get('/projekat/:projektaId', async (req, res) => {
    try {
        const faze = await prisma.faza.findMany({
            where: { projektaId: parseInt(req.params.projektaId) },
            include: {
                dokumenti: true
            },
            orderBy: {
                fazaBroj: 'asc'
            }
        });
        res.json(faze);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Preuzmi fazu po ID-u
router.get('/:id', async (req, res) => {
    try {
        const faza = await prisma.faza.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                dokumenti: true
            }
        });
        
        if (!faza) {
            return res.status(404).json({ error: 'Faza nije pronađena' });
        }
        
        res.json(faza);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Ažuriraj fazu (status, completed)
router.put('/:id', async (req, res) => {
    try {
        const { status, completed } = req.body;
        
        const faza = await prisma.faza.update({
            where: { id: parseInt(req.params.id) },
            data: {
                status: status || undefined,
                completed: completed || undefined,
                completedAt: completed ? new Date() : undefined
            },
            include: {
                dokumenti: true
            }
        });
        
        // Ako je faza završena, aktiviraj sljedeću
        if (completed && faza.fazaBroj < 4) {
            const nextFaza = await prisma.faza.findFirst({
                where: {
                    projektaId: faza.projektaId,
                    fazaBroj: faza.fazaBroj + 1
                }
            });
            
            if (nextFaza && nextFaza.status === 'pending') {
                await prisma.faza.update({
                    where: { id: nextFaza.id },
                    data: { status: 'active' }
                });
            }
        }
        
        res.json(faza);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Faza nije pronađena' });
        }
        res.status(500).json({ error: error.message });
    }
});

export default router;