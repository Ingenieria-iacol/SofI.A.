// js/renderer.js - Visualización (Z-Sorting + Pitch + Tanque 3D + UI Completa)

// ==========================================
// 1. MATEMÁTICAS VISUALES
// ==========================================

function isoToScreen(x, y, z) {
    const ang = window.estado.view.angle;
    const pitch = window.estado.view.pitch || 1; // 1 = Arriba, -1 = Abajo
    
    const nx = x * Math.cos(ang) - y * Math.sin(ang);
    const ny = x * Math.sin(ang) + y * Math.cos(ang);
    
    // El pitch invierte el efecto de la altura Z
    return { 
        x: nx * window.CONFIG.tileW, 
        y: (ny * window.CONFIG.tileH) - (z * window.CONFIG.tileW * 0.7 * pitch) 
    };
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
    
    // Centro base
    const pts = [{x: el.x, y: el.y, z: el.z}]; 

    // Puntos específicos para Tanques
    if(el.props.tipo === 'tanque_glp' && el.props.conexiones) {
        const diam = parseFloat(el.props.diametro) || 2.0;
        const len = parseFloat(el.props.longitud) || 6.0;
        const rads = (parseFloat(el.props.rotacion || 0) * Math.PI) / 180;
        const dx = Math.cos(rads) * (len / 2);
        const dy = Math.sin(rads) * (len / 2);
        
        // Extremos del eje central
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

// ==========================================
// 2. RENDERIZADO PRINCIPAL (Scene)
// ==========================================

function renderScene() {
    const cont = document.getElementById('contenedor-elementos'); 
    const capFit = document.getElementById('capa-fittings');
    cont.innerHTML = ''; capFit.innerHTML = ''; 
    
    // ALGORITMO DEL PINTOR (Z-SORTING)
    const lista = [...window.elementos];
    const pitch = window.estado.view.pitch || 1;
    
    lista.sort((a, b) => {
        // Profundidad aproximada: (X + Y) + Z*pitch
        const da = (a.x + a.y) + (a.z * (pitch > 0 ? 1 : -1));
        const db = (b.x + b.y) + (b.z * (pitch > 0 ? 1 : -1));
        return da - db;
    });

    lista.forEach(el => {
        if(el.visible === false) return;
        const lay = window.layers.find(l=>l.id===el.layerId); 
        if(!lay || !lay.visible) return;

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const s = isoToScreen(el.x, el.y, el.z);
        let col = el.props.customColor || el.props.color || lay.color; 
        
        if (el.props.tipo === 'tanque_glp') {
            dibujarTanqueGLP(g, s, el, col);
        } else if(el.tipo === 'tuberia') {
            dibujarTuberia(g, s, el, col);
        } else if(el.tipo === 'cota') {
            dibujarCota(g, s, el);
        } else if (el.tipo === 'texto') {
            dibujarTexto(g, s, el, col);
        } else {
            dibujarGenerico(g, s, el, col);
        }
        cont.appendChild(g);
    });
    
    if (typeof window.analizarRed === 'function') {
        const autoFittings = window.analizarRed();
        autoFittings.forEach(fit => dibujarFitting(fit, capFit));
    }
    
    updateStatusHUD();
    renderEffects();
}

// --- SUB-RUTINAS DE DIBUJO ---

function dibujarTuberia(g, s, el, col) {
    let width = 2;
    if(el.props.diametroNominal) width = window.parseDiameterToScale(el.props.diametroNominal);
    else width = el.props.grosor || 2;
    
    const e = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz);
    const body = document.createElementNS("http://www.w3.org/2000/svg", "line");
    body.setAttribute("x1",s.x); body.setAttribute("y1",s.y); 
    body.setAttribute("x2",e.x); body.setAttribute("y2",e.y);
    body.setAttribute("class","tuberia"); body.setAttribute("stroke", col); body.setAttribute("stroke-width", width);
    
    if(el.props.tipoLinea === 'dashed') body.setAttribute("stroke-dasharray", "6,4");
    else if(el.props.tipoLinea === 'dotted') body.setAttribute("stroke-dasharray", "2,2");
    g.appendChild(body);
    
    if(window.CONFIG.showTags && (el.props.diametroNominal || el.props.material)) {
        const midX = (s.x + e.x)/2; const midY = (s.y + e.y)/2;
        let angDeg = Math.atan2(e.y - s.y, e.x - s.x) * (180 / Math.PI);
        if (angDeg > 90 || angDeg < -90) { angDeg += 180; }
        
        const txtTop = `${el.props.material || ''} ${el.props.diametroNominal ? 'Ø'+el.props.diametroNominal : ''}`;
        const tTop = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tTop.setAttribute("x", midX); tTop.setAttribute("y", midY - 8); 
        tTop.setAttribute("class", "label-tech");
        tTop.setAttribute("transform", `rotate(${angDeg}, ${midX}, ${midY})`);
        tTop.textContent = txtTop;
        g.appendChild(tTop);
    }
}

// --- TANQUE 3D CON INGENIERÍA DE DETALLE ---
function dibujarTanqueGLP(g, screenPos, el, colorBase) {
    const tileW = window.CONFIG.tileW; 
    const diametro = parseFloat(el.props.diametro) || 2.0;
    const longitud = parseFloat(el.props.longitud) || 6.0;
    const radioScreen = (diametro / 2) * tileW; 
    const radioMeters = diametro / 2;
    
    const rotacionGrados = parseFloat(el.props.rotacion || 0);
    const rads = rotacionGrados * Math.PI / 180;
    const dx = Math.cos(rads) * (longitud / 2);
    const dy = Math.sin(rads) * (longitud / 2);
    
    const p1_iso = { x: el.x + dx, y: el.y + dy, z: el.z };
    const p2_iso = { x: el.x - dx, y: el.y - dy, z: el.z };
    const s1 = isoToScreen(p1_iso.x, p1_iso.y, p1_iso.z);
    const s2 = isoToScreen(p2_iso.x, p2_iso.y, p2_iso.z);
    
    const colorCuerpo = "#eeeeee"; const colorSombra = "#cccccc"; const strokeCol = colorBase || "#555";
    const angleScreen = Math.atan2(s2.y - s1.y, s2.x - s1.x);
    const perpX = Math.cos(angleScreen + Math.PI/2) * radioScreen;
    const perpY = Math.sin(angleScreen + Math.PI/2) * radioScreen;
    
    // Cuerpo
    const bodyPath = `M ${s1.x + perpX},${s1.y + perpY} L ${s2.x + perpX},${s2.y + perpY} L ${s2.x - perpX},${s2.y - perpY} L ${s1.x - perpX},${s1.y - perpY} Z`;
    const body = document.createElementNS("http://www.w3.org/2000/svg", "path");
    body.setAttribute("d", bodyPath); body.setAttribute("fill", colorCuerpo); 
    body.setAttribute("stroke", strokeCol); body.setAttribute("stroke-width", 2);
    g.appendChild(body);
    
    // Tapas
    [s2, s1].forEach(s => {
        const tapa = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        tapa.setAttribute("cx", s.x); tapa.setAttribute("cy", s.y);
        tapa.setAttribute("rx", radioScreen * 0.5); tapa.setAttribute("ry", radioScreen);
        tapa.setAttribute("transform", `rotate(${angleScreen * 180 / Math.PI}, ${s.x}, ${s.y})`);
        tapa.setAttribute("fill", s===s1 ? "#fff" : colorSombra); 
        tapa.setAttribute("stroke", strokeCol);
        g.appendChild(tapa);
    });

    // CONEXIONES (Basadas en Z real)
    const conexiones = el.props.conexiones || [];
    conexiones.forEach((conn, index) => {
        const t = (index + 1) / (conexiones.length + 1);
        const ax = p1_iso.x + (p2_iso.x - p1_iso.x) * t;
        const ay = p1_iso.y + (p2_iso.y - p1_iso.y) * t;
        
        // Z Real: Si es 'bottom', restamos el radio al Z del tanque. Si es 'top', sumamos.
        const isBottom = conn.posicion === 'bottom';
        const zOffset = isBottom ? -radioMeters : radioMeters;
        
        // Proyectar base
        const base = isoToScreen(ax, ay, el.z + zOffset);
        
        // Proyectar punta (Extrusión vertical Z)
        const heightMeters = 0.5; // Altura fija en metros
        const tipZ = el.z + zOffset + (isBottom ? -heightMeters : heightMeters);
        const tip = isoToScreen(ax, ay, tipZ);
        
        // Dibujar
        const diamPix = window.parseDiameterToScale(conn.diametro);
        const neck = document.createElementNS("http://www.w3.org/2000/svg", "line");
        neck.setAttribute("x1", base.x); neck.setAttribute("y1", base.y);
        neck.setAttribute("x2", tip.x); neck.setAttribute("y2", tip.y);
        neck.setAttribute("stroke", "#444"); neck.setAttribute("stroke-width", diamPix);
        g.appendChild(neck);
        
        // Brida/Cabeza
        const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        head.setAttribute("cx", tip.x); head.setAttribute("cy", tip.y);
        head.setAttribute("r", diamPix * 0.8); head.setAttribute("fill", "#222");
        g.appendChild(head);
        
        // Etiqueta
        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", tip.x); txt.setAttribute("y", tip.y + (isBottom?12:-5));
        txt.setAttribute("text-anchor", "middle"); txt.setAttribute("font-size", "9px");
        txt.setAttribute("fill", "#0078d7"); txt.textContent = conn.id;
        g.appendChild(txt);
    });
    
    // Alertas de seguridad y Drenaje Genérico
    if (el.props.checklist?.drenaje) {
        const cx = (s1.x + s2.x) / 2; const cy = (s1.y + s2.y) / 2;
        // Drenaje genérico pequeño
        const drain = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        drain.setAttribute("cx", cx); drain.setAttribute("cy", cy + radioScreen); // Aprox abajo visual
        drain.setAttribute("r", 3); drain.setAttribute("fill", "#000");
        g.appendChild(drain);
    }
    
    const esSeguro = el.props.checklist?.valvulaAlivio && el.props.checklist?.indicadorLlenado;
    if (!esSeguro) {
        body.setAttribute("fill", "#ffe6e6"); body.setAttribute("stroke", "#cc0000");
        const textAlert = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textAlert.setAttribute("x", (s1.x+s2.x)/2); textAlert.setAttribute("y", (s1.y+s2.y)/2);
        textAlert.setAttribute("text-anchor", "middle"); textAlert.setAttribute("dominant-baseline", "middle");
        textAlert.setAttribute("font-size", radioScreen); textAlert.textContent = "⚠️";
        g.appendChild(textAlert);
    }
}

function dibujarGenerico(g, s, el, col) {
    let rot = 0;
    if (el.props.dirVector) {
        const p1 = isoToScreen(0, 0, 0); const p2 = isoToScreen(el.props.dirVector.dx, el.props.dirVector.dy, el.props.dirVector.dz);
        rot = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    } else { rot = parseFloat(el.props.rotacion || 0); }
    
    g.setAttribute("transform", `translate(${s.x},${s.y}) rotate(${rot}) translate(${-s.x},${-s.y})`);
    
    const scaleFactor = el.props.scaleFactor || 1.0; 
    const baseSize = (window.CONFIG.tileW * 0.25) * scaleFactor;
    
    const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
    r.setAttribute("x", s.x - baseSize/2); r.setAttribute("y", s.y - baseSize/2);
    r.setAttribute("width", baseSize); r.setAttribute("height", baseSize);
    r.setAttribute("fill", "#222"); r.setAttribute("stroke", col);
    
    const tx = document.createElementNS("http://www.w3.org/2000/svg","text");
    tx.setAttribute("x", s.x); tx.setAttribute("y", s.y + 4); 
    tx.setAttribute("text-anchor","middle"); tx.setAttribute("fill",col); 
    tx.setAttribute("font-size", (baseSize*0.6)+"px"); 
    tx.textContent = el.icon;
    g.appendChild(r); g.appendChild(tx);
}

function dibujarCota(g, s, el) {
    const e = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz);
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1",s.x); l.setAttribute("y1",s.y); l.setAttribute("x2",e.x); l.setAttribute("y2",e.y);
    l.setAttribute("class","dim-line"); 
    g.appendChild(l);
}

