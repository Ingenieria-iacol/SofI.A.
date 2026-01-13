// js/utils.js
// Funciones Matemáticas y de Ayuda

// Convierte texto (ej: "10,5") a número flotante seguro
function parseInputFloat(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(val.toString().replace(',', '.'));
}

// Genera una clave única para coordenadas (para el mapa de nodos)
function getKey(x, y, z) {
    // Usamos EPSILON_GRID global o un valor fijo si no existe
    const gridEpsilon = (typeof window.EPSILON_GRID !== 'undefined') ? window.EPSILON_GRID : 0.001;
    return `${Math.round(x/gridEpsilon)}_${Math.round(y/gridEpsilon)}_${Math.round(z/gridEpsilon)}`;
}

// Compara si dos puntos 3D son prácticamente iguales
function arePointsEqual(p1, p2) {
    const ep = 0.001; // Epsilon local
    return Math.abs(p1.x - p2.x) < ep && 
           Math.abs(p1.y - p2.y) < ep && 
           Math.abs(p1.z - p2.z) < ep;
}

// Convierte un diámetro (ej: "1/2") a grosor en píxeles
function parseDiameterToScale(valStr) {
    if(!valStr) return 2; 
    let meters = 0;
    
    // Si viene en milímetros
    if(valStr.toLowerCase().includes('mm')) {
        const match = valStr.match(/(\d+)mm/);
        if (match) { meters = parseFloat(match[1]) / 1000; } 
        else { meters = parseFloat(valStr) / 1000; }
    } else {
        // Si viene en pulgadas (con fracciones)
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

// Formatea metros a la unidad seleccionada (m, cm, mm)
function formatLength(valMeters) { 
    const u = window.UNITS[window.CONFIG.unit]; 
    const val = valMeters * u.factor; 
    return parseFloat(val.toFixed(u.precision)) + " " + u.label; 
}

// Convierte de la unidad del usuario a metros
function parseToMeters(valUser) { 
    const u = window.UNITS[window.CONFIG.unit]; 
    return valUser / u.factor; 
}

// Asegura que un color sea hexadecimal completo
function ensureHex(c){ 
    if(c.startsWith('#') && c.length===7) return c; 
    return '#cccccc'; 
}

console.log("✅ Utilidades matemáticas cargadas");
