// js/core.js - Cerebro de la Aplicación (PDF, Polyline, Engineering Calc, Cycle Selection)

// ==========================================
// 1. ESTADO GLOBAL Y VARIABLES
// ==========================================
window.EPSILON_GRID = 0.001; 
window.layers = [{ id: 'l_gas', name: 'Gas', color: '#FFD700', visible: true }];
window.activeLayerId = 'l_gas';
window.elementos = [];

// Estado de la herramienta y vista
window.estado = {
    tool: 'select', 
    activeItem: null, 
    mouseIso: {x:0, y:0}, 
    snapped: null, 
    currentZ: 0,
    drawing: false, 
    startPt: null, 
    selID: null, 
    hoverID: null,
    view: { x: 0, y: 0, scale: 1, angle: Math.PI/4 },
    action: null, 
    startAction: {x:0, y:0}, 
    snapDir: null, 
    tempVector: null,
    verticalPendingDir: 0, 
    clipboard: null
};

let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 50;
let insertCoords = { x:0, y:0 }; 

// ==========================================
// 2. SISTEMA DE HISTORIAL (UNDO/REDO)
// ==========================================
window.saveState = function() {
    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }
    const state = JSON.stringify(window.elementos);
    historyStack.push(state);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateUndoRedoUI();
}

window.undo = function() {
    if (historyIndex > 0) {
        historyIndex--;
        restaurarEstado(historyStack[historyIndex]);
        updateUndoRedoUI();
    }
}

window.redo = function() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        restaurarEstado(historyStack[historyIndex]);
        updateUndoRedoUI();
    }
}

function restaurarEstado(jsonState) {
    window.elementos = JSON.parse(jsonState);
    window.estado.selID = null; 
    if(typeof renderScene === 'function') renderScene();
    if(typeof updatePropsPanel === 'function') updatePropsPanel();
    const rp = document.getElementById('right-panel');
    if(rp) rp.classList.add('closed');
}

function updateUndoRedoUI() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if(btnUndo) btnUndo.disabled = (historyIndex <= 0);
    if(btnRedo) btnRedo.disabled = (historyIndex >= historyStack.length - 1);
}

// ==========================================
// 3. GESTIÓN DE ELEMENTOS (CRUD)
// ==========================================
window.addEl = function(data) { 
    if(!data.props.diametroNominal && window.estado.activeItem?.props?.diametroNominal) { 
        data.props.diametroNominal = window.estado.activeItem.props.diametroNominal; 
    }
    window.elementos.push({
        id: Date.now(), 
        layerId: window.activeLayerId, 
        visible: true, 
        ...data
    }); 
    window.saveState(); 
    if(typeof renderScene === 'function') renderScene(); 
}

window.borrarSeleccion = function() { 
    if (!window.estado.selID) return;
    window.elementos = window.elementos.filter(x => x.id !== window.estado.selID); 
    window.estado.selID = null; 
    window.saveState(); 
    if(typeof updatePropsPanel === 'function') updatePropsPanel(); 
    if(typeof renderScene === 'function') renderScene(); 
    const rp = document.getElementById('right-panel');
    if(rp) rp.classList.add('closed'); 
}

window.setTool = function(t) { 
    window.estado.tool = (t==='cota'||t==='texto'||t==='select'||t==='insert'||t==='cut') ? t : 'draw'; 
    window.estado.drawing = false; 
    window.estado.selID = null; 
    if(typeof renderEffects === 'function') renderEffects(); 
    document.querySelectorAll('.tool-item').forEach(x => x.classList.remove('active'));
    ['btn-select','btn-cota','btn-texto', 'btn-insert','btn-cut'].forEach(id => { 
        const btn = document.getElementById(id); 
        if(btn) btn.classList.remove('active'); 
    });
    const activeBtn = document.getElementById('btn-'+t);
    if(activeBtn) activeBtn.classList.add('active'); 
}

