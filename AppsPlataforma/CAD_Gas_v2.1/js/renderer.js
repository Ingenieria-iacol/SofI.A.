// js/renderer.js - Visualización y Seguridad (Multi-Edit Ready)

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

function getSVGPoint(ex, ey) { 
    const svg = document.getElementById('lienzo-cad');
    const world = document.getElementById('world-transform');
    const pt = svg.createSVGPoint(); pt.x = ex; pt.y = ey; 
    return pt.matrixTransform(world.getScreenCTM().inverse()); 
}

function getSnapPoints(el) {
    if(el.visible === false) return [];
    const pts = [{x: el.x, y: el.y, z: el.z}]; 
    if(el.props.tipo === 'tanque_glp' && el.props.conexiones) {
        const diam = parseFloat(el.props.diametro) || 2.0;
        const len = parseFloat(el.props.longitud) || 6.0;
        const rads = (parseFloat(el.props.rotacion || 0) * Math.PI) / 180;
        const dx = Math.cos(rads) * (len / 2);
        const dy = Math.sin(rads) * (len / 2);
        const p1 = { x: el.x + dx, y: el.y + dy, z: el.z };
        const p2 = { x: el.x - dx, y: el.y - dy, z: el.z };
        el.props.conexiones.forEach((conn, idx) => {
            const t = (idx + 1) / (el.props.conexiones.length + 1);
            const cx = p1.x + (p2.x - p1.x) * t;
            const cy = p1.y + (p2.y - p1.y) * t;
            const cz = el.z + (conn.posicion === 'bottom' ? -(diam/2) : (diam/2));
            pts.push({ x: cx, y: cy, z: cz });
        });
    }
    if(el.tipo === 'valvula' || el.tipo === 'equipo') {
        const scale = el.props.scaleFactor || 1.0;
        const radio = 0.15 * scale; 
        const rads = (parseFloat(el.props.rotacion || 0) * Math.PI) / 180;
        pts.push({ x: el.x - Math.cos(rads) * radio, y: el.y - Math.sin(rads) * radio, z: el.z });
        pts.push({ x: el.x + Math.cos(rads) * radio, y: el.y + Math.sin(rads) * radio, z: el.z });
    }
    if(el.tipo === 'tuberia' || el.tipo === 'cota') {
        pts.push({x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz});
        pts.push({x: el.x + el.dx*0.5, y: el.y + el.dy*0.5, z: el.z + el.dz*0.5});
    }
    return pts;
}

function updateTransform() {
    const world = document.getElementById('world-transform');
    world.setAttribute('transform', `translate(${window.estado.view.x}, ${window.estado.view.y}) scale(${window.estado.view.scale})`);
    document.getElementById('hud-scale-input').value = Math.round(window.estado.view.scale*100);
    document.getElementById('hud-rot-input').value = Math.round(window.estado.view.angle * 180/Math.PI);
    renderGizmo();
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
    document.getElementById('hud-z-input').value = (window.estado.currentZ * u.factor).toFixed(u.precision);
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
    const c = document.getElementById('gizmo-axes'); c.innerHTML = '';
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
            const lenRaw = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
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
                const lenDisplay = `L=${window.formatLength(lenRaw)}`;
                let hDisplay = `Z=${window.formatLength(el.z)}`;
                if (Math.abs(el.dz) > 0.05) { hDisplay = `Z=${window.formatLength(el.z)}⮕${window.formatLength(el.z + el.dz)}`; }
                const txtBottom = `${lenDisplay}  |  ${hDisplay}`;
                const tBot = document.createElementNS("http://www.w3.org/2000/svg", "text");
                tBot.setAttribute("x", midX); tBot.setAttribute("y", midY + 12); 
                tBot.setAttribute("class", "label-tech");
                tBot.setAttribute("fill", "#999");
                tBot.setAttribute("transform", `rotate(${angDeg}, ${midX}, ${midY})`);
                tBot.textContent = txtBottom;
                g.appendChild(tBot);
            }
            if(showLabel && el.props.tag) {
                const tt = document.createElementNS("http://www.w3.org/2000/svg", "text");
                const offset = (el.props.diametroNominal || el.props.material) ? 24 : -5;
                tt.setAttribute("x", midX); tt.setAttribute("y", midY + offset); 
                tt.setAttribute("font-size", "10px"); tt.setAttribute("fill", "#fff"); 
                tt.setAttribute("text-anchor", "middle");
                tt.setAttribute("transform", `rotate(${angDeg}, ${midX}, ${midY})`);
                tt.textContent = el.props.tag;
                g.appendChild(tt);
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
                const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                c.setAttribute("cx", s.x); c.setAttribute("cy", s.y); c.setAttribute("r", fit.width * 0.2); c.setAttribute("fill", fit.color);
                g.appendChild(c);
            } else if (fit.tipo === 'tee_auto' || fit.tipo === 'cruz_auto') {
                const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                c.setAttribute("cx", s.x); c.setAttribute("cy", s.y); c.setAttribute("r", fit.width * 0.2);
                c.setAttribute("fill", "#222"); c.setAttribute("stroke", fit.color); c.setAttribute("stroke-width", fit.width);
                g.appendChild(c);
            } else if (fit.tipo === 'reductor_auto') {
                const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
                const r = fit.width * 1.5;
                const d = `M${s.x-r},${s.y-r/2} L${s.x+r},${s.y} L${s.x-r},${s.y+r/2} Z`;
                p.setAttribute("d", d); p.setAttribute("fill", "#444"); p.setAttribute("stroke", fit.color); p.setAttribute("stroke-width", 1);
                g.appendChild(p);
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
        } else if (el.props.tipo === 'tanque_glp') {
             const g = document.createElementNS("http://www.w3.org/2000/svg","circle");
             g.setAttribute("cx", s.x); g.setAttribute("cy", s.y); g.setAttribute("r", 20);
             g.setAttribute("class", cls); root.appendChild(g);
        } else {
            const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
            c.setAttribute("cx",s.x); c.setAttribute("cy",s.y); c.setAttribute("r",10); 
            c.setAttribute("class", cls); root.appendChild(c);
        }
    };
    if(window.estado.hoverID && window.estado.tool==='select') draw(window.estado.hoverID, ch, 'hover-halo');
    
    // MODIFICADO: Iterar sobre el array de selección
    if(window.estado.selection && window.estado.selection.length > 0) {
        window.estado.selection.forEach(id => {
             draw(id, cs, 'sel-halo');
        });
    }
}

