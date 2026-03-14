import express from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Pomoćna funkcija za HTML to plain text konverziju
function htmlToText(html) {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();
}

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
        const processedHtml = loadAndProcessTemplate(templatePath, variables);
        
        // Kreiraj PDF sa PDFKit
        const doc = new PDFDocument({
            bufferPages: true,
            margin: 40,
            size: 'A4',
            info: {
                Title: 'Ovlašćenje',
                Author: 'GO4ENERGY',
                Subject: 'Forma ovlašćenja za prosumera'
            }
        });
        
        // Error handling
        doc.on('error', (err) => {
            console.error('PDFKit error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'PDF generation error: ' + err.message });
            }
        });
        
        // Postavi response headers
        res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''ovlascenje-${projektId}.pdf`);
        
        // Pipe PDF u response
        doc.pipe(res);
        
        // Dodaj sadržaj u PDF - koristi Times-Roman font (ima Cyrillic podrsku)
        doc.fontSize(16).font('Times-Roman').text('OVLAŠĆENJE / PUNOMOĆ', { align: 'center' });
        doc.moveDown();
        
        // Glavni tekst
        const fontSize = 11;
        doc.fontSize(fontSize).font('Times-Roman');
        
        // Prvi paragraf - Davalac ovlašćenja
        const davalacText = `${variables.kupac_naziv}, ${variables.kupac_adresa}, ${variables.kupac_mjesto}, matični broj: ${variables.kupac_mb}, PIB: ${variables.kupac_pib} ovlašćuje:`;
        doc.text(davalacText, { align: 'left', width: 480 });
        doc.moveDown();
        
        // Drugi paragraf - Ovlašteno lice
        const ovlascenoText = `GO4ENERGY DOO, Cara Dušana 68, Pančevo, PIB: 114374550, MB: 22013980 i Uzon Igora, br.lk.: 008296970, JMBG: 1106993860022, da u naše ime preduzme sve potrebne radnje pred nadležnim državnim i upravnim organima, organima lokalne samouprave i javnim preduzećima radi ishodovanja rešenja „Odobrenje za priključenje" solarne elektrane ${variables.projekt_naziv} snage ${variables.projekt_snaga} kW.`;
        doc.text(ovlascenoText, { align: 'left', width: 480 });
        doc.moveDown(2);
        
        // Lokacija i datum
        doc.fontSize(fontSize).font('Times-Roman');
        doc.text(`U ${variables.kupac_mjesto}, ${variables.datum} godine`);
        doc.moveDown(2);
        
        // Potpis sekcija
        doc.fontSize(fontSize).font('Times-Roman').text('Davalac ovlašćenja:', { indent: 40 });
        doc.moveDown(3);
        doc.fontSize(fontSize).font('Times-Roman').text('______________________________', { indent: 40 });
        doc.fontSize(fontSize - 1).text(variables.kupac_direktor, { indent: 40 });
        
        // Završi PDF
        doc.end();
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// GET /api/pdf/forma-ugovor/:projektId
router.get('/forma-ugovor/:projektId', async (req, res) => {
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
        const processedHtml = loadAndProcessTemplate(templatePath, variables);
        
        const doc = new PDFDocument({
            bufferPages: true,
            margin: 40,
            size: 'A4'
        });
        
        doc.on('error', (err) => {
            console.error('PDFKit error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'PDF generation error' });
            }
        });
        
        res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''ugovor-${projektId}.pdf`);
        
        doc.pipe(res);
        
        doc.fontSize(16).font('Times-Roman').text('UGOVOR O ISHODOVANJU', { align: 'center' });
        doc.moveDown();
        doc.fontSize(11).font('Times-Roman').text(`${variables.kupac_naziv} u ${variables.kupac_mjestu}, ${variables.datum}. godine`);
        doc.moveDown(2);
        
        const tekst = `Ovaj dokument potvrđuje da je ${variables.kupac_naziv} započeo proces ishodovanja dozvola za priključenje solarne elektrane snage ${variables.projekt_snaga} kW na lokaciji ${variables.kupac_adresa}.`;
        doc.fontSize(11).font('Times-Roman').text(tekst);
        
        doc.end();
        
    } catch (error) {
        console.error('Error:', error);
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