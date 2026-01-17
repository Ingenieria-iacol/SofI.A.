// js/events.js - Control de Eventos (Multi-Select & Escape Fix)

const svg = document.getElementById('lienzo-cad');

// Desactivar menú contextual
svg.addEventListener('contextmenu', e => e.preventDefault());

// Mouse Down
svg.addEventListener('mousedown', e => {
    if(e.button === 2) { 
        window.estado.action = 'pan'; 
        window.estado.startAction = {x: e.clientX, y: e.clientY}; 
        return; 
    }
    if(e.button === 0) { 
        window.estado.startAction = {x: e.clientX, y: e.clientY}; 
        // Si estamos sobre un objeto que YA está seleccionado, iniciamos potencial arrastre (Drag)
        // Esto permite mover grupos seleccionados sin deseleccionarlos
        if (window.estado.tool === 'select' && window.estado.hoverID) { 
            if (window.estado.selection.includes(window.estado.hoverID)) {
                window.estado.action = 'potential_drag';
            } else {
                // Si no está seleccionado, el click lo seleccionará, pero el drag potencial sigue
                window.estado.action = 'potential_drag';
            }
        } else { 
            window.estado.action = 'rotate'; 
        } 
    }
});

// Mouse Move
svg.addEventListener('mousemove', e => {
    const p = getSVGPoint(e.clientX, e.clientY);

    // ROTAR
    if(window.estado.action === 'rotate') { 
        const mx_local = (e.clientX - window.estado.view.x) / window.estado.view.scale;
        const my_local = (e.clientY - window.estado.view.y) / window.estado.view.scale;
        const pivotIso = screenToIso(mx_local, my_local);
        window.estado.view.angle += (e.clientX - window.estado.startAction.x) * 0.01;
        const newScreenPos = isoToScreen(pivotIso.x, pivotIso.y, 0);
        window.estado.view.x = e.clientX - (newScreenPos.x * window.estado.view.scale);
        window.estado.view.y = e.clientY - (newScreenPos.y * window.estado.view.scale);
        window.estado.startAction = {x: e.clientX, y: e.clientY}; 
        renderGrid(); renderScene(); renderEffects(); updateTransform(); 
        return; 
    }

    // PAN (Mover cámara)
    if(window.estado.action === 'pan') { 
        window.estado.view.x += e.clientX - window.estado.startAction.x; 
        window.estado.view.y += e.clientY - window.estado.startAction.y; 
        window.estado.startAction = {x: e.clientX, y: e.clientY}; 
        updateTransform(); 
        return; 
    }
    
    // Calculo de coordenadas mouse
    const zOffsetHeight = (window.estado.currentZ || 0) * window.CONFIG.tileW * 0.7;
    const adjustedY = p.y + zOffsetHeight;
    const isoRaw = screenToIso(p.x, adjustedY);
    window.estado.mouseIso = { x: isoRaw.x, y: isoRaw.y };
    
    // SNAP
    let sn = null; let snID = null;
    if (window.CONFIG.enableSnap) {
        const tol = window.CONFIG.snapRadius / window.estado.view.scale;
        for (let i = 0; i < window.elementos.length; i++) {
            const el = window.elementos[i];
            if (el.visible === false) continue;
            if (Math.abs(el.x - window.estado.mouseIso.x) > 10 && Math.abs(el.y - window.estado.mouseIso.y) > 10) continue;

            const pts = getSnapPoints(el); 
            for (let j = 0; j < pts.length; j++) {
                const pt = pts[j];
                const s = isoToScreen(pt.x, pt.y, pt.z); 
                const distSq = (p.x - s.x)**2 + (p.y - s.y)**2;
                if(distSq < tol**2) { sn = pt; snID = el.id; break; }
            }
            if (sn) break;
        }
    }
    window.estado.snapped = sn;
    if (snID) window.estado.hoverID = snID; 
    
    // DRAG (Mover objetos MULTIPLES)
    if (window.estado.action === 'dragging' && window.estado.selection.length > 0) {
        // Usamos el primer elemento como referencia para el movimiento
        const refId = window.estado.selection[0];
        const el = window.elementos.find(x => x.id === refId);
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
                 // Movemos el líder
                 window.moverConConexiones(el.id, diffX, diffY, diffZ);
                 
                 // Movemos el resto de la selección con el mismo delta
                 for (let i=1; i<window.estado.selection.length; i++) {
                     window.moverConConexiones(window.estado.selection[i], diffX, diffY, diffZ);
                 }
                 
                 renderScene(); 
                 renderEffects();
            }
        }
    } else if (window.estado.action === 'potential_drag') {
            const distDrag = Math.hypot(e.clientX - window.estado.startAction.x, e.clientY - window.estado.startAction.y);
            if(distDrag > 5) { 
                window.estado.action = 'dragging'; 
                // Si arrastramos algo no seleccionado, lo seleccionamos
                if (window.estado.hoverID && !window.estado.selection.includes(window.estado.hoverID)) {
                     window.estado.selection = [window.estado.hoverID];
                     updatePropsPanel();
                }
                window.saveState(); 
            }
    }
    
    // HOVER SELECT / CUT (Igual que antes pero usa array selection)
    if(window.estado.tool === 'select' && !window.estado.action && !window.estado.snapped) {
        // ... (Lógica de hover existente)
        const tol = 8 / window.estado.view.scale; let h = null; let minD = tol; 
        window.elementos.forEach(el => {
            if(el.visible === false) return; 
            const s = isoToScreen(el.x, el.y, el.z); let d = 10000;
            if(el.tipo==='tuberia') {
                const en = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz); const L2 = (en.x-s.x)**2 + (en.y-s.y)**2;
                if(L2>0) { let t = ((p.x-s.x)*(en.x-s.x)+(p.y-s.y)*(en.y-s.y))/L2; t = Math.max(0, Math.min(1, t)); d = Math.sqrt((p.x - (s.x+t*(en.x-s.x)))**2 + (p.y - (s.y+t*(en.y-s.y)))**2); }
            } else { d = Math.sqrt((p.x-s.x)**2+(p.y-s.y)**2); }
            if(d < minD) { minD=d; h=el.id; }
        });
        if(h !== window.estado.hoverID) { window.estado.hoverID = h; renderEffects(); }
    } 
    
    // TOOLTIP
    const tooltip = document.getElementById('hover-tooltip');
    if (window.estado.hoverID) {
        const el = window.elementos.find(x => x.id === window.estado.hoverID);
        if(el) {
            let txt = `Z: ${formatLength(el.z)}`;
            if (el.tipo === 'tuberia' && Math.abs(el.dz) > 0.01) { txt = `Z: ${formatLength(el.z)} ⮕ ${formatLength(el.z + el.dz)}`; }
            tooltip.innerText = txt;
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        }
    } else { tooltip.style.display = 'none'; }

    renderInterface();
});

