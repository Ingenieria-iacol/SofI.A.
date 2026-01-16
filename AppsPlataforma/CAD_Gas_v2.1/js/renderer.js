// js/renderer.js - Visualización y UI (Panel de Propiedades Reparado)

window.toggleAccordion = function(id) { 
    const el = document.getElementById(id); 
    if(el) { el.classList.toggle('collapsed'); } 
};

window.cerrarPropiedades = function() {
    const card = document.getElementById('prop-card');
    if(card) card.classList.remove('active');
    window.estado.selection = []; 
    if(typeof renderEffects === 'function') renderEffects();
};

// ==========================================
// RENDERIZADO GRÁFICO (SVG)
// ==========================================

function isoToScreen(x, y, z) {
    const ang = window.estado.view.angle;
    const nx = x * Math.cos(ang) - y * Math.sin(ang);
    const ny = x * Math.sin(ang) + y * Math.cos(ang);
    return { x: nx * window.CONFIG.tileW, y: ny * window.CONFIG.tileH - (z * window.CONFIG.tileW * 0.7) };
}

function screenToIso(sx, sy) {
    const ang = window.estado.view.angle;
    const nx = sx / window.CONFIG.tileW;
    const ny = sy / window.CONFIG.tileH;
    const x = nx * Math.cos(-ang) - ny * Math.sin(-ang);
    const y = nx * Math.sin(-ang) + ny * Math.cos(-ang);
    return { x: x, y: y }; 
}

function updateTransform() {
    const world = document.getElementById('world-transform');
    if(world) {
        world.setAttribute('transform', `translate(${window.estado.view.x}, ${window.estado.view.y}) scale(${window.estado.view.scale})`);
        document.getElementById('hud-scale-input').value = Math.round(window.estado.view.scale*100);
        document.getElementById('hud-rot-input').value = Math.round(window.estado.view.angle * 180/Math.PI);
        renderGizmo();
    }
}

function updateZoomInput(val) {
    let v = window.parseInputFloat(val); if(isNaN(v) || v < 10) v = 10; if(v > 2000) v = 2000;
    window.estado.view.scale = v / 100; updateTransform(); renderEffects();
}

function updateRotInput(val) {
    let v = window.parseInputFloat(val); if(!isNaN(v)) { window.estado.view.angle = v * Math.PI / 180; updateTransform(); renderGrid(); renderScene(); renderEffects(); }
}

function updateZInput(val) {
    let v = window.parseInputFloat(val);
    if(!isNaN(v)) { window.estado.currentZ = v / window.UNITS[window.CONFIG.unit].factor; renderInterface(); }
}

function syncZInput() {
    const u = window.UNITS[window.CONFIG.unit];
    const val = (window.estado.currentZ * u.factor).toFixed(u.precision);
    const input = document.getElementById('hud-z-input');
    if(input && document.activeElement !== input) input.value = val;
}

function renderGrid() {
    const pMaj = document.getElementById('grid-path'); const pMin = document.getElementById('grid-minor'); const a = document.getElementById('grid-axis');
    if(!window.CONFIG.showGrid) { pMaj.setAttribute('d', ''); pMin.setAttribute('d', ''); a.setAttribute('d', ''); return; }
    let dMaj="", dMin="", da=""; const sz=20; const step = 1; 
    for(let i=-sz; i<=sz; i+=step) {
        let p1=isoToScreen(-sz,i,0), p2=isoToScreen(sz,i,0); let seg = `M${p1.x},${p1.y} L${p2.x},${p2.y} `;
        if(i===0) da+=seg; else if(i%5 === 0) dMaj+=seg; else dMin+=seg; 
    }
    for(let i=-sz; i<=sz; i+=step) {
        let p1=isoToScreen(i,-sz,0), p2=isoToScreen(i,sz,0); let seg = `M${p1.x},${p1.y} L${p2.x},${p2.y} `;
        if(i===0) da+=seg; else if(i%5 === 0) dMaj+=seg; else dMin+=seg;
    }
    pMaj.setAttribute('d', dMaj); pMin.setAttribute('d', dMin); a.setAttribute('d', da);
}