// ==========================================
// 4. LÓGICA DE INGENIERÍA
// ==========================================
window.moverConConexiones = function(idElemento, dx, dy, dz) {
    const el = window.elementos.find(e => e.id === idElemento); if (!el) return;
    const oldStart = { x: el.x, y: el.y, z: el.z };
    let oldEnd = null;
    if (el.tipo === 'tuberia' || el.tipo === 'cota') { 
        oldEnd = { x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz }; 
    }
    el.x += dx; el.y += dy; el.z += dz;
    const check = window.arePointsEqual;
    window.elementos.forEach(vecino => {
        if (vecino.id === idElemento || vecino.visible === false) return;
        if (check({x: vecino.x, y: vecino.y, z: vecino.z}, oldStart)) { 
            vecino.x += dx; vecino.y += dy; vecino.z += dz; 
        } else if (vecino.tipo === 'tuberia' || vecino.tipo === 'cota') {
            const vecEnd = { x: vecino.x + vecino.dx, y: vecino.y + vecino.dy, z: vecino.z + vecino.dz };
            if (check(vecEnd, oldStart)) { vecino.dx += dx; vecino.dy += dy; vecino.dz += dz; }
        }
        if (oldEnd) {
            if (check({x: vecino.x, y: vecino.y, z: vecino.z}, oldEnd)) { 
                vecino.x += dx; vecino.y += dy; vecino.z += dz; 
            } else if (vecino.tipo === 'tuberia' || vecino.tipo === 'cota') {
                const vecEnd = { x: vecino.x + vecino.dx, y: vecino.y + vecino.dy, z: vecino.z + vecino.dz };
                if (check(vecEnd, oldEnd)) { vecino.dx += dx; vecino.dy += dy; vecino.dz += dz; }
            }
        }
    });
}

window.cortarTuberia = function(idTuberia, xCorte, yCorte, zCorte) {
    const el = window.elementos.find(e => e.id === idTuberia); if(!el || el.tipo !== 'tuberia') return;
    const finalOriginal = { x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz };
    const propsOriginal = JSON.parse(JSON.stringify(el.props));
    el.dx = xCorte - el.x; el.dy = yCorte - el.y; el.dz = zCorte - el.z;
    const dx2 = finalOriginal.x - xCorte; 
    const dy2 = finalOriginal.y - yCorte; 
    const dz2 = finalOriginal.z - zCorte;
    window.addEl({ 
        tipo: 'tuberia', 
        x: xCorte, y: yCorte, z: zCorte, 
        dx: dx2, dy: dy2, dz: dz2, 
        props: propsOriginal, 
        layerId: el.layerId, 
        customColor: el.props.customColor 
    });
}

window.analizarRed = function() {
    const mapNodos = new Map(); 
    const accesorios = [];
    window.elementos.forEach(el => {
        if (el.tipo !== 'tuberia' || el.visible === false) return;
        if (isNaN(el.x) || isNaN(el.dx)) return; 
        const kStart = window.getKey(el.x, el.y, el.z); 
        const kEnd = window.getKey(el.x + el.dx, el.y + el.dy, el.z + el.dz);
        const len = Math.hypot(el.dx, el.dy, el.dz); if (len < 0.001) return;
        let width = 2; 
        if (el.props.diametroNominal) width = window.parseDiameterToScale(el.props.diametroNominal);
        const dir = { x: el.dx/len, y: el.dy/len, z: el.dz/len }; 
        const dirInv = { x: -dir.x, y: -dir.y, z: -dir.z };
        const col = el.props.customColor || el.props.color || '#ccc';
        if (!mapNodos.has(kStart)) mapNodos.set(kStart, []); mapNodos.get(kStart).push({ dir: dir, width: width, color: col });
        if (!mapNodos.has(kEnd)) mapNodos.set(kEnd, []); mapNodos.get(kEnd).push({ dir: dirInv, width: width, color: col });
    });

    mapNodos.forEach((conns, key) => {
        const parts = key.split('_').map(p => parseFloat(p) * window.EPSILON_GRID);
        const x = parts[0], y = parts[1], z = parts[2]; 
        const baseProps = conns[0] || { color: '#ccc', width: 2 };
        if (conns.length === 2) {
            const c1 = conns[0]; const c2 = conns[1];
            const dot = c1.dir.x * c2.dir.x + c1.dir.y * c2.dir.y + c1.dir.z * c2.dir.z;
            const maxWidth = Math.max(c1.width, c2.width);
            if (dot < -0.99 && Math.abs(c1.width - c2.width) > 0.5) { 
                accesorios.push({ tipo: 'reductor_auto', x, y, z, dirs: [c1.dir, c2.dir], color: baseProps.color, width: maxWidth }); 
            } else if (dot > -0.99 && dot < 0.99) { 
                accesorios.push({ tipo: 'codo_auto', x, y, z, dirs: [c1.dir, c2.dir], color: baseProps.color, width: maxWidth }); 
            }
        } else if (conns.length === 3) { 
            accesorios.push({ tipo: 'tee_auto', x, y, z, dirs: conns.map(c=>c.dir), color: baseProps.color, width: baseProps.width }); 
        } else if (conns.length === 4) { 
            accesorios.push({ tipo: 'cruz_auto', x, y, z, dirs: conns.map(c=>c.dir), color: baseProps.color, width: baseProps.width }); 
        }
    });
    return accesorios;
}

