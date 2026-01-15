// js/utils.js - Funciones Matemáticas y de Formato

function parseInputFloat(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(val.toString().replace(',', '.'));
}

function getKey(x, y, z) {
    // Usamos EPSILON_GRID global (definido en index) o un valor fijo
    const gridEpsilon = (typeof window.EPSILON_GRID !== 'undefined') ? window.EPSILON_GRID : 0.001;
    return `${Math.round(x/gridEpsilon)}_${Math.round(y/gridEpsilon)}_${Math.round(z/gridEpsilon)}`;
}

function arePointsEqual(p1, p2) {
    const ep = 0.001; 
    return Math.abs(p1.x - p2.x) < ep && 
           Math.abs(p1.y - p2.y) < ep && 
           Math.abs(p1.z - p2.z) < ep;
}

function parseDiameterToScale(valStr) {
    if(!valStr) return 2; 
    let meters = 0;
    
    if(valStr.toLowerCase().includes('mm')) {
        const match = valStr.match(/(\d+)mm/);
        if (match) { meters = parseFloat(match[1]) / 1000; } 
        else { meters = parseFloat(valStr) / 1000; }
    } else {
        let clean = valStr.replace(/"/g, '').replace('IPS','').replace('CTS','').trim();
        let parts = clean.split(/[- ]/);
        let inches = 0;
        parts.forEach(p => {
            if(p.includes('/')) { 
                const frac = p.split('/'); 
                if(frac.length === 2) inches += parseFloat(frac[0]) / parseFloat(frac[1]); 
            } else { 
                const f = parseFloat(p); 
                if(!isNaN(f)) inches += f; 
            }
        });
        meters = inches * 0.0254;
    }
    
    if(isNaN(meters) || meters === 0) return 2;
    // Usa CONFIG global
    let pixelWidth = meters * window.CONFIG.tileW;
    return Math.max(1.5, pixelWidth);
}

function formatLength(valMeters) { 
    const u = window.UNITS[window.CONFIG.unit]; 
    const val = valMeters * u.factor; 
    return parseFloat(val.toFixed(u.precision)) + " " + u.label; 
}

function parseToMeters(valUser) { 
    const u = window.UNITS[window.CONFIG.unit]; 
    return valUser / u.factor; 
}

function ensureHex(c){ 
    if(c.startsWith('#') && c.length===7) return c; 
    return '#cccccc'; 
}

// ==========================================
// CÁLCULOS DE INGENIERÍA (GAS)
// ==========================================

// Base de datos de Diámetros Internos (Aprox para Sch40)
window.DIAMETROS_INTERNOS_MM = {
    '1/2"': 15.8, '3/4"': 20.9, '1"': 26.6,
    '1-1/4"': 35.0, '1-1/2"': 40.9, '2"': 52.5,
    '2-1/2"': 62.7, '3"': 77.9, '4"': 102.3
};

// Datos de Gases
window.GAS_PROPS = {
    'natural': { s: 0.6, nombre: 'Gas Natural' },
    'glp': { s: 1.52, nombre: 'GLP (Propano)' }
};

/**
 * Calcula la caída de presión usando RENOUARD Lineal (Baja Presión < 100mbar)
 * Fórmula: DeltaP (mmcda) = 23200 * S * L * Q^1.82 * D^-4.82
 */
window.calcularGas = function(diamNominal, longitud, caudal, tipoGas = 'natural') {
    // 1. Obtener diámetro interno en mm
    const D = window.DIAMETROS_INTERNOS_MM[diamNominal];
    if (!D) return { error: "Diámetro no registrado en DB interna" };

    // 2. Propiedades del gas
    const S = window.GAS_PROPS[tipoGas].s;

    // 3. Fórmula Renouard Lineal
    // Convertimos de mmcda (mmH2O) a mbar dividiendo por 10.2
    const factorRenouard = 23200; 
    let caida_mmH2O = factorRenouard * S * longitud * Math.pow(caudal, 1.82) * Math.pow(D, -4.82);
    let caida_mbar = caida_mmH2O / 10.2; 

    // 4. Calcular Velocidad (V = 354 * Q / D^2)
    let velocidad = (354 * caudal) / Math.pow(D, 2);

    return {
        gas: window.GAS_PROPS[tipoGas].nombre,
        diametroInterno: D + " mm",
        caidaPresion: caida_mbar.toFixed(4) + " mbar",
        velocidad: velocidad.toFixed(2) + " m/s",
        longitud: longitud,
        caudal: caudal
    };
};

console.log("✅ Utilidades matemáticas + Física Gas cargadas (js/utils.js)");