// Mouse Up
window.addEventListener('mouseup', (e) => {
    const dist = Math.abs(e.clientX - window.estado.startAction.x) + Math.abs(e.clientY - window.estado.startAction.y);
    const isClick = dist < 5;
    
    // Si fue un click, procesar selección/acción
    if (isClick && (window.estado.action === 'rotate' || window.estado.action === 'potential_drag')) { 
        window.handleCanvasClick(e); 
    }
    
    if (window.estado.action === 'dragging') window.saveState();
    window.estado.action = null; 
});

// Zoom Wheel (Mantener)
svg.addEventListener('wheel', e => { 
    e.preventDefault(); 
    let newScale = window.estado.view.scale * (e.deltaY > 0 ? 0.9 : 1.1); 
    if (newScale < 0.1) newScale = 0.1; if (newScale > 20) newScale = 20; 
    
    // Zoom hacia el mouse o selección
    if(window.estado.selection.length > 0) {
        // Zoom al primer elemento seleccionado
        const el = window.elementos.find(x => x.id === window.estado.selection[0]);
        if(el) {
            let ox = el.x, oy = el.y, oz = el.z; if(el.tipo === 'tuberia' || el.tipo === 'cota') { ox += el.dx/2; oy += el.dy/2; oz += el.dz/2; }
            const ptLocal = isoToScreen(ox, oy, oz); 
            const rect = svg.getBoundingClientRect();
            window.estado.view.scale = newScale;
            window.estado.view.x = (rect.width / 2) - (ptLocal.x * newScale); 
            window.estado.view.y = (rect.height / 2) - (ptLocal.y * newScale);
        }
    } else {
            const rect = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
            const oldScale = window.estado.view.scale;
            window.estado.view.x = mouseX - (mouseX - window.estado.view.x) * (newScale / oldScale);
            window.estado.view.y = mouseY - (mouseY - window.estado.view.y) * (newScale / oldScale);
            window.estado.view.scale = newScale;
    }
    updateTransform(); renderEffects(); 
}, { passive: false });

