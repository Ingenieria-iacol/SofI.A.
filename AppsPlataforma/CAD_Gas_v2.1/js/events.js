// js/events.js - Control de Eventos (Teclado y Mouse)

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
        if (window.estado.tool === 'select' && window.estado.hoverID) { 
            window.estado.action = 'potential_drag'; 
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
    
    if (snID && (window.estado.activeItem?.type === 'valvula' || window.estado.activeItem?.type === 'equipo')) {
            const targetEl = window.elementos.find(x => x.id === snID);
            if (targetEl && targetEl.tipo === 'tuberia') { window.estado.snapDir = { dx: targetEl.dx, dy: targetEl.dy, dz: targetEl.dz }; }
    } else { window.estado.snapDir = null; }
    
    // DRAG (Mover objetos)
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
                 window.moverConConexiones(el.id, diffX, diffY, diffZ);
                 renderScene(); 
                 renderEffects();
            }
        }
    } else if (window.estado.action === 'potential_drag') {
            const distDrag = Math.hypot(e.clientX - window.estado.startAction.x, e.clientY - window.estado.startAction.y);
            if(distDrag > 5) { 
                window.estado.action = 'dragging'; 
                if(!window.estado.selID) { window.estado.selID = window.estado.hoverID; updatePropsPanel(); } 
                window.saveState(); 
            }
    }
    
    // HOVER SELECT / CUT
    if(window.estado.tool === 'select' && !window.estado.action && !window.estado.snapped) {
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
    } else if (window.estado.tool === 'cut' && !window.estado.action) {
        const tol = 8 / window.estado.view.scale; let h = null; let minD = tol;
        window.elementos.forEach(el => {
            if(el.visible === false || el.tipo !== 'tuberia') return;
            const s = isoToScreen(el.x, el.y, el.z);
            const en = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz); 
            const L2 = (en.x-s.x)**2 + (en.y-s.y)**2;
            let d = 10000;
            if(L2>0) { let t = ((p.x-s.x)*(en.x-s.x)+(p.y-s.y)*(en.y-s.y))/L2; t = Math.max(0, Math.min(1, t)); d = Math.sqrt((p.x - (s.x+t*(en.x-s.x)))**2 + (p.y - (s.y+t*(en.y-s.y)))**2); }
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
    if (isClick && (window.estado.action === 'rotate' || window.estado.action === 'potential_drag')) { window.handleCanvasClick(e); }
    if (window.estado.action === 'dragging') window.saveState();
    window.estado.action = null; 
});

// Zoom Wheel
svg.addEventListener('wheel', e => { 
    e.preventDefault(); 
    let newScale = window.estado.view.scale * (e.deltaY > 0 ? 0.9 : 1.1); 
    if (newScale < 0.1) newScale = 0.1; if (newScale > 20) newScale = 20; 
    
    // Zoom hacia el mouse o selección
    if(window.estado.selID) {
        const el = window.elementos.find(x => x.id === window.estado.selID);
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

// Teclado (Atajos)
window.addEventListener('keydown', e => {
    if(document.activeElement && (document.activeElement.classList.contains('hud-input') || document.activeElement.classList.contains('float-input'))) {
         if(e.key === 'Escape') {
             document.getElementById('dynamic-input-container').style.display = 'none';
             document.getElementById('vertical-input-container').style.display = 'none';
             window.estado.verticalPendingDir = 0;
             document.activeElement.blur();
         }
         return;
    }
    
    // Copy/Paste
    if(e.ctrlKey && e.key.toLowerCase() === 'c') {
        if(window.estado.selID) {
            const el = window.elementos.find(x=>x.id===window.estado.selID);
            if(el) { window.estado.clipboard = JSON.parse(JSON.stringify(el)); console.log("Copiado"); }
        }
        return;
    }
    if(e.ctrlKey && e.key.toLowerCase() === 'v') {
        if(window.estado.clipboard) {
            const copy = JSON.parse(JSON.stringify(window.estado.clipboard));
            copy.id = Date.now();
            copy.x = window.estado.mouseIso.x; copy.y = window.estado.mouseIso.y; copy.z = window.estado.currentZ; 
            window.elementos.push(copy);
            window.saveState(); renderScene();
        }
        return;
    }

    if(e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); window.undo(); return; }
    if(e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); window.redo(); return; }

    // Elevación rápida (Q/A)
    const k = e.key.toLowerCase();
    if (k === 'q' || k === 'a') {
        let originPoint = null;
        if (window.estado.drawing && window.estado.inicio) { originPoint = window.estado.inicio; } else if (window.estado.selID) {
            const el = window.elementos.find(x => x.id === window.estado.selID);
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
    
    if(e.key==='Escape') { 
        window.estado.drawing=false; window.setTool('select'); 
        document.getElementById('dynamic-input-container').style.display = 'none';
        document.getElementById('vertical-input-container').style.display = 'none';
    } 
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

console.log("✅ Eventos cargados");
