// js/utils.js - Matemáticas, Formato y Física de Fluidos
console.log("🔹 Cargando Utils...");

window.parseInputFloat = function(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(val.toString().replace(',', '.'));
};

window.getKey = function(x, y, z) {
    const gridEpsilon = (typeof window.EPSILON_GRID !== 'undefined') ? window.EPSILON_GRID : 0.001;
    return `${Math.round(x/gridEpsilon)}_${Math.round(y/gridEpsilon)}_${Math.round(z/gridEpsilon)}`;
};

window.arePointsEqual = function(p1, p2) {
    const ep = 0.001; 
    return Math.abs(p1.x - p2.x) < ep && 
           Math.abs(p1.y - p2.y) < ep && 
           Math.abs(p1.z - p2.z) < ep;
};

// Convierte diámetros nominales a escala visual
window.parseDiameterToScale = function(valStr) {
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
    let pixelWidth = meters * (window.CONFIG ? window.CONFIG.tileW : 100);
    return Math.max(1.5, pixelWidth);
};

window.formatLength = function(valMeters) { 
    const u = window.UNITS[window.CONFIG.unit]; 
    const val = valMeters * u.factor; 
    return parseFloat(val.toFixed(u.precision)) + " " + u.label; 
};

window.parseToMeters = function(valUser) { 
    const u = window.UNITS[window.CONFIG.unit]; 
    return valUser / u.factor; 
};

window.ensureHex = function(c){ 
    if(c && c.startsWith('#') && c.length===7) return c; 
    return '#cccccc'; 
};

window.GAS_PROPS = {
    'natural': { s: 0.60, nombre: 'Gas Natural (Metano)', pcs: 10.35 }, 
    'glp':     { s: 1.52, nombre: 'GLP (Propano/Butano)', pcs: 25.9 }
};

window.DIAMETROS_INTERNOS_MM = {
    '1/4"': 9.2,   '3/8"': 12.5,
    '1/2"': 15.8,  '3/4"': 20.9,
    '1"': 26.6,    '1-1/4"': 35.1,
    '1-1/2"': 40.9,'2"': 52.5,
    '2-1/2"': 62.7,'3"': 77.9,
    '4"': 102.3,   '6"': 154.1,
    '1/4" L': 6.35, '3/8" L': 10.9, '1/2" L': 13.8,
    '5/8" L': 16.9, '3/4" L': 19.9, '1" L': 26.0,
    '1/2" IPS': 15.0, '3/4" IPS': 20.0, '1" IPS': 26.0,
    '20mm': 16.0, '25mm': 20.0, '32mm': 26.0, '40mm': 32.6, '63mm': 51.4
};

// MOTOR DE CÁLCULO MUELLER (Recuperado)
window.calcularFlujoGas = function(diamNominal, longitud_m, caudal_m3h, tipoGas = 'natural', presionEntrada_mbar = 23) {
    const D_mm = window.DIAMETROS_INTERNOS_MM[diamNominal];
    if (!D_mm) return { error: `Diámetro '${diamNominal}' no catalogado para cálculo.` };
    if (longitud_m <= 0 || caudal_m3h <= 0) return { error: "Longitud y Caudal deben ser mayores a 0." };

    const gas = window.GAS_PROPS[tipoGas];
    if (!gas) return { error: "Tipo de gas no válido." };

    const Q_cfh = caudal_m3h * 35.3147; 
    const L_ft = longitud_m * 3.28084;
    const D_in = D_mm / 25.4;
    const S = gas.s;

    let caida_mbar = 0;
    let P_salida_mbar = 0;
    let regimen = "";

    if (presionEntrada_mbar < 70) {
        regimen = "Baja Presión (Mueller Low)";
        const term1 = 2971 * Math.pow(D_in, 2.725);
        const term2 = Math.pow(S, 0.425);
        const factor = Q_cfh / (term1 / term2); 
        const h_in_per_ft = Math.pow(factor, (1 / 0.575)); 
        const h_total_in_wc = h_in_per_ft * L_ft;
        caida_mbar = h_total_in_wc * 2.4908;
    } else {
        regimen = "Media Presión (Mueller High)";
        const P_atm_psi = 14.696;
        const P1_man_psi = presionEntrada_mbar * 0.0145038;
        const P1_abs_psi = P1_man_psi + P_atm_psi;
        const term1 = 2826 * Math.pow(D_in, 2.725);
        const term2 = Math.pow(S, 0.425);
        const factor = Q_cfh / (term1 / term2);
        const diff_sq_psi = Math.pow(factor, (1 / 0.575)) * L_ft; 
        const P2_sq_abs = Math.pow(P1_abs_psi, 2) - diff_sq_psi;
        if (P2_sq_abs < 0) return { error: "La caída excede la presión de entrada." };
        const P2_abs_psi = Math.sqrt(P2_sq_abs);
        const caida_psi = P1_abs_psi - P2_abs_psi;
        caida_mbar = caida_psi * 68.9476; 
    }

    P_salida_mbar = presionEntrada_mbar - caida_mbar;
    const P_atm_mbar = 1013.25;
    const P_media_mbar = P_atm_mbar + (presionEntrada_mbar + P_salida_mbar) / 2;
    const factor_compresion = P_atm_mbar / P_media_mbar; 
    const caudal_real_m3s = (caudal_m3h * factor_compresion) / 3600;
    const area_m2 = Math.PI * Math.pow(D_mm / 1000 / 2, 2);
    const velocidad_ms = caudal_real_m3s / area_m2;

    let estado = "OK";
    let alertas = [];
    if (velocidad_ms > 30) { estado = "CRÍTICO"; alertas.push("Velocidad >30m/s"); }
    else if (velocidad_ms > 20) { estado = "ALERTA"; alertas.push("Velocidad >20m/s"); }
    
    const porcentajeCaida = (caida_mbar / presionEntrada_mbar) * 100;
    if (presionEntrada_mbar < 70 && caida_mbar > 1.5) { alertas.push("Caída > 1.5 mbar"); }
    if (porcentajeCaida > 10) { alertas.push("Caída > 10%"); }
    if (alertas.length > 0 && estado === "OK") estado = "OBSERVAR";

    return {
        formula: regimen,
        gas: gas.nombre,
        diametro: diamNominal + ` (${D_mm}mm int)`,
        longitud: longitud_m.toFixed(2) + " m",
        caudal: caudal_m3h.toFixed(2) + " m³/h",
        presionEntrada: presionEntrada_mbar.toFixed(2) + " mbar",
        caidaPresion: caida_mbar.toFixed(4) + " mbar",
        porcentajeCaida: porcentajeCaida.toFixed(2) + "%",
        presionSalida: P_salida_mbar.toFixed(2) + " mbar",
        velocidad: velocidad_ms.toFixed(2) + " m/s",
        estado: estado,
        alertas: alertas.join(", ")
    };
};
