// js/events.js - Eventos del Mouse y Teclado

const svg = document.getElementById('lienzo-cad');

// Desactivar menú contextual
svg.addEventListener('contextmenu', e => e.preventDefault());

// MOUSE DOWN
svg.addEventListener('mousedown', e => {
    if(e.button === 2) { 
        window.estado.action = 'pan'; 
        window.estado.startAction = {x: e.clientX, y: e.clientY}; 
    } else if(e.button === 0) { 
        window.estado.startAction = {x: e.clientX, y: e.clientY}; 
        if (window.estado.tool === 'select' && window.estado.hoverID) { 
            window.estado.action = 'potential_drag'; 
        } else { 
            // INICIO ROTACIÓN ORBITAL
            window.estado.action = 'rotate'; 
            
            // 1. Definir Pivote (Objeto seleccionado o Centro Pantalla)
            let pivotIso = { x: 0, y: 0, z: 0 };
            if (window.estado.selID) {
                const el = window.elementos.find(x => x.id === window.estado.selID);
                if (el) pivotIso = { x: el.x, y: el.y, z: el.z };
            }
            
            // 2. Guardar estado inicial para cálculo delta
            // Calculamos dónde está ese punto HOY en pantalla
            const screenBefore = window.isoToScreen(pivotIso.x, pivotIso.y, pivotIso.z);
            
            window.estado.pivotData = {
                iso: pivotIso,
                screenX: screenBefore.x * window.estado.view.scale + window.estado.view.x,
                screenY: screenBefore.y * window.estado.view.scale + window.estado.view.y,
                startAngle: window.estado.view.angle
            };
        } 
    }
});