function renderInterface() {
    const g = document.getElementById('capa-interfaz'); g.innerHTML='';
    if(window.estado.action === 'rotate' || window.estado.action === 'pan') return;

    let tx = window.estado.snapped ? window.estado.snapped.x : window.estado.mouseIso.x;
    let ty = window.estado.snapped ? window.estado.snapped.y : window.estado.mouseIso.y;
    let tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
    let lockedAxis = null; 

    if (window.estado.drawing && !window.estado.snapped) {
        const gridX = Math.round(window.estado.mouseIso.x * 10) / 10;
        const gridY = Math.round(window.estado.mouseIso.y * 10) / 10;
        const dx = gridX - window.estado.inicio.x; const dy = gridY - window.estado.inicio.y; const dz = window.estado.currentZ - window.estado.inicio.z;
        const th = 0.5;
        if (Math.abs(dy) < th && Math.abs(dz) < th) { ty = window.estado.inicio.y; tz = window.estado.inicio.z; tx = gridX; lockedAxis = 'x'; } 
        else if (Math.abs(dx) < th && Math.abs(dz) < th) { tx = window.estado.inicio.x; tz = window.estado.inicio.z; ty = gridY; lockedAxis = 'y'; } 
        else if (Math.abs(dx) < th && Math.abs(dy) < th) { tx = window.estado.inicio.x; ty = window.estado.inicio.y; tz = window.estado.inicio.z; lockedAxis = 'z'; }
        else { tx = gridX; ty = gridY; }
    }
    const worldPoint = isoToScreen(tx, ty, tz);
    
    if(Math.abs(tz) > 0.01) {
        const floor = isoToScreen(tx, ty, 0);
        const l = document.createElementNS("http://www.w3.org/2000/svg","line");
        l.setAttribute("x1",floor.x); l.setAttribute("y1",floor.y); l.setAttribute("x2",worldPoint.x); l.setAttribute("y2",worldPoint.y);
        l.setAttribute("stroke", "#666"); l.setAttribute("stroke-dasharray", "3,3"); l.setAttribute("class","z-ref-line"); g.appendChild(l);
        const pathFloor = document.createElementNS("http://www.w3.org/2000/svg","path");
        pathFloor.setAttribute("d", `M${floor.x-3},${floor.y-3} L${floor.x+3},${floor.y+3} M${floor.x-3},${floor.y+3} L${floor.x+3},${floor.y-3}`);
        pathFloor.setAttribute("stroke", "#666"); pathFloor.setAttribute("opacity", "0.6"); g.appendChild(pathFloor);
    }

    if(window.estado.snapped) {
        const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
        r.setAttribute("x", worldPoint.x-5); r.setAttribute("y",worldPoint.y-5); r.setAttribute("width",10); r.setAttribute("height",10);
        r.setAttribute("class","snap-marker");
        r.setAttribute("stroke", "#00FFFF"); r.setAttribute("stroke-width", "2");
        g.appendChild(r);
    } else {
        const path = document.createElementNS("http://www.w3.org/2000/svg","path");
        path.setAttribute("d", `M${worldPoint.x-15},${worldPoint.y} L${worldPoint.x+15},${worldPoint.y} M${worldPoint.x},${worldPoint.y-15} L${worldPoint.x},${worldPoint.y+15}`);
        path.setAttribute("class","cursor-crosshair"); g.appendChild(path);
    }
    
    if(window.estado.drawing) {
        const start = isoToScreen(window.estado.inicio.x, window.estado.inicio.y, window.estado.inicio.z);
        if(lockedAxis) {
            let vec = {x:0, y:0, z:0}; let col = '#fff';
            if(lockedAxis === 'x') { vec.x = 1; col = '#ff4444'; } if(lockedAxis === 'y') { vec.y = 1; col = '#44ff44'; } if(lockedAxis === 'z') { vec.z = 1; col = '#4444ff'; }
            const distGuia = 200; 
            const p1 = isoToScreen(window.estado.inicio.x - vec.x*distGuia, window.estado.inicio.y - vec.y*distGuia, window.estado.inicio.z - vec.z*distGuia);
            const p2 = isoToScreen(window.estado.inicio.x + vec.x*distGuia, window.estado.inicio.y + vec.y*distGuia, window.estado.inicio.z + vec.z*distGuia);
            const guideLine = document.createElementNS("http://www.w3.org/2000/svg","line");
            guideLine.setAttribute("x1", p1.x); guideLine.setAttribute("y1", p1.y); guideLine.setAttribute("x2", p2.x); guideLine.setAttribute("y2", p2.y);
            guideLine.setAttribute("stroke", col); guideLine.setAttribute("stroke-width", "1"); guideLine.setAttribute("stroke-dasharray", "5,3"); guideLine.setAttribute("opacity", "0.8");
            g.appendChild(guideLine);
        }
        const l = document.createElementNS("http://www.w3.org/2000/svg","line");
        l.setAttribute("x1",start.x); l.setAttribute("y1",start.y); l.setAttribute("x2",worldPoint.x); l.setAttribute("y2",worldPoint.y);
        l.setAttribute("stroke", "#fff"); l.setAttribute("stroke-dasharray", "4,4"); l.setAttribute("opacity", "0.5"); g.appendChild(l);
    }
}

