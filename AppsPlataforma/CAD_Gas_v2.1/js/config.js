// js/config.js - Configuración y Catálogo
window.CONFIG = { 
    tileW: 100, 
    tileH: 50, 
    zStep: 1, 
    snapRadius: 10, 
    showGrid: true, 
    enableSnap: true, 
    unit: 'm', 
    showTags: true 
};

window.UNITS = { 
    'm': { factor: 1, label: 'm', precision: 2 }, 
    'dm': { factor: 10, label: 'cm', precision: 1 }, 
    'cm': { factor: 100, label: 'cm', precision: 1 }, 
    'mm': { factor: 1000, label: 'mm', precision: 0 } 
};

window.DIAMETROS_DISPONIBLES = {
    'acero_sch40': ['1/4"', '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"', '6"'],
    'acero_sch80': ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '3"', '4"'],
    'pe_metric': ['20mm', '25mm', '32mm', '40mm', '50mm', '63mm', '90mm', '110mm']
};

window.CATALOGO = {
    mat: [
        { subCat: 'Acero al Carbón', id: 't_ac_40', name: 'Sch40', color: '#444444', type: 'tuberia', props: { material: 'acero_sch40', diametroNominal: '1"' } },
        { subCat: 'Acero Galvanizado', id: 't_gl_40', name: 'Sch40 Galv', color: '#C0C0C0', type: 'tuberia', props: { material: 'galv_sch40', diametroNominal: '1"' } },
        { subCat: 'Cobre Rígido', id: 't_cu_l', name: 'Tipo L (Azul)', color: '#1E90FF', type: 'tuberia', props: { material: 'cobre_l', diametroNominal: '1/2"' } },
        { subCat: 'Plásticas', id: 't_pe_met', name: 'PE Métrico', color: '#FFD700', type: 'tuberia', props: { material: 'pe_metric', diametroNominal: '32mm' } }
    ],
    comp: [
        { subCat: 'Válvulas', id: 'v_bola', name: 'V. Bola', icon: '⧓', type: 'valvula', props: { tipo: 'bola', rotacion: 0 } },
        { subCat: 'Uniones', id: 'c_brida', name: 'Brida', icon: '⭕', type: 'equipo', props: { tipo: 'accesorio' } }
    ],
    eq: [
        { subCat: 'Medición', id: 'eq_medidor', name: 'Medidor G4', icon: '⏱️', type: 'equipo', props: { modelo: 'G4' } },
        { subCat: 'Regulación', id: 'eq_reg', name: 'Regulador', icon: '⚙️', type: 'equipo', props: { cap: '5 m3/h' } }
    ],
    inst: [
        { subCat: 'Presión', id: 'i_mano', name: 'Manómetro', icon: '⌚', type: 'equipo', props: { rango: '0-60 psi' } }
    ],
    perif: [
        { 
            subCat: 'Tanques', 
            id: 'p_tanque', 
            name: 'Tanque GLP Horizontal', 
            icon: '💊', 
            type: 'equipo', 
            props: { 
                tipo: 'tanque_glp',
                diametro: 2.0,       
                longitud: 6.0,       
                capacidadGalones: 1000,
                numConexiones: 2,
                rotacion: 0,
                conexiones: [
                    { id: 1, nombre: "Llenado", tipo: "brida", diametro: '2"', posicion: 'top' },
                    { id: 2, nombre: "Servicio", tipo: "macho", diametro: '1"', posicion: 'top' },
                    { id: 3, nombre: "Drenaje", tipo: "hembra", diametro: '2"', posicion: 'bottom' }
                ],
                checklist: {         
                    rotogate: false,
                    indicadorLlenado: true,
                    drenaje: true,
                    valvulaAlivio: true
                }
            } 
        }
    ],
    cons: []
};
