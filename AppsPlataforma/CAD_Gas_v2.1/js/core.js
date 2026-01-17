// js/core.js - Cerebro de la Aplicación (CORREGIDO Y COMPLETO)

window.EPSILON_GRID = 0.001; 
window.layers = [{ id: 'l_gas', name: 'Gas', color: '#FFD700', visible: true }];
window.activeLayerId = 'l_gas';
window.elementos = [];

// Estado Global
window.estado = {
    tool: 'select', 
    activeItem: null, 
    mouseIso: {x:0, y:0}, 
    snapped: null, 
    currentZ: 0,
    drawing: false, 
    startPt: null, 
    selection: [],
    get selID() { return this.selection.length === 1 ? this.selection[0] : null; },
    hoverID: null,
    view: { x: 0, y: 0, scale: 1, angle: Math.PI/4 },
    action: null, 
    startAction: {x:0, y:0}, 
    snapDir: null, 
    tempVector: null,
    verticalPendingDir: 0, 
    clipboard: [] 
};

let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 50;
let insertCoords = { x:0, y:0 }; 

// --- HISTORIAL (UNDO/REDO) ---
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
    window.estado.selection = []; 
    if(typeof renderScene === 'function') renderScene();
    if(typeof updatePropsPanel === 'function') updatePropsPanel();
}

function updateUndoRedoUI() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if(btnUndo) btnUndo.disabled = (historyIndex <= 0);
    if(btnRedo) btnRedo.disabled = (historyIndex >= historyStack.length - 1);
}

// --- CRUD ELEMENTOS ---
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
    if (window.estado.selection.length === 0) return;
    window.elementos = window.elementos.filter(x => !window.estado.selection.includes(x.id));
    window.estado.selection = [];
    window.saveState(); 
    window.cerrarPropiedades(); 
    if(typeof renderScene === 'function') renderScene(); 
}

window.setTool = function(t) { 
    window.estado.tool = (t==='cota'||t==='texto'||t==='select'||t==='insert'||t==='cut') ? t : 'draw'; 
    window.estado.drawing = false; 
    window.estado.selection = [];
    window.cerrarPropiedades();
    if(typeof renderEffects === 'function') renderEffects(); 
    
    document.querySelectorAll('.tool-item').forEach(x => x.classList.remove('active'));
    ['btn-select','btn-cota','btn-texto', 'btn-insert','btn-cut'].forEach(id => { 
        const btn = document.getElementById(id); 
        if(btn) btn.classList.remove('active'); 
    });
    const activeBtn = document.getElementById('btn-'+t);
    if(activeBtn) activeBtn.classList.add('active'); 
}