function dibujarTexto(g, s, el, col) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x",s.x); t.setAttribute("y",s.y); t.setAttribute("class","dim-text");
    t.setAttribute("fill", col); t.setAttribute("font-size", "14px"); 
    t.textContent = el.props.text;
    g.appendChild(t);
}

function dibujarFitting(fit, container) {
    const s = isoToScreen(fit.x, fit.y, fit.z);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", s.x); c.setAttribute("cy", s.y); 
    c.setAttribute("r", fit.width * 0.8); 
    c.setAttribute("fill", fit.color);
    g.appendChild(c);
    container.appendChild(g);
}

// ==========================================
// 3. UI HELPERS Y ACTUALIZACIONES
// ==========================================

function updateStatusHUD() {
    let indic = document.getElementById('view-indicator');
    if (!indic) {
        indic = document.createElement('div'); indic.id = 'view-indicator';
        indic.style.cssText = "position:absolute; top:60px; left:50%; transform:translateX(-50%); pointer-events:none; font-weight:bold;";
        document.getElementById('main-area').appendChild(indic);
    }
    const pitch = window.estado.view.pitch || 1;
    indic.innerText = pitch < 0 ? "⬇ VISTA INFERIOR" : "";
    indic.style.color = pitch < 0 ? "#ff4444" : "transparent";
    
    document.getElementById('hud-scale-input').value = Math.round(window.estado.view.scale*100);
    document.getElementById('hud-rot-input').value = Math.round(window.estado.view.angle * 180/Math.PI);
    renderGizmo();
}

