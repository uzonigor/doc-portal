import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Prazan model - jednopolna/tropolna šema ili string plan
function prazanModel(naziv, tip) {
    const osnova = {
        version: 1,
        meta: { naziv: naziv || (tip === 'PLAN' ? 'String plan' : 'Nova šema') },
        sheet: { format: 'A3', orijentacija: 'landscape' }
    };

    if (tip === 'PLAN') {
        return { ...osnova, tip: 'PLAN', podloga: { slika: null }, modul: {}, polja: [], stringovi: [] };
    }

    return { ...osnova, meta: { ...osnova.meta, standard: 'IEC-60617' }, nodes: [], edges: [] };
}

/** Model je validan ako odgovara svom tipu crteža. */
function proveriModel(model, tip) {
    if (!model || typeof model !== 'object') return 'Model mora biti objekat';

    if (tip === 'PLAN' || model.tip === 'PLAN') {
        if (!Array.isArray(model.polja) || !Array.isArray(model.stringovi)) {
            return 'String plan mora imati polja i stringovi nizove';
        }
        return null;
    }

    if (!Array.isArray(model.nodes) || !Array.isArray(model.edges)) {
        return 'Šema mora imati nodes i edges nizove';
    }
    return null;
}

// GET - Sve šeme jednog projekta (bez modela, samo lista)
router.get('/projekat/:projektId', async (req, res) => {
    try {
        const seme = await prisma.sema.findMany({
            where: { projektaId: parseInt(req.params.projektId) },
            select: { id: true, naziv: true, tip: true, verzija: true, createdAt: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(seme);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Jedna šema sa modelom
router.get('/:id', async (req, res) => {
    try {
        const sema = await prisma.sema.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { projekat: { include: { kupac: true } } }
        });

        if (!sema) {
            return res.status(404).json({ error: 'Šema nije pronađena' });
        }

        res.json(sema);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Nova šema
router.post('/', async (req, res) => {
    try {
        const { projektaId, naziv, tip, model } = req.body;

        if (!projektaId) {
            return res.status(400).json({ error: 'projektaId je obavezan' });
        }

        const projekat = await prisma.projekat.findUnique({
            where: { id: parseInt(projektaId) }
        });

        if (!projekat) {
            return res.status(404).json({ error: 'Projekat nije pronađen' });
        }

        const sema = await prisma.sema.create({
            data: {
                projektaId: parseInt(projektaId),
                naziv: naziv || (tip === 'PLAN' ? 'String plan' : 'Nova šema'),
                tip: tip || '1L',
                model: model || prazanModel(naziv, tip)
            }
        });

        res.status(201).json(sema);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Snimi model šeme
router.put('/:id', async (req, res) => {
    try {
        const { naziv, tip, model } = req.body;

        if (model !== undefined) {
            const postojeca = await prisma.sema.findUnique({
                where: { id: parseInt(req.params.id) },
                select: { tip: true }
            });
            if (!postojeca) return res.status(404).json({ error: 'Šema nije pronađena' });

            const greska = proveriModel(model, tip || postojeca.tip);
            if (greska) return res.status(400).json({ error: greska });
        }

        const data = {};
        if (naziv !== undefined) data.naziv = naziv;
        if (tip !== undefined) data.tip = tip;
        if (model !== undefined) {
            data.model = model;
            data.verzija = { increment: 1 };
        }

        const sema = await prisma.sema.update({
            where: { id: parseInt(req.params.id) },
            data
        });

        res.json({ success: true, sema });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Šema nije pronađena' });
        }
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Obriši šemu
router.delete('/:id', async (req, res) => {
    try {
        await prisma.sema.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Šema nije pronađena' });
        }
        res.status(500).json({ error: error.message });
    }
});

export default router;
