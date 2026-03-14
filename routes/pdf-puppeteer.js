import express from 'express';
import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Pomoćna funkcija za učitavanje i procesiranje template-a
function loadAndProcessTemplate(templatePath, variables) {
    let template = fs.readFileSync(templatePath, 'utf-8');
    
    // Zamijeni sve {{placeholder}} sa vrijednostima
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        template = template.replace(regex, value || '');
    }
    
    return template;
}

// GET /api/pdf/forma-ovlascenja/:projektId
router.get('/forma-ovlascenja/:projektId', async (req, res) => {
    let browser;
    try {
        const { projektId } = req.params;
        
        // Učitaj projekat sa kupcima
        const projekt = await prisma.projekat.findUnique({
            where: { id: parseInt(projektId) },
            include: { kupac: true }
        });
        
        if (!projekt) {
            return res.status(404).json({ error: 'Projekat nije pronađen' });
        }
        
        // Pripremi varijable za template
        const today = new Date();
        const formattedDate = `${today.getDate()}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
        
        const variables = {
            kupac_naziv: projekt.kupac.naziv || '',
            kupac_adresa: projekt.kupac.adresa || '',
            kupac_mjesto: projekt.kupac.mjesto || '',
            kupac_mb: projekt.kupac.mbKompanije || projekt.kupac.licniId || '-',
            kupac_pib: projekt.kupac.pib || projekt.kupac.jmbg || '-',
            kupac_direktor: projekt.kupac.direktor || projekt.kupac.prezime || '',
            projekt_naziv: projekt.naziv || '',
            projekt_snaga: projekt.snaga || '0',
            projekt_lokacija: projekt.lokacija || '',
            datum: formattedDate
        };
        
        // Učitaj HTML template
        const templatePath = path.join(__dirname, '../templates/forma-ovlascenja-template.html');
        const htmlContent = loadAndProcessTemplate(templatePath, variables);
        
        // Generiši PDF sa Puppeteer (ima Unicode support)
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Generiši PDF sa UTF-8 encoding-om
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '40px',
                right: '40px',
                bottom: '40px',
                left: '40px'
            }
        });
        
        await browser.close();
        
        // Šalji PDF kao response
        res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''ovlascenje-${projektId}.pdf`);
        res.send(pdfBuffer);
        
    } catch (error) {
        if (browser) await browser.close();
        console.error('Error generating PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// GET /api/pdf/forma-ugovor/:projektId
router.get('/forma-ugovor/:projektId', async (req, res) => {
    let browser;
    try {
        const { projektId } = req.params;
        
        // Učitaj projekat
        const projekt = await prisma.projekat.findUnique({
            where: { id: parseInt(projektId) },
            include: { kupac: true }
        });
        
        if (!projekt) {
            return res.status(404).json({ error: 'Projekat nije pronađen' });
        }
        
        const today = new Date();
        const formattedDate = `${today.getDate()}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
        
        const variables = {
            kupac_naziv: projekt.kupac.naziv || '',
            kupac_adresa: projekt.kupac.adresa || '',
            kupac_mjesto: projekt.kupac.mjesto || '',
            kupac_mb: projekt.kupac.mbKompanije || projekt.kupac.licniId || '-',
            kupac_pib: projekt.kupac.pib || projekt.kupac.jmbg || '-',
            datum: formattedDate,
            projekt_naziv: projekt.naziv || '',
            projekt_snaga: projekt.snaga || '0'
        };
        
        const templatePath = path.join(__dirname, '../templates/forma-ugovor-template.html');
        const htmlContent = loadAndProcessTemplate(templatePath, variables);
        
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '40px',
                right: '40px',
                bottom: '40px',
                left: '40px'
            }
        });
        
        await browser.close();
        
        res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''ugovor-${projektId}.pdf`);
        res.send(pdfBuffer);
        
    } catch (error) {
        if (browser) await browser.close();
        console.error('Error generating PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// GET /api/pdf/template/:docNum - Učitaj template tekst za editovanje
router.get('/template/:docNum', async (req, res) => {
    try {
        const { docNum } = req.params;
        
        // Mapa dokumenata na template fajlove
        const templateMap = {
            '0_1': 'forma-ovlascenja-template.html',
            '0_2': 'forma-ugovor-template.html',
            '5_0': 'forma-potvrda-template.html',
            '6_1': 'forma-zahtev-template.html',
            '7_1': 'forma-zahtev-ugovora-template.html'
        };
        
        const templateFile = templateMap[docNum];
        if (!templateFile) {
            return res.status(404).json({ error: 'Template nije pronađen' });
        }
        
        const templatePath = path.join(__dirname, '../templates', templateFile);
        
        // Provjeri da li template postoji
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: 'Template fajl nije pronađen' });
        }
        
        // Učitaj i vrati template sadržaj
        const content = fs.readFileSync(templatePath, 'utf-8');
        res.json({ content });
        
    } catch (error) {
        console.error('Error loading template:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
