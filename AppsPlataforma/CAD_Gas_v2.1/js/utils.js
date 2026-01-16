// js/utils.js - Funciones Matemáticas, de Formato y UI Utilities

// Inicialización segura de globales
if(!window.UNITS) {
    window.UNITS = { 'm': { factor: 1, label: 'm', precision: 2 } };
}
if(!window.CONFIG) {
    window.CONFIG = { unit: 'm', tileW: 100 };
}

window.parseInputFloat = function(str) {
    if (typeof str === 'number') return str;
    if (!str) return NaN;
    str = str.toString().replace(',', '.');
    return parseFloat(str);
};

window.formatLength = function(valRaw) {
    const u = window.UNITS[window.CONFIG.unit];
    if (!u) return valRaw.toFixed(2);
    const val = valRaw * u.factor;
    return val.toFixed(u.precision) + ' ' + u.label;
};

window.parseToMeters = function(valUser) {
    const u = window.UNITS[window.CONFIG.unit];
    if (!u) return valUser;
    return valUser / u.factor;
};

window.parseDiameterToScale = function(diamStr) {
    if(!diamStr) return 2;
    let num = 1;
    if(diamStr.includes('"')) {
        const frac = diamStr.replace('"','').split('/');
        if(frac.length === 2) num = parseFloat(frac[0])/parseFloat(frac[1]);
        else num = parseFloat(frac[0]);
        return Math.max(2, num * 3); 
    } 
    else if (diamStr.toLowerCase().includes('mm')) {
        num = parseFloat(diamStr.toLowerCase().replace('mm',''));
        return Math.max(2, num * 0.15);
    }
    return 2;
};

window.getKey = function(x, y, z) {
    const prec = 1000; 
    return `${Math.round(x*prec)}_${Math.round(y*prec)}_${Math.round(z*prec)}`;
};

window.ensureHex = function(color) {
    if(!color) return '#cccccc';
    if(color.startsWith('#')) return color;
    // Fallback para colores nombrados
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    return ctx.fillStyle;
};

// --- CÁLCULO DE FLUJO DE GAS (Mueller) ---
window.calcularFlujoGas = function(diam, len, caudal, tipoGas, presionEntrada) {
    // Constantes de Gravedad Específica (S)
    const S = (tipoGas === 'glp') ? 1.52 : 0.60;
    
    // Parsear Diámetro a Pulgadas Reales (D)
    let D = 1.0; 
    if(diam && diam.includes('"')) {
        const parts = diam.replace('"','').split('/');
        if(parts.length===2) D = parseFloat(parts[0])/parseFloat(parts[1]);
        else D = parseFloat(parts[0]);
    } else if (diam && diam.toLowerCase().includes('mm')) {
        D = parseFloat(diam.replace('mm','')) / 25.4;
    }

    // Protecciones contra valores cero o negativos
    if (len <= 0.001) len = 0.001; 
    if (D <= 0) D = 0.5;
    if (caudal < 0) caudal = 0;

    // Fórmula Mueller (Baja Presión - Simplificada)
    // h = (Q^2 * L * S) / (C * D^5)
    // Usamos constante C=1000 aprox para mantener consistencia con tu versión anterior
    const drop = (caudal * caudal * len * S) / (1000 * Math.pow(D, 5));
    
    // Cálculo de Velocidad
    const area = Math.PI * Math.pow((D * 0.0254)/2, 2); // Area en m2
    let vel = 0;
    if (area > 0) vel = (caudal / 3600) / area; // m/s

    // Estado según velocidad
    let estado = "OK";
    if (vel > 20) estado = "ALERTA";
    if (vel > 30) estado = "CRÍTICO";
    
    // Presión final
    const pSalida = Math.max(0, presionEntrada - drop);

    return {
        estado: estado,
        caidaPresion: drop, // Valor numérico para lógica
        caidaPresionStr: drop.toFixed(4) + " mbar",
        porcentajeCaida: (presionEntrada > 0 ? ((drop/presionEntrada)*100).toFixed(2) : "0") + "%",
        velocidad: vel.toFixed(2) + " m/s",
        presionSalida: pSalida, // Valor numérico para lógica
        presionSalidaStr: pSalida.toFixed(2) + " mbar",
        formula: "Mueller (Aprox)",
        alertas: (vel > 20) ? "Velocidad excesiva" : ""
    };
};

window.arePointsEqual = function(p1, p2) {
    const e = 0.001;
    return Math.abs(p1.x - p2.x) < e && Math.abs(p1.y - p2.y) < e && Math.abs(p1.z - p2.z) < e;
};

// --- FIX SISTEMA DE ARRASTRE (DRAG & DROP) ---
window.makeDraggable = function(el) {
    if(!el) return;
    const header = el.querySelector('.pc-header') || el;
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.onmousedown = function(e) {
        if(e.target.closest('.pc-close') || e.target.closest('button') || e.target.closest('input')) {
            return;
        }
        e.preventDefault(); 
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;
        el.style.transition = "none";
        document.addEventListener('mousemove', elementDrag);
        document.addEventListener('mouseup', closeDragElement);
    };

    function elementDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = (initialLeft + dx) + "px";
        el.style.top = (initialTop + dy) + "px";
    }

    function closeDragElement() {
        isDragging = false;
        el.style.transition = ""; 
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
    }
};