function renderGizmo() {
    const c = document.getElementById('gizmo-axes'); if(!c) return;
    c.innerHTML = '';
    const ang = window.estado.view.angle;
    const axesData = [ { id:'X', x:1, y:0, z:0, col:'#f44' }, { id:'Y', x:0, y:1, z:0, col:'#4f4' }, { id:'Z', x:0, y:0, z:1, col:'#44f' } ];
    axesData.forEach(ax => {
        const nx = ax.x * Math.cos(ang) - ax.y * Math.sin(ang);
        const ny = ax.x * Math.sin(ang) + ax.y * Math.cos(ang);
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1",0); l.setAttribute("y1",0); l.setAttribute("x2",nx*35); l.setAttribute("y2",ny*17.5 - ax.z*24.5);
        l.setAttribute("stroke", ax.col); l.setAttribute("class", "axis-line");
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", nx*45); t.setAttribute("y", ny*23 - ax.z*30); 
        t.setAttribute("fill", ax.col); t.setAttribute("class", "axis-text"); t.textContent = ax.id;
        c.appendChild(l); c.appendChild(t);
    });
}

function renderScene() {
    const cont = document.getElementById('contenedor-elementos'); 
    const capFit = document.getElementById('capa-fittings');
    cont.innerHTML = ''; capFit.innerHTML = ''; 
    window.elementos.forEach(el => {
        const lay = window.layers.find(l=>l.id===el.layerId); 
        if(!lay || !lay.visible) return;
        if(el.visible === false) return; 

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const s = isoToScreen(el.x, el.y, el.z);
        let col = el.props.customColor || el.props.color || lay.color; 
        let width = 2;
        if(el.tipo === 'tuberia' && el.props.diametroNominal) width = window.parseDiameterToScale(el.props.diametroNominal);
        else width = el.props.grosor || 2; 
        const showLabel = window.CONFIG.showTags || (el.props.mostrarEtiqueta === true);

        if(el.tipo === 'tuberia') {
            const e = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz);
            const body = document.createElementNS("http://www.w3.org/2000/svg", "line");
            body.setAttribute("x1",s.x); body.setAttribute("y1",s.y); body.setAttribute("x2",e.x); body.setAttribute("y2",e.y);
            body.setAttribute("class","tuberia"); body.setAttribute("stroke", col); body.setAttribute("stroke-width", width);
            if(el.props.tipoLinea === 'dashed') body.setAttribute("stroke-dasharray", "6,4");
            else if(el.props.tipoLinea === 'dotted') body.setAttribute("stroke-dasharray", "2,2");
            g.appendChild(body);
            const midX = (s.x + e.x)/2; const midY = (s.y + e.y)/2;
            let angDeg = Math.atan2(e.y - s.y, e.x - s.x) * (180 / Math.PI);
            if (angDeg > 90 || angDeg < -90) { angDeg += 180; }
            if(showLabel && (el.props.diametroNominal || el.props.material)) {
                const matRaw = el.props.material || '';
                const matDisplay = matRaw.charAt(0).toUpperCase() + matRaw.slice(1);
                const diamDisplay = el.props.diametroNominal ? `Ø${el.props.diametroNominal}` : '';
                const txtTop = `${matDisplay} ${diamDisplay}`.trim();
                const tTop = document.createElementNS("http://www.w3.org/2000/svg", "text");
                tTop.setAttribute("x", midX); tTop.setAttribute("y", midY - 8); 
                tTop.setAttribute("class", "label-tech");
                tTop.setAttribute("transform", `rotate(${angDeg}, ${midX}, ${midY})`);
                tTop.textContent = txtTop;
                g.appendChild(tTop);
            }
        } 
        else if(el.tipo === 'cota') {
            const e = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz);
            const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
            l.setAttribute("x1",s.x); l.setAttribute("y1",s.y); l.setAttribute("x2",e.x); l.setAttribute("y2",e.y);
            l.setAttribute("class","dim-line"); l.setAttribute("stroke", "#aaa");
            const rawLen = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
            const txtLen = window.formatLength(rawLen);
            const midX = (s.x + e.x) / 2; const midY = (s.y + e.y) / 2;
            let angDeg = Math.atan2(e.y - s.y, e.x - s.x) * (180 / Math.PI);
            if (angDeg > 90 || angDeg < -90) { angDeg += 180; }
            if(showLabel) {
                const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
                t.setAttribute("x", midX); t.setAttribute("y", midY); t.setAttribute("class","dim-text");
                t.setAttribute("transform", `rotate(${angDeg}, ${midX}, ${midY}) translate(0, -5)`);
                t.textContent = txtLen;
                g.appendChild(l); g.appendChild(t);
            } else { g.appendChild(l); }
        } 
        else if (el.tipo === 'texto') {
            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x",s.x); t.setAttribute("y",s.y); t.setAttribute("class","dim-text");
            t.setAttribute("fill", col); t.setAttribute("font-size", "14px"); t.textContent = el.props.text;
            g.appendChild(t);
        } 
        else {
             let rot = 0;
             if (el.props.dirVector) {
                 const p1 = isoToScreen(0, 0, 0); 
                 const p2 = isoToScreen(el.props.dirVector.dx, el.props.dirVector.dy, el.props.dirVector.dz);
                 rot = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
             } else { rot = parseFloat(el.props.rotacion || 0); }
             g.setAttribute("transform", `translate(${s.x},${s.y}) rotate(${rot}) translate(${-s.x},${-s.y})`);

             if (el.props.tipo === 'tanque_glp') { dibujarTanqueGLP(g, s, el, col); } 
             else if (el.icon && el.icon.trim().startsWith('<svg')) {
                 const scale = el.props.scaleFactor || 1.0;
                 const size = 30 * scale; 
                 const halfSize = size / 2;
                 const iconWrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
                 iconWrapper.innerHTML = el.icon; 
                 const svgContent = iconWrapper.querySelector('svg');
                 if(svgContent) {
                     let dx = -halfSize; 
                     if (el.props.anchor === 'start') dx = 0; 
                     if (el.props.anchor === 'end') dx = -size; 
                     let dy = -halfSize; 
                     svgContent.setAttribute("width", size); svgContent.setAttribute("height", size);
                     svgContent.setAttribute("x", s.x + dx); svgContent.setAttribute("y", s.y + dy);
                     svgContent.setAttribute("fill", "none"); svgContent.setAttribute("stroke", col); svgContent.setAttribute("stroke-width", "2"); svgContent.setAttribute("overflow", "visible");
                     const fills = svgContent.querySelectorAll(".filled");
                     fills.forEach(f => f.setAttribute("fill", col));
                     g.appendChild(iconWrapper);
                 }
                 if(showLabel && el.props.tag) {
                     const tt = document.createElementNS("http://www.w3.org/2000/svg", "text");
                     tt.setAttribute("x", s.x); tt.setAttribute("y", s.y - halfSize - 5); 
                     tt.setAttribute("text-anchor","middle"); tt.setAttribute("fill","#fff"); tt.setAttribute("font-size","10px"); 
                     tt.textContent = el.props.tag;
                     g.appendChild(tt);
                 }
             }
             else {
                const scaleFactor = el.props.scaleFactor || 1.0; 
                const baseSize = (window.CONFIG.tileW * 0.25) * scaleFactor; 
                const halfS = baseSize / 2;
                let dx = -halfS;
                if (el.props.anchor === 'start') dx = 0;
                if (el.props.anchor === 'end') dx = -baseSize;
                
                const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
                r.setAttribute("x", s.x + dx); r.setAttribute("y", s.y - halfS); 
                r.setAttribute("width", baseSize); r.setAttribute("height", baseSize);
                r.setAttribute("fill", "#222"); r.setAttribute("stroke", col);
                
                const tx = document.createElementNS("http://www.w3.org/2000/svg","text");
                tx.setAttribute("x", s.x + dx + halfS); tx.setAttribute("y", s.y + 4); tx.setAttribute("text-anchor","middle");
                tx.setAttribute("fill",col); tx.setAttribute("font-size", (baseSize*0.6)+"px"); tx.textContent = el.icon; 
                g.appendChild(r); g.appendChild(tx);
             }
        }
        cont.appendChild(g);
    });
    
    if (typeof window.analizarRed === 'function') {
        const autoFittings = window.analizarRed();
        autoFittings.forEach(fit => {
            const s = isoToScreen(fit.x, fit.y, fit.z);
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            if (fit.tipo === 'codo_auto') {
                const scaleW = fit.width / window.CONFIG.tileW; 
                const elbowRadius = Math.max(scaleW * 2.5, 0.02); 
                const v1 = fit.dirs[0]; const v2 = fit.dirs[1];
                const p1 = isoToScreen(fit.x + v1.x * elbowRadius, fit.y + v1.y * elbowRadius, fit.z + v1.z * elbowRadius);
                const p2 = isoToScreen(fit.x + v2.x * elbowRadius, fit.y + v2.y * elbowRadius, fit.z + v2.z * elbowRadius);
                const d = `M${p1.x},${p1.y} Q${s.x},${s.y} ${p2.x},${p2.y}`;
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", d); path.setAttribute("stroke", fit.color); path.setAttribute("stroke-width", fit.width); path.setAttribute("class", "fitting-auto");
                g.appendChild(path);
            } else if (fit.tipo === 'tee_auto' || fit.tipo === 'cruz_auto') {
                const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                c.setAttribute("cx", s.x); c.setAttribute("cy", s.y); c.setAttribute("r", fit.width * 0.2);
                c.setAttribute("fill", "#222"); c.setAttribute("stroke", fit.color); c.setAttribute("stroke-width", fit.width);
                g.appendChild(c);
            } 
            capFit.appendChild(g);
        });
    }
    renderEffects();
}

