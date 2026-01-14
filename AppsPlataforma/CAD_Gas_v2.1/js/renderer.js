// js/renderer.js
function isoToScreen(x, y, z) {
    const ang = window.estado.view.angle;
    const pitch = window.estado.view.pitch || 1; 
    const nx = x * Math.cos(ang) - y * Math.sin(ang);
    const ny = x * Math.sin(ang) + y * Math.cos(ang);
    return { x: nx * window.CONFIG.tileW, y: (ny * window.CONFIG.tileH) - (z * window.CONFIG.tileW * 0.7 * pitch) };
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
    const pt = document.getElementById('lienzo-cad').createSVGPoint(); pt.x = ex; pt.y = ey; 
    return pt.matrixTransform(document.getElementById('world-transform').getScreenCTM().inverse()); 
}

// --- RENDERIZADO ---
function renderGrid() {
    const pMaj = document.getElementById('grid-path'), pMin = document.getElementById('grid-minor'), a = document.getElementById('grid-axis');
    if(!window.CONFIG.showGrid) { pMaj.setAttribute('d', ''); pMin.setAttribute('d', ''); a.setAttribute('d', ''); return; }
    let dMaj="", dMin="", da=""; const sz=20; 
    for(let i=-sz; i<=sz; i++) {
        let p1=isoToScreen(-sz,i,0), p2=isoToScreen(sz,i,0); let seg = `M${p1.x},${p1.y} L${p2.x},${p2.y} `;
        if(i===0) da+=seg; else if(i%5 === 0) dMaj+=seg; else dMin+=seg; 
    }
    for(let i=-sz; i<=sz; i++) {
        let p1=isoToScreen(i,-sz,0), p2=isoToScreen(i,sz,0); let seg = `M${p1.x},${p1.y} L${p2.x},${p2.y} `;
        if(i===0) da+=seg; else if(i%5 === 0) dMaj+=seg; else dMin+=seg;
    }
    pMaj.setAttribute('d', dMaj); pMin.setAttribute('d', dMin); a.setAttribute('d', da);
}

function renderGizmo() {
    const c = document.getElementById('gizmo-axes'); c.innerHTML = '';
    const ang = window.estado.view.angle;
    [{id:'X',x:1,y:0,z:0,c:'#f44'},{id:'Y',x:0,y:1,z:0,c:'#4f4'},{id:'Z',x:0,y:0,z:1,c:'#44f'}].forEach(ax => {
        const nx = ax.x * Math.cos(ang) - ax.y * Math.sin(ang);
        const ny = ax.x * Math.sin(ang) + ax.y * Math.cos(ang);
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1",0); l.setAttribute("y1",0); l.setAttribute("x2",nx*30); l.setAttribute("y2",ny*15 - ax.z*20);
        l.setAttribute("stroke", ax.c); l.setAttribute("stroke-width", "2");
        c.appendChild(l);
    });
}

function renderScene() {
    const cont = document.getElementById('contenedor-elementos'); cont.innerHTML = ''; 
    
    // Z-SORTING
    const lista = [...window.elementos];
    const pitch = window.estado.view.pitch || 1;
    lista.sort((a, b) => {
        const da = (a.x + a.y) + (a.z * (pitch > 0 ? 1 : -1));
        const db = (b.x + b.y) + (b.z * (pitch > 0 ? 1 : -1));
        return da - db;
    });

    lista.forEach(el => {
        if(el.visible === false) return;
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const s = isoToScreen(el.x, el.y, el.z);
        let col = el.props.customColor || el.props.color || '#ccc'; 
        
        if (el.props.tipo === 'tanque_glp') {
            dibujarTanqueGLP(g, s, el, col);
        } else if(el.tipo === 'tuberia') {
            const e = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz);
            const w = el.props.diametroNominal ? window.parseDiameterToScale(el.props.diametroNominal) : 2;
            const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
            l.setAttribute("x1",s.x); l.setAttribute("y1",s.y); l.setAttribute("x2",e.x); l.setAttribute("y2",e.y);
            l.setAttribute("stroke", col); l.setAttribute("stroke-width", w);
            g.appendChild(l);
        } else {
            // Generico
            const r = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            r.setAttribute("cx", s.x); r.setAttribute("cy", s.y); r.setAttribute("r", 5); r.setAttribute("fill", col);
            g.appendChild(r);
        }
        cont.appendChild(g);
    });
    renderInterface();
}