// MOUSE MOVE
svg.addEventListener('mousemove', e => {
    const p = window.getSVGPoint(e.clientX, e.clientY);

    // --- ROTACIÓN ORBITAL ---
    if(window.estado.action === 'rotate') { 
        const deltaX = (e.clientX - window.estado.startAction.x) * 0.01;
        window.estado.view.angle = window.estado.pivotData.startAngle + deltaX;
        
        // CORRECCIÓN ORBITAL: Mover la cámara para que el objeto siga bajo el mouse
        const pIso = window.estado.pivotData.iso;
        const newScreenRaw = window.isoToScreen(pIso.x, pIso.y, pIso.z);
        
        window.estado.view.x = window.estado.pivotData.screenX - (newScreenRaw.x * window.estado.view.scale);
        window.estado.view.y = window.estado.pivotData.screenY - (newScreenRaw.y * window.estado.view.scale);
        
        if(typeof updateTransform === 'function') updateTransform(); 
        if(typeof renderScene === 'function') renderScene();
        return; 
    }

    // --- PAN ---
    if(window.estado.action === 'pan') { 
        window.estado.view.x += e.clientX - window.estado.startAction.x; 
        window.estado.view.y += e.clientY - window.estado.startAction.y; 
        window.estado.startAction = {x: e.clientX, y: e.clientY}; 
        if(typeof updateTransform === 'function') updateTransform(); 
        return; 
    }
    
    // --- CÁLCULO COORDENADAS MOUSE ---
    const zOffsetHeight = (window.estado.currentZ || 0) * window.CONFIG.tileW * 0.7;
    // Si la vista está invertida, la altura visual cambia
    const pitch = window.estado.view.pitch || 1;
    const adjustedY = p.y + (zOffsetHeight * pitch);
    
    const isoRaw = window.screenToIso(p.x, adjustedY);
    window.estado.mouseIso = { x: isoRaw.x, y: isoRaw.y };
    
    // --- SNAP ---
    let sn = null; let snID = null;
    if (window.CONFIG.enableSnap) {
        const tol = window.CONFIG.snapRadius / window.estado.view.scale;
        for (let i = 0; i < window.elementos.length; i++) {
            const el = window.elementos[i];
            if (el.visible === false) continue;
            // Optimización: bounding box simple
            if (Math.abs(el.x - window.estado.mouseIso.x) > 10 && Math.abs(el.y - window.estado.mouseIso.y) > 10) continue;

            const pts = window.getSnapPoints(el); 
            for (let j = 0; j < pts.length; j++) {
                const pt = pts[j];
                const s = window.isoToScreen(pt.x, pt.y, pt.z); 
                const distSq = (p.x - s.x)**2 + (p.y - s.y)**2;
                if(distSq < tol**2) { sn = pt; snID = el.id; break; }
            }
            if (sn) break;
        }
    }
    window.estado.snapped = sn;
    if (snID) window.estado.hoverID = snID; 
    
    // --- DRAGGING ---
    if (window.estado.action === 'dragging' && window.estado.selID) {
        const el = window.elementos.find(x => x.id === window.estado.selID);
        if (el) {
            const gridX = Math.round(window.estado.mouseIso.x * 10) / 10;
            const gridY = Math.round(window.estado.mouseIso.y * 10) / 10;
            const targetPos = window.estado.snapped || { x: gridX, y: gridY, z: el.z };
            
            const diffX = targetPos.x - el.x;
            const diffY = targetPos.y - el.y;
            let diffZ = 0;
            if (window.estado.snapped && window.estado.snapped.z !== undefined) {
                 diffZ = window.estado.snapped.z - el.z;
            }

            if (Math.abs(diffX) > 0.001 || Math.abs(diffY) > 0.001 || Math.abs(diffZ) > 0.001) {
                 if(typeof window.moverConConexiones === 'function') window.moverConConexiones(el.id, diffX, diffY, diffZ);
                 if(typeof renderScene === 'function') renderScene();
            }
        }
    } else if (window.estado.action === 'potential_drag') {
            const distDrag = Math.hypot(e.clientX - window.estado.startAction.x, e.clientY - window.estado.startAction.y);
            if(distDrag > 5) { 
                window.estado.action = 'dragging'; 
                if(!window.estado.selID) { window.estado.selID = window.estado.hoverID; if(typeof updatePropsPanel === 'function') updatePropsPanel(); } 
                window.saveState(); 
            }
    }
    
    // --- HOVER ---
    if(window.estado.tool === 'select' && !window.estado.action && !window.estado.snapped) {
        const tol = 8 / window.estado.view.scale; let h = null; let minD = tol; 
        window.elementos.forEach(el => {
            if(el.visible === false) return; 
            const s = window.isoToScreen(el.x, el.y, el.z); let d = 10000;
            // Distancia simple al centro (Mejorar con BBox en futuro)
            d = Math.sqrt((p.x - s.x)**2 + (p.y - s.y)**2);
            if(d < minD) { minD=d; h=el.id; }
        });
        if(h !== window.estado.hoverID) { window.estado.hoverID = h; if(typeof renderEffects === 'function') renderEffects(); }
    }
    
    if(typeof renderInterface === 'function') renderInterface();
});

// MOUSE UP
window.addEventListener('mouseup', (e) => {
    const dist = Math.abs(e.clientX - window.estado.startAction.x) + Math.abs(e.clientY - window.estado.startAction.y);
    const isClick = dist < 5;
    if (isClick && (window.estado.action === 'rotate' || window.estado.action === 'potential_drag')) { 
        if(typeof window.handleCanvasClick === 'function') window.handleCanvasClick(e); 
    }
    if (window.estado.action === 'dragging') window.saveState();
    window.estado.action = null; 
});

// ZOOM
window.addEventListener('wheel', e => {
    e.preventDefault();
    let s = window.estado.view.scale * (e.deltaY > 0 ? 0.9 : 1.1);
    if(s < 0.1) s = 0.1; if(s > 20) s = 20;
    
    // Zoom hacia el mouse
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; 
    const mouseY = e.clientY - rect.top;
    const oldScale = window.estado.view.scale;
    
    window.estado.view.x = mouseX - (mouseX - window.estado.view.x) * (s / oldScale);
    window.estado.view.y = mouseY - (mouseY - window.estado.view.y) * (s / oldScale);
    window.estado.view.scale = s;
    
    if(typeof updateTransform === 'function') updateTransform(); 
}, { passive: false });

console.log("✅ Eventos cargados");