function renderEffects() {
    const ch = document.getElementById('capa-hover'); ch.innerHTML='';
    const cs = document.getElementById('capa-seleccion'); cs.innerHTML='';
    const draw = (id, root, cls) => {
        const el = window.elementos.find(x=>x.id===id); if(!el || el.visible === false) return; 
        const s = isoToScreen(el.x, el.y, el.z);
        if(el.tipo === 'tuberia' || el.tipo === 'cota') {
            const e = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz);
            const l = document.createElementNS("http://www.w3.org/2000/svg","line");
            l.setAttribute("x1",s.x); l.setAttribute("y1",s.y); l.setAttribute("x2",e.x); l.setAttribute("y2",e.y);
            l.setAttribute("class", cls); root.appendChild(l);
        } else {
            const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
            c.setAttribute("cx",s.x); c.setAttribute("cy",s.y); c.setAttribute("r",10); 
            c.setAttribute("class", cls); root.appendChild(c);
        }
    };
    if(window.estado.hoverID && window.estado.tool==='select') draw(window.estado.hoverID, ch, 'hover-halo');
    if(window.estado.selection && window.estado.selection.length > 0) {
        window.estado.selection.forEach(id => draw(id, cs, 'sel-halo'));
    }
}

function renderInterface() {
    const g = document.getElementById('capa-interfaz'); g.innerHTML='';
    if(window.estado.action === 'rotate' || window.estado.action === 'pan') return;
    let tx = window.estado.snapped ? window.estado.snapped.x : window.estado.mouseIso.x;
    let ty = window.estado.snapped ? window.estado.snapped.y : window.estado.mouseIso.y;
    let tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
    const worldPoint = isoToScreen(tx, ty, tz);
    if(window.estado.snapped) {
        const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
        r.setAttribute("x", worldPoint.x-5); r.setAttribute("y",worldPoint.y-5); r.setAttribute("width",10); r.setAttribute("height",10);
        r.setAttribute("class","snap-marker"); r.setAttribute("stroke", "#00FFFF"); r.setAttribute("stroke-width", "2"); g.appendChild(r);
    } else {
        const path = document.createElementNS("http://www.w3.org/2000/svg","path");
        path.setAttribute("d", `M${worldPoint.x-15},${worldPoint.y} L${worldPoint.x+15},${worldPoint.y} M${worldPoint.x},${worldPoint.y-15} L${worldPoint.x},${worldPoint.y+15}`);
        path.setAttribute("class","cursor-crosshair"); g.appendChild(path);
    }
}

