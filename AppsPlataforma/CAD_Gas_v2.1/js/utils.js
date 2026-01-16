// js/utils.js - Funciones Matemáticas, de Formato y UI Utilities

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
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    return ctx.fillStyle;
};

// Cálculo de Flujo de Gas (Mueller)
window.calcularFlujoGas = function(diam, len, caudal, tipoGas, presionEntrada) {
    const S = (tipoGas === 'glp') ? 1.52 : 0.60;
    
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
    
    // Formula simplificada Mueller
    drop = (caudal * caudal * len * S) / (1000 * Math.pow(D, 5));
    
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

// --- FIX SISTEMA DE ARRASTRE (DRAG & DROP) ---
window.makeDraggable = function(el) {
    // Buscamos el header, si no existe usamos el elemento completo
    const header = el.querySelector('.pc-header') || el;
    
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.onmousedown = function(e) {
        // 1. IMPORTANTE: Si clicamos en el botón de cerrar o sus hijos, NO iniciar arrastre
        if(e.target.closest('.pc-close') || e.target.closest('button')) {
            return;
        }

        e.preventDefault(); // Evita selección de texto indeseada al arrastrar
        isDragging = true;
        
        // 2. Capturamos posición inicial del ratón
        startX = e.clientX;
        startY = e.clientY;
        
        // 3. Capturamos posición inicial del elemento (relativa al padre, no al viewport)
        // Esto corrige el bug de que se "pierda" al soltarlo o se resetee.
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;
        
        // 4. Desactivamos transición temporalmente para que el arrastre sea instantáneo (sin lag)
        el.style.transition = "none";

        document.addEventListener('mousemove', elementDrag);
        document.addEventListener('mouseup', closeDragElement);
    };

    function elementDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        // Calcular desplazamiento
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Aplicar nueva posición
        el.style.left = (initialLeft + dx) + "px";
        el.style.top = (initialTop + dy) + "px";
        
        // NOTA: No tocamos 'transform' aquí para no romper la animación de escala CSS
    }

    function closeDragElement() {
        isDragging = false;
        // Restaurar transiciones (vacío vuelve al valor del CSS)
        el.style.transition = ""; 
        
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
    }
};

console.log("✅ Utils cargados (Fixed Draggable System)");