// ==========================================
// 5. HELPERS DE INTERACCIÓN (Inputs y Clicks)
// ==========================================
window.mostrarInputDinámico = function(xScreen, yScreen, distActual, vectorData) {
    const box = document.getElementById('dynamic-input-container'); 
    const input = document.getElementById('dynamic-len');
    window.estado.tempVector = { ...vectorData, distOriginal: distActual };
    box.style.left = (xScreen + 15) + 'px'; 
    box.style.top = (yScreen + 15) + 'px'; 
    box.style.display = 'flex';
    const u = window.UNITS[window.CONFIG.unit]; 
    const valDisplay = distActual * u.factor;
    input.value = valDisplay.toFixed(u.precision); 
    input.focus(); input.select();
}

window.confirmarInput = function() {
    const box = document.getElementById('dynamic-input-container'); 
    const input = document.getElementById('dynamic-len');
    const val = window.parseInputFloat(input.value); 
    
    if (window.estado.tempVector && !isNaN(val) && val > 0) {
        let { dx, dy, dz, distOriginal } = window.estado.tempVector;
        if (distOriginal < 0.001) distOriginal = 1; 
        const valInMeters = window.parseToMeters(val); 
        const ratio = valInMeters / distOriginal;
        dx *= ratio; dy *= ratio; dz *= ratio;
        
        const tipo = window.estado.tool === 'cota' ? 'cota' : 'tuberia';
        const props = window.estado.tool === 'cota' ? {} : JSON.parse(JSON.stringify(window.estado.activeItem.props));
        
        if(window.estado.activeItem?.props?.diametroNominal && !props.diametroNominal) { 
            props.diametroNominal = window.estado.activeItem.props.diametroNominal; 
        }
        
        window.addEl({ tipo, x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z, dx, dy, dz, props });
        
        if (window.estado.tool !== 'cota') { 
            window.estado.inicio = { x: window.estado.inicio.x + dx, y: window.estado.inicio.y + dy, z: window.estado.inicio.z + dz }; 
            window.estado.drawing = true; 
        } else { 
            window.estado.drawing = false; 
        }
    }
    box.style.display = 'none'; window.estado.tempVector = null; 
    if(typeof renderScene === 'function') renderScene(); 
}

// FUNCION DE SELECCIÓN CÍCLICA
function selectElementAt(mouseX, mouseY) {
    if(!window.elementos.length) return null;
    
    // 1. Encontrar candidatos cercanos (distancia en pantalla)
    const threshold = 10; // píxeles
    const candidates = [];
    
    window.elementos.forEach(el => {
        if(el.visible === false) return;
        const s = isoToScreen(el.x, el.y, el.z);
        let dist = 1000;
        
        if(el.tipo === 'tuberia' || el.tipo === 'cota') {
            const e = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz);
            // Distancia punto a segmento
            const l2 = (e.x-s.x)**2 + (e.y-s.y)**2;
            if(l2 === 0) dist = Math.hypot(mouseX-s.x, mouseY-s.y);
            else {
                let t = ((mouseX-s.x)*(e.x-s.x) + (mouseY-s.y)*(e.y-s.y)) / l2;
                t = Math.max(0, Math.min(1, t));
                dist = Math.hypot(mouseX - (s.x + t*(e.x-s.x)), mouseY - (s.y + t*(e.y-s.y)));
            }
        } else {
            // Distancia punto a punto
            dist = Math.hypot(mouseX - s.x, mouseY - s.y);
        }
        
        if(dist < threshold) {
            candidates.push({ el: el, dist: dist });
        }
    });
    
    if(candidates.length === 0) return null;
    
    // 2. Ordenar candidatos (opcional, por profundidad o distancia)
    // Para simplificar, usamos el orden de dibujo (último dibujado está "arriba")
    candidates.reverse(); 
    
    // 3. Lógica Cíclica
    // Si ya hay algo seleccionado y está en la lista de candidatos, selecciona el siguiente
    if(window.estado.selID) {
        const idx = candidates.findIndex(c => c.el.id === window.estado.selID);
        if(idx !== -1) {
            // Seleccionar el siguiente en la lista (circular)
            const nextIdx = (idx + 1) % candidates.length;
            return candidates[nextIdx].el.id;
        }
    }
    
    // Si no hay selección previa o la selección no está aquí, seleccionar el primero
    return candidates[0].el.id;
}