function initLibrary() {
    const fillGroup = (id, items) => {
        const c = document.getElementById(id); if(!c) return; c.innerHTML='';
        if (!items) return; 
        items.forEach(it => {
            const div = document.createElement('div'); div.className='tool-item';
            let iconHtml = it.icon;
            if(it.icon && it.icon.startsWith('<svg')) {
                iconHtml = it.icon.replace('<svg', `<svg style="width:20px;height:20px;stroke:${it.color||'#aaa'};fill:none;"`);
            } else { iconHtml = `<div style="font-size:1.2rem;">${it.icon||'▪'}</div>`; }
            div.innerHTML = `<div class="tool-icon">${iconHtml}</div><div class="tool-name">${it.name}</div>`;
            div.onclick = () => { 
                document.querySelectorAll('.tool-item').forEach(x=>x.classList.remove('active')); div.classList.add('active'); 
                window.estado.activeItem = it; window.setTool(it.id); 
                document.getElementById('prop-card').classList.remove('active');
            };
            c.appendChild(div);
        });
    };
    const C = window.CATALOGO;
    if(C) {
        fillGroup('grp-mat', C.mat); fillGroup('grp-comp', C.comp); fillGroup('grp-eq', C.eq);
        fillGroup('grp-inst', C.inst); fillGroup('grp-perif', C.perif); fillGroup('grp-cons', C.cons); 
    }
    renderLayersUI();
}

