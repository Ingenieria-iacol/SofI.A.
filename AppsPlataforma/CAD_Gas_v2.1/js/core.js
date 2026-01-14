// js/core.js
window.EPSILON_GRID = 0.001; 
window.layers = [{ id: 'l_gas', name: 'Gas', color: '#FFD700', visible: true }];
window.activeLayerId = 'l_gas';
window.elementos = [];

window.estado = {
    tool: 'select', activeItem: null, mouseIso: {x:0, y:0}, snapped: null, currentZ: 0,
    drawing: false, startPt: null, selID: null, hoverID: null,
    view: { x: 0, y: 0, scale: 1, angle: Math.PI/4, pitch: 1 },
    action: null, startAction: {x:0, y:0}, snapDir: null, tempVector: null,
    verticalPendingDir: 0, clipboard: null, pivotData: null
};

let historyStack = []; let historyIndex = -1; const MAX_HISTORY = 50;
let insertCoords = { x:0, y:0 };

// --- HISTORIAL ---
window.saveState = function() {
    if (historyIndex < historyStack.length - 1) historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(JSON.stringify(window.elementos));
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateUndoRedoUI();
};
window.undo = function() { if(historyIndex>0) { historyIndex--; restaurarEstado(historyStack[historyIndex]); updateUndoRedoUI(); } };
window.redo = function() { if(historyIndex<historyStack.length-1) { historyIndex++; restaurarEstado(historyStack[historyIndex]); updateUndoRedoUI(); } };

function restaurarEstado(jsonState) {
    window.elementos = JSON.parse(jsonState);
    window.estado.selID = null; 
    if(typeof renderScene === 'function') renderScene();
    if(typeof updatePropsPanel === 'function') updatePropsPanel();
}
function updateUndoRedoUI() {
    const bU = document.getElementById('btn-undo'), bR = document.getElementById('btn-redo');
    if(bU) bU.disabled = (historyIndex <= 0);
    if(bR) bR.disabled = (historyIndex >= historyStack.length - 1);
}

// --- VIEW CONTROL ---
window.togglePitch = function() {
    window.estado.view.pitch = (window.estado.view.pitch === 1) ? -1 : 1;
    if(typeof renderScene === 'function') renderScene();
    if(typeof updateTransform === 'function') updateTransform();
};

// --- CRUD ---
window.addEl = function(data) { 
    if(!data.props.diametroNominal && window.estado.activeItem?.props?.diametroNominal) { 
        data.props.diametroNominal = window.estado.activeItem.props.diametroNominal; 
    }
    window.elementos.push({id:Date.now(), layerId:window.activeLayerId, visible:true, ...data}); 
    window.saveState(); 
    if(typeof renderScene === 'function') renderScene(); 
};
window.borrarSeleccion = function() { 
    if(!window.estado.selID) return;
    window.elementos = window.elementos.filter(x => x.id !== window.estado.selID); 
    window.estado.selID = null; 
    window.saveState(); 
    if(typeof updatePropsPanel === 'function') updatePropsPanel(); 
    if(typeof renderScene === 'function') renderScene(); 
    document.getElementById('right-panel').classList.add('closed'); 
};
window.setTool = function(t) { 
    window.estado.tool = (t==='cota'||t==='texto'||t==='select'||t==='insert'||t==='cut') ? t : 'draw'; 
    window.estado.drawing = false; window.estado.selID = null; 
    if(typeof renderEffects === 'function') renderEffects(); 
    document.querySelectorAll('.tool-item').forEach(x => x.classList.remove('active'));
    ['btn-select','btn-cota','btn-texto', 'btn-insert','btn-cut'].forEach(id => { const b=document.getElementById(id); if(b) b.classList.remove('active'); });
    const ab = document.getElementById('btn-'+t); if(ab) ab.classList.add('active'); 
};