window.handleCanvasClick = function(e) {
    if(document.getElementById('dynamic-input-container').style.display === 'flex' || 
       document.getElementById('vertical-input-container').style.display === 'flex') return;
    
    // CORTAR
    if(window.estado.tool === 'cut' && window.estado.hoverID) {
        const tx = window.estado.snapped ? window.estado.snapped.x : Math.round(window.estado.mouseIso.x*10)/10;
        const ty = window.estado.snapped ? window.estado.snapped.y : Math.round(window.estado.mouseIso.y*10)/10;
        const tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
        window.cortarTuberia(window.estado.hoverID, tx, ty, tz); 
        window.saveState(); 
        if(typeof renderScene === 'function') renderScene();
        return;
    }
    
    // INSERTAR
    if(window.estado.tool === 'insert') {
        const tx = window.estado.snapped ? window.estado.snapped.x : Math.round(window.estado.mouseIso.x*10)/10;
        const ty = window.estado.snapped ? window.estado.snapped.y : Math.round(window.estado.mouseIso.y*10)/10;
        const tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
        window.abrirModalInsertar(tx, ty, tz); 
        return; 
    }
    
    // SELECCIONAR (MEJORADO CON CICLO)
    if(window.estado.tool === 'select') { 
        // Obtener coordenadas de mouse relativas al SVG
        const rect = document.getElementById('lienzo-cad').getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        // Usar la nueva función de selección cíclica
        const pickedID = selectElementAt(mx, my);
        
        window.estado.selID = pickedID; 
        
        if(window.estado.selID) { 
            const el = window.elementos.find(x => x.id === window.estado.selID); 
            if(el) { 
                window.estado.currentZ = el.z; 
                if(typeof syncZInput === 'function') syncZInput(); 
            } 
        }
        if(typeof updatePropsPanel === 'function') updatePropsPanel(); 
        if(typeof renderEffects === 'function') renderEffects();
        const rp = document.getElementById('right-panel'); 
        if(window.estado.selID) { rp.classList.remove('closed'); } else { rp.classList.add('closed'); }
        return; 
    }
    
    // DIBUJAR
    let tx = window.estado.snapped ? window.estado.snapped.x : Math.round(window.estado.mouseIso.x*10)/10;
    let ty = window.estado.snapped ? window.estado.snapped.y : Math.round(window.estado.mouseIso.y*10)/10;
    let tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
    
    if (window.estado.drawing && window.estado.inicio && !window.estado.snapped) {
        const gridX = Math.round(window.estado.mouseIso.x * 10) / 10;
        const gridY = Math.round(window.estado.mouseIso.y * 10) / 10;
        const dx = gridX - window.estado.inicio.x; 
        const dy = gridY - window.estado.inicio.y; 
        const dz = window.estado.currentZ - window.estado.inicio.z;
        const th = 0.5;
        if (Math.abs(dy) < th && Math.abs(dz) < th) { ty = window.estado.inicio.y; tz = window.estado.inicio.z; tx = gridX; } 
        else if (Math.abs(dx) < th && Math.abs(dz) < th) { tx = window.estado.inicio.x; tz = window.estado.inicio.z; ty = gridY; } 
        else if (Math.abs(dx) < th && Math.abs(dy) < th) { tx = window.estado.inicio.x; ty = window.estado.inicio.y; tz = window.estado.inicio.z; }
        else { tx = gridX; ty = gridY; }
    }

    if(window.estado.tool === 'texto') { 
        const txt = prompt("Texto:", "Etiqueta"); 
        if(txt) { window.addEl({tipo:'texto', x:tx, y:ty, z:tz, props:{text:txt}}); } 
        return; 
    }
    
    if(window.estado.activeItem?.type === 'tuberia' || window.estado.tool === 'cota') {
        if(!window.estado.drawing) { 
            window.estado.drawing = true; 
            if (window.estado.snapped) { 
                window.estado.currentZ = tz; 
                if(typeof syncZInput === 'function') syncZInput(); 
            }
            window.estado.inicio = {x:tx, y:ty, z:tz}; 
        } else {
            let dx=tx-window.estado.inicio.x, dy=ty-window.estado.inicio.y, dz=tz-window.estado.inicio.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if(dist > 0.01) { 
                window.mostrarInputDinámico(window.event.clientX, window.event.clientY, dist, {dx, dy, dz}); 
            } else { 
                window.estado.drawing = false; 
            }
        }
    } else if (window.estado.activeItem) {
        const props = JSON.parse(JSON.stringify(window.estado.activeItem.props)); 
        if (window.estado.snapDir && (window.estado.activeItem.type === 'valvula' || window.estado.activeItem.type === 'equipo')) { 
            props.dirVector = window.estado.snapDir; 
            delete props.rotacion; 
        }
        window.addEl({tipo: window.estado.activeItem.type, x:tx, y:ty, z:tz, props, icon: window.estado.activeItem.icon});
    }
    if(typeof renderInterface === 'function') renderInterface();
}