function renderLayersUI() {
    const c = document.getElementById('lista-capas-header'); if(!c) return; c.innerHTML='';
    window.layers.forEach(l => {
        const r = document.createElement('div'); r.className = `layer-row-header ${l.id===window.activeLayerId?'active':''}`;
        r.innerHTML = `<div class="layer-vis" onclick="togLay('${l.id}')">${l.visible?'👁️':'🙈'}</div><div style="flex:1; font-size:0.8rem; color:${l.color}">${l.name}</div>`;
        r.onclick = (e) => { if(e.target.className!=='layer-vis') { window.activeLayerId=l.id; renderLayersUI(); updatePropsPanel(); } e.stopPropagation(); };
        c.appendChild(r);
    });
    const sel = document.getElementById('p-capa'); if(sel) {
        sel.innerHTML = '';
        window.layers.forEach(l => { const opt = document.createElement('option'); opt.value=l.id; opt.innerText=l.name; sel.appendChild(opt); });
    }
}

// === LÓGICA DE UI FLOTANTE (Propiedades REPARADA) ===
function updatePropsPanel() {
    const elId = window.estado.selection.length > 0 ? window.estado.selection[0] : null;
    const el = window.elementos.find(x => x.id === elId);
    const card = document.getElementById('prop-card');
    
    // Inicializar Drag & Drop solo una vez
    if (!card.getAttribute('data-draggable-init')) {
        if(window.makeDraggable) window.makeDraggable(card);
        card.setAttribute('data-draggable-init', 'true');
    }

    if (!el) { card.classList.remove('active'); return; }

    // Posicionar el panel cerca del objeto solo si no está activo aún (para no saltar si ya se movió)
    if (!card.classList.contains('active')) {
        const screenPos = isoToScreen(el.x, el.y, el.z);
        // Ajuste para que no salga de pantalla
        let finalLeft = Math.max(20, Math.min(window.innerWidth - 340, screenPos.x + 60)); 
        let finalTop = Math.max(60, Math.min(window.innerHeight - 400, screenPos.y - 40));  
        card.style.left = finalLeft + 'px'; card.style.top = finalTop + 'px';
    }

    const f = document.getElementById('prop-form'); 
    const v = document.getElementById('prop-vacio');
    const hero = document.getElementById('pc-hero-container');
    const title = document.getElementById('pc-title-text');
    const contDatos = document.getElementById('prop-datos-tecnicos-container'); 
    const selCount = window.estado.selection.length;

    card.classList.add('active'); 
    f.style.display = 'block'; 
    v.style.display = 'none';

    if (selCount > 1) {
        title.innerText = `Selección (${selCount})`;
        hero.innerHTML = '<div style="font-size:40px; color:#fff;">📚</div>';
        contDatos.innerHTML = `<div style="padding:10px; color:#aaa; font-size:0.8rem;">Edición múltiple no disponible para todos los campos.</div>`;
        return;
    }

    title.innerText = el.name || el.tipo.toUpperCase();
    hero.innerHTML = `<div class="pc-hero-icon">${el.icon || '▪'}</div>`;
    contDatos.innerHTML = ''; 

    // Campos Generales
    document.getElementById('p-visible').checked = (el.visible !== false); 
    document.getElementById('p-show-label').checked = (el.props.mostrarEtiqueta === true);
    document.getElementById('p-color').value = ensureHex(el.props.customColor || el.props.color || '#cccccc');
    document.getElementById('p-tag').value = el.props.tag || '';
    document.getElementById('p-linestyle').value = el.props.tipoLinea || 'solid';
    document.getElementById('p-capa').value = el.layerId;
    document.getElementById('p-grosor').value = el.props.grosor || 2;
    document.getElementById('p-rot').value = el.props.rotacion || 0;
    
    // Geometría
    const u = window.UNITS[window.CONFIG.unit];
    document.getElementById('lbl-unit-z').innerText = u.label; 
    document.getElementById('p-altura').value = ((el.z || 0) * u.factor).toFixed(u.precision);
    
    const rowFinal = document.getElementById('row-altura-final'); 
    document.getElementById('lbl-unit-z-final').innerText = u.label;
    
    // Lógica Específica por Tipo
    if (el.tipo === 'tuberia' || el.tipo === 'cota') {
        const finalZ = el.z + el.dz; 
        document.getElementById('p-altura-final').value = (finalZ * u.factor).toFixed(u.precision);
        rowFinal.style.display = 'flex'; 
        document.getElementById('row-longitud').style.display = 'flex';
        const rawLen = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
        document.getElementById('p-longitud').value = (rawLen * u.factor).toFixed(u.precision);
        
        // Datos Tubería (Material y Diámetro)
        if (el.tipo === 'tuberia') {
             const accGroup = document.createElement('div'); accGroup.className = 'acc-group';
             accGroup.innerHTML = `
             <div class="acc-header">Datos Tubería</div>
             <div class="acc-content">
                <div class="prop-row"><label>Material</label><select id="p-mat" class="btn" style="width:100%"></select></div>
                <div class="prop-row"><label>Diámetro</label><select id="p-diam" class="btn" style="width:100%"></select></div>
             </div>`;
             contDatos.appendChild(accGroup);
             
             // Llenar Materiales
             const sM = accGroup.querySelector('#p-mat');
             if(window.CATALOGO && window.CATALOGO.mat) {
                 window.CATALOGO.mat.forEach(m => { 
                     const o=document.createElement('option'); o.value=m.props.material; o.innerText=m.name; 
                     if(el.props.material===m.props.material) o.selected=true; 
                     sM.appendChild(o); 
                 });
             }
             sM.onchange = (e) => window.changeMaterial(e.target.value);
             
             // Llenar Diámetros
             const sD = accGroup.querySelector('#p-diam');
             const list = window.DIAMETROS_DISPONIBLES ? (window.DIAMETROS_DISPONIBLES[el.props.material] || []) : [];
             list.forEach(d => { 
                 const o=document.createElement('option'); o.value=d; o.innerText=d; 
                 if(el.props.diametroNominal===d) o.selected=true; 
                 sD.appendChild(o); 
             });
             sD.onchange = (e) => window.updateDiametro(e.target.value);
        }
    } else {
        // NO es tubería (Equipos, Válvulas, Textos)
        rowFinal.style.display = 'none'; 
        document.getElementById('row-longitud').style.display = 'none';

        if (el.tipo !== 'texto') {
             const divConsumo = document.createElement('div');
             divConsumo.className = 'acc-group';
             divConsumo.innerHTML = `
                <div class="acc-header">Datos de Proceso</div>
                <div class="acc-content">
                    <div class="prop-row"><label>Caudal / Consumo (m³/h)</label><input type="number" id="p-caudal" value="${el.props.caudal || 0}" step="0.1" class="btn-input" style="width:100%"></div>
                    <small style="color:#777; font-size:0.7rem;">Defina > 0 si este elemento consume gas.</small>
                </div>`;
             contDatos.appendChild(divConsumo);
             
             const inpC = divConsumo.querySelector('#p-caudal');
             inpC.onchange = (e) => { 
                 el.props.caudal = parseFloat(e.target.value); 
                 window.saveState(); 
             };
             
             if (el.props.tipo === 'tanque_glp') generarFormularioTanque(el, contDatos);
        }
    }
}

