// js/events.js - Control de Eventos
console.log("🔹 Cargando Eventos...");

window.initEvents = function() {
    const svg = document.getElementById('lienzo-cad');
    if(!svg) return;

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
        // PAN
        if(window.estado.action === 'pan') { 
            window.estado.view.x += e.clientX - window.estado.startAction.x; 
            window.estado.view.y += e.clientY - window.estado.startAction.y; 
            window.estado.startAction = {x: e.clientX, y: e.clientY}; 
            window.updateTransform(); 
            return; 
        }

        // ROTAR
        if(window.estado.action === 'rotate') { 
            window.estado.view.angle += (e.clientX - window.estado.startAction.x) * 0.01;
            window.estado.startAction = {x: e.clientX, y: e.clientY}; 
            window.updateTransform(); window.renderGrid(); window.renderScene(); 
            return; 
        }

        // COORDENADAS
        const p = window.getSVGPoint(e.clientX, e.clientY);
        const zOffsetHeight = (window.estado.currentZ || 0) * window.CONFIG.tileW * 0.7;
        const isoRaw = window.screenToIso(p.x, p.y + zOffsetHeight);
        window.estado.mouseIso = { x: isoRaw.x, y: isoRaw.y };
        
        // SNAP LOGIC
        let sn = null; let snID = null;
        if (window.CONFIG.enableSnap) {
            const tol = window.CONFIG.snapRadius / window.estado.view.scale;
            for (let i = 0; i < window.elementos.length; i++) {
                const el = window.elementos[i];
                if (el.visible === false) continue;
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
        if (snID) window.estado.hoverID = snID; else window.estado.hoverID = null;

        // TOOLTIP
        const tooltip = document.getElementById('hover-tooltip');
        if (window.estado.hoverID) {
            const el = window.elementos.find(x => x.id === window.estado.hoverID);
            if(el) {
                let txt = `Z: ${window.formatLength(el.z)}`;
                if (el.tipo === 'tuberia' && Math.abs(el.dz) > 0.01) { 
                    txt = `Z: ${window.formatLength(el.z)} ⮕ ${window.formatLength(el.z + el.dz)}`; 
                }
                tooltip.innerText = txt;
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
            }
        } else { tooltip.style.display = 'none'; }

        if(typeof window.renderInterface === 'function') window.renderInterface();
    });

    // Mouse Up
    window.addEventListener('mouseup', (e) => {
        const dist = Math.abs(e.clientX - window.estado.startAction.x) + Math.abs(e.clientY - window.estado.startAction.y);
        const isClick = dist < 5;
        if (isClick && (window.estado.action === 'rotate' || window.estado.action === 'potential_drag')) { 
            window.handleCanvasClick(e); 
        }
        window.estado.action = null; 
    });

    // Zoom
    svg.addEventListener('wheel', e => { 
        e.preventDefault(); 
        let newScale = window.estado.view.scale * (e.deltaY > 0 ? 0.9 : 1.1); 
        if (newScale < 0.1) newScale = 0.1; if (newScale > 20) newScale = 20; 
        window.estado.view.scale = newScale;
        window.updateTransform(); window.renderEffects(); 
    }, { passive: false });

    // Teclado
    window.addEventListener('keydown', e => {
        if(e.key === 'Escape') { window.estado.drawing=false; window.setTool('select'); }
        if(e.key === 'Delete') { window.borrarSeleccion(); }
        if(e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); window.undo(); }
        if(e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); window.redo(); }
    });
};
