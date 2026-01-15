// js/utils.js - Funciones Matemáticas y de Formato

// Asegurar que window.UNITS exista si config.js falló
if(!window.UNITS) {
    window.UNITS = { 'm': { factor: 1, label: 'm', precision: 2 } };
}
if(!window.CONFIG) {
    window.CONFIG = { unit: 'm', tileW: 100 };
}

window.parseInputFloat = function(str) {
    if (typeof str === 'number') return str;
    if (!str) return NaN;
    str = str.replace(',', '.');
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
    // Extraer número de strings como '1/2"' o '32mm'
    let num = 1;
    if(diamStr.includes('"')) {
        const frac = diamStr.replace('"','').split('/');
        if(frac.length === 2) num = parseFloat(frac[0])/parseFloat(frac[1]);
        else num = parseFloat(frac[0]);
        return Math.max(2, num * 3); // Escalar pulgadas para visualización
    } 
    else if (diamStr.toLowerCase().includes('mm')) {
        num = parseFloat(diamStr.toLowerCase().replace('mm',''));
        return Math.max(2, num * 0.15); // Escalar mm
    }
    return 2;
};

window.getKey = function(x, y, z) {
    const prec = 1000; // Precisión grid (Epsilon)
    return `${Math.round(x*prec)}_${Math.round(y*prec)}_${Math.round(z*prec)}`;
};

window.ensureHex = function(color) {
    if(!color) return '#cccccc';
    if(color.startsWith('#')) return color;
    // Mapeo básico de colores nombrados si es necesario
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    return ctx.fillStyle;
};

// Cálculo de Flujo de Gas (Mueller)
window.calcularFlujoGas = function(diam, len, caudal, tipoGas, presionEntrada) {
    const S = (tipoGas === 'glp') ? 1.52 : 0.60;
    
    // Diámetro interno aprox (pulgadas)
    let D = 1.0; 
    if(diam.includes('"')) {
        const parts = diam.replace('"','').split('/');
        if(parts.length===2) D = parseFloat(parts[0])/parseFloat(parts[1]);
        else D = parseFloat(parts[0]);
    } else if (diam.includes('mm')) {
        D = parseFloat(diam.replace('mm','')) / 25.4;
    }

    let drop = 0;
    let vel = 0;
    
    const factorK = (tipoGas === 'glp') ? 0.8 : 1.0;
    drop = (caudal * caudal * len * S) / (1000 * Math.pow(D, 5));
    
    // Velocidad (m/s) aprox
    const area = Math.PI * Math.pow((D * 0.0254)/2, 2);
    vel = (caudal / 3600) / area;

    let estado = "OK";
    if (vel > 20) estado = "ALERTA";
    if (vel > 30) estado = "CRÍTICO";
    
    return {
        estado: estado,
        caidaPresion: drop.toFixed(4) + " mbar",
        porcentajeCaida: ((drop/presionEntrada)*100).toFixed(2) + "%",
        velocidad: vel.toFixed(2) + " m/s",
        presionSalida: (presionEntrada - drop).toFixed(2) + " mbar",
        formula: "Mueller (Aprox)",
        alertas: (vel > 20) ? "Velocidad excesiva" : ""
    };
};

window.arePointsEqual = function(p1, p2) {
    const e = 0.001;
    return Math.abs(p1.x - p2.x) < e && Math.abs(p1.y - p2.y) < e && Math.abs(p1.z - p2.z) < e;
};

// --- FIX FUNCIÓN DE ARRASTRE ---
window.makeDraggable = function(el) {
    const header = el.querySelector('.pc-header') || el;
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.onmousedown = function(e) {
        // CORRECCIÓN CLAVE: Si el clic es en el botón de cerrar, no iniciar Drag
        if(e.target.classList.contains('pc-close') || e.target.closest('.pc-close')) {
            return;
        }

        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = el.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        document.addEventListener('mouseup', closeDragElement);
        document.addEventListener('mousemove', elementDrag);
    };

    function elementDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        el.style.left = (initialLeft + dx) + "px";
        el.style.top = (initialTop + dy) + "px";
        
        el.style.transform = "none"; 
        el.style.opacity = "1";
    }

    function closeDragElement() {
        isDragging = false;
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
    }
};

console.log("✅ Utils cargados (Drag fix)");