function updateTransform() {
    const world = document.getElementById('world-transform');
    world.setAttribute('transform', `translate(${window.estado.view.x}, ${window.estado.view.y}) scale(${window.estado.view.scale})`);
    updateStatusHUD();
}

function renderEffects() {
    const ch = document.getElementById('capa-hover'); ch.innerHTML='';
    const cs = document.getElementById('capa-seleccion'); cs.innerHTML='';
    const draw = (id, root, cls) => {
        const el = window.elementos.find(x=>x.id===id); if(!el || el.visible === false) return; 
        const s = isoToScreen(el.x, el.y, el.z);
        const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
        c.setAttribute("cx",s.x); c.setAttribute("cy",s.y); c.setAttribute("r",15); 
        c.setAttribute("class", cls); root.appendChild(c);
    };
    if(window.estado.hoverID && window.estado.tool==='select') draw(window.estado.hoverID, ch, 'hover-halo');
    if(window.estado.selID) draw(window.estado.selID, cs, 'sel-halo');
}

function renderInterface() {
    const g = document.getElementById('capa-interfaz'); g.innerHTML='';
    if(window.estado.action === 'rotate' || window.estado.action === 'pan') return;

    let tx = window.estado.snapped ? window.estado.snapped.x : window.estado.mouseIso.x;
    let ty = window.estado.snapped ? window.estado.snapped.y : window.estado.mouseIso.y;
    let tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
    
    const s = isoToScreen(tx, ty, tz);
    if(window.estado.snapped) {
        const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
        r.setAttribute("x", s.x-5); r.setAttribute("y",s.y-5); r.setAttribute("width",10); r.setAttribute("height",10);
        r.setAttribute("class","snap-marker"); r.setAttribute("stroke", "#00FFFF");
        g.appendChild(r);
    } else {
        const path = document.createElementNS("http://www.w3.org/2000/svg","path");
        path.setAttribute("d", `M${s.x-15},${s.y} L${s.x+15},${s.y} M${s.x},${s.y-15} L${s.x},${s.y+15}`);
        path.setAttribute("class","cursor-crosshair"); g.appendChild(path);
    }
}