window.abrirModalInsertar = function(x, y, zDefault) {
    insertCoords = { x, y };
    const sel = document.getElementById('ins-select'); sel.innerHTML = '';
    const groupNames = { mat: 'Materiales (Tuberías)', comp: 'Componentes', eq: 'Equipos', inst: 'Instrumentos', perif: 'Periféricos / Válvulas', cons: 'Consumibles' };
    
    if (window.CATALOGO) {
        Object.keys(window.CATALOGO).forEach(key => {
            const group = document.createElement('optgroup'); group.label = groupNames[key] || key.toUpperCase();
            window.CATALOGO[key].forEach(item => { 
                const opt = document.createElement('option'); 
                opt.value = key + '|' + item.id; 
                opt.innerText = item.name; 
                opt.setAttribute('data-type', item.type); 
                group.appendChild(opt); 
            });
            sel.appendChild(group);
        });
    }
    
    const u = window.UNITS[window.CONFIG.unit]; 
    document.getElementById('ins-z1').value = (zDefault * u.factor).toFixed(u.precision); 
    document.getElementById('ins-z2').value = (zDefault * u.factor).toFixed(u.precision);
    window.checkInsertType(); 
    document.getElementById('modal-insertar').style.display = 'flex';
}

window.cerrarModalInsertar = function() { 
    document.getElementById('modal-insertar').style.display = 'none'; 
    window.setTool('select'); 
}

window.checkInsertType = function() {
    const sel = document.getElementById('ins-select'); if(!sel.options.length) return;
    const opt = sel.options[sel.selectedIndex]; const type = opt.getAttribute('data-type');
    const rowZ2 = document.getElementById('row-ins-z2'); 
    if(type === 'tuberia') rowZ2.style.display = 'flex'; else rowZ2.style.display = 'none';
}

window.ejecutarInsercion = function() {
    const sel = document.getElementById('ins-select'); const valParts = sel.value.split('|'); const groupKey = valParts[0]; const itemId = valParts[1];
    const itemDef = window.CATALOGO[groupKey].find(x => x.id === itemId); if(!itemDef) return;
    const rawZ1 = window.parseInputFloat(document.getElementById('ins-z1').value); 
    const rawZ2 = window.parseInputFloat(document.getElementById('ins-z2').value);
    const u = window.UNITS[window.CONFIG.unit]; 
    const z1Meters = rawZ1 / u.factor; 
    const z2Meters = rawZ2 / u.factor;
    const props = JSON.parse(JSON.stringify(itemDef.props));
    
    if (itemDef.type === 'tuberia' && Math.abs(z1Meters - z2Meters) > 0.001) { 
        window.addEl({ tipo: 'tuberia', x: insertCoords.x, y: insertCoords.y, z: z1Meters, dx: 0, dy: 0, dz: z2Meters - z1Meters, props: props, layerId: window.activeLayerId, customColor: itemDef.color }); 
    } else { 
        window.addEl({ tipo: itemDef.type, x: insertCoords.x, y: insertCoords.y, z: z1Meters, dx: 0, dy: 0, dz: 0, props: props, icon: itemDef.icon, layerId: window.activeLayerId, color: itemDef.color }); 
    }
    document.getElementById('modal-insertar').style.display = 'none'; 
    window.setTool('select'); 
    if(typeof renderScene === 'function') renderScene();
}

window.guardarProyecto = function() { 
    document.getElementById('modal-guardar').style.display = 'flex'; 
    document.getElementById('input-filename').focus(); 
}