// === FUNCIONES DE MODAL RESULTADOS ===

window.mostrarCalculoGlobal = function() {
    const m = document.getElementById('modal-resultados-global');
    if(m) m.style.display = 'flex';
}

window.ejecutarCalculoGlobal = function() {
    const pIn = parseFloat(document.getElementById('glob-presion').value);
    const gas = document.getElementById('glob-gas').value;
    const body = document.getElementById('tabla-resultados-body');
    const sum = document.getElementById('res-summary');
    
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;">Calculando...</td></tr>';
    
    // Timeout para permitir que la UI se renderice antes del cálculo pesado
    setTimeout(() => {
        const res = window.calcularTodaLaRed(pIn, gas);
        
        if (res.error) {
            body.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#f44;">Error: ${res.error}</td></tr>`;
            sum.innerHTML = "";
            return;
        }
        
        let html = "";
        let maxVel = 0;
        let maxDrop = 0;

        res.tramos.forEach(t => {
            const pipe = window.elementos.find(x => x.id === t.pipeId);
            const desc = pipe ? (pipe.props.material + " " + pipe.props.diametroNominal) : "Tubería";
            
            let colorVel = "res-ok";
            if (parseFloat(t.vel) > 20) colorVel = "res-warn";
            if (parseFloat(t.vel) > 30) colorVel = "res-crit";
            
            maxVel = Math.max(maxVel, parseFloat(t.vel));
            maxDrop += t.drop;

            html += `
                <tr>
                    <td>${desc}</td>
                    <td>${t.len.toFixed(2)}</td>
                    <td>${t.diam}</td>
                    <td>${t.flow.toFixed(3)}</td>
                    <td class="${colorVel}">${t.vel}</td>
                    <td>${t.drop.toFixed(4)}</td>
                    <td>${t.pOut.toFixed(2)}</td>
                </tr>
            `;
        });
        
        body.innerHTML = html;
        sum.innerHTML = `
            <strong>Total Tramos:</strong> ${res.tramos.length} | 
            <strong>Velocidad Máx:</strong> ${maxVel.toFixed(2)} m/s | 
            <strong>Fuente Detectada:</strong> ${res.source.isSource ? 'Sí' : 'Automática (Primer nodo)'}
        `;
    }, 100);
}

