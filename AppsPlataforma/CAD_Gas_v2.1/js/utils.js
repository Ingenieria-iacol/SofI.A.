// js/utils.js
window.parseInputFloat = function(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(val.toString().replace(',', '.'));
};

window.getKey = function(x, y, z) {
    const gridEpsilon = window.EPSILON_GRID || 0.001;
    return `${Math.round(x/gridEpsilon)}_${Math.round(y/gridEpsilon)}_${Math.round(z/gridEpsilon)}`;
};

window.arePointsEqual = function(p1, p2) {
    const ep = 0.001; 
    return Math.abs(p1.x - p2.x) < ep && Math.abs(p1.y - p2.y) < ep && Math.abs(p1.z - p2.z) < ep;
};

window.parseDiameterToScale = function(valStr) {
    if(!valStr) return 2; 
    let meters = 0;
    if(valStr.toLowerCase().includes('mm')) {
        const match = valStr.match(/(\d+)mm/);
        if (match) { meters = parseFloat(match[1]) / 1000; } else { meters = parseFloat(valStr) / 1000; }
    } else {
        let clean = valStr.replace(/"/g, '').replace('IPS','').replace('CTS','').trim();
        let parts = clean.split(/[- ]/);
        let inches = 0;
        parts.forEach(p => {
            if(p.includes('/')) { const frac = p.split('/'); if(frac.length === 2) inches += parseFloat(frac[0]) / parseFloat(frac[1]); } else { const f = parseFloat(p); if(!isNaN(f)) inches += f; }
        });
        meters = inches * 0.0254;
    }
    if(isNaN(meters) || meters === 0) return 2;
    return Math.max(1.5, meters * window.CONFIG.tileW);
};

window.formatLength = function(valMeters) { 
    const u = window.UNITS[window.CONFIG.unit]; 
    const val = valMeters * u.factor; 
    return parseFloat(val.toFixed(u.precision)) + " " + u.label; 
};

window.parseToMeters = function(valUser) { 
    const u = window.UNITS[window.CONFIG.unit]; 
    return valUser / u.factor; 
};

window.ensureHex = function(c){ 
    if(c && c.startsWith('#') && c.length===7) return c; 
    return '#cccccc'; 
};