window.confirmarDescarga = function() {
    let nombre = document.getElementById('input-filename').value || 'proyecto_gas'; 
    if (!nombre.endsWith('.json')) { nombre += '.json'; }
    const datos = JSON.stringify({ layers: window.layers, elementos: window.elementos });
    const blob = new Blob([datos], { type: "application/json" }); 
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url); 
    document.getElementById('modal-guardar').style.display = 'none';
}

window.guardarEnNavegador = function() { 
    try { 
        const datos = JSON.stringify({ layers: window.layers, elementos: window.elementos }); 
        localStorage.setItem('backup_cad_gas', datos); 
        const msg = document.getElementById('msg-guardado'); 
        if(msg) {
            msg.style.display = 'block'; 
            setTimeout(() => { msg.style.display = 'none'; document.getElementById('modal-guardar').style.display = 'none'; }, 1500); 
        }
    } catch (e) { alert("Error: Almacenamiento lleno."); } 
}

window.cargarProyecto = function(inputElement){ 
    if (!inputElement.files.length) return;
    const r = new FileReader(); 
    r.onload = function(e) {
        try {
            const d = JSON.parse(e.target.result); 
            if(d.layers) window.layers = d.layers; 
            if(d.elementos) window.elementos = d.elementos; 
            window.saveState(); 
            if(typeof renderScene === 'function') renderScene(); 
            if(typeof renderLayersUI === 'function') renderLayersUI();
        } catch(err) { alert("Error al leer el archivo."); }
    }; 
    r.readAsText(inputElement.files[0]); 
}

window.limpiarTodo = function(){ 
    if(confirm("¿Estás seguro de borrar todo?")){
        window.elementos = []; window.saveState(); if(typeof renderScene === 'function') renderScene();
    } 
}

window.mostrarReporte = function() {
    const tuberias = {}; const accesorios = {}; const equipos = {};
    window.elementos.forEach(el => {
        if (el.visible === false) return;
        if (el.tipo === 'tuberia') {
            let matStr = el.props.material ? el.props.material.replace('_', ' ').toUpperCase() : "GENÉRICO";
            let diamStr = el.props.diametroNominal || "?";
            let key = `${matStr} [${diamStr}]`;
            let len = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
            tuberias[key] = (tuberias[key] || 0) + len;
        } else if (el.tipo === 'cota' || el.tipo === 'texto') {
            return;
        } else {
            let cat = "Otros";
            if (el.tipo === 'valvula') cat = "Válvulas";
            if (el.props.tipo === 'tanque_glp') cat = "Tanques";
            if (el.props.tipo === 'accesorio') cat = "Accesorios";
            let name = el.name || el.props.nombre || el.tipo;
            let det = el.props.modelo || el.props.diametro || "";
            let key = `${name} ${det}`;
            equipos[cat] = equipos[cat] || {}; equipos[cat][key] = (equipos[cat][key] || 0) + 1;
        }
    });

    if (typeof window.analizarRed === 'function') {
        const autoFittings = window.analizarRed();
        autoFittings.forEach(fit => {
            let name = "Accesorio Auto";
            if (fit.tipo === 'codo_auto') name = "Codo 90°";
            else if (fit.tipo === 'tee_auto') name = "Tee Recta";
            else if (fit.tipo === 'reductor_auto') name = "Reductor";
            else if (fit.tipo === 'cruz_auto') name = "Cruz";
            let key = `${name} (Generado)`;
            accesorios[key] = (accesorios[key] || 0) + 1;
        });
    }

    let html = "";
    if (Object.keys(tuberias).length > 0) {
        html += `<tr class="table-header"><td colspan="2">🔵 TUBERÍAS Y DUCTOS</td></tr>`;
        for (let key in tuberias) html += `<tr><td>${key}</td><td align='right'><b>${window.formatLength(tuberias[key])}</b></td></tr>`;
    }
    let hayAccesorios = Object.keys(accesorios).length > 0 || (equipos['Accesorios'] && Object.keys(equipos['Accesorios']).length > 0);
    if (hayAccesorios) {
        html += `<tr class="table-header"><td colspan="2">🟠 ACCESORIOS Y CONEXIONES</td></tr>`;
        for (let key in accesorios) html += `<tr><td>${key}</td><td align='right'>${accesorios[key]} und</td></tr>`;
        if (equipos['Accesorios']) {
            for (let key in equipos['Accesorios']) html += `<tr><td>${key}</td><td align='right'>${equipos['Accesorios'][key]} und</td></tr>`;
            delete equipos['Accesorios']; 
        }
    }
    for (let cat in equipos) {
        html += `<tr class="table-header"><td colspan="2">🟢 ${cat.toUpperCase()}</td></tr>`;
        for (let key in equipos[cat]) html += `<tr><td>${key}</td><td align='right'>${equipos[cat][key]} und</td></tr>`;
    }

    const table = document.getElementById('tabla-res');
    if (table) { table.innerHTML = html; document.getElementById('modal-reporte').style.display = 'flex'; }
};

