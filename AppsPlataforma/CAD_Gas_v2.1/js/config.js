// js/config.js

// CONFIGURACIÓN POR DEFECTO
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

// CONSTANTES DE UNIDADES
window.UNITS = { 
    'm': { factor: 1, label: 'm', precision: 2 }, 
    'dm': { factor: 10, label: 'cm', precision: 1 }, 
    'cm': { factor: 100, label: 'cm', precision: 1 }, 
    'mm': { factor: 1000, label: 'mm', precision: 0 } 
};

// DIÁMETROS DISPONIBLES
window.DIAMETROS_DISPONIBLES = {
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

// ==========================================
// ICONOS SVG (Estilo P&ID) - CORREGIDO: SE GUARDA EN WINDOW
// ==========================================
window.ICONS = {
    PIPE: `<svg viewBox="0 0 24 24"><line x1="2" y1="20" x2="22" y2="4" /></svg>`,
    PIPE_FLEX: `<svg viewBox="0 0 24 24"><path d="M2,20 C8,20 8,12 12,12 S16,4 22,4" /></svg>`,
    UNION: `<svg viewBox="0 0 24 24"><path d="M7,12 L17,12 M7,8 L7,16 M17,8 L17,16" /></svg>`, 
    BRIDA: `<svg viewBox="0 0 24 24"><line x1="12" y1="4" x2="12" y2="20" stroke-width="3"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="16" x2="16" y2="16"/></svg>`,
    V_GATE: `<svg viewBox="0 0 24 24"><path d="M2,8 L12,16 L22,8 L22,16 L12,8 L2,16 Z" class="filled" fill="currentColor" stroke="none"/></svg>`, 
    V_BOLA: `<svg viewBox="0 0 24 24"><path d="M2,7 L12,12 L2,17 Z" /><path d="M22,7 L12,12 L22,17 Z" /><circle cx="12" cy="12" r="3" /></svg>`, 
    V_ACTUADA: `<svg viewBox="0 0 24 24"><path d="M2,8 L12,13 L2,18 Z" /><path d="M22,8 L12,13 L22,18 Z" /><line x1="12" y1="13" x2="12" y2="6" stroke-width="1.5"/><rect x="8" y="2" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`, 
    V_GLOBO: `<svg viewBox="0 0 24 24"><path d="M2,7 L12,12 L2,17 Z" /><path d="M22,7 L12,12 L22,17 Z" /><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>`, 
    V_AGUJA: `<svg viewBox="0 0 24 24"><path d="M2,12 L22,12 M12,12 L12,20 M8,16 L16,16" /><path d="M12,12 L8,4 L16,4 Z" /></svg>`, 
    V_CHECK: `<svg viewBox="0 0 24 24"><path d="M4,17 L14,12 L4,7 Z" /><line x1="14" y1="7" x2="14" y2="17" /></svg>`, 
    V_EXCESO: `<svg viewBox="0 0 24 24"><path d="M2,12 L22,12" /><path d="M16,7 L8,12 L16,17 Z" fill="currentColor"/></svg>`, 
    MEDIDOR: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12,12 L16,8" /><text x="8" y="16" font-size="8" font-family="Arial" stroke="none" fill="currentColor">M</text></svg>`,
    CORRECTOR: `<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M8,12 L16,12" /></svg>`,
    REGULADOR: `<svg viewBox="0 0 24 24"><path d="M4,12 L20,12" /><path d="M12,12 L8,4 L16,4 Z" /></svg>`,
    COMPRESOR: `<svg viewBox="0 0 24 24"><path d="M4,20 L20,4 M20,20 L4,4" /><circle cx="12" cy="12" r="8" /></svg>`,
    MANOMETRO: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="7" /><line x1="12" y1="15" x2="12" y2="22" /><text x="12" y="10" text-anchor="middle" font-size="8" stroke="none" fill="currentColor">PI</text></svg>`,
    PRESOSTATO: `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /><text x="12" y="15" text-anchor="middle" font-size="8" stroke="none" fill="currentColor">PS</text></svg>`,
    SENSOR: `<svg viewBox="0 0 24 24"><path d="M12,2 L15,8 L21,9 L17,14 L18,20 L12,17 L6,20 L7,14 L3,9 L9,8 Z" /></svg>`,
    SOPORTE: `<svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="20" stroke-width="3"/><line x1="12" y1="20" x2="12" y2="8"/><path d="M8,8 L16,8 L12,14 Z"/></svg>`,
    TANQUE: `<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="4" /><line x1="8" y1="6" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="18" /></svg>`,
    CINTA: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" stroke-width="3"/><path d="M12,6 L18,2" stroke-width="1"/></svg>`,
    BOTELLA: `<svg viewBox="0 0 24 24"><path d="M9,20 L15,20 L15,10 L9,10 Z" /><path d="M12,10 L12,6" /><rect x="10" y="4" width="4" height="2" /></svg>`,
    BROCHA: `<svg viewBox="0 0 24 24"><rect x="8" y="4" width="8" height="6" /><line x1="8" y1="10" x2="8" y2="13" /><line x1="11" y1="10" x2="11" y2="13" /><line x1="13" y1="10" x2="13" y2="13" /><line x1="16" y1="10" x2="16" y2="13" /><path d="M10,13 L14,13 L13,20 L11,20 Z" /></svg>`
};

// ALIAS LOCAL PARA CATALOGO (Evita romper el resto del archivo)
const ICONS = window.ICONS;

// Props Default para Flujo
const defaultFlow = { diamIn: '1/2"', typeIn: 'hembra', diamOut: '1/2"', typeOut: 'hembra' };

// CATÁLOGO COMPLETO
window.CATALOGO = {
    mat: [
        { subCat: 'Acero al Carbón', id: 't_ac_40', name: 'Sch40', color: '#444444', icon: ICONS.PIPE, type: 'tuberia', props: { material: 'acero_sch40', diametroNominal: '1"' } },
        { subCat: 'Acero al Carbón', id: 't_ac_80', name: 'Sch80', color: '#222222', icon: ICONS.PIPE, type: 'tuberia', props: { material: 'acero_sch80', diametroNominal: '1"' } },
        { subCat: 'Acero al Carbón', id: 't_ac_160', name: 'Sch160', color: '#000000', icon: ICONS.PIPE, type: 'tuberia', props: { material: 'acero_sch160', diametroNominal: '1"' } },
        { subCat: 'Acero Galvanizado', id: 't_gl_40', name: 'Sch40 Galv', color: '#C0C0C0', icon: ICONS.PIPE, type: 'tuberia', props: { material: 'galv_sch40', diametroNominal: '1"' } },
        { subCat: 'Cobre Rígido', id: 't_cu_k', name: 'Tipo K (Verde)', color: '#006400', icon: ICONS.PIPE, type: 'tuberia', props: { material: 'cobre_k', diametroNominal: '1/2"' } },
        { subCat: 'Cobre Rígido', id: 't_cu_l', name: 'Tipo L (Azul)', color: '#1E90FF', icon: ICONS.PIPE, type: 'tuberia', props: { material: 'cobre_l', diametroNominal: '1/2"' } },
        { subCat: 'Cobre Flexible', id: 't_cu_flex', name: 'Flexible', color: '#B87333', icon: ICONS.PIPE_FLEX, type: 'tuberia', props: { material: 'cobre_flex', diametroNominal: '3/8"' } },
        { subCat: 'Multicapa', id: 't_multi', name: 'PE-AL-PE', color: '#FFFFE0', icon: ICONS.PIPE, type: 'tuberia', props: { material: 'multicapa', diametroNominal: '1620 (20mm)' } },
        { subCat: 'Plásticas', id: 't_pe_met', name: 'PE Métrico', color: '#FFD700', icon: ICONS.PIPE, type: 'tuberia', props: { material: 'pe_metric', diametroNominal: '32mm' } }
    ],
    comp: [
        { subCat: 'Uniones', id: 'c_union', name: 'Unión Universal', icon: ICONS.UNION, type: 'equipo', props: { tipo: 'accesorio', ...defaultFlow } },
        { subCat: 'Uniones', id: 'c_brida', name: 'Brida', icon: ICONS.BRIDA, type: 'equipo', props: { tipo: 'accesorio', diamIn:'2"', typeIn:'brida', diamOut:'2"', typeOut:'brida' } },
        { subCat: 'Válvulas (Aislamiento)', id: 'v_bola', name: 'V. Bola', icon: ICONS.V_BOLA, type: 'valvula', props: { tipo: 'bola', rotacion: 0, ...defaultFlow }, info: { title: "Válvula de Bola", desc: "Cierre rápido 90°." } },
        { 
            subCat: 'Válvulas (Aislamiento)', 
            id: 'v_actuada', 
            name: 'V. Actuada', 
            icon: ICONS.V_ACTUADA, 
            type: 'valvula', 
            props: { 
                tipo: 'actuada', 
                rotacion: 0,
                voltaje: '24V',
                corriente: 'DC',
                estadoCompuerta: 'N/C',
                referencia: '',
                diametro: '1/2"',
                tipoAcople: 'Hembra',
                tipoUnion: 'NPT',
                mpo: '125 PSI'
            }, 
            info: { title: "Válvula Actuada", desc: "Control eléctrico/neumático." } 
        },
        { subCat: 'Válvulas (Regulación)', id: 'v_aguja', name: 'V. Aguja', icon: ICONS.V_AGUJA, type: 'valvula', props: { tipo: 'aguja', rotacion: 0, ...defaultFlow }, info: { title: "V. Aguja", desc: "Control fino." } },
        { subCat: 'Válvulas (Regulación)', id: 'v_globo', name: 'V. Globo', icon: ICONS.V_GLOBO, type: 'valvula', props: { tipo: 'globo', rotacion: 0, ...defaultFlow }, info: { title: "V. Globo", desc: "Estrangulamiento." } },
        { subCat: 'Válvulas (Seguridad)', id: 'v_check', name: 'V. Cheque', icon: ICONS.V_CHECK, type: 'valvula', props: { tipo: 'retencion', rotacion: 0, ...defaultFlow }, info: { title: "V. Cheque", desc: "Una vía." } },
        { subCat: 'Válvulas (Seguridad)', id: 'v_exceso', name: 'Exc. Flujo', icon: ICONS.V_EXCESO, type: 'valvula', props: { tipo: 'exceso', rotacion: 0, ...defaultFlow }, info: { title: "Exc. Flujo", desc: "Cierre por ruptura." } }
    ],
    eq: [
        { subCat: 'Medición', id: 'eq_medidor', name: 'Medidor G4', icon: ICONS.MEDIDOR, type: 'equipo', props: { modelo: 'G4', diamIn:'1"', typeIn:'macho', diamOut:'1"', typeOut:'macho' } },
        { subCat: 'Medición', id: 'eq_ecor', name: 'Electro-corrector', icon: ICONS.CORRECTOR, type: 'equipo', props: { modelo: 'EC', ...defaultFlow } },
        { subCat: 'Regulación', id: 'eq_reg', name: 'Regulador', icon: ICONS.REGULADOR, type: 'equipo', props: { cap: '5 m3/h', diamIn:'1/2"', typeIn:'hembra', diamOut:'1"', typeOut:'hembra' } },
        { subCat: 'Compresión', id: 'eq_comp', name: 'Compresor', icon: ICONS.COMPRESOR, type: 'equipo', props: { cap: 'HP', ...defaultFlow } }
    ],
    inst: [
          { subCat: 'Presión', id: 'i_mano', name: 'Manómetro', icon: ICONS.MANOMETRO, type: 'equipo', props: { rango: '0-60 psi', diamIn:'1/4"', typeIn:'macho' } },
          { subCat: 'Presión', id: 'i_pres', name: 'Presostato', icon: ICONS.PRESOSTATO, type: 'equipo', props: { set: 'High', diamIn:'1/4"', typeIn:'hembra' } },
          { subCat: 'Seguridad', id: 'i_ion', name: 'Sensor Ionizado', icon: ICONS.SENSOR, type: 'equipo', props: { tipo: 'Ion' } }
    ],
    perif: [
        { subCat: 'Soportes', id: 'p_sop', name: 'Soporte', icon: ICONS.SOPORTE, type: 'equipo', props: { tipo: 'soporte' } },
        { 
            subCat: 'Tanques', 
            id: 'p_tanque', 
            name: 'Tanque GLP Horizontal', 
            icon: ICONS.TANQUE, 
            type: 'equipo', 
            props: { 
            tipo: 'tanque_glp',
            diametro: 2.0,       
            longitud: 6.0,       
            capacidadGalones: 1000,
            numConexiones: 2,
            rotacion: 0, 
            checklist: {         
                    rotogate: false,
                    indicadorLlenado: true,
                    multivalvulas: false,
                    drenaje: true,
                    valvulaAlivio: true,
                    valvulaLlenado: true
                }
            } 
        }
    ],
    cons: [
        { subCat: 'Sellantes', id: 'cs_teflon', name: 'Cinta Teflón', icon: ICONS.CINTA, type: 'consumible', props: { tipo: 'teflon' } },
        { subCat: 'Sellantes', id: 'cs_fuerza_alt', name: 'Traba. Fuerza Alta', icon: ICONS.BOTELLA, type: 'consumible', props: { tipo: 'anaerobico' } },
        { subCat: 'Sellantes', id: 'cs_fuerza_med', name: 'Traba. Fuerza Media', icon: ICONS.BOTELLA, type: 'consumible', props: { tipo: 'anaerobico' } },
        { subCat: 'Pinturas', id: 'cs_anti', name: 'Anticorrosivo', icon: ICONS.BROCHA, type: 'consumible', props: { tipo: 'pintura' } },
        { subCat: 'Pinturas', id: 'cs_epox', name: 'Epóxica', icon: ICONS.BROCHA, type: 'consumible', props: { tipo: 'pintura' } },
        { subCat: 'Solventes', id: 'cs_tiner', name: 'Tiner', icon: ICONS.BOTELLA, type: 'consumible', props: { tipo: 'solvente' } }
    ]
};