// --- GESTIÓN DE UI ---
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
    const svg = document.getElementById('lienzo-cad'); const rect = svg.getBoundingClientRect(); 
    window.estado.view.angle = Math.PI / 4; window.estado.view.x = rect.width/2; window.estado.view.y = rect.height/2; window.estado.view.scale = 1;
    updateTransform(); renderScene();
}
function togglePanel(id) { document.getElementById(id).classList.toggle('closed'); setTimeout(() => { updateTransform(); }, 410); }
function toggleGroup(id) { document.querySelectorAll('.lib-items').forEach(el => { if(el.id !== id) el.classList.remove('open'); }); document.getElementById(id).classList.toggle('open'); }
function toggleAccordion(id) { const el = document.getElementById(id); if(el) el.classList.toggle('collapsed'); }

// --- BIBLIOTECA ---
function initLibrary() {
    const fillGroup = (id, items) => {
        const c = document.getElementById(id); c.innerHTML='';
        if (!items) return; 
        items.forEach(it => {
            const div = document.createElement('div'); div.className='tool-item';
            div.innerHTML = `<div class="tool-icon" style="color:${it.color||'#aaa'}">${it.icon||'▪'}</div><div class="tool-name">${it.name}</div>`;
            div.onclick = () => { 
                document.querySelectorAll('.tool-item').forEach(x=>x.classList.remove('active')); div.classList.add('active'); 
                window.estado.activeItem = it; window.setTool(it.id); 
                document.getElementById('right-panel').classList.add('closed');
            };
            c.appendChild(div);
        });
    };
    const C = window.CATALOGO;
    if(C) { fillGroup('grp-mat', C.mat); fillGroup('grp-comp', C.comp); fillGroup('grp-eq', C.eq); fillGroup('grp-inst', C.inst); fillGroup('grp-perif', C.perif); fillGroup('grp-cons', C.cons); }
    renderLayersUI();
}
function renderLayersUI() {
    const c = document.getElementById('lista-capas-header'); c.innerHTML='';
    window.layers.forEach(l => {
        const r = document.createElement('div'); r.className = `layer-row-header ${l.id===window.activeLayerId?'active':''}`;
        r.innerHTML = `<div class="layer-vis" onclick="togLay('${l.id}')">${l.visible?'👁️':'🙈'}</div><div style="flex:1; font-size:0.8rem; color:${l.color}">${l.name}</div>`;
        r.onclick = (e) => { if(e.target.className!=='layer-vis') { window.activeLayerId=l.id; renderLayersUI(); } e.stopPropagation(); };
        c.appendChild(r);
    });
    const sel = document.getElementById('p-capa'); sel.innerHTML = '';
    window.layers.forEach(l => { const opt = document.createElement('option'); opt.value=l.id; opt.innerText=l.name; sel.appendChild(opt); });
}

