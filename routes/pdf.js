import express from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper funkcija za učitavanje i procesiranje HTML template-a
function loadAndProcessTemplate(templatePath, variables) {
    let html = fs.readFileSync(templatePath, 'utf-8');
    
    // Zamijeni sve {{placeholder}} sa vrijednostima iz variables objekta
    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, variables[key] || '');
    });
    
    return html;
}

// Helper funkcija za konverziju HTML-a u obican text za PDFKit
function htmlToText(html) {
    // Uklanja HTML tagove i čuva samo tekst
    return html
        .replace(/<style[^>]*>.*?<\/style>/gs, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();
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
            datum: formattedDate
        };
        
        // Učitaj HTML template
        const templatePath = path.join(__dirname, '../templates/forma-ovlascenja-template.html');
        const processedHtml = loadAndProcessTemplate(templatePath, variables);
        
        // Konvertuj HTML u obican tekst
        const plainText = htmlToText(processedHtml);
        
        // Kreiraj PDF sa PDFKit
        const doc = new PDFDocument({
            bufferPages: true,
            margin: 40
        });
        
        // Postavi response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ovlascenje-${projektId}.pdf"`);
        
        // Pipe PDF u response
        doc.pipe(res);
        
        // Dodaj sadržaj u PDF
        doc.fontSize(14).font('Helvetica-Bold').text('OVLAŠĆENJE / PUNOMOĆ', { align: 'center' });
        doc.moveDown();
        
        // Glavni tekst - dijelovi sa indentacijom
        const fontSize = 11;
        doc.fontSize(fontSize).font('Helvetica');
        
        // Prvi paragraf - Davalac ovlašćenja
        const davalacText = `${variables.kupac_naziv}, ${variables.kupac_adresa}, ${variables.kupac_mjesto}, matični broj: ${variables.kupac_mb}, PIB: ${variables.kupac_pib} ovlašćuje:`;
        doc.text(davalacText, { align: 'justify', width: 480 });
        doc.moveDown();
        
        // Drugi paragraf - Ovlašteno lice
        const ovlascenoText = `GO4ENERGY DOO, Cara Dušana 68, Pančevo, PIB: 114374550, MB: 22013980 i Uzon Igora, br.lk.: 008296970, JMBG: 1106993860022, da u naše ime preduzme sve potrebne radnje pred nadležnim državnim i upravnim organima, organima lokalne samouprave i javnim preduzećima radi ishodovanja rešenja „Odobrenje za priključenje" solarne elektrane ${variables.projekt_naziv} snage ${variables.projekt_snaga} kW.`;
        doc.text(ovlascenoText, { align: 'justify', width: 480 });
        doc.moveDown(2);
        
        // Lokacija i datum
        doc.fontSize(fontSize).font('Helvetica');
        doc.text(`U ${variables.kupac_mjesto}, ${variables.datum} godine`);
        doc.moveDown(2);
        
        // Potpis sekcija
        doc.fontSize(fontSize).font('Helvetica-Bold').text('Davalac ovlašćenja:', { indent: 40 });
        doc.moveDown(3);
        doc.fontSize(fontSize).font('Helvetica').text('______________________________', { indent: 40 });
        doc.fontSize(fontSize - 1).text(variables.kupac_direktor, { indent: 40 });
        
        // Završi PDF
        doc.end();
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