function toggleConfig(key) {
    if(key === 'grid') window.CONFIG.showGrid = !window.CONFIG.showGrid; 
    if(key === 'snap') window.CONFIG.enableSnap = !window.CONFIG.enableSnap;
    const btn = document.getElementById('cmd-'+key); if(btn) btn.classList.toggle('active'); renderGrid(); renderScene();
}
function toggleTags() {
    window.CONFIG.showTags = !window.CONFIG.showTags;
    const btn = document.getElementById('btn-toggle-tags');
    if(window.CONFIG.showTags) btn.classList.add('active'); else btn.classList.remove('active');
    renderScene();
}
function resetView() { 
    const svg = document.getElementById('lienzo-cad');
    const rect = svg.getBoundingClientRect(); window.estado.view.angle = Math.PI / 4; 
    
    // Zoom a la selección (si hay) o reset general
    if (window.estado.selection && window.estado.selection.length > 0) {
        const el = window.elementos.find(e => e.id === window.estado.selection[0]);
        if(el) {
            let ox = el.x, oy = el.y, oz = el.z; if(el.tipo === 'tuberia' || el.tipo === 'cota') { ox += el.dx/2; oy += el.dy/2; oz += el.dz/2; }
            const ptLocal = isoToScreen(ox, oy, oz);
            window.estado.view.x = (rect.width/2) - (ptLocal.x * window.estado.view.scale); window.estado.view.y = (rect.height/2) - (ptLocal.y * window.estado.view.scale);
        }
    } else {
        if(window.elementos.length === 0) { window.estado.view.scale = 1; window.estado.view.x = rect.width/2; window.estado.view.y = rect.height/2; } 
        else {
             let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
             window.elementos.forEach(el => {
                 if(el.visible === false) return;
                 let pts = [{x:el.x, y:el.y, z:el.z}];
                 if(el.tipo === 'tuberia' || el.tipo === 'cota'){ pts.push({x:el.x+el.dx, y:el.y+el.dy, z:el.z+el.dz}); }
                 pts.forEach(p => { const s = isoToScreen(p.x, p.y, p.z); if(s.x < minX) minX = s.x; if(s.x > maxX) maxX = s.x; if(s.y < minY) minY = s.y; if(s.y > maxY) maxY = s.y; });
             });
             const w = maxX - minX; const h = maxY - minY;
             if(w===0 && h===0) { window.estado.view.scale = 1; window.estado.view.x = rect.width/2 - (minX); window.estado.view.y = rect.height/2 - (minY); } 
             else {
                 const padding = 50; const scaleX = (rect.width - padding*2) / w; const scaleY = (rect.height - padding*2) / h;
                 let newScale = Math.min(scaleX, scaleY); if(newScale > 2) newScale = 2; 
                 window.estado.view.scale = newScale;
                 const midX = (minX + maxX) / 2; const midY = (minY + maxY) / 2;
                 window.estado.view.x = (rect.width/2) - (midX * newScale); window.estado.view.y = (rect.height/2) - (midY * newScale);
             }
        }
    }
    updateTransform(); renderGrid(); renderScene(); renderEffects(); 
}
function togglePanel(id) { document.getElementById(id).classList.toggle('closed'); setTimeout(() => { updateTransform(); }, 410); }
function toggleGroup(id) { document.querySelectorAll('.lib-items').forEach(el => { if(el.id !== id) el.classList.remove('open'); }); document.getElementById(id).classList.toggle('open'); }

window.toggleAccordion = function(id) { 
    const el = document.getElementById(id); 
    if(el) { el.classList.toggle('collapsed'); } 
};