// --- FORMULARIO DE PROPIEDADES TANQUE ---
function generarFormularioTanque(el, container) {
    container.innerHTML = ''; 
    const props = el.props;
    if (!props.conexiones) {
        props.conexiones = []; for(let i=0; i<(props.numConexiones||2); i++) props.conexiones.push({ id: i+1, nombre: `Punto ${i+1}`, tipo: "brida", diametro: '2"', posicion: 'top' });
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
                    <option value="soldadura" ${conn.tipo==='soldadura'?'selected':''}>Soldadura</option>
                </select>
                <select class="btn conn-change" data-idx="${index}" data-field="posicion" style="width:70px; font-size:0.75rem;" title="Posición">
                    <option value="top" ${conn.posicion!=='bottom'?'selected':''}>⬆ Sup</option>
                    <option value="bottom" ${conn.posicion==='bottom'?'selected':''}>⬇ Inf</option>
                </select>
            </div>
            <div style="display:flex; gap:5px;">
                 <label style="font-size:0.7rem; align-self:center;">Diam:</label>
                 <select class="btn conn-change" data-idx="${index}" data-field="diametro" style="flex:1; font-size:0.75rem;">
                    <option value='1/2"' ${conn.diametro==='1/2"'?'selected':''}>1/2"</option>
                    <option value='3/4"' ${conn.diametro==='3/4"'?'selected':''}>3/4"</option>
                    <option value='1"' ${conn.diametro==='1"'?'selected':''}>1"</option>
                    <option value='1-1/2"' ${conn.diametro==='1-1/2"'?'selected':''}>1.5"</option>
                    <option value='2"' ${conn.diametro==='2"'?'selected':''}>2"</option>
                    <option value='3"' ${conn.diametro==='3"'?'selected':''}>3"</option>
                    <option value='4"' ${conn.diametro==='4"'?'selected':''}>4"</option>
                    <option value='6"' ${conn.diametro==='6"'?'selected':''}>6"</option>
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
    const itemsCheck = [ {k:'valvulaAlivio', l:'Válvula Alivio', crit: true}, {k:'indicadorLlenado', l:'Indicador Nivel', crit: true}, {k:'drenaje', l:'Drenaje'}, {k:'rotogate', l:'Rotogate'}, {k:'multivalvulas', l:'Multiválvulas'} ];
    itemsCheck.forEach(it => {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.marginBottom = '4px';
        const isMissingCrit = it.crit && !chk[it.k];
        if(isMissingCrit) div.style.color = "#ff6666";
        div.innerHTML = `<input type="checkbox" class="chk-tanque" data-key="${it.k}" ${chk[it.k] ? 'checked' : ''} style="margin-right:8px;"><span style="font-size:0.8rem">${it.l} ${it.crit ? '*' : ''}</span>`;
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

function updatePropsPanel() {
    const el = window.elementos.find(x=>x.id===window.estado.selID);
    const f = document.getElementById('prop-form'); const v = document.getElementById('prop-vacio');
    const divAdjust = document.getElementById('obj-adjust-controls');
    const contDatos = document.getElementById('prop-datos-tecnicos-container'); contDatos.innerHTML = ''; 

    if(!el) { f.style.display='none'; v.style.display='block'; return; }
    f.style.display='block'; v.style.display='none';
    
    document.getElementById('p-visible').checked = (el.visible !== false); 
    document.getElementById('p-color').value = ensureHex(el.props.customColor || el.props.color || '#cccccc');
    document.getElementById('p-tag').value = el.props.tag || '';
    document.getElementById('p-linestyle').value = el.props.tipoLinea || 'solid';
    document.getElementById('p-capa').value = el.layerId;
    document.getElementById('p-show-label').checked = el.props.mostrarEtiqueta === true;
    
    const u = window.UNITS[window.CONFIG.unit];
    document.getElementById('lbl-unit-z').innerText = u.label; document.getElementById('p-altura').value = (el.z * u.factor).toFixed(u.precision);
    const rowFinal = document.getElementById('row-altura-final'); document.getElementById('lbl-unit-z-final').innerText = u.label;
    
    if (el && el.props.tipo === 'tanque_glp') {
        generarFormularioTanque(el, contDatos);
        if(divAdjust) divAdjust.style.display = 'none';
    } 
    else if (el.tipo === 'tuberia' || el.tipo === 'cota') {
        const finalZ = el.z + el.dz; document.getElementById('p-altura-final').value = (finalZ * u.factor).toFixed(u.precision);
        rowFinal.style.display = 'flex'; divAdjust.style.display = 'none'; document.getElementById('row-longitud').style.display = 'flex';
        const rawLen = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
        document.getElementById('lbl-unit').innerText = u.label; document.getElementById('p-longitud').value = (rawLen * u.factor).toFixed(u.precision);
    } else {
        rowFinal.style.display = 'none'; document.getElementById('row-longitud').style.display = 'none';
        if(el.tipo !== 'texto') {
             divAdjust.style.display = 'block'; const scaleVal = el.props.scaleFactor || 1.0;
             document.getElementById('p-scale').value = scaleVal; document.getElementById('p-scale-val').textContent = scaleVal;
             document.getElementById('p-anchor').value = el.props.anchor || 'center';
        } else { divAdjust.style.display = 'none'; }
    }
    const divGrosor = document.getElementById('row-grosor');
    if(el.tipo === 'tuberia' && el.props.material) { divGrosor.style.display = 'none'; } else { divGrosor.style.display = 'flex'; document.getElementById('p-grosor').value = el.props.grosor || 2; }
    if(el.props.rotacion !== undefined) document.getElementById('p-rot').value = el.props.rotacion;
    
    if (el.tipo === 'tuberia' && el.props.material) {
        const accGroup = document.createElement('div'); accGroup.className = 'acc-group'; accGroup.id = 'grp-tech';
        const accHead = document.createElement('div'); accHead.className = 'acc-header'; accHead.innerText = 'Datos Técnicos';
        accHead.onclick = function() { toggleAccordion('grp-tech'); };
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
    }
}

// --- HELPERS GLOBALES DE UI ---
window.togLay = (id) => { const l=window.layers.find(x=>x.id===id); l.visible=!l.visible; renderLayersUI(); renderScene(); }
window.addLayer = () => { window.layers.push({id:'l'+Date.now(), name:'Nueva', color:'#fff', visible:true}); renderLayersUI(); }
window.updateAlturaFinal = function(valUser) {
    const el = window.elementos.find(x => x.id === window.estado.selID); if (!el || (el.tipo !== 'tuberia' && el.tipo !== 'cota')) return;
    const num = parseInputFloat(valUser); if (isNaN(num)) return;
    const u = window.UNITS[window.CONFIG.unit]; const newFinalZ = num / u.factor; el.dz = newFinalZ - el.z;
    window.saveState(); renderScene(); renderEffects(); updatePropsPanel(); 
}
window.changeMaterial = function(newMat) {
    const el = window.elementos.find(x=>x.id===window.estado.selID); if(!el) return;
    const catItem = window.CATALOGO.mat.find(m => m.props.material === newMat);
    if(catItem) { el.props.material = newMat; el.props.customColor = null; el.props.color = catItem.color; el.props.diametroNominal = catItem.props.diametroNominal; window.saveState(); updatePropsPanel(); renderScene(); }
}
window.updateDiametro = function(val) { const el = window.elementos.find(x=>x.id===window.estado.selID); if(el){ el.props.diametroNominal = val; window.saveState(); renderScene(); renderEffects(); } }
window.updateStyleProp = function(k,v) { 
    const el=window.elementos.find(x=>x.id===window.estado.selID); 
    if(el){ 
        if(k==='color') { el.props.customColor = v; } 
        else if (k === 'scaleFactor') { el.props[k] = parseFloat(v); document.getElementById('p-scale-val').textContent = v; } 
        else { el.props[k]=v; }
        window.saveState(); renderScene(); if(k==='anchor' || k==='scaleFactor') renderEffects(); 
    } 
}
window.updateBooleanProp = function(k, val) { const el = window.elementos.find(x=>x.id===window.estado.selID); if(el){ el.props[k] = val; window.saveState(); renderScene(); } }
window.updateRootProp = function(k, val) { const el = window.elementos.find(x=>x.id===window.estado.selID); if(el){ el[k] = val; window.saveState(); renderScene(); renderEffects(); } }
window.updateLongitud = function(valUser) {
    const el = window.elementos.find(x=>x.id===window.estado.selID); if(!el || el.tipo !== 'tuberia') return;
    const currentLen = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2); if(currentLen < 0.0001) return;
    const newValMeters = parseToMeters(parseInputFloat(valUser)); if(isNaN(newValMeters) || newValMeters <= 0) return;
    const ratio = newValMeters / currentLen; el.dx *= ratio; el.dy *= ratio; el.dz *= ratio;
    window.saveState(); renderScene();
}
window.updateAltura = function(valUser) {
    const el = window.elementos.find(x=>x.id===window.estado.selID); if(!el) return;
    const num = parseInputFloat(valUser); if(isNaN(num)) return;
    const u = window.UNITS[window.CONFIG.unit]; el.z = num / u.factor;
    window.saveState(); renderScene(); renderEffects(); updatePropsPanel();
}

console.log("✅ Renderer cargado");
