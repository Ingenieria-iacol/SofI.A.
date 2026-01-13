// js/core.js - Estado Global y Lógica de Negocio

// --- VARIABLES GLOBALES DE ESTADO ---
window.EPSILON_GRID = 0.001; 
window.layers = [{ id: 'l_gas', name: 'Gas', color: '#FFD700', visible: true }];
window.activeLayerId = 'l_gas';
window.elementos = [];
window.estado = {
    tool: 'select', activeItem: null, mouseIso: {x:0, y:0}, snapped: null, currentZ: 0,
    drawing: false, startPt: null, selID: null, hoverID: null,
    view: { x: 0, y: 0, scale: 1, angle: Math.PI/4 },
    action: null, startAction: {x:0, y:0}, snapDir: null, tempVector: null,
    verticalPendingDir: 0, clipboard: null
};

let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 50;
let insertCoords = { x:0, y:0 };

// --- SISTEMA DE HISTORIAL (UNDO/REDO) ---
window.saveState = function() {
    if (historyIndex < historyStack.length - 1) { historyStack = historyStack.slice(0, historyIndex + 1); }
    const state = JSON.stringify(window.elementos);
    historyStack.push(state);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateUndoRedoUI();
}

window.undo = function() {
    if (historyIndex > 0) { historyIndex--; restaurarEstado(historyStack[historyIndex]); updateUndoRedoUI(); }
}

window.redo = function() {
    if (historyIndex < historyStack.length - 1) { historyIndex++; restaurarEstado(historyStack[historyIndex]); updateUndoRedoUI(); }
}

