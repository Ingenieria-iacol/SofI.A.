// js/config.js

// CONFIGURACIÓN POR DEFECTO
window. CONFIG = { 
    tileW: 100, 
    tileH: 50, 
    zStep: 1, 
    snapRadius: 10, 
    showGrid: true, 
    enableSnap: true, 
    unit: 'm', 
    showTags: true 
};

// CONSTANTES DE UNIDADES
window. UNITS = { 
    'm': { factor: 1, label: 'm', precision: 2 }, 
    'dm': { factor: 10, label: 'cm', precision: 1 }, 
    'cm': { factor: 100, label: 'cm', precision: 1 }, 
    'mm': { factor: 1000, label: 'mm', precision: 0 } 
};

// DIÁMETROS DISPONIBLES
window. DIAMETROS_DISPONIBLES = {
    'acero_sch40': ['1/4"', '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"', '6"'],
    'acero_sch80': ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '3"', '4"'],
    'acero_sch160': ['1/2"', '3/4"', '1"', '2"'],
    'galv_sch40': ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '3"', '4"'],
    'galv_sch80': ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"'],
    'galv_sch160': ['1/2"', '3/4"', '1"'],
    'multicapa': ['1216 (16mm)', '1620 (20mm)', '2025 (25mm)', '2632 (32mm)', '4050 (50mm)'],
    'cobre_k': ['3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"'],
    'cobre_l': ['1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"'],
    'cobre_m': ['3/8"', '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"'],
    'cobre_flex': ['1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"'],
    'pe_ips': ['1/2" IPS', '3/4" IPS', '1" IPS', '1-1/4" IPS', '2" IPS', '3" IPS', '4" IPS'],
    'pe_cts': ['1/2" CTS', '1" CTS'],
    'pe_metric': ['20mm', '25mm', '32mm', '40mm', '50mm', '63mm', '90mm', '110mm', '160mm']
};