// --- TOPOLOGÍA Y CÁLCULO DE RED (MEJORADO CON CARGAS EN TUBERÍAS) ---
window.calcularTodaLaRed = function(presionEntrada, tipoGas) {
    // 1. Construir Grafo
    const nodes = new Map(); 
    const pipes = [];

    const getNode = (x, y, z, elemId = null, load = 0) => {
        const k = window.getKey(x, y, z);
        if (!nodes.has(k)) {
            nodes.set(k, { key: k, x, y, z, neighbors: [], elemId: null, isSource: false, load: 0 });
        }
        const n = nodes.get(k);
        if (elemId) n.elemId = elemId;
        if (load > 0) n.load += load;
        return n;
    };

    // Recorrer elementos
    window.elementos.forEach(el => {
        if (!el.visible) return;
        
        if (el.tipo === 'tuberia') {
            const start = getNode(el.x, el.y, el.z);
            const end = getNode(el.x + el.dx, el.y + el.dy, el.z + el.dz);
            const len = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
            
            // --- NUEVA LÓGICA: Cargas en Tuberías ---
            if (el.props.caudal && parseFloat(el.props.caudal) > 0) {
                end.load += parseFloat(el.props.caudal);
            }
            
            start.neighbors.push({ target: end.key, pipeId: el.id });
            end.neighbors.push({ target: start.key, pipeId: el.id });
            
            pipes.push({ 
                id: el.id, 
                len: len, 
                diam: el.props.diametroNominal, 
                flow: 0 
            });
        } 
        else if (el.tipo === 'valvula' || el.tipo === 'equipo' || el.props.tipo === 'tanque_glp') {
            const load = parseFloat(el.props.caudal || el.props.potencia || 0);
            const name = (el.name || el.props.nombre || "").toLowerCase();
            const subCat = (el.subCat || "").toLowerCase();
            const isSrc = (name.includes("medidor") || name.includes("regulador") || name.includes("tanque") || subCat.includes("medición"));
            
            const n = getNode(el.x, el.y, el.z, el.id, load);
            if (isSrc) n.isSource = true;
        }
    });

    // 2. Encontrar Fuente
    let sourceNode = null;
    for (const [k, n] of nodes) {
        if (n.isSource) { sourceNode = n; break; }
    }
    // Fallback: Si no hay fuente definida, usar el primer nodo que tenga vecinos
    if (!sourceNode && nodes.size > 0) {
        sourceNode = nodes.values().next().value;
    }

    if (!sourceNode) return { error: "No se encontraron elementos conectados o fuente de gas." };

    // 3. Propagar Demanda (Back-calculation)
    const visitedFlow = new Set();
    const calculateFlowRecursively = (currentNodeKey, parentKey) => {
        visitedFlow.add(currentNodeKey);
        const node = nodes.get(currentNodeKey);
        let totalFlow = node.load; 

        node.neighbors.forEach(link => {
            if (link.target !== parentKey) {
                const flowFromChild = calculateFlowRecursively(link.target, currentNodeKey);
                totalFlow += flowFromChild;
                const pipe = pipes.find(p => p.id === link.pipeId);
                if (pipe) pipe.flow = flowFromChild; 
            }
        });
        return totalFlow;
    };

    calculateFlowRecursively(sourceNode.key, null);

    // 4. Calcular Presiones (Forward-calculation)
    const results = [];
    const visitedPress = new Set(); 
    
    const calculatePressureRecursively = (currentNodeKey, parentKey, currentP) => {
        visitedPress.add(currentNodeKey);
        const node = nodes.get(currentNodeKey);
        
        node.neighbors.forEach(link => {
            if (link.target !== parentKey && !visitedPress.has(link.target)) {
                const pipe = pipes.find(p => p.id === link.pipeId);
                if (pipe) {
                    const calc = window.calcularFlujoGas(pipe.diam, pipe.len, pipe.flow, tipoGas, currentP);
                    results.push({
                        pipeId: pipe.id,
                        diam: pipe.diam,
                        len: pipe.len,
                        flow: pipe.flow,
                        pIn: currentP,
                        pOut: calc.presionSalida,
                        drop: calc.caidaPresion,
                        vel: calc.velocidad,
                        msg: calc.estado
                    });
                    calculatePressureRecursively(link.target, currentNodeKey, calc.presionSalida);
                }
            }
        });
    };

    calculatePressureRecursively(sourceNode.key, null, presionEntrada);
    
    return { success: true, tramos: results, source: sourceNode };
};

// --- HELPERS E INTERACCIÓN ---
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
        if (window.estado.selection.includes(vecino.id)) return;

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

