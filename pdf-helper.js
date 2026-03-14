// pdf-helper.js - dodaj u svaki HTML fajl gdje trebaju PDF-i

/**
 * Download PDF forma
 * @param {number} projektId - ID projekta
 * @param {string} formaType - Tip forme (npr. 'forma-ovlascenja', 'forma-ugovor', itd.)
 */
function downloadPDF(projektId, formaType) {
    if (!projektId) {
        alert('Greška: ID projekta nije pronađen');
        return;
    }
    
    const url = `/api/pdf/${formaType}/${projektId}`;
    
    // Kreiraj link i pokreni download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formaType}-${projektId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Download PDF forma sa custom filename-om
 * @param {number} projektId - ID projekta
 * @param {string} formaType - Tip forme
 * @param {string} customName - Custom naziv fajla (bez .pdf)
 */
function downloadPDFCustom(projektId, formaType, customName) {
    if (!projektId) {
        alert('Greška: ID projekta nije pronađen');
        return;
    }
    
    const url = `/api/pdf/${formaType}/${projektId}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${customName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Download PDF sa loading indicatorom
 * @param {number} projektId - ID projekta
 * @param {string} formaType - Tip forme
 * @param {HTMLElement} buttonElement - Button koji se klikne (za loading state)
 */
async function downloadPDFWithLoader(projektId, formaType, buttonElement) {
    if (!projektId) {
        alert('Greška: ID projekta nije pronađen');
        return;
    }
    
    try {
        // Promijeni dugme u loading state
        const originalText = buttonElement.textContent;
        buttonElement.textContent = 'Generiše PDF...';
        buttonElement.disabled = true;
        
        // Preuzmи PDF
        const url = `/api/pdf/${formaType}/${projektId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Konvertuj u blob
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        
        // Kreiraj link i pokreni download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${formaType}-${projektId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Oslobodi URL
        window.URL.revokeObjectURL(downloadUrl);
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        alert('Greška pri generisanju PDF-a: ' + error.message);
    } finally {
        // Vrati dugme u normalno stanje
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
    }
}