function dibujarTanqueGLP(g, s, el, col) {
    const tileW = window.CONFIG.tileW; 
    const diam = parseFloat(el.props.diametro)||2; const len = parseFloat(el.props.longitud)||6;
    const radS = (diam/2)*tileW; const radM = diam/2;
    const rot = (parseFloat(el.props.rotacion||0)*Math.PI)/180;
    
    // Ejes
    const dx = Math.cos(rot)*(len/2); const dy = Math.sin(rot)*(len/2);
    const p1 = {x:el.x+dx, y:el.y+dy, z:el.z}; const p2 = {x:el.x-dx, y:el.y-dy, z:el.z};
    const s1 = isoToScreen(p1.x, p1.y, p1.z); const s2 = isoToScreen(p2.x, p2.y, p2.z);
    
    // Cuerpo
    const angS = Math.atan2(s2.y-s1.y, s2.x-s1.x);
    const pX = Math.cos(angS+Math.PI/2)*radS; const pY = Math.sin(angS+Math.PI/2)*radS;
    
    const body = document.createElementNS("http://www.w3.org/2000/svg", "path");
    body.setAttribute("d", `M ${s1.x+pX},${s1.y+pY} L ${s2.x+pX},${s2.y+pY} L ${s2.x-pX},${s2.y-pY} L ${s1.x-pX},${s1.y-pY} Z`);
    body.setAttribute("fill", "#eee"); body.setAttribute("stroke", "#555");
    g.appendChild(body);
    
    // Tapas
    [s2, s1].forEach(pt => {
        const elip = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        elip.setAttribute("cx", pt.x); elip.setAttribute("cy", pt.y);
        elip.setAttribute("rx", radS*0.5); elip.setAttribute("ry", radS);
        elip.setAttribute("transform", `rotate(${angS*180/Math.PI}, ${pt.x}, ${pt.y})`);
        elip.setAttribute("fill", pt===s1?"#fff":"#ccc"); elip.setAttribute("stroke", "#555");
        g.appendChild(elip);
    });

    // Conexiones
    const upX = -pX * (window.estado.view.pitch||1); const upY = -pY * (window.estado.view.pitch||1);
    (el.props.conexiones||[]).forEach((conn, i) => {
        const t = (i+1)/((el.props.conexiones.length||0)+1);
        const ax = p1.x + (p2.x-p1.x)*t; const ay = p1.y + (p2.y-p1.y)*t;
        const isBot = conn.posicion === 'bottom';
        const az = el.z + (isBot ? -radM : radM);
        const base = isoToScreen(ax, ay, az);
        const tipZ = az + (isBot ? -0.5 : 0.5); // 0.5m de alto
        const tip = isoToScreen(ax, ay, tipZ);
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", base.x); line.setAttribute("y1", base.y);
        line.setAttribute("x2", tip.x); line.setAttribute("y2", tip.y);
        line.setAttribute("stroke", "#333"); line.setAttribute("stroke-width", window.parseDiameterToScale(conn.diametro));
        g.appendChild(line);
    });
}

function renderInterface() {
    const g = document.getElementById('capa-interfaz'); g.innerHTML='';
    if(window.estado.action==='rotate' || window.estado.action==='pan') return;
    const s = isoToScreen(window.estado.mouseIso.x, window.estado.mouseIso.y, window.estado.currentZ);
    if(window.estado.snapped) {
        const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
        r.setAttribute("x", s.x-5); r.setAttribute("y",s.y-5); r.setAttribute("width",10); r.setAttribute("height",10);
        r.setAttribute("stroke", "#0ff"); r.setAttribute("fill", "none"); g.appendChild(r);
    } else {
        const p = document.createElementNS("http://www.w3.org/2000/svg","path");
        p.setAttribute("d", `M${s.x-10},${s.y} L${s.x+10},${s.y} M${s.x},${s.y-10} L${s.x},${s.y+10}`);
        p.setAttribute("stroke", "#fff"); g.appendChild(p);
    }
}

// UI UPDATE
function updateStatusHUD() {
    const p = window.estado.view.pitch||1;
    document.getElementById('hover-tooltip').style.display = p<0 ? 'block' : 'none';
    if(p<0) { document.getElementById('hover-tooltip').innerText = "VISTA INFERIOR"; }
}

function updatePropsPanel() {
    const el = window.elementos.find(x=>x.id===window.estado.selID);
    const f = document.getElementById('prop-form');
    if(!el) { if(f) f.style.display='none'; return; }
    if(f) f.style.display='block';
    
    // Simplificado para restaurar funcionalidad basica
    document.getElementById('p-altura').value = el.z;
    // (Aquí iría la lógica completa de generarFormularioTanque si se desea restaurar el acordeón completo)
}

function renderLayersUI() {
    const c = document.getElementById('lista-capas-header'); c.innerHTML='';
    window.layers.forEach(l => {
        const d = document.createElement('div'); d.innerText = l.name; d.style.padding="5px";
        if(l.id===window.activeLayerId) d.style.background="#444";
        d.onclick = () => { window.activeLayerId=l.id; renderLayersUI(); };
        c.appendChild(d);
    });
}