window.exportarCSV = function() {
    let csvContent = "data:text/csv;charset=utf-8,"; csvContent += "Categoria,Elemento,Cantidad/Longitud,Unidad\r\n";
    window.elementos.forEach(el => {
        if(el.visible === false || el.tipo === 'cota' || el.tipo === 'texto') return;
        let cat = "Otros", desc = el.name || el.tipo, val = 1, unit = "und";
        if(el.tipo === 'tuberia') {
            cat = "Tuberia"; desc = (el.props.material || "Generico") + " " + (el.props.diametroNominal || "");
            val = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2); unit = "m";
        } else if (el.props.tipo === 'tanque_glp') { cat = "Tanques"; desc = `Tanque GLP ${el.props.capacidadGalones}gl`; } 
        else if (el.tipo === 'valvula') { cat = "Valvulas"; }
        let valStr = val.toString().replace('.', ',');
        csvContent += `${cat},${desc},${valStr},${unit}\r\n`;
    });
    const encodedUri = encodeURI(csvContent); 
    const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "reporte_materiales_gas.csv"); 
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

window.realizarCalculo = function() {
    const el = window.elementos.find(x => x.id === window.estado.selID);
    if (!el || el.tipo !== 'tuberia') { alert("Seleccione una tubería."); return; }
    
    const Q = window.parseInputFloat(document.getElementById('calc-caudal').value);
    const P = window.parseInputFloat(document.getElementById('calc-presion').value);
    const Gas = document.getElementById('calc-gas').value;
    const L = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
    
    if (Q <= 0 || P <= 0) { alert("Ingrese Caudal y Presión válidos (>0)."); return; }
    
    const res = window.calcularFlujoGas(el.props.diametroNominal, L, Q, Gas, P);
    
    const divRes = document.getElementById('calc-result');
    if (res.error) {
        divRes.innerHTML = `<div class="calc-result-box calc-err">❌ Error: ${res.error}</div>`;
    } else {
        let cls = "calc-ok"; if(res.estado === "ALERTA") cls = "calc-alert"; if(res.estado === "CRÍTICO") cls = "calc-err";
        divRes.innerHTML = `
            <div class="calc-result-box ${cls}">
                <strong>Estado: ${res.estado}</strong><br>
                ΔP: ${res.caidaPresion} (${res.porcentajeCaida})<br>
                Velocidad: ${res.velocidad}<br>
                P. Salida: ${res.presionSalida}<br>
                <small style="color:#888">${res.formula}</small>
                ${res.alertas ? `<br><small style="color:#f44">⚠ ${res.alertas}</small>` : ''}
            </div>
        `;
    }
}

window.mostrarEcuaciones = function() {
    document.getElementById('modal-ecuaciones').style.display = 'flex';
}

window.prepararPDF = function() {
    document.getElementById('pdf-nombre').value = ""; document.getElementById('pdf-id').value = "";
    document.getElementById('modal-pdf').style.display = 'flex';
}

