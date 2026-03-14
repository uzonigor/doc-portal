import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// GET - Preuzmi sve projekte
router.get('/', async (req, res) => {
    try {
        const projekti = await prisma.projekat.findMany({
            include: {
                kupac: true,
                faze: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(projekti);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Preuzmi projekte za određenog kupca
router.get('/kupac/:kupacId', async (req, res) => {
    try {
        const projekti = await prisma.projekat.findMany({
            where: { kupacId: parseInt(req.params.kupacId) },
            include: {
                faze: true
            }
        });
        res.json(projekti);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Preuzmi projekat po ID-u
router.get('/:id', async (req, res) => {
    try {
        const projekat = await prisma.projekat.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                kupac: true,
                faze: {
                    include: {
                        dokumenti: true
                    }
                },
                dokumenti: true
            }
        });
        
        if (!projekat) {
            return res.status(404).json({ error: 'Projekat nije pronađen' });
        }
        
        res.json(projekat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Kreiraj novi projekat
router.post('/', async (req, res) => {
    try {
        const { kupacId, naziv, snaga, lokacija } = req.body;
        
        // Validacija
        if (!kupacId || !naziv || !snaga) {
            return res.status(400).json({ error: 'Nedostaju obavezna polja: kupacId, naziv, snaga' });
        }
        
        // Provjera da li kupac postoji
        const kupac = await prisma.kupac.findUnique({
            where: { id: parseInt(kupacId) }
        });
        
        if (!kupac) {
            return res.status(404).json({ error: 'Kupac nije pronađen' });
        }
        
        // Kreiraj projekat sa svim fazama
        const newProjekat = await prisma.projekat.create({
            data: {
                kupacId: parseInt(kupacId),
                naziv,
                snaga: parseFloat(snaga),
                lokacija,
                status: 'active',
                faze: {
                    create: [
                        {
                            fazaBroj: 0,
                            naziv: 'Priprema Dokumentacije',
                            opis: 'Osnovne forme ovlašćenja i ugovore potrebne za početak',
                            status: 'active'
                        },
                        {
                            fazaBroj: 1,
                            naziv: 'Izgradnja Proizvodnog Objekta',
                            opis: 'Dokumentacija o izgradnji i instalaciji solarnog sistema',
                            status: 'pending'
                        },
                        {
                            fazaBroj: 2,
                            naziv: 'Prilagođenje Mernog Mjesta',
                            opis: 'Procedure za prilagođenje mjernog mjesta za proizvodnju',
                            status: 'pending'
                        },
                        {
                            fazaBroj: 3,
                            naziv: 'Zaključivanje Ugovora',
                            opis: 'Konačni ugovori sa elektrodistribucijom',
                            status: 'pending'
                        },
                        {
                            fazaBroj: 4,
                            naziv: 'Upis u Registar',
                            opis: 'Konačna registracija kupca-proizvođača',
                            status: 'pending'
                        }
                    ]
                }
            },
            include: {
                faze: true
            }
        });
        
        res.status(201).json(newProjekat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Ažuriraj projekat
router.put('/:id', async (req, res) => {
    try {
        const projekat = await prisma.projekat.update({
            where: { id: parseInt(req.params.id) },
            data: req.body,
            include: {
                faze: true
            }
        });
        
        res.json(projekat);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Projekat nije pronađen' });
        }
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Obriši projekat
router.delete('/:id', async (req, res) => {
    try {
        await prisma.projekat.delete({
            where: { id: parseInt(req.params.id) }
        });
        
        res.json({ message: 'Projekat je obrisan' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Projekat nije pronađen' });
        }
        res.status(500).json({ error: error.message });
    }
});

export default router;