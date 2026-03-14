import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// GET - Preuzmi sve kupce
router.get('/', async (req, res) => {
    try {
        const kupci = await prisma.kupac.findMany({
            include: {
                projekti: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(kupci);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Preuzmi kupca po ID-u
router.get('/:id', async (req, res) => {
    try {
        const kupac = await prisma.kupac.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                projekti: {
                    include: {
                        faze: true
                    }
                }
            }
        });
        
        if (!kupac) {
            return res.status(404).json({ error: 'Kupac nije pronađen' });
        }
        
        res.json(kupac);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Kreiraj novog kupca
router.post('/', async (req, res) => {
    try {
        const { tip, naziv, adresa, mjesto, email, telefon, ...rest } = req.body;
        
        // Validacija
        if (!tip || !naziv || !email) {
            return res.status(400).json({ error: 'Nedostaju obavezna polja: tip, naziv, email' });
        }
        
        const newKupac = await prisma.kupac.create({
            data: {
                tip,
                naziv,
                adresa,
                mjesto,
                email,
                telefon,
                ...rest
            }
        });
        
        res.status(201).json(newKupac);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email, PIB ili JMBG već postoji' });
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT - Ažuriraj kupca
router.put('/:id', async (req, res) => {
    try {
        const kupac = await prisma.kupac.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        
        res.json(kupac);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Kupac nije pronađen' });
        }
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Obriši kupca
router.delete('/:id', async (req, res) => {
    try {
        await prisma.kupac.delete({
            where: { id: parseInt(req.params.id) }
        });
        
        res.json({ message: 'Kupac je obrisan' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Kupac nije pronađen' });
        }
        res.status(500).json({ error: error.message });
    }
});

export default router;