// --- FILES & I/O (RESTAURADO) ---
window.guardarProyecto = function() { document.getElementById('modal-guardar').style.display = 'flex'; };
window.confirmarDescarga = function() {
    let nombre = document.getElementById('input-filename').value || 'proyecto';
    if (!nombre.endsWith('.json')) nombre += '.json';
    const blob = new Blob([JSON.stringify({ layers: window.layers, elementos: window.elementos })], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
    document.getElementById('modal-guardar').style.display = 'none';
};
window.guardarEnNavegador = function() { 
    try { 
        localStorage.setItem('backup_cad_gas', JSON.stringify({ layers: window.layers, elementos: window.elementos })); 
        const msg = document.getElementById('msg-guardado'); if(msg) { msg.style.display='block'; setTimeout(()=>msg.style.display='none', 1500); }
    } catch (e) { alert("Error storage"); } 
};
window.cargarProyecto = function(inputElement){ 
    if (!inputElement.files.length) return;
    const r = new FileReader(); 
    r.onload = function(e) {
        try { const d = JSON.parse(e.target.result); window.layers = d.layers; window.elementos = d.elementos; window.saveState(); renderScene(); if(typeof renderLayersUI === 'function') renderLayersUI(); } catch(err) { alert("Error JSON"); }
    }; 
    r.readAsText(inputElement.files[0]); 
};
window.limpiarTodo = function(){ if(confirm("¿Borrar todo?")){ window.elementos = []; window.saveState(); renderScene(); } };

// --- INGENIERIA ---
window.analizarRed = function() { return []; }; // Placeholder si no se usa lógica avanzada de fittings auto
window.moverConConexiones = function(id, dx, dy, dz) {
    const el = window.elementos.find(e => e.id === id); if(!el) return;
    const oldStart = { x: el.x, y: el.y, z: el.z };
    el.x += dx; el.y += dy; el.z += dz;
    // Lógica básica de arrastre de vecinos (para simplificar core, se puede expandir)
    window.elementos.forEach(v => {
        if(v.id!==id && window.arePointsEqual({x:v.x,y:v.y,z:v.z}, oldStart)) { v.x+=dx; v.y+=dy; v.z+=dz; }
    });
};
window.cortarTuberia = function(id, x, y, z) {
    const el = window.elementos.find(e => e.id === id); if(!el || el.tipo !== 'tuberia') return;
    const fin = { x: el.x+el.dx, y: el.y+el.dy, z: el.z+el.dz };
    const props = JSON.parse(JSON.stringify(el.props));
    el.dx = x - el.x; el.dy = y - el.y; el.dz = z - el.z;
    window.addEl({ tipo: 'tuberia', x: x, y: y, z: z, dx: fin.x-x, dy: fin.y-y, dz: fin.z-z, props: props, layerId: el.layerId, customColor: el.props.customColor });
};
// Helpers de input
window.mostrarInputDinámico = function(ex, ey, d, v) {
    const b = document.getElementById('dynamic-input-container'); const i = document.getElementById('dynamic-len');
    window.estado.tempVector = { ...v, distOriginal: d };
    b.style.left = (ex+15)+'px'; b.style.top = (ey+15)+'px'; b.style.display = 'flex';
    i.value = (d * window.UNITS[window.CONFIG.unit].factor).toFixed(2); i.focus(); i.select();
};
window.confirmarInput = function() {
    const b = document.getElementById('dynamic-input-container'); const i = document.getElementById('dynamic-len');
    const val = window.parseInputFloat(i.value);
    if(window.estado.tempVector && !isNaN(val) && val > 0) {
        let { dx, dy, dz, distOriginal } = window.estado.tempVector;
        const ratio = window.parseToMeters(val) / (distOriginal < 0.001 ? 1 : distOriginal);
        window.addEl({ 
            tipo: window.estado.tool==='cota'?'cota':'tuberia', 
            x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z, 
            dx: dx*ratio, dy: dy*ratio, dz: dz*ratio, 
            props: JSON.parse(JSON.stringify(window.estado.activeItem?.props || {})) 
        });
        if(window.estado.tool!=='cota') { window.estado.inicio.x+=dx*ratio; window.estado.inicio.y+=dy*ratio; window.estado.inicio.z+=dz*ratio; window.estado.drawing=true; }
        else window.estado.drawing=false;
    }
    b.style.display = 'none'; window.estado.tempVector = null; renderScene();
};
window.abrirModalInsertar = function(x, y, z) {
    insertCoords = {x,y}; const u = window.UNITS[window.CONFIG.unit];
    document.getElementById('ins-z1').value = (z*u.factor).toFixed(2); document.getElementById('ins-z2').value = (z*u.factor).toFixed(2);
    document.getElementById('modal-insertar').style.display='flex';
};
window.cerrarModalInsertar = function() { document.getElementById('modal-insertar').style.display='none'; window.setTool('select'); };
window.ejecutarInsercion = function() {
    const sel = document.getElementById('ins-select').value.split('|');
    const item = window.CATALOGO[sel[0]].find(x=>x.id===sel[1]); if(!item) return;
    const z1 = window.parseToMeters(window.parseInputFloat(document.getElementById('ins-z1').value));
    window.addEl({ tipo: item.type, x: insertCoords.x, y: insertCoords.y, z: z1, dx:0, dy:0, dz:0, props: JSON.parse(JSON.stringify(item.props)), icon: item.icon, color: item.color });
    window.cerrarModalInsertar();
};
window.checkInsertType = function(){}; // Placeholder
window.mostrarReporte = function(){ /* ... (Simplificado, ver versión anterior si la necesitas completa) ... */ 
    alert("Reporte disponible en versión completa"); 
};