// Teclado (FIX ESCAPE Y DELETE)
window.addEventListener('keydown', e => {
    // Si está escribiendo en un input, escape solo hace blur
    if(document.activeElement && (document.activeElement.classList.contains('hud-input') || document.activeElement.classList.contains('float-input'))) {
         if(e.key === 'Escape') {
             document.getElementById('dynamic-input-container').style.display = 'none';
             document.getElementById('vertical-input-container').style.display = 'none';
             window.estado.verticalPendingDir = 0;
             document.activeElement.blur();
         }
         return;
    }
    
    // COPY / PASTE
    if(e.ctrlKey && e.key.toLowerCase() === 'c') {
        // Copiar selección
        if(window.estado.selection.length > 0) {
            // Clonar array de objetos seleccionados
            window.estado.clipboard = window.elementos.filter(x => window.estado.selection.includes(x.id)).map(x => JSON.parse(JSON.stringify(x)));
            console.log(`Copiados ${window.estado.clipboard.length} elementos`);
        }
        return;
    }
    if(e.ctrlKey && e.key.toLowerCase() === 'v') {
        if(window.estado.clipboard && window.estado.clipboard.length > 0) {
            // Pegar en la posición del mouse (ajustando offset relativo al primero)
            const ref = window.estado.clipboard[0];
            const dx = window.estado.mouseIso.x - ref.x;
            const dy = window.estado.mouseIso.y - ref.y;
            
            const newIds = [];
            window.estado.clipboard.forEach(item => {
                const copy = JSON.parse(JSON.stringify(item));
                copy.id = Date.now() + Math.random();
                copy.x += dx; copy.y += dy; // Mantiene posición relativa
                copy.z = window.estado.currentZ; // Forza Z actual
                window.elementos.push(copy);
                newIds.push(copy.id);
            });
            window.estado.selection = newIds;
            window.saveState(); renderScene(); renderEffects();
        }
        return;
    }

    if(e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); window.undo(); return; }
    if(e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); window.redo(); return; }

    // Elevación rápida (Q/A)
    const k = e.key.toLowerCase();
    if (k === 'q' || k === 'a') {
        let originPoint = null;
        if (window.estado.drawing && window.estado.inicio) { 
            originPoint = window.estado.inicio; 
        } else if (window.estado.selection.length > 0) {
            const el = window.elementos.find(x => x.id === window.estado.selection[0]);
            if(el) { originPoint = { x: el.x, y: el.y, z: el.z }; window.estado.drawing = true; window.estado.inicio = originPoint; window.estado.activeItem = el.tipo === 'tuberia' ? { type: 'tuberia', props: el.props, color: el.props.customColor } : window.estado.activeItem; }
        } else {
            if(k==='q') window.estado.currentZ += 1; if(k==='a') window.estado.currentZ -= 1; syncZInput(); renderInterface(); return;
        }

        if (originPoint) {
            e.preventDefault();
            const dir = (k === 'q') ? 1 : -1;
            window.estado.verticalPendingDir = dir;
            const box = document.getElementById('vertical-input-container');
            const title = document.getElementById('v-text');
            const icon = document.getElementById('v-icon');
            if (dir === 1) { title.innerText = "SUBIENDO"; icon.innerText = "⬆"; title.style.color = "#0f0"; }
            else { title.innerText = "BAJANDO"; icon.innerText = "⬇"; title.style.color = "#f44"; }
            const rect = svg.getBoundingClientRect();
            box.style.left = (rect.width/2 - 75) + 'px'; box.style.top = (rect.height/2 - 50) + 'px';
            box.style.display = 'flex';
            const inp = document.getElementById('v-len'); inp.value = ''; inp.focus();
        }
        return;
    }
    
    // ESCAPE FIX (Cierre global)
    if(e.key==='Escape') { 
        // 1. Cerrar inputs flotantes
        document.getElementById('dynamic-input-container').style.display = 'none';
        document.getElementById('vertical-input-container').style.display = 'none';
        
        // 2. Cerrar Modales
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        
        // 3. Cancelar dibujo
        window.estado.drawing = false; 
        window.setTool('select'); 
        
        // 4. Limpiar selección y cerrar propiedades
        window.estado.selection = [];
        window.cerrarPropiedades(); // Esta función limpia y renderiza
    } 
    
    // DELETE
    if(e.key==='Delete') window.borrarSeleccion(); renderInterface();
});

// Click fuera para cerrar menús
window.onclick = function(event) {
    if (!event.target.matches('.btn') && !event.target.closest('.layer-dropdown')) {
        var dropdowns = document.getElementsByClassName("layer-content");
        for (var i = 0; i < dropdowns.length; i++) { var openDropdown = dropdowns[i]; if (openDropdown.classList.contains('show')) { openDropdown.classList.remove('show'); } }
    }
}

// Inputs flotantes
document.getElementById('dynamic-len').addEventListener('keydown', (e) => { if (e.key === 'Enter') window.confirmarInput(); if (e.key === 'Escape') { document.getElementById('dynamic-input-container').style.display = 'none'; window.estado.tempVector = null; } e.stopPropagation(); });

document.getElementById('v-len').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = parseInputFloat(e.target.value);
        if (!isNaN(val) && val > 0 && window.estado.verticalPendingDir !== 0 && window.estado.inicio) {
            const u = window.UNITS[window.CONFIG.unit];
            const lenMeters = val / u.factor; const dz = lenMeters * window.estado.verticalPendingDir;
            let props = {};
            if (window.estado.activeItem && window.estado.activeItem.type === 'tuberia') { props = JSON.parse(JSON.stringify(window.estado.activeItem.props)); } else { props = { material: 'acero', diametroNominal: '1"' }; }
            const col = window.estado.activeItem?.color || '#ccc';
            window.addEl({ tipo: 'tuberia', x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z, dx: 0, dy: 0, dz: dz, props: props, customColor: col });
            window.estado.inicio.z += dz; window.estado.currentZ = window.estado.inicio.z; syncZInput();
            document.getElementById('vertical-input-container').style.display = 'none';
            window.estado.verticalPendingDir = 0;
            renderScene(); renderInterface(); 
        }
    }
});

console.log("✅ Eventos cargados (Fixes applied)");