function restaurarEstado(jsonState) {
    window.elementos = JSON.parse(jsonState);
    window.estado.selID = null; 
    // Estas funciones vienen de renderer.js, pero como son globales funcionarán
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

// --- GESTIÓN DE ELEMENTOS ---
window.addEl = function(data) { 
    if(!data.props.diametroNominal && window.estado.activeItem?.props?.diametroNominal) { 
        data.props.diametroNominal = window.estado.activeItem.props.diametroNominal; 
    }
    window.elementos.push({id:Date.now(), layerId:window.activeLayerId, visible:true, ...data}); 
    window.saveState(); 
    if(typeof renderScene === 'function') renderScene(); 
}

window.borrarSeleccion = function() { 
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

// --- LÓGICA DE INGENIERÍA (Conexiones y Cortes) ---
window.moverConConexiones = function(idElemento, dx, dy, dz) {
    const el = window.elementos.find(e => e.id === idElemento); if (!el) return;
    const oldStart = { x: el.x, y: el.y, z: el.z };
    let oldEnd = null;
    if (el.tipo === 'tuberia' || el.tipo === 'cota') { oldEnd = { x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz }; }
    
    el.x += dx; el.y += dy; el.z += dz;

    window.elementos.forEach(vecino => {
        if (vecino.id === idElemento || vecino.visible === false) return;
        
        // Función helper local para no depender de utils.js dentro del loop si no cargó, 
        // aunque debería estar cargado. Usamos window.arePointsEqual
        const check = window.arePointsEqual;

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
        tipo: 'tuberia', x: xCorte, y: yCorte, z: zCorte, 
        dx: dx2, dy: dy2, dz: dz2, 
        props: propsOriginal, layerId: el.layerId, customColor: el.props.customColor 
    });
}

window.analizarRed = function() {
    const mapNodos = new Map(); const accesorios = [];
    window.elementos.forEach(el => {
        if (el.tipo !== 'tuberia' || el.visible === false) return;
        if (isNaN(el.x) || isNaN(el.dx)) return; 
        
        // Dependencia de utils.js
        const kStart = window.getKey(el.x, el.y, el.z); 
        const kEnd = window.getKey(el.x + el.dx, el.y + el.dy, el.z + el.dz);
        
        const len = Math.hypot(el.dx, el.dy, el.dz); if (len < 0.001) return;
        
        let width = 2; 
        // Dependencia de utils.js
        if (el.props.diametroNominal) width = window.parseDiameterToScale(el.props.diametroNominal);
        
        const dir = { x: el.dx/len, y: el.dy/len, z: el.dz/len }; 
        const dirInv = { x: -dir.x, y: -dir.y, z: -dir.z };
        const col = el.props.customColor || el.props.color || '#ccc';
        
        if (!mapNodos.has(kStart)) mapNodos.set(kStart, []); mapNodos.get(kStart).push({ dir: dir, width: width, color: col });
        if (!mapNodos.has(kEnd)) mapNodos.set(kEnd, []); mapNodos.get(kEnd).push({ dir: dirInv, width: width, color: col });
    });

    mapNodos.forEach((conns, key) => {
        // EPSILON_GRID definido arriba
        const parts = key.split('_').map(p => parseFloat(p) * window.EPSILON_GRID);
        const x = parts[0], y = parts[1], z = parts[2]; const base = conns[0]; 
        
        if (conns.length === 2) {
            const c1 = conns[0]; const c2 = conns[1];
            const dot = c1.dir.x * c2.dir.x + c1.dir.y * c2.dir.y + c1.dir.z * c2.dir.z;
            if (dot < -0.99 && Math.abs(c1.width - c2.width) > 0.5) { 
                accesorios.push({ tipo: 'reductor_auto', x, y, z, dirs: [c1.dir, c2.dir], color: base.color, width: Math.max(c1.width, c2.width) }); 
            } else if (dot > -0.99 && dot < 0.99) { 
                accesorios.push({ tipo: 'codo_auto', x, y, z, dirs: [c1.dir, c2.dir], color: base.color, width: Math.max(c1.width, c2.width) }); 
            }
        } else if (conns.length === 3) { 
            accesorios.push({ tipo: 'tee_auto', x, y, z, dirs: conns.map(c=>c.dir), color: base.color, width: base.width }); 
        } else if (conns.length === 4) { 
            accesorios.push({ tipo: 'cruz_auto', x, y, z, dirs: conns.map(c=>c.dir), color: base.color, width: base.width }); 
        }
    });
    return accesorios;
}

// --- HELPERS INTERFAZ ---
window.mostrarInputDinámico = function(xScreen, yScreen, distActual, vectorData) {
    const box = document.getElementById('dynamic-input-container'); 
    const input = document.getElementById('dynamic-len');
    window.estado.tempVector = { ...vectorData, distOriginal: distActual };
    box.style.left = (xScreen + 15) + 'px'; box.style.top = (yScreen + 15) + 'px'; box.style.display = 'flex';
    
    // Dependencias utils y config
    const u = window.UNITS[window.CONFIG.unit]; 
    const valDisplay = distActual * u.factor;
    input.value = valDisplay.toFixed(u.precision); input.focus(); input.select();
}

window.confirmarInput = function() {
    const box = document.getElementById('dynamic-input-container'); 
    const input = document.getElementById('dynamic-len');
    const val = window.parseInputFloat(input.value); // utils.js
    
    if (window.estado.tempVector && !isNaN(val) && val > 0) {
        let { dx, dy, dz, distOriginal } = window.estado.tempVector;
        if (distOriginal < 0.001) distOriginal = 1; 
        const valInMeters = window.parseToMeters(val); // utils.js
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

window.handleCanvasClick = function(e) {
    if(document.getElementById('dynamic-input-container').style.display === 'flex' || 
       document.getElementById('vertical-input-container').style.display === 'flex') return;
    
    // Herramienta CORTAR
    if(window.estado.tool === 'cut' && window.estado.hoverID) {
        const tx = window.estado.snapped ? window.estado.snapped.x : Math.round(window.estado.mouseIso.x*10)/10;
        const ty = window.estado.snapped ? window.estado.snapped.y : Math.round(window.estado.mouseIso.y*10)/10;
        const tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
        window.cortarTuberia(window.estado.hoverID, tx, ty, tz); 
        window.saveState(); 
        if(typeof renderScene === 'function') renderScene();
        return;
    }
    
    // Herramienta INSERTAR
    if(window.estado.tool === 'insert') {
        const tx = window.estado.snapped ? window.estado.snapped.x : Math.round(window.estado.mouseIso.x*10)/10;
        const ty = window.estado.snapped ? window.estado.snapped.y : Math.round(window.estado.mouseIso.y*10)/10;
        const tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
        window.abrirModalInsertar(tx, ty, tz); return; 
    }
    
    // Herramienta SELECT
    if(window.estado.tool === 'select') { 
        window.estado.selID = window.estado.hoverID; 
        if(window.estado.selID) { 
            const el = window.elementos.find(x => x.id === window.estado.selID); 
            if(el) { 
                window.estado.currentZ = el.z; 
                // Esta función está en renderer.js, se asume cargada
                if(typeof syncZInput === 'function') syncZInput(); 
            } 
        }
        if(typeof updatePropsPanel === 'function') updatePropsPanel(); 
        if(typeof renderEffects === 'function') renderEffects();
        const rp = document.getElementById('right-panel'); 
        if(window.estado.selID) { rp.classList.remove('closed'); } else { rp.classList.add('closed'); }
        return; 
    }
    
    // Herramienta DIBUJO (Draw, Cota, etc)
    let tx = window.estado.snapped ? window.estado.snapped.x : Math.round(window.estado.mouseIso.x*10)/10;
    let ty = window.estado.snapped ? window.estado.snapped.y : Math.round(window.estado.mouseIso.y*10)/10;
    let tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
    
    if (window.estado.drawing && window.estado.inicio && !window.estado.snapped) {
        const diffX = tx - window.estado.inicio.x; 
        const diffY = ty - window.estado.inicio.y; 
        const diffZ = tz - window.estado.inicio.z; 
        const th = 0.5;
        if (Math.abs(diffY) < th && Math.abs(diffZ) < th) { ty = window.estado.inicio.y; tz = window.estado.inicio.z; tx = gridX; } 
        else if (Math.abs(diffX) < th && Math.abs(diffZ) < th) { tx = window.estado.inicio.x; tz = window.estado.inicio.z; ty = gridY; } 
        else if (Math.abs(diffX) < th && Math.abs(diffY) < th) { tx = window.estado.inicio.x; ty = window.estado.inicio.y; tz = window.estado.inicio.z; }
        else { 
            // Grid snap suave
            tx = Math.round(window.estado.mouseIso.x*10)/10;
            ty = Math.round(window.estado.mouseIso.y*10)/10;
        }
    }

    if(window.estado.tool === 'texto') { 
        const txt = prompt("Texto:", "Etiqueta"); 
        if(txt) { window.addEl({tipo:'texto', x:tx, y:ty, z:tz, props:{text:txt}}); } 
        return; 
    }
    
    if(window.estado.activeItem?.type === 'tuberia' || window.estado.tool === 'cota') {
        if(!window.estado.drawing) { 
            // INICIO DEL DIBUJO
            window.estado.drawing = true; 
            if (window.estado.snapped) { 
                window.estado.currentZ = tz; 
                if(typeof syncZInput === 'function') syncZInput(); 
            }
            window.estado.inicio = {x:tx, y:ty, z:tz}; 
        } else {
            let dx=tx-window.estado.inicio.x, dy=ty-window.estado.inicio.y, dz=tz-window.estado.inicio.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if(dist > 0.01) { window.mostrarInputDinámico(window.event.clientX, window.event.clientY, dist, {dx, dy, dz}); } else { window.estado.drawing = false; }
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
// --- EN js/core.js (Añadir al final) ---

// 1. Abrir el Modal de Guardado
window.guardarProyecto = function() { 
    document.getElementById('modal-guardar').style.display = 'flex'; 
    document.getElementById('input-filename').focus(); 
}

// 2. Descargar el archivo .JSON al PC
window.confirmarDescarga = function() {
    let nombre = document.getElementById('input-filename').value || 'proyecto_gas'; 
    if (!nombre.endsWith('.json')) { nombre += '.json'; }
    
    // Usamos las variables globales window.layers y window.elementos
    const datos = JSON.stringify({ 
        layers: window.layers, 
        elementos: window.elementos 
    });
    
    const blob = new Blob([datos], { type: "application/json" }); 
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = nombre; 
    a.click();
    
    URL.revokeObjectURL(url); 
    document.getElementById('modal-guardar').style.display = 'none';
}

// 3. Guardado Rápido en el Navegador (LocalStorage)
window.guardarEnNavegador = function() { 
    try { 
        const datos = JSON.stringify({ 
            layers: window.layers, 
            elementos: window.elementos 
        }); 
        localStorage.setItem('backup_cad_gas', datos); 
        
        // Feedback visual
        const msg = document.getElementById('msg-guardado'); 
        if(msg) {
            msg.style.display = 'block'; 
            setTimeout(() => { 
                msg.style.display = 'none'; 
                document.getElementById('modal-guardar').style.display = 'none'; 
            }, 1500); 
        }
    } catch (e) { 
        alert("Error: Almacenamiento lleno o deshabilitado."); 
    } 
}

// 4. Limpiar / Nuevo Proyecto
window.limpiarTodo = function(){ 
    if(confirm("¿Estás seguro de querer borrar todo el dibujo?")){
        window.elementos = []; 
        window.saveState(); 
        if(typeof renderScene === 'function') renderScene();
    } 
}

// 5. Cargar Proyecto desde Archivo (Botón Abrir)
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
        } catch(err) {
            alert("Error al leer el archivo JSON.");
            console.error(err);
        }
    }; 
    r.readAsText(inputElement.files[0]); 
}
console.log("✅ Core Logic cargado");