function selectElementAt(mouseX, mouseY) {
    if(!window.elementos.length) return null;
    const worldMx = (mouseX - window.estado.view.x) / window.estado.view.scale;
    const worldMy = (mouseY - window.estado.view.y) / window.estado.view.scale;
    const threshold = 10 / window.estado.view.scale; 
    const candidates = [];
    
    window.elementos.forEach(el => {
        if(el.visible === false) return;
        const s = isoToScreen(el.x, el.y, el.z);
        let dist = 1000;
        
        if(el.tipo === 'tuberia' || el.tipo === 'cota') {
            const e = isoToScreen(el.x+el.dx, el.y+el.dy, el.z+el.dz);
            const l2 = (e.x-s.x)**2 + (e.y-s.y)**2;
            if(l2 === 0) dist = Math.hypot(worldMx-s.x, worldMy-s.y);
            else {
                let t = ((worldMx-s.x)*(e.x-s.x) + (worldMy-s.y)*(e.y-s.y)) / l2;
                t = Math.max(0, Math.min(1, t));
                dist = Math.hypot(worldMx - (s.x + t*(e.x-s.x)), worldMy - (s.y + t*(e.y-s.y)));
            }
        } else {
            dist = Math.hypot(worldMx - s.x, worldMy - s.y);
        }
        if(dist < threshold) { candidates.push({ el: el, dist: dist }); }
    });
    
    if(candidates.length === 0) return null;
    candidates.sort((a,b) => a.dist - b.dist);
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
        window.saveState(); renderScene(); return;
    }
    
    // INSERTAR
    if(window.estado.tool === 'insert') {
        const tx = window.estado.snapped ? window.estado.snapped.x : Math.round(window.estado.mouseIso.x*10)/10;
        const ty = window.estado.snapped ? window.estado.snapped.y : Math.round(window.estado.mouseIso.y*10)/10;
        const tz = window.estado.snapped ? window.estado.snapped.z : window.estado.currentZ;
        window.abrirModalInsertar(tx, ty, tz); return; 
    }
    
    // SELECCIONAR
    if(window.estado.tool === 'select') { 
        const rect = document.getElementById('lienzo-cad').getBoundingClientRect();
        const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
        const pickedID = selectElementAt(mx, my);
        if (pickedID) {
            if (e.shiftKey) {
                const idx = window.estado.selection.indexOf(pickedID);
                if (idx !== -1) window.estado.selection.splice(idx, 1);
                else window.estado.selection.push(pickedID);
            } else {
                window.estado.selection = [pickedID];
            }
            const el = window.elementos.find(x => x.id === pickedID);
            if(el) { window.estado.currentZ = el.z; if(typeof syncZInput === 'function') syncZInput(); }
        } else {
            if (!e.shiftKey) window.estado.selection = [];
        }
        if(typeof updatePropsPanel === 'function') updatePropsPanel(); 
        if(typeof renderEffects === 'function') renderEffects();
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
    const groupNames = { mat: 'Materiales', comp: 'Componentes', eq: 'Equipos', inst: 'Instrumentos', perif: 'Periféricos', cons: 'Consumibles' };
    
    if (window.CATALOGO) {
        Object.keys(window.CATALOGO).forEach(key => {
            const group = document.createElement('optgroup'); group.label = groupNames[key] || key.toUpperCase();
            window.CATALOGO[key].forEach(item => { 
                const opt = document.createElement('option'); opt.value = key + '|' + item.id; opt.innerText = item.name; opt.setAttribute('data-type', item.type); group.appendChild(opt); 
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
    document.getElementById('row-ins-z2').style.display = (type === 'tuberia') ? 'flex' : 'none';
}
window.ejecutarInsercion = function() {
    const sel = document.getElementById('ins-select'); const valParts = sel.value.split('|');
    const itemDef = window.CATALOGO[valParts[0]].find(x => x.id === valParts[1]); if(!itemDef) return;
    const rawZ1 = window.parseInputFloat(document.getElementById('ins-z1').value); 
    const rawZ2 = window.parseInputFloat(document.getElementById('ins-z2').value);
    const u = window.UNITS[window.CONFIG.unit]; 
    const z1 = rawZ1 / u.factor; const z2 = rawZ2 / u.factor;
    const props = JSON.parse(JSON.stringify(itemDef.props));
    
    if (itemDef.type === 'tuberia' && Math.abs(z1 - z2) > 0.001) { 
        window.addEl({ tipo: 'tuberia', x: insertCoords.x, y: insertCoords.y, z: z1, dx: 0, dy: 0, dz: z2 - z1, props: props, layerId: window.activeLayerId, customColor: itemDef.color }); 
    } else { 
        window.addEl({ tipo: itemDef.type, x: insertCoords.x, y: insertCoords.y, z: z1, dx: 0, dy: 0, dz: 0, props: props, icon: itemDef.icon, layerId: window.activeLayerId, color: itemDef.color }); 
    }
    document.getElementById('modal-insertar').style.display = 'none'; 
    window.setTool('select'); renderScene();
}

window.guardarProyecto = function() { document.getElementById('modal-guardar').style.display = 'flex'; document.getElementById('input-filename').focus(); }
window.confirmarDescarga = function() {
    let nombre = document.getElementById('input-filename').value || 'proyecto_gas'; 
    if (!nombre.endsWith('.json')) { nombre += '.json'; }
    const datos = JSON.stringify({ layers: window.layers, elementos: window.elementos });
    const blob = new Blob([datos], { type: "application/json" }); 
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
    document.getElementById('modal-guardar').style.display = 'none';
}
window.guardarEnNavegador = function() { 
    try { 
        localStorage.setItem('backup_cad_gas', JSON.stringify({ layers: window.layers, elementos: window.elementos })); 
        const msg = document.getElementById('msg-guardado'); msg.style.display = 'block'; 
        setTimeout(() => { msg.style.display = 'none'; document.getElementById('modal-guardar').style.display = 'none'; }, 1500); 
    } catch (e) { alert("Error: Almacenamiento lleno."); } 
}
window.cargarProyecto = function(input){ 
    if (!input.files.length) return;
    const r = new FileReader(); 
    r.onload = function(e) {
        try {
            const d = JSON.parse(e.target.result); 
            if(d.layers) window.layers = d.layers; if(d.elementos) window.elementos = d.elementos; 
            window.saveState(); renderScene(); renderLayersUI();
        } catch(err) { alert("Error al leer el archivo."); }
    }; 
    r.readAsText(input.files[0]); 
}
window.limpiarTodo = function(){ 
    if(confirm("¿Estás seguro de borrar todo?")){ window.elementos = []; window.saveState(); window.cerrarPropiedades(); renderScene(); } 
}

// Funciones de reporte
window.mostrarReporte = function() {
    const tuberias = {}; const accesorios = {}; const equipos = {};
    window.elementos.forEach(el => {
        if (el.visible === false) return;
        if (el.tipo === 'tuberia') {
            let k = `${el.props.material || "GENÉRICO"} [${el.props.diametroNominal || "?"}]`;
            tuberias[k] = (tuberias[k] || 0) + Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
        } else if (el.tipo !== 'cota' && el.tipo !== 'texto') {
            let cat = "Otros"; if (el.tipo === 'valvula') cat = "Válvulas"; if (el.props.tipo === 'tanque_glp') cat = "Tanques";
            let name = el.name || el.props.nombre || el.tipo;
            let key = `${name} ${el.props.modelo || el.props.diametro || ""}`;
            equipos[cat] = equipos[cat] || {}; equipos[cat][key] = (equipos[cat][key] || 0) + 1;
        }
    });

    if (typeof window.analizarRed === 'function') {
        window.analizarRed().forEach(fit => {
            let name = "Accesorio Auto"; if (fit.tipo === 'codo_auto') name = "Codo 90°"; else if (fit.tipo === 'tee_auto') name = "Tee Recta";
            accesorios[`${name} (Generado)`] = (accesorios[`${name} (Generado)`] || 0) + 1;
        });
    }

    let html = "";
    if (Object.keys(tuberias).length > 0) {
        html += `<tr class="table-header"><td colspan="2">🔵 TUBERÍAS</td></tr>`;
        for (let key in tuberias) html += `<tr><td>${key}</td><td align='right'><b>${window.formatLength(tuberias[key])}</b></td></tr>`;
    }
    if (Object.keys(accesorios).length > 0) {
        html += `<tr class="table-header"><td colspan="2">🟠 FITTINGS</td></tr>`;
        for (let key in accesorios) html += `<tr><td>${key}</td><td align='right'>${accesorios[key]} und</td></tr>`;
    }
    const table = document.getElementById('tabla-res'); if (table) { table.innerHTML = html; document.getElementById('modal-reporte').style.display = 'flex'; }
};

// === EXPORTAR CSV (FUNCIONALIDAD REAL) ===
window.exportarCSV = function() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM para acentos
    csvContent += "Categoria,Elemento,Detalle,Cantidad/Longitud (m),Caudal (m3/h)\n";

    // Agrupar Tuberías
    const tuberias = {};
    window.elementos.forEach(el => {
        if (!el.visible) return;
        if (el.tipo === 'tuberia') {
            let k = `${el.props.material} - ${el.props.diametroNominal}`;
            const len = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
            if (!tuberias[k]) tuberias[k] = 0;
            tuberias[k] += len;
        } else if (el.tipo !== 'cota' && el.tipo !== 'texto') {
            const nombre = el.name || el.props.nombre || el.tipo;
            const detalle = el.props.modelo || el.props.tipo || "-";
            const caudal = el.props.caudal || 0;
            csvContent += `Equipo,${nombre},${detalle},1,${caudal}\n`;
        }
    });

    for (const key in tuberias) {
        csvContent += `Tuberia,${key},-,${tuberias[key].toFixed(2)},-\n`;
    }

    if (typeof window.analizarRed === 'function') {
        const fits = window.analizarRed();
        const fitCounts = {};
        fits.forEach(f => {
            const n = f.tipo === 'codo_auto' ? 'Codo 90' : (f.tipo === 'tee_auto' ? 'Tee' : 'Cruz');
            fitCounts[n] = (fitCounts[n] || 0) + 1;
        });
        for (const k in fitCounts) {
            csvContent += `Accesorio,${k},Generado Auto,${fitCounts[k]},-\n`;
        }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "listado_materiales_gas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.realizarCalculo = function() {
    if (window.estado.selection.length !== 1) { alert("Seleccione una única tubería."); return; }
    const el = window.elementos.find(x => x.id === window.estado.selection[0]);
    if (!el || el.tipo !== 'tuberia') { alert("No es tubería."); return; }
    const Q = window.parseInputFloat(document.getElementById('calc-caudal').value);
    const P = window.parseInputFloat(document.getElementById('calc-presion').value);
    const Gas = document.getElementById('calc-gas').value;
    const L = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
    const res = window.calcularFlujoGas(el.props.diametroNominal, L, Q, Gas, P);
    const divRes = document.getElementById('calc-result');
    divRes.innerHTML = `<div>Estado: ${res.estado}<br>ΔP: ${res.caidaPresionStr}<br>Vel: ${res.velocidad}</div>`;
}

window.mostrarEcuaciones = function() { document.getElementById('modal-ecuaciones').style.display = 'flex'; }
window.prepararPDF = function() { document.getElementById('modal-pdf').style.display = 'flex'; }

// === GENERAR PDF (FUNCIONALIDAD REAL CON JSPDF) ===
window.generarPDF = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Datos del Modal
    const nombreProy = document.getElementById('pdf-nombre').value || "Proyecto Gas";
    const autor = document.getElementById('pdf-autor').value || "Usuario CAD";
    const fecha = new Date().toLocaleDateString();

    // Encabezado
    doc.setFontSize(18);
    doc.setTextColor(0, 113, 235); // Color Accent
    doc.text("Reporte Técnico - Instalación de Gas", 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Proyecto: ${nombreProy}`, 14, 30);
    doc.text(`Autor: ${autor}`, 14, 36);
    doc.text(`Fecha: ${fecha}`, 14, 42);

    // --- TABLA DE MATERIALES ---
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("1. Listado de Materiales", 14, 55);

    const rowsMat = [];
    // Lógica de agrupación (similar a CSV)
    const tuberias = {};
    window.elementos.forEach(el => {
        if (!el.visible) return;
        if (el.tipo === 'tuberia') {
            let k = `${el.props.material} [${el.props.diametroNominal}]`;
            const len = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
            tuberias[k] = (tuberias[k] || 0) + len;
        } else if (el.tipo !== 'cota' && el.tipo !== 'texto') {
            const n = el.name || el.props.nombre || el.tipo;
            rowsMat.push(["Equipo", n, "1 ud"]);
        }
    });
    for (const key in tuberias) {
        rowsMat.push(["Tubería", key, window.formatLength(tuberias[key])]);
    }
    // Fittings auto
    if (typeof window.analizarRed === 'function') {
        const fits = window.analizarRed();
        const fc = {};
        fits.forEach(f => fc[f.tipo] = (fc[f.tipo]||0)+1);
        for(let k in fc) rowsMat.push(["Accesorio", k.replace('_auto','').toUpperCase(), fc[k]+" ud"]);
    }

    doc.autoTable({
        startY: 60,
        head: [['Categoría', 'Descripción', 'Cantidad']],
        body: rowsMat,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] }
    });

    // --- TABLA DE CÁLCULO (Si se ejecutó previamente) ---
    let finalY = doc.lastAutoTable.finalY + 15;
    
    // Ejecutar un cálculo rápido silencioso para tener datos frescos
    const pres = parseFloat(document.getElementById('glob-presion').value) || 23;
    const gas = document.getElementById('glob-gas').value || 'natural';
    const resCalc = window.calcularTodaLaRed(pres, gas);

    if (!resCalc.error) {
        doc.text("2. Memoria de Cálculo (Mueller)", 14, finalY);
        
        const rowsCalc = resCalc.tramos.map(t => {
            const pipe = window.elementos.find(x => x.id === t.pipeId);
            const ref = pipe ? `${pipe.props.material} ${pipe.props.diametroNominal}` : "Tramo";
            return [
                ref,
                t.len.toFixed(2),
                t.flow.toFixed(2),
                t.vel, // Velocidad
                t.drop.toFixed(3),
                t.pOut.toFixed(2)
            ];
        });

        doc.autoTable({
            startY: finalY + 5,
            head: [['Tramo', 'Long (m)', 'Q (m³/h)', 'Vel (m/s)', 'Caída (mbar)', 'P. Final']],
            body: rowsCalc,
            theme: 'striped',
            headStyles: { fillColor: [0, 113, 235] }
        });
        
        // Notas finales
        finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.text(`Presión Entrada: ${pres} mbar | Gas: ${gas.toUpperCase()}`, 14, finalY);
    } else {
        doc.setTextColor(255, 0, 0);
        doc.text("Error en cálculo: Verifique conectividad de la red.", 14, finalY);
    }

    doc.save(`${nombreProy.replace(/\s+/g, '_')}.pdf`);
    document.getElementById('modal-pdf').style.display = 'none';
};

window.setUnit = function(u) {
    if (window.UNITS[u]) {
        window.CONFIG.unit = u;
        if (typeof renderScene === 'function') renderScene();
        if (typeof renderInterface === 'function') renderInterface();
        if (typeof updatePropsPanel === 'function') updatePropsPanel();
        const lbl = document.getElementById('hud-z-unit'); if(lbl) lbl.innerText = window.UNITS[u].label;
    }
};

console.log("✅ Core System (RESTAURADO y FUNCIONAL) cargado");