// CATÁLOGO COMPLETO
window. CATALOGO = {
    mat: [
        { subCat: 'Acero al Carbón', id: 't_ac_40', name: 'Sch40', color: '#444444', type: 'tuberia', props: { material: 'acero_sch40', diametroNominal: '1"' } },
        { subCat: 'Acero al Carbón', id: 't_ac_80', name: 'Sch80', color: '#222222', type: 'tuberia', props: { material: 'acero_sch80', diametroNominal: '1"' } },
        { subCat: 'Acero al Carbón', id: 't_ac_160', name: 'Sch160', color: '#000000', type: 'tuberia', props: { material: 'acero_sch160', diametroNominal: '1"' } },
        { subCat: 'Acero Galvanizado', id: 't_gl_40', name: 'Sch40 Galv', color: '#C0C0C0', type: 'tuberia', props: { material: 'galv_sch40', diametroNominal: '1"' } },
        { subCat: 'Cobre Rígido', id: 't_cu_k', name: 'Tipo K (Verde)', color: '#006400', type: 'tuberia', props: { material: 'cobre_k', diametroNominal: '1/2"' } },
        { subCat: 'Cobre Rígido', id: 't_cu_l', name: 'Tipo L (Azul)', color: '#1E90FF', type: 'tuberia', props: { material: 'cobre_l', diametroNominal: '1/2"' } },
        { subCat: 'Cobre Flexible', id: 't_cu_flex', name: 'Flexible', color: '#B87333', type: 'tuberia', props: { material: 'cobre_flex', diametroNominal: '3/8"' } },
        { subCat: 'Multicapa', id: 't_multi', name: 'PE-AL-PE', color: '#FFFFE0', type: 'tuberia', props: { material: 'multicapa', diametroNominal: '1620 (20mm)' } },
        { subCat: 'Plásticas', id: 't_pe_met', name: 'PE Métrico', color: '#FFD700', type: 'tuberia', props: { material: 'pe_metric', diametroNominal: '32mm' } }
    ],
    comp: [
        { subCat: 'Uniones', id: 'c_union', name: 'Unión Universal', icon: '🔗', type: 'equipo', props: { tipo: 'accesorio' } },
        { subCat: 'Uniones', id: 'c_brida', name: 'Brida', icon: '⭕', type: 'equipo', props: { tipo: 'accesorio' } },
        { subCat: 'Válvulas (Aislamiento)', id: 'v_bola', name: 'V. Bola', icon: '⧓', type: 'valvula', props: { tipo: 'bola', rotacion: 0 }, info: { title: "Válvula de Bola", desc: "Cierre rápido 90°.", use: "Cierre general." } },
        { subCat: 'Válvulas (Aislamiento)', id: 'v_macho', name: 'V. Macho', icon: '🔽', type: 'valvula', props: { tipo: 'macho', rotacion: 0 }, info: { title: "Válvula Macho", desc: "Cono metálico con grasa.", use: "Acometidas." } },
        { subCat: 'Válvulas (Regulación)', id: 'v_aguja', name: 'V. Aguja', icon: '📍', type: 'valvula', props: { tipo: 'aguja', rotacion: 0 }, info: { title: "V. Aguja", desc: "Control fino.", use: "Instrumentación." } },
        { subCat: 'Válvulas (Regulación)', id: 'v_globo', name: 'V. Globo', icon: '🌐', type: 'valvula', props: { tipo: 'globo', rotacion: 0 }, info: { title: "V. Globo", desc: "Estrangulamiento.", use: "Bypass." } },
        { subCat: 'Válvulas (Seguridad)', id: 'v_check', name: 'V. Cheque', icon: '▶', type: 'valvula', props: { tipo: 'retencion', rotacion: 0 }, info: { title: "V. Cheque", desc: "Una vía.", use: "Salida bombas." } },
        { subCat: 'Válvulas (Seguridad)', id: 'v_exceso', name: 'Exc. Flujo', icon: '⚡', type: 'valvula', props: { tipo: 'exceso', rotacion: 0 }, info: { title: "Exc. Flujo", desc: "Cierre por ruptura.", use: "Tanques." } }
    ],
    eq: [
        { subCat: 'Medición', id: 'eq_medidor', name: 'Medidor G4', icon: '⏱️', type: 'equipo', props: { modelo: 'G4' } },
        { subCat: 'Medición', id: 'eq_ecor', name: 'Electro-corrector', icon: '📟', type: 'equipo', props: { modelo: 'EC' } },
        { subCat: 'Regulación', id: 'eq_reg', name: 'Regulador', icon: '⚙️', type: 'equipo', props: { cap: '5 m3/h' } },
        { subCat: 'Compresión', id: 'eq_comp', name: 'Compresor', icon: '🔋', type: 'equipo', props: { cap: 'HP' } }
    ],
    inst: [
          { subCat: 'Presión', id: 'i_mano', name: 'Manómetro', icon: '⌚', type: 'equipo', props: { rango: '0-60 psi' } },
          { subCat: 'Presión', id: 'i_pres', name: 'Presostato', icon: '🛑', type: 'equipo', props: { set: 'High' } },
          { subCat: 'Seguridad', id: 'i_ion', name: 'Sensor Ionizado', icon: '🔥', type: 'equipo', props: { tipo: 'Ion' } }
    ],
    perif: [
        { subCat: 'Soportes', id: 'p_sop', name: 'Soporte', icon: '⚓', type: 'equipo', props: { tipo: 'soporte' } },
       // En js/config.js -> Dentro de CATALOGO.perif

// ... en js/config.js ...
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
            // posicion: 'top' (Lomo) o 'bottom' (Vientre)
            { id: 1, nombre: "Llenado", tipo: "brida", diametro: '2"', posicion: 'top' },
            { id: 2, nombre: "Servicio", tipo: "macho", diametro: '1"', posicion: 'top' },
            { id: 3, nombre: "Drenaje", tipo: "hembra", diametro: '2"', posicion: 'bottom' }
        ],
        checklist: {         
            rotogate: false,
            indicadorLlenado: true,
            drenaje: true, // Este es el checkbox general, pero ahora usaremos conexiones reales
            valvulaAlivio: true
        }
    } 
},
// ...
    ],
    cons: [
        { subCat: 'Sellantes', id: 'cs_teflon', name: 'Cinta Teflón', icon: '🧶', type: 'consumible', props: { tipo: 'teflon' } },
        { subCat: 'Sellantes', id: 'cs_fuerza_alt', name: 'Traba. Fuerza Alta', icon: '🔴', type: 'consumible', props: { tipo: 'anaerobico' } },
        { subCat: 'Sellantes', id: 'cs_fuerza_med', name: 'Traba. Fuerza Media', icon: '🔵', type: 'consumible', props: { tipo: 'anaerobico' } },
        { subCat: 'Pinturas', id: 'cs_anti', name: 'Anticorrosivo', icon: '🖌️', type: 'consumible', props: { tipo: 'pintura' } },
        { subCat: 'Pinturas', id: 'cs_epox', name: 'Epóxica', icon: '🧪', type: 'consumible', props: { tipo: 'pintura' } },
        { subCat: 'Solventes', id: 'cs_tiner', name: 'Tiner', icon: '💧', type: 'consumible', props: { tipo: 'solvente' } }
    ]
};