function initLibrary() {
    const fillGroup = (id, items) => {
        const c = document.getElementById(id); c.innerHTML='';
        if (!items) return; 
        let lastSubCat = null;
        items.forEach(it => {
            if (it.subCat && it.subCat !== lastSubCat) {
                const subHeader = document.createElement('div');
                subHeader.className = 'lib-subheader';
                subHeader.innerText = it.subCat;
                c.appendChild(subHeader);
                lastSubCat = it.subCat;
            }
            const div = document.createElement('div'); div.className='tool-item';
            
            let iconHtml = it.icon;
            if(it.icon && it.icon.startsWith('<svg')) {
                iconHtml = it.icon.replace('<svg', `<svg style="width:20px;height:20px;stroke:${it.color||'#aaa'};fill:none;"`);
            } else {
                iconHtml = `<div style="font-size:1.2rem;">${it.icon||'▪'}</div>`;
            }
            
            div.innerHTML = `<div class="tool-icon">${iconHtml}</div><div class="tool-name">${it.name}</div>`;
            
            if (it.info) {
                const tip = document.createElement('div');
                tip.className = 'lib-tooltip';
                tip.innerHTML = `<span class="tooltip-title">${it.info.title}</span><div class="tooltip-desc">${it.info.desc}</div>${it.info.use ? `<span class="tooltip-meta">Uso: ${it.info.use}</span>` : ''}${it.info.spec ? `<span class="tooltip-meta">Spec: ${it.info.spec}</span>` : ''}`;
                div.appendChild(tip);
            }
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
    const c = document.getElementById('lista-capas-header'); c.innerHTML='';
    window.layers.forEach(l => {
        const r = document.createElement('div'); r.className = `layer-row-header ${l.id===window.activeLayerId?'active':''}`;
        r.innerHTML = `<div class="layer-vis" onclick="togLay('${l.id}')">${l.visible?'👁️':'🙈'}</div><div style="flex:1; font-size:0.8rem; color:${l.color}">${l.name}</div>`;
        r.onclick = (e) => { if(e.target.className!=='layer-vis') { window.activeLayerId=l.id; renderLayersUI(); updatePropsPanel(); } e.stopPropagation(); };
        c.appendChild(r);
    });
    const sel = document.getElementById('p-capa'); sel.innerHTML = '';
    window.layers.forEach(l => { const opt = document.createElement('option'); opt.value=l.id; opt.innerText=l.name; sel.appendChild(opt); });
}

// === NUEVA LÓGICA DE UI FLOTANTE (REPARADA) ===

window.cerrarPropiedades = function() {
    document.getElementById('prop-card').classList.remove('active');
    // CORRECCIÓN: Limpiar selección al cerrar panel manualmente
    window.estado.selection = []; 
    if(typeof renderEffects === 'function') renderEffects();
};

function updatePropsPanel() {
    const el = window.elementos.find(x => x.id === (window.estado.selection.length > 0 ? window.estado.selection[0] : null));
    const card = document.getElementById('prop-card');
    
    // Init Drag si no existe
    if (!card.getAttribute('data-draggable-init')) {
        if(window.makeDraggable) window.makeDraggable(card);
        card.setAttribute('data-draggable-init', 'true');
    }

    // --- POSICIONAMIENTO INTELIGENTE ---
    if (el && !card.classList.contains('active')) {
        const screenPos = isoToScreen(el.x, el.y, el.z);
        let finalLeft = screenPos.x + 60; 
        let finalTop = screenPos.y - 40;  
        const maxLeft = window.innerWidth - 340;
        const maxTop = window.innerHeight - 400;
        
        if (finalLeft > maxLeft) finalLeft = screenPos.x - 340; 
        if (finalLeft < 0) finalLeft = 20;
        if (finalTop < 60) finalTop = 80;
        if (finalTop > maxTop) finalTop = maxTop;
        
        card.style.left = finalLeft + 'px';
        card.style.top = finalTop + 'px';
        
        card.style.transform = "scale(0.95)";
        setTimeout(() => card.style.transform = "scale(1)", 50);
    }

    const f = document.getElementById('prop-form'); 
    const v = document.getElementById('prop-vacio');
    const hero = document.getElementById('pc-hero-container');
    const title = document.getElementById('pc-title-text');
    const divAdjust = document.getElementById('obj-adjust-controls');
    const contDatos = document.getElementById('prop-datos-tecnicos-container'); 
    
    const selCount = window.estado.selection.length;

    // CASO 0: Nada seleccionado
    if (selCount === 0) {
        card.classList.remove('active');
        return;
    }
    
    // Activar tarjeta
    card.classList.add('active');
    f.style.display = 'block'; 
    v.style.display = 'none';

    // CASO MULTI-SELECCIÓN (BATCH)
    if (selCount > 1) {
        title.innerText = `Selección (${selCount})`;
        hero.innerHTML = '<div style="font-size:40px; color:#fff;">📚</div>';
        contDatos.innerHTML = '';
        
        // Formulario Batch simplificado
        contDatos.innerHTML = `
            <div class="acc-group">
                <div class="acc-header">Edición Masiva</div>
                <div class="acc-content">
                    <div class="prop-row"><label>Capa Común</label><select id="p-batch-capa" class="btn"></select></div>
                    <div class="prop-row"><label>Color Común</label><input type="color" id="p-batch-color" style="height:35px; width:100%"></div>
                    <div class="prop-row row-h"><label style="flex:1">Visible</label><input type="checkbox" id="p-batch-visible" checked></div>
                    <div style="margin-top:20px;">
                        <button class="btn danger" onclick="borrarSeleccion()" style="width:100%;">Eliminar Todos (${selCount})</button>
                    </div>
                </div>
            </div>
        `;
        
        const selCapa = document.getElementById('p-batch-capa');
        window.layers.forEach(l => { const opt = document.createElement('option'); opt.value=l.id; opt.innerText=l.name; selCapa.appendChild(opt); });
        
        // Listeners Batch
        selCapa.onchange = (e) => window.updateBatchProp('layerId', e.target.value);
        document.getElementById('p-batch-color').onchange = (e) => window.updateBatchProp('customColor', e.target.value);
        document.getElementById('p-batch-visible').onchange = (e) => window.updateBatchProp('visible', e.target.checked);
        
        // Ocultar resto
        document.getElementById('grp-general').style.display = 'none';
        document.getElementById('grp-geo').style.display = 'none';
        document.getElementById('grp-app').style.display = 'none';
        
        return;
    }

    // CASO ÚNICO (NORMAL)
    document.getElementById('grp-general').style.display = 'block';
    document.getElementById('grp-geo').style.display = 'block';
    document.getElementById('grp-app').style.display = 'block';
    
    // Configurar Hero y Título
    let displayTitle = "Elemento";
    if (el.tipo === 'tuberia') displayTitle = "Tubería";
    else if (el.props.nombre) displayTitle = el.props.nombre;
    else if (el.name) displayTitle = el.name;
    else if (el.tipo === 'valvula') displayTitle = "Válvula";
    else displayTitle = el.tipo.toUpperCase();
    
    title.innerText = displayTitle;
    
    hero.innerHTML = '';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'pc-hero-icon';
    if (el.tipo === 'tuberia') { 
        if (window.ICONS && window.ICONS.PIPE) {
            iconDiv.innerHTML = window.ICONS.PIPE;
        } else {
             iconDiv.innerHTML = '---'; 
        }
    } 
    else if (el.icon) { iconDiv.innerHTML = el.icon; } 
    else { iconDiv.innerHTML = '<div style="font-size:40px; color:#fff;">▪</div>'; }
    hero.appendChild(iconDiv);

    contDatos.innerHTML = ''; 

    // Mapeo de valores básicos
    document.getElementById('p-visible').checked = (el.visible !== false); 
    document.getElementById('p-color').value = ensureHex(el.props.customColor || el.props.color || '#cccccc');
    document.getElementById('p-tag').value = el.props.tag || '';
    document.getElementById('p-linestyle').value = el.props.tipoLinea || 'solid';
    document.getElementById('p-capa').value = el.layerId;
    document.getElementById('p-show-label').checked = el.props.mostrarEtiqueta === true;
    
    const u = window.UNITS[window.CONFIG.unit];
    document.getElementById('lbl-unit-z').innerText = u.label; 
    document.getElementById('p-altura').value = (el.z * u.factor).toFixed(u.precision);
    const rowFinal = document.getElementById('row-altura-final'); 
    document.getElementById('lbl-unit-z-final').innerText = u.label;
    
    // Lógica Específica
    if (el && el.props.tipo === 'tanque_glp') {
        generarFormularioTanque(el, contDatos);
        if(divAdjust) divAdjust.style.display = 'none';
    } 
    else if (el.props.tipo === 'actuada') {
        generarFormularioValvulaActuada(el, contDatos);
        if(divAdjust) divAdjust.style.display = 'block';
        document.getElementById('p-anchor').value = el.props.anchor || 'center';
        document.getElementById('row-grosor').style.display = 'none';
        rowFinal.style.display = 'none'; 
        document.getElementById('row-longitud').style.display = 'none';
    }
    else if (el.tipo === 'tuberia' || el.tipo === 'cota') {
        const finalZ = el.z + el.dz; 
        document.getElementById('p-altura-final').value = (finalZ * u.factor).toFixed(u.precision);
        rowFinal.style.display = 'flex'; 
        divAdjust.style.display = 'none'; 
        document.getElementById('row-longitud').style.display = 'flex';
        const rawLen = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
        document.getElementById('lbl-unit').innerText = u.label; 
        document.getElementById('p-longitud').value = (rawLen * u.factor).toFixed(u.precision);
    } else {
        rowFinal.style.display = 'none'; 
        document.getElementById('row-longitud').style.display = 'none';
        if(el.tipo !== 'texto') {
             divAdjust.style.display = 'block'; 
             const scaleVal = el.props.scaleFactor || 1.0;
             document.getElementById('p-scale').value = scaleVal; 
             document.getElementById('p-scale-val').textContent = scaleVal;
             document.getElementById('p-anchor').value = el.props.anchor || 'center';
        } else { divAdjust.style.display = 'none'; }
    }
    
    // Bloque Flujo Genérico (Si no es actuada/tanque/tuberia)
    if (el.tipo !== 'tuberia' && el.tipo !== 'cota' && el.tipo !== 'texto' && el.props.tipo !== 'tanque_glp' && el.props.tipo !== 'actuada') {
        const grpFlow = document.createElement('div'); grpFlow.className = 'acc-group'; grpFlow.id='grp-flow';
        const headFlow = document.createElement('div'); headFlow.className = 'acc-header'; headFlow.innerText = 'Conexiones y Flujo';
        headFlow.onclick = function() { window.toggleAccordion('grp-flow'); };
        
        const contentFlow = document.createElement('div'); contentFlow.className = 'acc-content';
        
        const btnInvert = document.createElement('div'); btnInvert.className = 'prop-row';
        btnInvert.innerHTML = `<button class="btn" style="width:100%" onclick="window.invertirFlujo()">🔄 Invertir Sentido Flujo</button>`;
        contentFlow.appendChild(btnInvert);

        const titleIn = document.createElement('div'); titleIn.style = "font-size:0.7rem; color:#aaa; margin:5px 0; border-bottom:1px solid #444;"; titleIn.innerText = "ENTRADA (INLET)";
        contentFlow.appendChild(titleIn);
        const rowIn = document.createElement('div'); rowIn.className = 'prop-row row-h';
        rowIn.innerHTML = `<select class="btn" style="flex:1" onchange="updateStyleProp('diamIn', this.value)"><option value='1/4"' ${el.props.diamIn==='1/4"'?'selected':''}>1/4"</option><option value='1/2"' ${el.props.diamIn==='1/2"'?'selected':''}>1/2"</option><option value='3/4"' ${el.props.diamIn==='3/4"'?'selected':''}>3/4"</option><option value='1"' ${el.props.diamIn==='1"'?'selected':''}>1"</option></select><select class="btn" style="flex:1" onchange="updateStyleProp('typeIn', this.value)"><option value='hembra' ${el.props.typeIn==='hembra'?'selected':''}>Hembra</option><option value='macho' ${el.props.typeIn==='macho'?'selected':''}>Macho</option><option value='brida' ${el.props.typeIn==='brida'?'selected':''}>Brida</option></select>`;
        contentFlow.appendChild(rowIn);

        const titleOut = document.createElement('div'); titleOut.style = "font-size:0.7rem; color:#aaa; margin:5px 0; border-bottom:1px solid #444;"; titleOut.innerText = "SALIDA (OUTLET)";
        contentFlow.appendChild(titleOut);
        const rowOut = document.createElement('div'); rowOut.className = 'prop-row row-h';
        rowOut.innerHTML = `<select class="btn" style="flex:1" onchange="updateStyleProp('diamOut', this.value)"><option value='1/4"' ${el.props.diamOut==='1/4"'?'selected':''}>1/4"</option><option value='1/2"' ${el.props.diamOut==='1/2"'?'selected':''}>1/2"</option><option value='3/4"' ${el.props.diamOut==='3/4"'?'selected':''}>3/4"</option><option value='1"' ${el.props.diamOut==='1"'?'selected':''}>1"</option></select><select class="btn" style="flex:1" onchange="updateStyleProp('typeOut', this.value)"><option value='hembra' ${el.props.typeOut==='hembra'?'selected':''}>Hembra</option><option value='macho' ${el.props.typeOut==='macho'?'selected':''}>Macho</option><option value='brida' ${el.props.typeOut==='brida'?'selected':''}>Brida</option></select>`;
        contentFlow.appendChild(rowOut);

        grpFlow.appendChild(headFlow); grpFlow.appendChild(contentFlow); contDatos.appendChild(grpFlow);
    }

    const divGrosor = document.getElementById('row-grosor');
    if(el.tipo === 'tuberia' && el.props.material) { divGrosor.style.display = 'none'; } else if (el.props.tipo !== 'actuada') { divGrosor.style.display = 'flex'; document.getElementById('p-grosor').value = el.props.grosor || 2; }
    if(el.props.rotacion !== undefined) document.getElementById('p-rot').value = el.props.rotacion;

    if (el.tipo === 'tuberia' && el.props.material) {
        const accGroup = document.createElement('div'); accGroup.className = 'acc-group'; accGroup.id = 'grp-tech';
        const accHead = document.createElement('div'); accHead.className = 'acc-header'; accHead.innerText = 'Datos Técnicos';
        accHead.onclick = function() { window.toggleAccordion('grp-tech'); };
        const accContent = document.createElement('div'); accContent.className = 'acc-content';
        const rowMat = document.createElement('div'); rowMat.className = 'prop-row';
        const lblMat = document.createElement('label'); lblMat.innerText = "Material Tubería";
        const selMat = document.createElement('select'); selMat.className = 'btn';
        window.CATALOGO.mat.forEach(mItem => {
            const opt = document.createElement('option'); opt.value = mItem.props.material; opt.innerText = mItem.name;
            if(el.props.material === mItem.props.material) opt.selected = true;
            selMat.appendChild(opt);
        });
        selMat.onchange = (e) => changeMaterial(e.target.value);
        rowMat.appendChild(lblMat); rowMat.appendChild(selMat); accContent.appendChild(rowMat);
        
        if (window.DIAMETROS_DISPONIBLES[el.props.material]) {
            const list = window.DIAMETROS_DISPONIBLES[el.props.material];
            const rowDia = document.createElement('div'); rowDia.className = 'prop-row';
            const labelDia = document.createElement('label'); labelDia.innerText = "Diámetro Nominal";
            const selectDia = document.createElement('select'); selectDia.className = 'btn'; selectDia.style.width = '100%';
            selectDia.onchange = function(e) { window.updateDiametro(e.target.value); };
            list.forEach(nominal => {
                const opt = document.createElement('option'); opt.value = nominal; opt.innerText = nominal; 
                if(el.props.diametroNominal === nominal) opt.selected = true;
                selectDia.appendChild(opt);
            });
            rowDia.appendChild(labelDia); rowDia.appendChild(selectDia); accContent.appendChild(rowDia);
        }
        accGroup.appendChild(accHead); accGroup.appendChild(accContent); contDatos.appendChild(accGroup);

        const calcGroup = document.createElement('div'); calcGroup.className = 'acc-group'; calcGroup.id='grp-calc';
        const calcHead = document.createElement('div'); calcHead.className = 'acc-header'; calcHead.innerText = 'Cálculo Hidráulico';
        calcHead.onclick = function() { window.toggleAccordion('grp-calc'); };
        const calcContent = document.createElement('div'); calcContent.className = 'acc-content';
        calcContent.innerHTML = `<div class="prop-row"><label>Caudal (m³/h)</label><input type="number" id="calc-caudal" placeholder="Ej: 2.5"></div><div class="prop-row"><label>P. Entrada (mbar)</label><input type="number" id="calc-presion" value="23"></div><div class="prop-row"><label>Tipo Gas</label><select id="calc-gas" class="btn"><option value="natural">Gas Natural</option><option value="glp">GLP</option></select></div><div class="prop-row" style="flex-direction:row; justify-content:space-between;"><button class="btn primary" onclick="realizarCalculo()" style="flex:1; margin-right:5px;">Iterar ⚡</button><button class="btn" onclick="mostrarEcuaciones()" style="flex:1;">Función ƒ(x)</button></div><div id="calc-result"></div>`;
        calcGroup.appendChild(calcHead); calcGroup.appendChild(calcContent); contDatos.appendChild(calcGroup);
    }
}

// NUEVO: Función de Batch Update
window.updateBatchProp = function(key, val) {
    if(window.estado.selection.length < 2) return;
    window.estado.selection.forEach(id => {
        const el = window.elementos.find(x => x.id === id);
        if (el) {
            if (key === 'layerId' || key === 'visible') el[key] = val;
            else if (key === 'customColor') el.props.customColor = val;
        }
    });
    window.saveState();
    renderScene();
    renderEffects();
}

function generarFormularioValvulaActuada(el, container) {
    const grp = document.createElement('div');
    grp.className = 'acc-group';
    grp.innerHTML = `
        <div class="acc-header" onclick="this.parentElement.classList.toggle('collapsed')">Datos de Actuador</div>
        <div class="acc-content">
            <div class="prop-row row-h">
                <div style="flex:1"><label>Voltaje</label><input type="text" class="inp-actuada" data-key="voltaje" value="${el.props.voltaje||''}"></div>
                <div style="flex:1"><label>Corriente</label>
                    <select class="btn inp-actuada" data-key="corriente">
                        <option value="AC" ${el.props.corriente==='AC'?'selected':''}>AC</option>
                        <option value="DC" ${el.props.corriente==='DC'?'selected':''}>DC</option>
                    </select>
                </div>
            </div>
            <div class="prop-row"><label>Estado Compuerta</label>
                <select class="btn inp-actuada" data-key="estadoCompuerta" style="width:100%">
                    <option value="N/C" ${el.props.estadoCompuerta==='N/C'?'selected':''}>N/C (Normal Cerrada)</option>
                    <option value="N/A" ${el.props.estadoCompuerta==='N/A'?'selected':''}>N/A (Normal Abierta)</option>
                </select>
            </div>
            <div class="prop-row"><label>Referencia / Modelo</label><input type="text" class="inp-actuada" data-key="referencia" value="${el.props.referencia||''}"></div>
            <div class="prop-row"><label>MPO (Max Pressure)</label><input type="text" class="inp-actuada" data-key="mpo" value="${el.props.mpo||''}"></div>
            
            <div style="margin:10px 0; border-top:1px solid #444;"></div>
            <label style="font-size:0.75rem; color:#aaa; margin-bottom:5px; display:block;">Conexión Mecánica</label>
            
            <div class="prop-row row-h">
                <div style="flex:1"><label>Diámetro</label>
                    <select class="btn inp-actuada" data-key="diametro">
                        <option value='1/4"' ${el.props.diametro==='1/4"'?'selected':''}>1/4"</option>
                        <option value='1/2"' ${el.props.diametro==='1/2"'?'selected':''}>1/2"</option>
                        <option value='3/4"' ${el.props.diametro==='3/4"'?'selected':''}>3/4"</option>
                        <option value='1"' ${el.props.diametro==='1"'?'selected':''}>1"</option>
                        <option value='1-1/2"' ${el.props.diametro==='1-1/2"'?'selected':''}>1-1/2"</option>
                        <option value='2"' ${el.props.diametro==='2"'?'selected':''}>2"</option>
                    </select>
                </div>
                <div style="flex:1"><label>Acople</label>
                    <select class="btn inp-actuada" data-key="tipoAcople">
                        <option value="Hembra" ${el.props.tipoAcople==='Hembra'?'selected':''}>Hembra</option>
                        <option value="Macho" ${el.props.tipoAcople==='Macho'?'selected':''}>Macho</option>
                        <option value="Brida" ${el.props.tipoAcople==='Brida'?'selected':''}>Brida</option>
                    </select>
                </div>
            </div>
            <div class="prop-row"><label>Tipo Unión</label>
                 <select class="btn inp-actuada" data-key="tipoUnion" style="width:100%">
                    <option value="NPT" ${el.props.tipoUnion==='NPT'?'selected':''}>NPT (Rosca)</option>
                    <option value="AB" ${el.props.tipoUnion==='AB'?'selected':''}>AB (Brida)</option>
                    <option value="SL" ${el.props.tipoUnion==='SL'?'selected':''}>SL (Soldada)</option>
                </select>
            </div>
        </div>
    `;
    container.appendChild(grp);
    
    // Listeners para guardar cambios
    container.querySelectorAll('.inp-actuada').forEach(inp => {
        inp.onchange = (e) => {
            el.props[e.target.dataset.key] = e.target.value;
            window.saveState();
        };
    });
}

function generarFormularioTanque(el, container) {
    container.innerHTML = ''; 
    const props = el.props;
    if (!props.conexiones) {
        const n = props.numConexiones || 2;
        props.conexiones = [];
        for(let i=0; i<n; i++) props.conexiones.push({ id: i+1, nombre: `Punto ${i+1}`, tipo: "brida", diametro: '2"', posicion: 'top' });
    }
    const grpDim = document.createElement('div');
    grpDim.className = 'acc-group';
    grpDim.innerHTML = `
        <div class="acc-header" onclick="this.parentElement.classList.toggle('collapsed')">Dimensiones Tanque</div>
        <div class="acc-content">
            <div class="prop-row"><label>Diámetro (m)</label><input type="number" class="inp-tanque" data-key="diametro" value="${props.diametro}" step="0.1"></div>
            <div class="prop-row"><label>Longitud (m)</label><input type="number" class="inp-tanque" data-key="longitud" value="${props.longitud}" step="0.5"></div>
            <div class="prop-row"><label>Capacidad (Gal)</label><input type="number" class="inp-tanque" data-key="capacidadGalones" value="${props.capacidadGalones}"></div>
        </div>
    `;
    container.appendChild(grpDim);

    const grpConn = document.createElement('div');
    grpConn.className = 'acc-group';
    const btnAdd = `<button class="btn" style="float:right; font-size:0.7rem; padding:2px 6px;" onclick="addConexionTanque()">+</button>`;
    grpConn.innerHTML = `<div class="acc-header" onclick="this.parentElement.classList.toggle('collapsed')">Puntos de Acople ${btnAdd}</div><div class="acc-content" id="list-conexiones"></div>`;
    container.appendChild(grpConn);
    const listConn = grpConn.querySelector('#list-conexiones');
    props.conexiones.forEach((conn, index) => {
        const row = document.createElement('div');
        row.style.borderBottom = "1px solid #444";
        row.style.padding = "5px"; row.style.marginBottom = "5px"; row.style.background = "#1e1e1e";
        row.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-weight:bold; color:#0078d7; font-size:0.8rem;">#${index+1} ${conn.nombre}</span>
                <span style="cursor:pointer; color:#d44;" onclick="delConexionTanque(${index})">✕</span>
            </div>
            <div style="display:flex; gap:5px; margin-bottom:4px;">
                <select class="btn conn-change" data-idx="${index}" data-field="tipo" style="flex:1; font-size:0.75rem;">
                    <option value="brida" ${conn.tipo==='brida'?'selected':''}>Brida</option>
                    <option value="macho" ${conn.tipo==='macho'?'selected':''}>Macho</option>
                    <option value="hembra" ${conn.tipo==='hembra'?'selected':''}>Hembra</option>
                </select>
                <select class="btn conn-change" data-idx="${index}" data-field="posicion" style="width:70px; font-size:0.75rem;" title="Posición">
                    <option value="top" ${conn.posicion!=='bottom'?'selected':''}>⬆ Sup</option>
                    <option value="bottom" ${conn.posicion==='bottom'?'selected':''}>⬇ Inf</option>
                </select>
            </div>
            <div style="display:flex; gap:5px;">
                 <label style="font-size:0.7rem; align-self:center;">Diam:</label>
                 <select class="btn conn-change" data-idx="${index}" data-field="diametro" style="flex:1; font-size:0.75rem;">
                    <option value='1"' ${conn.diametro==='1"'?'selected':''}>1"</option>
                    <option value='2"' ${conn.diametro==='2"'?'selected':''}>2"</option>
                    <option value='4"' ${conn.diametro==='4"'?'selected':''}>4"</option>
                </select>
            </div>
        `;
        listConn.appendChild(row);
    });

    const grpChk = document.createElement('div');
    grpChk.className = 'acc-group';
    grpChk.innerHTML = `<div class="acc-header" onclick="this.parentElement.classList.toggle('collapsed')">Checklist Técnico</div><div class="acc-content" id="list-chk"></div>`;
    container.appendChild(grpChk);
    const listChk = grpChk.querySelector('#list-chk');
    const chk = props.checklist || {};
    const itemsCheck = [ {k:'valvulaAlivio', l:'Válvula Alivio', crit: true}, {k:'indicadorLlenado', l:'Indicador Nivel', crit: true}, {k:'drenaje', l:'Drenaje'} ];
    itemsCheck.forEach(it => {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.marginBottom = '4px';
        div.innerHTML = `<input type="checkbox" class="chk-tanque" data-key="${it.k}" ${chk[it.k] ? 'checked' : ''} style="margin-right:8px;"><span style="font-size:0.8rem">${it.l}</span>`;
        listChk.appendChild(div);
    });

    container.querySelectorAll('.inp-tanque').forEach(inp => {
        inp.onchange = (e) => { el.props[e.target.dataset.key] = parseFloat(e.target.value); window.saveState(); renderScene(); updatePropsPanel(); };
    });
    container.querySelectorAll('.chk-tanque').forEach(chkBox => {
        chkBox.onchange = (e) => { if(!el.props.checklist) el.props.checklist = {}; el.props.checklist[e.target.dataset.key] = e.target.checked; window.saveState(); renderScene(); updatePropsPanel(); };
    });
    listConn.querySelectorAll('.conn-change').forEach(sel => {
        sel.onchange = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const field = e.target.dataset.field;
            el.props.conexiones[idx][field] = e.target.value;
            window.saveState(); renderScene();
        };
    });
    window.addConexionTanque = () => {
        const id = el.props.conexiones.length + 1;
        el.props.conexiones.push({ id: id, nombre: "Nuevo", tipo: "macho", diametro: '1"', posicion: 'top' });
        window.saveState(); updatePropsPanel(); renderScene();
    };
    window.delConexionTanque = (idx) => {
        el.props.conexiones.splice(idx, 1);
        window.saveState(); updatePropsPanel(); renderScene();
    };
}

// Función auxiliar para dibujar Tanque
function dibujarTanqueGLP(g, s, el, col) {
    // Cuerpo tanque
    const gC = document.createElementNS("http://www.w3.org/2000/svg","rect");
    // Tamaño relativo (simplificado para el icono en canvas)
    // En realidad debería escalar con el zoom, pero para icono basta esto
    gC.setAttribute("x", s.x - 20); gC.setAttribute("y", s.y - 10);
    gC.setAttribute("width", 40); gC.setAttribute("height", 20);
    gC.setAttribute("rx", 5); gC.setAttribute("ry", 5);
    gC.setAttribute("fill", "#222"); gC.setAttribute("stroke", col);
    g.appendChild(gC);
    
    // Texto
    const t = document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x", s.x); t.setAttribute("y", s.y+4); 
    t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", "8px"); 
    t.setAttribute("fill", col); t.textContent = "GLP";
    g.appendChild(t);
}

window.togLay = (id) => { const l=window.layers.find(x=>x.id===id); l.visible=!l.visible; renderLayersUI(); renderScene(); }
window.addLayer = () => { window.layers.push({id:'l'+Date.now(), name:'Nueva', color:'#fff', visible:true}); renderLayersUI(); }

window.updateAlturaFinal = function(valUser) {
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x => x.id === window.estado.selection[0]); if (!el || (el.tipo !== 'tuberia' && el.tipo !== 'cota')) return;
    const num = parseInputFloat(valUser); if (isNaN(num)) return;
    const u = window.UNITS[window.CONFIG.unit]; const newFinalZ = num / u.factor; el.dz = newFinalZ - el.z;
    window.saveState(); renderScene(); renderEffects(); updatePropsPanel(); 
}
window.changeMaterial = function(newMat) {
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x=>x.id===window.estado.selection[0]); if(!el) return;
    const catItem = window.CATALOGO.mat.find(m => m.props.material === newMat);
    if(catItem) { el.props.material = newMat; el.props.customColor = null; el.props.color = catItem.color; el.props.diametroNominal = catItem.props.diametroNominal; window.saveState(); updatePropsPanel(); renderScene(); }
}
window.updateDiametro = function(val) { 
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x=>x.id===window.estado.selection[0]); 
    if(el){ el.props.diametroNominal = val; window.saveState(); renderScene(); renderEffects(); } 
}
window.updateStyleProp = function(k,v) { 
    if (window.estado.selection.length !== 1) return;
    const el=window.elementos.find(x=>x.id===window.estado.selection[0]); 
    if(el){ 
        if(k==='color') { el.props.customColor = v; } 
        else if (k === 'scaleFactor') { el.props[k] = parseFloat(v); document.getElementById('p-scale-val').textContent = v; } 
        else { el.props[k]=v; }
        window.saveState(); renderScene(); if(k==='anchor' || k==='scaleFactor') renderEffects(); 
    } 
}
window.invertirFlujo = function() {
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x => x.id === window.estado.selection[0]);
    if (el && el.props) {
        el.props.rotacion = (parseFloat(el.props.rotacion || 0) + 180) % 360;
        document.getElementById('p-rot').value = el.props.rotacion;
        window.saveState(); renderScene();
    }
}
window.updateBooleanProp = function(k, val) { 
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x=>x.id===window.estado.selection[0]); if(el){ el.props[k] = val; window.saveState(); renderScene(); } 
}
window.updateRootProp = function(k, val) { 
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x=>x.id===window.estado.selection[0]); if(el){ el[k] = val; window.saveState(); renderScene(); renderEffects(); } 
}
window.updateLongitud = function(valUser) {
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x=>x.id===window.estado.selection[0]); if(!el || el.tipo !== 'tuberia') return;
    const currentLen = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2); if(currentLen < 0.0001) return;
    const newValMeters = parseToMeters(parseInputFloat(valUser)); if(isNaN(newValMeters) || newValMeters <= 0) return;
    const ratio = newValMeters / currentLen; el.dx *= ratio; el.dy *= ratio; el.dz *= ratio;
    window.saveState(); renderScene();
}
window.updateAltura = function(valUser) {
    if (window.estado.selection.length !== 1) return;
    const el = window.elementos.find(x=>x.id===window.estado.selection[0]); if(!el) return;
    const num = parseInputFloat(valUser); if(isNaN(num)) return;
    const u = window.UNITS[window.CONFIG.unit]; el.z = num / u.factor;
    window.saveState(); renderScene(); renderEffects(); updatePropsPanel();
}

console.log("✅ Renderer cargado con Blue Stream UI (Drag & Drop + Smart Pos + Multi-Edit Fix)");