// Funciones Auxiliares UI
window.togLay = (id) => { const l=window.layers.find(x=>x.id===id); l.visible=!l.visible; renderLayersUI(); renderScene(); }
window.addLayer = () => { window.layers.push({id:'l'+Date.now(), name:'Nueva', color:'#fff', visible:true}); renderLayersUI(); }
window.changeMaterial = function(newMat) {
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x=>x.id===window.estado.selection[0]);
    if(window.CATALOGO && window.CATALOGO.mat) {
        const catItem = window.CATALOGO.mat.find(m => m.props.material === newMat);
        if(catItem) { el.props.material = newMat; el.props.color = catItem.color; el.props.diametroNominal = catItem.props.diametroNominal; window.saveState(); updatePropsPanel(); renderScene(); }
    }
}
window.updateDiametro = function(val) { 
    const el = window.elementos.find(x=>x.id===window.estado.selection[0]); 
    if(el){ el.props.diametroNominal = val; window.saveState(); renderScene(); renderEffects(); } 
}
window.updateStyleProp = function(k,v) { 
    const el=window.elementos.find(x=>x.id===window.estado.selection[0]); 
    if(el){ el.props[k]=v; window.saveState(); renderScene(); } 
}
window.updateRootProp = function(k,v) { 
    const el=window.elementos.find(x=>x.id===window.estado.selection[0]); 
    if(el){ el[k]=v; window.saveState(); renderScene(); renderEffects(); } 
}
window.updateBooleanProp = function(k,v) {
    const el=window.elementos.find(x=>x.id===window.estado.selection[0]);
    if(el){ el.props[k]=v; window.saveState(); renderScene(); }
}
window.updateAltura = function(v){
     const el=window.elementos.find(x=>x.id===window.estado.selection[0]);
     const u=window.UNITS[window.CONFIG.unit];
     if(el){ el.z = parseFloat(v)/u.factor; window.saveState(); renderScene(); updatePropsPanel(); }
}
window.updateAlturaFinal = function(v){
     const el=window.elementos.find(x=>x.id===window.estado.selection[0]);
     const u=window.UNITS[window.CONFIG.unit];
     if(el){ el.dz = (parseFloat(v)/u.factor) - el.z; window.saveState(); renderScene(); updatePropsPanel(); }
}
window.updateLongitud = function(v){
     const el=window.elementos.find(x=>x.id===window.estado.selection[0]);
     const u=window.UNITS[window.CONFIG.unit];
     const l = parseFloat(v)/u.factor;
     const cur = Math.sqrt(el.dx**2+el.dy**2+el.dz**2);
     if(cur > 0.0001) { const r = l/cur; el.dx*=r; el.dy*=r; el.dz*=r; window.saveState(); renderScene(); }
}
window.dibujarTanqueGLP = function(g,s,el,c) {
    const r=document.createElementNS("http://www.w3.org/2000/svg","rect");
    r.setAttribute("x",s.x-20); r.setAttribute("y",s.y-10); r.setAttribute("width",40); r.setAttribute("height",20); r.setAttribute("rx",5); r.setAttribute("fill","#222"); r.setAttribute("stroke",c); g.appendChild(r);
}
window.generarFormularioTanque = function(el, c) { /* Placeholder para mantener compatibilidad */ }

console.log("✅ Renderer UI (Panel Propiedades REPARADO) cargado");