window.generarPDF = function() {
    const nombre = document.getElementById('pdf-nombre').value.trim();
    const id = document.getElementById('pdf-id').value.trim();
    const autor = document.getElementById('pdf-autor').value.trim() || "Ingeniería";
    const incluirEcuaciones = document.getElementById('pdf-include-eq').checked;

    if (!nombre || !id) { alert("Por favor, ingrese el Nombre y el ID."); return; }

    document.getElementById('modal-pdf').style.display = 'none';
    const gizmo = document.getElementById('gizmo-container');
    const hud = document.querySelector('.hud-overlay');
    if(gizmo) gizmo.style.display = 'none'; if(hud) hud.style.display = 'none';

    html2canvas(document.getElementById('main-area'), { backgroundColor: '#111111', scale: 1.5 }).then(canvas => {
        if(gizmo) gizmo.style.display = 'block'; if(hud) hud.style.display = 'flex';

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight(); const margin = 15;

        doc.setDrawColor(0); doc.setFillColor(240, 240, 240);
        doc.rect(margin, margin, pageWidth - 2*margin, 25, 'F'); doc.rect(margin, margin, pageWidth - 2*margin, 25, 'S');
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("REPORTE DE INGENIERÍA - ISOMÉTRICO DE GAS", pageWidth / 2, margin + 8, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`PROYECTO: ${nombre}`, margin + 5, margin + 16); doc.text(`ID: ${id}`, margin + 5, margin + 21);
        doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth - margin - 5, margin + 16, { align: "right" });
        doc.text(`RESPONSABLE: ${autor}`, pageWidth - margin - 5, margin + 21, { align: "right" });

        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        doc.addImage(imgData, 'JPEG', margin, margin + 30, pageWidth - 2*margin, 100);
        doc.rect(margin, margin + 30, pageWidth - 2*margin, 100);

        const tuberias = {}; const items = {};
        window.elementos.forEach(el => {
            if (el.visible === false || el.tipo ==='cota' || el.tipo ==='texto') return;
            if(el.tipo === 'tuberia') {
                let k = `${el.props.material || 'Genérico'} [${el.props.diametroNominal || '?'}]`;
                tuberias[k] = (tuberias[k]||0) + Math.sqrt(el.dx**2+el.dy**2+el.dz**2);
            } else {
                let n = el.name || el.tipo; if(el.tipo==='valvula') n = "Válvula " + n;
                let det = el.props.modelo || el.props.diametro || "";
                items[`${n} ${det}`] = (items[`${n} ${det}`]||0) + 1;
            }
        });
        if (typeof window.analizarRed === 'function') {
            window.analizarRed().forEach(fit => {
                let n = "Accesorio Auto"; if(fit.tipo==='codo_auto') n="Codo 90°"; else if(fit.tipo==='tee_auto') n="Tee";
                items[`${n} (Generado)`] = (items[`${n} (Generado)`]||0) + 1;
            });
        }
        const tableBody = [];
        for (let k in tuberias) tableBody.push(["Tubería", k, window.formatLength(tuberias[k])]);
        for (let k in items) tableBody.push(["Elemento", k, items[k] + " und"]);

        doc.autoTable({ startY: margin + 130 + 10, head: [['Categoría', 'Descripción', 'Cantidad']], body: tableBody, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, margin: { left: margin, right: margin } });
        doc.text("Pagina 1/2", pageWidth - margin, pageHeight - 10, {align:"right"});

        if(incluirEcuaciones) {
            doc.addPage();
            doc.setFillColor(230, 230, 230); doc.rect(margin, margin, pageWidth - 2*margin, 15, 'F');
            doc.setFontSize(12); doc.setFont("helvetica", "bold");
            doc.text("ANEXO TÉCNICO: METODOLOGÍA DE CÁLCULO", pageWidth/2, margin + 10, {align:"center"});
            let y = margin + 30;
            doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text("Este proyecto utiliza la metodología de MUELLER para el cálculo de pérdidas.", margin, y); y+=10;
            doc.setFontSize(9);
            doc.text("- Gas Natural (S=0.60) / GLP (S=1.52)", margin+5, y); y+=10;
            doc.setFontSize(11); doc.setFont("helvetica", "bold");
            doc.text("1. Fórmula Baja Presión (< 70 mbar)", margin, y); y+=8;
            doc.setFont("courier", "bold");
            doc.setDrawColor(200); doc.setFillColor(250, 250, 255); doc.rect(margin, y-2, 100, 15, 'F');
            doc.text("Q = (2971 * D^2.725 / S^0.425) * (h / L)^0.575", margin+2, y+8); 
            y+=20;
            doc.setFont("helvetica", "bold");
            doc.text("2. Fórmula Media Presión (> 70 mbar)", margin, y); y+=8;
            doc.setFont("courier", "bold");
            doc.setDrawColor(200); doc.setFillColor(250, 250, 255); doc.rect(margin, y-2, 110, 15, 'F');
            doc.text("Q = (2826 * D^2.725 / S^0.425) * ((P1^2 - P2^2)/L)^0.575", margin+2, y+8); 
            y = pageHeight - 30;
            doc.setFont("helvetica", "normal"); doc.setFontSize(8);
            doc.text("Nota: Cálculos referenciales.", margin, y);
            doc.text("Pagina 2/2", pageWidth - margin, pageHeight - 10, {align:"right"});
        }
        doc.save(`Reporte_${id}.pdf`);
    });
}

console.log("✅ Core Logic (Full Suite + Cycle Selection) cargado");
