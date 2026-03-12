// ============================================
// FORM CONTROLLER
// ============================================

// Mock baza podataka (kasnije zameni sa pravom bazom)
const forms = {
    'potvrda': {
        id: 'potvrda',
        name: 'Potvrda o usklađenosti',
        phase: 1,
        fields: ['company', 'address', 'kw', 'inverter_type']
    },
    'zahtev': {
        id: 'zahtev',
        name: 'Zahtev za prilagođenje mernog mesta',
        phase: 2,
        fields: ['company', 'meter_id', 'address']
    },
    'ugovor': {
        id: 'ugovor',
        name: 'Zahtev za zaključenje ugovora',
        phase: 3,
        fields: ['company', 'contract_type', 'start_date']
    }
};

// GET sve dostupne forme
exports.getAllForms = async (req, res) => {
    try {
        res.json({
            success: true,
            forms: Object.values(forms)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// GET specifičnu formu po ID-u
exports.getFormById = async (req, res) => {
    try {
        const { formId } = req.params;
        const form = forms[formId];
        
        if (!form) {
            return res.status(404).json({
                success: false,
                error: 'Forma nije pronađena'
            });
        }
        
        res.json({
            success: true,
            form: form
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// POST - Čuva formu (draft)
exports.saveForm = async (req, res) => {
    try {
        const { formId, data } = req.body;
        
        if (!formId || !data) {
            return res.status(400).json({
                success: false,
                error: 'formId i data su obavezni'
            });
        }
        
        // Validiraj formu da postoji
        const form = forms[formId];
        if (!form) {
            return res.status(404).json({
                success: false,
                error: 'Forma nije pronađena'
            });
        }
        
        // TODO: Čuva u bazu podataka
        console.log(`Form ${formId} saved:`, data);
        
        res.json({
            success: true,
            message: 'Forma je uspešno sačuvana',
            formId: formId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// POST - Validira formu
exports.validateForm = async (req, res) => {
    try {
        const { formId, data } = req.body;
        
        if (!formId || !data) {
            return res.status(400).json({
                success: false,
                error: 'formId i data su obavezni'
            });
        }
        
        const form = forms[formId];
        if (!form) {
            return res.status(404).json({
                success: false,
                error: 'Forma nije pronađena'
            });
        }
        
        // Prosledi validaciju
        const errors = {};
        const warnings = {};
        
        // Primer validacije
        form.fields.forEach(field => {
            if (!data[field]) {
                errors[field] = `${field} je obavezan`;
            }
        });
        
        const isValid = Object.keys(errors).length === 0;
        
        res.json({
            success: true,
            isValid: isValid,
            errors: errors,
            warnings: warnings,
            message: isValid ? 'Forma je validna' : 'Forma ima greške'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
