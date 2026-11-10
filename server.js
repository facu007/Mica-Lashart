require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const mailer = require('./mailer');

const port = process.env.PORT || 3456;
const dir = __dirname;

// Configuración de Supabase desde variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase = null;
if (SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });


    console.log(`[Supabase] Conectado a ${SUPABASE_URL}`);
  } catch (err) {
    console.warn('[Supabase] Error al inicializar cliente:', err.message);
  }
} else {
  console.log('[Supabase] Modo Local / Demo activo. Para conectar a la nube, completa las variables en .env');
}

// Fallback en memoria de turnos y catálogo para desarrollo local
const localDatabase = {
  appointments: [],
  enrollments: [],
  services: [
    {
      id: '22222222-2222-2222-2222-222222222201',
      name: 'Clásicas Pelo a Pelo',
      slug: 'clasicas-pelo-a-pelo',
      badge: 'Efecto Rímel Natural',
      duration_minutes: 90,
      price_ars: 28000,
      deposit_ars: 5000,
      category: 'extensiones'
    },
    {
      id: '22222222-2222-2222-2222-222222222202',
      name: 'Volumen Híbrido Glam',
      slug: 'volumen-hibrido-glam',
      badge: '★ Look Más Pedido',
      duration_minutes: 120,
      price_ars: 34000,
      deposit_ars: 5000,
      category: 'extensiones'
    },
    {
      id: '22222222-2222-2222-2222-222222222203',
      name: 'Volumen Ruso 3D-5D',
      slug: 'volumen-ruso-3d-5d',
      badge: 'Densidad & Mirada Intensa',
      duration_minutes: 135,
      price_ars: 42000,
      deposit_ars: 8000,
      category: 'extensiones'
    },
    {
      id: '22222222-2222-2222-2222-222222222204',
      name: 'Mega Volumen Velvet',
      slug: 'mega-volumen-velvet',
      badge: 'Impacto Black Intenso',
      duration_minutes: 150,
      price_ars: 48000,
      deposit_ars: 10000,
      category: 'extensiones'
    },
    {
      id: '22222222-2222-2222-2222-222222222205',
      name: 'Lifting de Pestañas + Botox',
      slug: 'lifting-pestanas-botox',
      badge: 'Nutrición 100% Natural',
      duration_minutes: 60,
      price_ars: 24000,
      deposit_ars: 4000,
      category: 'lifting'
    },
    {
      id: '22222222-2222-2222-2222-222222222206',
      name: 'Laminado & Diseño de Cejas',
      slug: 'laminado-diseno-cejas',
      badge: 'Alisado + Henna HD',
      duration_minutes: 45,
      price_ars: 20000,
      deposit_ars: 4000,
      category: 'cejas'
    }
  ],
  gallery: []
};

// Cargar y persistir fotos de ejemplo de la galería
const GALLERY_FILE = path.join(dir, 'gallery-data.json');
function loadGalleryData() {
  try {
    if (fs.existsSync(GALLERY_FILE)) {
      const content = fs.readFileSync(GALLERY_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn('[Gallery] Error al leer gallery-data.json:', e.message);
  }
  return [];
}

function saveGalleryData(items) {
  try {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Gallery] Error al escribir gallery-data.json:', e.message);
  }
}

localDatabase.gallery = loadGalleryData();

// Asegurar bucket público 'gallery' en Supabase Storage para alojar fotos en la nube
let galleryBucketReady = false;
async function ensureGalleryBucket() {
  if (!supabase || galleryBucketReady) return galleryBucketReady;
  try {
    const { data: existing, error: getErr } = await supabase.storage.getBucket('gallery');
    if (existing && !getErr) {
      galleryBucketReady = true;
      return true;
    }
    const { error: createErr } = await supabase.storage.createBucket('gallery', {
      public: true,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    });
    if (!createErr || String(createErr.message || '').toLowerCase().includes('already exists')) {
      galleryBucketReady = true;
      console.log('[Storage] Bucket público "gallery" listo en Supabase Storage.');
      return true;
    }
    console.warn('[Storage] Aviso al preparar bucket gallery:', createErr.message);
  } catch (e) {
    console.warn('[Storage] Excepción verificando bucket gallery:', e.message);
  }
  return false;
}
if (supabase) {
  ensureGalleryBucket().catch(() => {});
}

// Cargar y persistir horarios publicados por el Admin (con estado tachado en vivo)
const PUBLISHED_SCHEDULES_FILE = path.join(dir, 'published-schedules.json');
function loadPublishedSchedulesLocal() {
  try {
    if (fs.existsSync(PUBLISHED_SCHEDULES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PUBLISHED_SCHEDULES_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object' && parsed.days) return parsed;
    }
  } catch (e) {
    console.warn('[Schedules] Error al leer published-schedules.json:', e.message);
  }
  return { days: {} };
}

function savePublishedSchedulesLocal(data) {
  try {
    fs.writeFileSync(PUBLISHED_SCHEDULES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Schedules] Error al guardar published-schedules.json:', e.message);
  }
}

localDatabase.publishedSchedules = loadPublishedSchedulesLocal();

// =========================================================================
// CONTENIDO EDITABLE DEL SITIO WEB, SERVICIOS, PROMOS, CURSOS Y SECCIONES
// =========================================================================
const SITE_CONTENT_FILE = path.join(dir, 'site-content.json');

function getDefaultSiteContent() {
  return {
    services: [
      {
        id: '22222222-2222-2222-2222-222222222205',
        name: 'Lifting de Pestañas + Nutrición Keratina',
        slug: 'lifting-pestanas-botox',
        badge: 'Lifting & Nutrición',
        desc: 'Eleva tus pestañas naturales desde la raíz con curvatura armónica. Baño botox y keratina para engrosar y dar brillo sin rímel.',
        duration: 60,
        durationLabel: '60 min',
        price: 24000,
        deposit: 4800,
        icon: '🌸',
        category: 'lifting',
        isActive: true,
        sortOrder: 1
      },
      {
        id: '22222222-2222-2222-2222-222222222201',
        name: 'Extensiones Pelo a Pelo Clásicas',
        slug: 'clasicas-pelo-a-pelo',
        badge: 'Pelo a Pelo',
        desc: 'Una extensión suave adherida por cada pestaña sana. Logra el aspecto de máscara perfecta, mirada abierta y ordenada sin recargar.',
        duration: 90,
        durationLabel: '90-120 min',
        price: 28000,
        deposit: 5600,
        icon: '✨',
        category: 'clasicas',
        isActive: true,
        sortOrder: 2
      },
      {
        id: '22222222-2222-2222-2222-222222222202',
        name: 'Volumen Híbrido / Light Russian',
        slug: 'volumen-hibrido-glam',
        badge: '★ Look Más Pedido',
        desc: 'Abanicos ultralivianos armados en el momento combinados con técnica individual. Densidad esponjosa, dimensión glam y acabado aterciopelado.',
        duration: 120,
        durationLabel: '120 min',
        price: 34000,
        deposit: 6800,
        icon: '👑',
        category: 'volumen',
        isActive: true,
        sortOrder: 3
      },
      {
        id: '22222222-2222-2222-2222-222222222203',
        name: 'Volumen Ruso 3D-5D',
        slug: 'volumen-ruso-3d-5d',
        badge: 'Densidad & Mirada Intensa',
        desc: 'Abanicos artesanales ultralivianos hechos a mano. Densidad sofisticada y curvatura impecable.',
        duration: 135,
        durationLabel: '135 min',
        price: 42000,
        deposit: 8400,
        icon: '💎',
        category: 'volumen',
        isActive: true,
        sortOrder: 4
      },
      {
        id: '22222222-2222-2222-2222-222222222204',
        name: 'Mega Volumen Velvet',
        slug: 'mega-volumen-velvet',
        badge: 'Impacto Black Intenso',
        desc: 'Máxima cobertura y textura aterciopelada. Fibras extra finas 0.03mm de máxima ligereza.',
        duration: 150,
        durationLabel: '150 min',
        price: 48000,
        deposit: 9600,
        icon: '🖤',
        category: 'volumen',
        isActive: true,
        sortOrder: 5
      },
      {
        id: '22222222-2222-2222-2222-222222222206',
        name: 'Laminado & Perfilado de Cejas',
        slug: 'laminado-diseno-cejas',
        badge: 'Cejas VIP',
        desc: 'Direcciona y fija cada vello para enmarcar el rostro con simetría orgánica. Incluye diseño personalizado con pinza e hidratación.',
        duration: 45,
        durationLabel: '45 min',
        price: 20000,
        deposit: 4000,
        icon: '🦋',
        category: 'volumen',
        isActive: true,
        sortOrder: 6
      },
      {
        id: '22222222-2222-2222-2222-222222222207',
        name: 'Mantenimiento de Extensiones (Service)',
        slug: 'mantenimiento-extensiones',
        badge: 'Service Mensual',
        desc: 'Reemplazo de pestañas regeneradas para mantener el diseño simétrico, fresco y limpio de forma continua cada 2 a 3 semanas.',
        duration: 60,
        durationLabel: '60 min',
        price: 18000,
        deposit: 3600,
        icon: '💫',
        category: 'clasicas',
        isActive: true,
        sortOrder: 7
      }
    ],
    promosSection: {
      pill: 'Promociones de Temporada',
      title: 'Elegí la opción para potenciar tus resultados',
      subtitle: 'Paquetes y combos pensados para maximizar la belleza de tu mirada y mantenerla impecable por semanas.',
      bannerTag: 'Agenda Online 24/7',
      bannerTitle: 'Reservá tu Horario en Tiempo Real',
      bannerSubtitle: 'Zona Htal. Penna - Villa Cerrito - Bahía Blanca',
      bannerBtnText: 'Abrir Agenda Online',
      items: [
        {
          id: 'promo_1',
          badge: 'Combo Look Natural',
          duration: '75 min',
          title: 'Lifting + Botox + Perfilado',
          desc: 'Pestañas curvadas con nutrición profunda y cejas perfectamente definidas y ordenadas. Cero uso de rímel diario.',
          priceLabel: 'Precio Promoción',
          price: 22000,
          ribbonText: 'La opción para potenciar tus resultados ♡',
          btnText: 'Pedir Turno Promo',
          serviceLink: 'lifting',
          isVip: false,
          vipBadge: ''
        },
        {
          id: 'promo_2',
          badge: 'Pack Glow Total',
          duration: '120 min',
          title: 'Extensiones Híbridas / Rusas + Cejas',
          desc: 'Densidad suave, textura aterciopelada y abanicos ultralivianos hechos a mano más laminado de cejas completo.',
          priceLabel: 'Inversión Especial',
          price: 34000,
          ribbonText: 'La opción para potenciar tus resultados ♡',
          btnText: 'Reservar Turno VIP',
          serviceLink: 'hibrido',
          isVip: true,
          vipBadge: '★ Más Elegido VIP ★'
        },
        {
          id: 'promo_3',
          badge: 'Mantenimiento Mensual',
          duration: '60 min',
          title: 'Service Frecuente (Cada 2 a 3 sem)',
          desc: 'Retiro de piezas crecidas y relleno prolijo para lucir tu set completo, limpio y simétrico todo el mes.',
          priceLabel: 'Precio Clientas Frecuentes',
          price: 18000,
          ribbonText: 'Cuidado continuo de tu mirada ♡',
          btnText: 'Agendar Service',
          serviceLink: 'mantenimiento',
          isVip: false,
          vipBadge: ''
        }
      ]
    },
    coursesSection: {
      pill: '🎓 ACADEMIA MICA LASH ART ♡ CAPACITACIONES 🎓',
      title: 'Cursos Profesionales & Masterclasses',
      subtitle: 'Aprendé las técnicas más solicitadas del mercado de la mano de Micaela (lashista y educadora desde 2016). Formación personalizada con práctica en modelo real, kit profesional completo y doble certificación.',
      trustBadges: [
        { icon: '🎓', title: 'Certificado Oficial', subtitle: 'Válido para inserción profesional' },
        { icon: '📦', title: 'Kit Completo Incluido', subtitle: 'Materiales profesionales importados' },
        { icon: '👁️', title: 'Práctica Real Supervisada', subtitle: 'Atención paso a paso con modelo' },
        { icon: '💬', title: 'Mentoría Permanente', subtitle: 'Canal directo de consultas con Mica' }
      ],
      courses: [
        {
          id: '33333333-3333-3333-3333-333333333301',
          slug: 'curso-inicial-clasicas',
          badge: '★ El Más Elegido',
          duration: '2 Jornadas',
          title: 'Curso Inicial: Clásicas 1 a 1',
          subtitle: 'Extensiones Pelo a Pelo • Nivel Inicial sin experiencia previa',
          desc: 'El curso base fundamental para insertarte en el mundo lash. Aprendé desde cero anatomía ocular, bioseguridad, dirección de postura, aislación milimétrica y mapping adaptado a cada ojo.',
          syllabus: [
            'Práctica real en cabeza técnica y modelo viva',
            'Kit profesional completo (pinzas, adhesivo, blíster)',
            'Manual teórico encuadernado y certificado oficial',
            'Seguimiento y asesoría post-curso de por vida'
          ],
          priceLabel: 'Inversión',
          price: 75000,
          priceNote: 'Opciones en cuotas • Seña previa',
          modalityFilter: 'presencial',
          btnText: 'Consultar por WhatsApp',
          whatsappText: 'Hola Mica! Quiero info y temario del Curso Inicial de Clásicas Pelo a Pelo',
          isActive: true,
          sortOrder: 1
        },
        {
          id: '33333333-3333-3333-3333-333333333302',
          slug: 'masterclass-volumen-ruso',
          badge: '👑 Especialización Avanzada',
          duration: '1 Jornada VIP',
          title: 'Masterclass: Volumen Ruso & Mega',
          subtitle: 'Técnicas Rusas • Armado manual de abanicos 2D a 6D',
          desc: 'Llevá tu técnica al máximo nivel. Dominá el armado de abanicos en tira y pinza, retención blindada (hasta 6 semanas), mapping avanzado (Fox, Wet, Kim) y química del adhesivo.',
          syllabus: [
            'Técnica artesanal sin abanicos prearmados',
            'Secretos de retención extrema y control de humedad',
            'Módulo de fotografía y edición para Instagram',
            'Certificado de Master Lashista en Volumen'
          ],
          priceLabel: 'Inversión',
          price: 88000,
          priceNote: 'Cupos ultra limitados (1 a 1)',
          modalityFilter: 'ambos',
          btnText: 'Consultar por WhatsApp',
          whatsappText: 'Hola Mica! Quiero info y fechas de la Masterclass de Volumen Ruso',
          isActive: true,
          sortOrder: 2
        },
        {
          id: '33333333-3333-3333-3333-333333333303',
          slug: 'taller-lifting-laminado',
          badge: '🌿 Rápida Salida Laboral',
          duration: '1 Día Intensivo',
          title: 'Taller Dual: Lifting & Laminado',
          subtitle: 'Lifting con Keratina + Laminado & Perfilado de Cejas',
          desc: 'Combiná los dos tratamientos naturales más pedidos en una sola capacitación. Aprendé tiempos exactos de exposición, elección de moldes según el párpado, tinte y nutrición botox.',
          syllabus: [
            'Modalidad Presencial VIP u Online en Video HD',
            'Visagismo y perfilado de cejas con hilo y pinza',
            'Dossier descargable y lista de proveedores directos',
            'Doble Certificación Oficial incluida'
          ],
          priceLabel: 'Inversión',
          price: 48000,
          priceNote: 'Online: $28.000 • Material incluido',
          modalityFilter: 'ambos',
          btnText: 'Consultar por WhatsApp',
          whatsappText: 'Hola Mica! Quiero info del Taller Dual de Lifting y Laminado de Cejas',
          isActive: true,
          sortOrder: 3
        }
      ]
    },
    hero: {
      statusPill: 'Turnos Disponibles Esta Semana • Bahía Blanca',
      scriptTitle: '¿Lista para sentir la diferencia?',
      mainTitleLine1: 'Miradas con arte,',
      mainTitleHighlight: 'precisión & elegancia.',
      ribbonTop: 'RESERVÁ TU TURNO CON',
      ribbonBrand: 'Mica Lash Art',
      description: 'Diseño exclusivo de pestañas, visagismo y cuidado integral. Un espacio privado en Bahía Blanca para relajarte mientras transformamos tu mirada sin dañar tu pestaña natural.',
      primaryBtnText: 'Pedir Turno Online',
      secondaryBtnText: 'Ver Precios & Promos',
      guarantees: [
        '100% Sin dolor',
        'Nutrición folicular',
        '+150 clientas felices'
      ],
      styles: [
        {
          id: 'hibrido',
          name: 'Volumen Híbrido',
          badge: '★ Look Más Pedido',
          title: 'Volumen Híbrido Glam',
          detail: 'Densidad suave, textura aterciopelada y abanicos ultralivianos en camilla',
          price: '$34.000',
          time: '120 min',
          img: 'images/ej-volumen-hibrido.jpg'
        },
        {
          id: 'lifting',
          name: 'Lifting & Botox',
          badge: '🌿 100% Pestaña Natural',
          title: 'Lifting con Keratina Botox',
          detail: 'Eleva tus pestañas naturales desde la raíz con nutrición botox y tinte negro',
          price: '$24.000',
          time: '75 min',
          img: 'images/ej-lifting-botox.jpg'
        },
        {
          id: 'comparativa',
          name: 'Comparativa Real',
          badge: '✨ Ojo Real vs Natural',
          title: 'Antes vs Después en Directo',
          detail: 'Apertura total de mirada comprobada en sesión real con máxima fijación',
          price: '$34.000',
          time: '120 min',
          img: 'images/ej-comparativa-real.jpg'
        },
        {
          id: 'ruso',
          name: 'Volumen Ruso',
          badge: '🔥 Máxima Densidad 3D-5D',
          title: 'Mega Volumen Ruso',
          detail: 'Abanicos artesanales abiertos a mano, negro carbón y acabado aterciopelado',
          price: '$42.000',
          time: '150 min',
          img: 'images/ej-volumen-ruso.jpg'
        }
      ]
    },
    servicesSection: {
      pill: 'Catálogo del Estudio',
      title: 'Técnicas & Tratamientos VIP',
      subtitle: 'Aislación prolija 1 a 1 sin excesos ni peso. Seleccioná el servicio para agendar tu horario exclusivo.',
      ctaCardTitle: '¿Querés ver todos los horarios libres?',
      ctaCardDesc: 'Consultá el calendario interactivo en tiempo real, elegí el día y horario que más te convenga y dejá tu nota de preferencia.',
      ctaCardBtn: 'Ver Calendario de Turnos'
    },
    gallerySection: {
      pill: 'Trabajos Reales',
      title: 'Galería de Miradas',
      subtitle: 'Aislación milimétrica, cero grumos y terminación de alta gama en cada sesión. Tocá para ver en detalle.',
      instagramBtnText: 'Ver más de 150 trabajos en Instagram @mica.lashart'
    },
    about: {
      photoUrl: 'images/mica-bio-1.jpg',
      photoTopBadge: 'Lashista & Maquilladora desde 2016',
      photoCardName: 'Micaela',
      photoCardRole: 'Creadora de Mica Lash Art • Bahía Blanca',
      photoCardSub: 'Atención VIP & Capacitaciones',
      stat1Value: '9+ Años',
      stat1Label: 'De Experiencia (2016)',
      stat2Value: '+150',
      stat2Label: 'Clientas & Alumnas',
      headerPill: '🎀✨ ¡HOLA, SOY MICA! BIENVENIDAS A MI MUNDO ✨🎀',
      headline: '"Hacer de mi pasión mi profesión." 👑',
      subheadline: 'Si todavía no me conocés, ¡me presento! 💗',
      introParagraph1: 'Soy Micaela, creadora de Mica Lash Art, lashista desde 2016, maquilladora y apasionada por el mundo de la belleza. 🦋💄',
      introParagraph2: 'A lo largo de los años fui aprendiendo, capacitándome y sumando nuevos servicios para ofrecerles una experiencia cada vez más completa, siempre con amor, dedicación y atención a cada detalle. 🩷',
      boxTitle: '¿Qué podés encontrar en Mica Lash Art?',
      specialties: [
        { icon: '🎀', text: 'Extensiones de pestañas y diseños personalizados' },
        { icon: '🤍', text: 'Lifting de pestañas' },
        { icon: '🦋', text: 'Diseño y perfilado de cejas' },
        { icon: '🌸', text: 'Depilación' },
        { icon: '💄', text: 'Maquillaje profesional' },
        { icon: '✨', text: 'Electroestimulación corporal' }
      ],
      quote: '"Cada servicio tiene su magia, pero todos comparten lo mismo: las ganas de ayudarte a resaltar tu belleza y que te sientas hermosa, cómoda y segura de vos misma. 🫶🏻"',
      closingParagraph1: 'Detrás de esta marca hay años de trabajo, esfuerzo, aprendizaje y muchísimos sueños por cumplir. Y esto es solo el comienzo… 💫',
      closingParagraph2: 'Gracias a cada clienta y alumna que confía en mí, recomienda mi trabajo y me acompaña en este camino. Ustedes son una parte muy importante de todo lo que estoy construyendo. 🥹💕',
      closingSignature: 'Bienvenidas a mi espacio, a mi trabajo y a este sueño llamado MICA LASH ART. 🎀🩷'
    },
    bookingSection: {
      pill: '✨ AGENDA ONLINE EN TIEMPO REAL ✨',
      title: 'Reservá Tu Turno en Pocos Clics',
      subtitle: 'Accedé a nuestra aplicación exclusiva de turnos. Seleccioná tu tratamiento favorito, elegí el día en el calendario interactivo y asegurá tu horario sin esperas.',
      primaryBtnText: 'Abrir Agenda de Turnos',
      secondaryBtnText: 'Iniciar Sesión Clientas',
      features: [
        { icon: '🗓️', title: 'Calendario Interactivo', desc: 'Elegí tu fecha y hora exacta disponible en vivo.' },
        { icon: '⚡', title: 'Reserva Directa Online', desc: 'Tu cita queda registrada al instante en nuestra agenda.' },
        { icon: '📅', title: 'Google Calendar', desc: 'Sincronizá tu cita directo en tu celular.' }
      ],
      turnosPageRibbon: 'AGENDA ONLINE • MICA LASH ART ♡',
      turnosPageTitle: 'Pedir Turno',
      turnosPageSubtitle: 'Elegí tu tratamiento, seleccioná fecha en el calendario y asegurá tu horario en tiempo real.',
      turnosHoursNote: 'Atención: Mar a Sáb 10:00 a 19:30 hs'
    },
    location: {
      pill: 'Estudio Privado',
      title: 'Visitanos en Bahía Blanca',
      subtitle: 'Atención en estudio privado climatizado, sin esperas ni ruido exterior. Tu sesión es 100% personalizada.',
      addressTitle: 'Ubicación',
      addressText: 'Zona Htal. Penna - Villa Cerrito - Bahía Blanca',
      addressNote: 'Dirección exacta enviada por WhatsApp al confirmar seña',
      hoursTitle: 'Días & Horarios',
      hoursLine1: 'Lunes a Viernes: 10:00 a 19:30 hs',
      hoursLine2: 'Sábados: 10:00 a 16:00 hs (Cupos limitados)',
      studioPhotoUrl: 'images/studio-ambiance-vip.jpg',
      whatsappNumber: '5492914491141',
      instagramHandle: '@mica.lashart',
      instagramUrl: 'https://instagram.com/mica.lashart',
      brandName: 'MICA LASH ART',
      footerSubtitle: 'Zona Htal. Penna - Villa Cerrito - Bahía Blanca • Agenda de Turnos Online',
      footerCopyright: '© 2025 Mica Lash Art. Todos los derechos reservados.'
    },
    faqs: {
      pill: 'Información Útil',
      title: 'Preguntas Frecuentes',
      subtitle: 'Todo lo que tenés que saber antes de tu cita en el estudio.',
      items: [
        {
          id: 'faq_1',
          question: '¿Duelen las extensiones o el lifting?',
          answer: 'Para nada. Es un proceso 100% indoloro, no invasivo y muy relajante. La mayoría de las clientas se duerme plácidamente durante la sesión sobre nuestra camilla ergonómica.'
        },
        {
          id: 'faq_2',
          question: '¿Cuánto duran las extensiones de pestañas?',
          answer: 'Acompañan el ciclo biológico natural de tu pestaña (4 a 6 semanas). Para mantenerlas siempre tupidas y prolijas, se sugiere realizar el service de mantenimiento cada 2 a 3 semanas.'
        },
        {
          id: 'faq_3',
          question: '¿Cómo llego a mi turno y cómo preparo mis pestañas?',
          answer: 'Es fundamental asistir con los ojos completamente libres de maquillaje, rímel y sombras, y sin cremas en el contorno de ojos para garantizar la máxima adherencia y duración.'
        },
        {
          id: 'faq_4',
          question: '¿Cómo se confirma el turno en el estudio?',
          answer: 'El turno se reserva formalmente mediante transferencia bancaria de una seña. Una vez recibida, te enviamos la confirmación del horario y la dirección exacta en Zona Htal. Penna - Villa Cerrito.'
        }
      ]
    }
  };
}

function loadSiteContentLocal() {
  const defaults = getDefaultSiteContent();
  try {
    if (fs.existsSync(SITE_CONTENT_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SITE_CONTENT_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        return {
          ...defaults,
          ...parsed,
          services: Array.isArray(parsed.services) && parsed.services.length > 0 ? parsed.services : defaults.services,
          promosSection: { ...defaults.promosSection, ...(parsed.promosSection || {}) },
          coursesSection: {
            ...defaults.coursesSection,
            ...(parsed.coursesSection || {}),
            courses: Array.isArray(parsed.coursesSection?.courses) ? parsed.coursesSection.courses : defaults.coursesSection.courses
          },
          hero: { ...defaults.hero, ...(parsed.hero || {}) },
          servicesSection: { ...defaults.servicesSection, ...(parsed.servicesSection || {}) },
          gallerySection: { ...defaults.gallerySection, ...(parsed.gallerySection || {}) },
          about: { ...defaults.about, ...(parsed.about || {}) },
          bookingSection: { ...defaults.bookingSection, ...(parsed.bookingSection || {}) },
          location: { ...defaults.location, ...(parsed.location || {}) },
          faqs: { ...defaults.faqs, ...(parsed.faqs || {}) }
        };
      }
    }
  } catch (e) {
    console.warn('[SiteContent] Error al leer site-content.json:', e.message);
  }
  return defaults;
}

function saveSiteContentLocal(contentObj) {
  try {
    fs.writeFileSync(SITE_CONTENT_FILE, JSON.stringify(contentObj, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[SiteContent] Error al guardar site-content.json:', e.message);
  }
}

localDatabase.siteContent = loadSiteContentLocal();

function mapDbCategoryForServicesTable(cat) {
  const c = String(cat || '').toLowerCase();
  if (c === 'lifting') return 'lifting';
  if (c === 'cejas') return 'cejas';
  if (c === 'combo') return 'combo';
  return 'extensiones';
}

async function getSiteContentFull() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'site_content')
        .maybeSingle();

      if (!error && data && data.value && typeof data.value === 'object') {
        const defaults = getDefaultSiteContent();
        const remote = data.value;
        const merged = {
          ...defaults,
          ...remote,
          services: Array.isArray(remote.services) && remote.services.length > 0 ? remote.services : defaults.services,
          promosSection: { ...defaults.promosSection, ...(remote.promosSection || {}) },
          coursesSection: {
            ...defaults.coursesSection,
            ...(remote.coursesSection || {}),
            courses: Array.isArray(remote.coursesSection?.courses) ? remote.coursesSection.courses : defaults.coursesSection.courses
          },
          hero: { ...defaults.hero, ...(remote.hero || {}) },
          servicesSection: { ...defaults.servicesSection, ...(remote.servicesSection || {}) },
          gallerySection: { ...defaults.gallerySection, ...(remote.gallerySection || {}) },
          about: { ...defaults.about, ...(remote.about || {}) },
          bookingSection: { ...defaults.bookingSection, ...(remote.bookingSection || {}) },
          location: { ...defaults.location, ...(remote.location || {}) },
          faqs: { ...defaults.faqs, ...(remote.faqs || {}) }
        };
        localDatabase.siteContent = merged;
        saveSiteContentLocal(merged);
        return merged;
      }
    } catch (e) {
      console.warn('[Supabase] Error leyendo site_content:', e.message);
    }
  }
  if (!localDatabase.siteContent) {
    localDatabase.siteContent = loadSiteContentLocal();
  }
  return localDatabase.siteContent;
}

async function syncServicesToSupabaseTable(servicesList) {
  if (!supabase || !Array.isArray(servicesList)) return;
  try {
    const crypto = require('crypto');
    const rows = servicesList.map((s, idx) => {
      const rawId = String(s.id || '');
      const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)
        ? rawId
        : crypto.randomUUID();
      s.id = validUuid;
      const slugBase = String(s.slug || s.name || `servicio-${idx + 1}`)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `servicio-${idx + 1}`;
      s.slug = slugBase;
      const priceNum = Number(s.price !== undefined ? s.price : s.price_ars) || 0;
      const depNum = Number(s.deposit !== undefined ? s.deposit : s.deposit_ars) || Math.ceil((priceNum * 0.2) / 100) * 100;
      return {
        id: validUuid,
        name: s.name || 'Servicio',
        slug: `${slugBase}-${validUuid.slice(-4)}`,
        badge: s.badge || '',
        description: s.desc || s.description || '',
        duration_minutes: Number(s.duration || s.duration_minutes) || 90,
        price_ars: priceNum,
        deposit_ars: depNum,
        icon: s.icon || '✨',
        category: mapDbCategoryForServicesTable(s.category),
        is_active: s.isActive !== false,
        sort_order: Number(s.sortOrder) || (idx + 1)
      };
    });
    if (rows.length > 0) {
      await supabase.from('services').upsert(rows, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn('[Supabase] Aviso sincronizando tabla services:', e.message);
  }
}

async function syncCoursesToSupabaseTable(coursesList) {
  if (!supabase || !Array.isArray(coursesList)) return;
  try {
    const crypto = require('crypto');
    const rows = coursesList.map((c, idx) => {
      const rawId = String(c.id || '');
      const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)
        ? rawId
        : crypto.randomUUID();
      c.id = validUuid;
      const slugBase = String(c.slug || c.title || `curso-${idx + 1}`)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `curso-${idx + 1}`;
      c.slug = slugBase;
      const priceNum = Number(c.price !== undefined ? c.price : c.price_ars) || 0;
      return {
        id: validUuid,
        title: c.title || 'Curso',
        slug: `${slugBase}-${validUuid.slice(-4)}`,
        level: c.subtitle || c.level || 'Inicial',
        modality: c.modalityFilter || c.modality || 'presencial',
        duration_hours: c.duration || c.duration_hours || '1 Jornada',
        price_ars: priceNum,
        deposit_ars: Number(c.deposit || c.deposit_ars) || Math.ceil((priceNum * 0.2) / 100) * 100,
        includes_kit: true,
        badge: c.badge || 'Certificado Oficial',
        description: c.desc || c.description || '',
        syllabus: Array.isArray(c.syllabus) ? c.syllabus : [],
        is_active: c.isActive !== false,
        sort_order: Number(c.sortOrder) || (idx + 1)
      };
    });
    if (rows.length > 0) {
      await supabase.from('courses').upsert(rows, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn('[Supabase] Aviso sincronizando tabla courses:', e.message);
  }
}

async function saveSiteContentFull(incomingContent) {
  const current = await getSiteContentFull();
  const merged = {
    ...current,
    ...incomingContent,
    services: Array.isArray(incomingContent.services) ? incomingContent.services : current.services,
    promosSection: incomingContent.promosSection ? { ...current.promosSection, ...incomingContent.promosSection } : current.promosSection,
    coursesSection: incomingContent.coursesSection ? {
      ...current.coursesSection,
      ...incomingContent.coursesSection,
      courses: Array.isArray(incomingContent.coursesSection.courses) ? incomingContent.coursesSection.courses : current.coursesSection.courses
    } : current.coursesSection,
    hero: incomingContent.hero ? { ...current.hero, ...incomingContent.hero } : current.hero,
    servicesSection: incomingContent.servicesSection ? { ...current.servicesSection, ...incomingContent.servicesSection } : current.servicesSection,
    gallerySection: incomingContent.gallerySection ? { ...current.gallerySection, ...incomingContent.gallerySection } : current.gallerySection,
    about: incomingContent.about ? { ...current.about, ...incomingContent.about } : current.about,
    bookingSection: incomingContent.bookingSection ? { ...current.bookingSection, ...incomingContent.bookingSection } : current.bookingSection,
    location: incomingContent.location ? { ...current.location, ...incomingContent.location } : current.location,
    faqs: incomingContent.faqs ? { ...current.faqs, ...incomingContent.faqs } : current.faqs,
    updatedAt: new Date().toISOString()
  };

  if (Array.isArray(incomingContent.services)) {
    await syncServicesToSupabaseTable(merged.services);
  }
  if (incomingContent.coursesSection && Array.isArray(incomingContent.coursesSection.courses)) {
    await syncCoursesToSupabaseTable(merged.coursesSection.courses);
  }

  localDatabase.siteContent = merged;
  localDatabase.services = merged.services;
  saveSiteContentLocal(merged);

  if (supabase) {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'site_content',
          value: merged,
          description: 'Contenido editable completo del sitio web, precios, cursos, promos y secciones'
        }, { onConflict: 'key' });
      if (error) {
        console.warn('[Supabase] Error guardando site_content en settings:', error.message);
      }
    } catch (e) {
      console.warn('[Supabase] Excepción guardando site_content:', e.message);
    }
  }

  return merged;
}

async function getPublishedSchedulesMap() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'published_schedules')
        .maybeSingle();
      if (!error && data && data.value && typeof data.value === 'object') {
        const normalized = { days: data.value.days || {} };
        localDatabase.publishedSchedules = normalized;
        savePublishedSchedulesLocal(normalized);
        return normalized;
      }
    } catch (e) {
      console.warn('[Supabase] Error leyendo published_schedules:', e.message);
    }
  }
  if (!localDatabase.publishedSchedules || !localDatabase.publishedSchedules.days) {
    localDatabase.publishedSchedules = loadPublishedSchedulesLocal();
  }
  return localDatabase.publishedSchedules;
}

async function savePublishedSchedulesMap(mapObj) {
  const cleanMap = { days: (mapObj && mapObj.days) ? mapObj.days : {} };
  localDatabase.publishedSchedules = cleanMap;
  savePublishedSchedulesLocal(cleanMap);

  if (supabase) {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'published_schedules',
          value: cleanMap,
          description: 'Horarios publicados por el admin con control de tachado en tiempo real'
        }, { onConflict: 'key' });
      if (error) {
        console.warn('[Supabase] Error guardando published_schedules:', error.message);
      }
    } catch (e) {
      console.warn('[Supabase] Excepción guardando published_schedules:', e.message);
    }
  }
  return cleanMap;
}

async function getBookedTimesForDate(dateStr) {
  let bookedAppts = [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('start_time,end_time')
        .eq('appointment_date', dateStr)
        .neq('status', 'cancelled');
      if (!error && Array.isArray(data)) {
        bookedAppts = data;
      }
    } catch (e) {
      console.warn('[Supabase] Error consultando citas del día:', e.message);
    }
  } else {
    bookedAppts = localDatabase.appointments
      .filter(a => (a.appointment_date === dateStr || a.date === dateStr) && a.status !== 'cancelled')
      .map(a => ({ start_time: a.start_time || a.time, end_time: a.end_time || a.endTime || '' }));
  }
  return bookedAppts;
}

function isTimeOverlappingBooked(slotTime, bookedAppts, slotDurationMin = 60) {
  const toMin = (t) => {
    if (!t) return 0;
    const [hh, mm] = String(t).split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };
  const sStart = toMin(slotTime);
  const sEnd = sStart + slotDurationMin;
  return bookedAppts.some(appt => {
    const cleanStart = String(appt.start_time || '').slice(0, 5);
    if (cleanStart === slotTime) return true;
    const aStart = toMin(appt.start_time);
    const aEnd = appt.end_time ? toMin(appt.end_time) : aStart + slotDurationMin;
    return sStart < aEnd && sEnd > aStart;
  });
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper para parsear JSON body en requests POST/PATCH/PUT (soporta fotos hasta 10MB)
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1.2e7) { // ~12MB limit para fotos HD en Base64
        req.destroy();
        reject(new Error('Payload too large (máximo 10MB)'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
  });
  res.end(JSON.stringify(data));
}

// Router API
async function handleApiRequest(req, res, pathname, queryParams) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
    });
    res.end();
    return;
  }

  // 1. GET /api/health
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'Mica Lash Art Backend',
      mode: supabase ? 'supabase' : 'local',
      supabaseConfigured: !!supabase,
      supabaseUrl: SUPABASE_URL || null,
      timestamp: new Date().toISOString()
    });
  }

  // 2. GET /api/config (Variables públicas para frontend)
  if (req.method === 'GET' && pathname === '/api/config') {
    return sendJson(res, 200, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      isConfigured: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
      whatsapp: '5492914491141',
      studio: 'Mica Lash Art • Bahía Blanca'
    });
  }

  // 3. GET /api/services
  if (req.method === 'GET' && pathname === '/api/services') {
    const includeInactive = queryParams.get('all') === 'true';
    const content = await getSiteContentFull();
    const list = Array.isArray(content.services) ? content.services : localDatabase.services;
    const filtered = includeInactive ? list : list.filter(s => s.isActive !== false);
    return sendJson(res, 200, { services: filtered });
  }

  // 3b. GET /api/site-content (Todo el contenido editable de la web, precios, cursos y secciones)
  if (req.method === 'GET' && pathname === '/api/site-content') {
    try {
      const content = await getSiteContentFull();
      return sendJson(res, 200, { content });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 3c. PUT /api/site-content (Guardar cambios en precios, servicios, cursos, promos o secciones)
  if ((req.method === 'PUT' || req.method === 'POST') && pathname === '/api/site-content') {
    try {
      const body = await parseJsonBody(req);
      const payload = body.content || body;
      const saved = await saveSiteContentFull(payload);
      return sendJson(res, 200, { success: true, content: saved });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 3d. POST /api/site-content/reset (Restaurar una sección o todo el sitio a los valores originales)
  if (req.method === 'POST' && pathname === '/api/site-content/reset') {
    try {
      const body = await parseJsonBody(req);
      const section = body.section;
      const defaults = getDefaultSiteContent();
      let updated;
      if (section && defaults[section] !== undefined) {
        updated = await saveSiteContentFull({ [section]: defaults[section] });
      } else {
        updated = await saveSiteContentFull(defaults);
      }
      return sendJson(res, 200, { success: true, content: updated });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4. GET /api/turnos/availability
  if (req.method === 'GET' && pathname === '/api/turnos/availability') {
    const date = queryParams.get('date');
    if (!date) {
      return sendJson(res, 400, { error: 'El parámetro ?date=YYYY-MM-DD es obligatorio.' });
    }

    const [pubMap, bookedAppts] = await Promise.all([
      getPublishedSchedulesMap(),
      getBookedTimesForDate(date)
    ]);

    const publishedDay = pubMap.days && pubMap.days[date];
    if (publishedDay && publishedDay.published !== false && Array.isArray(publishedDay.slots)) {
      const slots = publishedDay.slots.map(s => {
        const time = String(s.time || '').slice(0, 5);
        const autoBooked = isTimeOverlappingBooked(time, bookedAppts, 60);
        const crossedOut = !!s.crossedOut;
        return {
          time,
          crossedOut,
          autoBooked,
          available: !crossedOut && !autoBooked
        };
      });
      return sendJson(res, 200, { date, isPublished: true, slots });
    }

    const defaultSlots = ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];
    const slots = defaultSlots.map(time => {
      const autoBooked = isTimeOverlappingBooked(time, bookedAppts, 90);
      return {
        time,
        crossedOut: false,
        autoBooked,
        available: !autoBooked
      };
    });

    return sendJson(res, 200, { date, isPublished: false, slots });
  }

  // 5. POST /api/turnos (Crear turno)
  if (req.method === 'POST' && pathname === '/api/turnos') {
    try {
      const body = await parseJsonBody(req);
      const { serviceId, serviceName, date, time, endTime, name, phone, email, notes, price, depositArs, depositReceipt } = body;

      if (!date || !time || !name || !phone) {
        return sendJson(res, 400, { error: 'Faltan campos requeridos (date, time, name, phone).' });
      }

      if (!depositReceipt) {
        return sendJson(res, 400, { error: 'Para reservar es obligatorio adjuntar el comprobante de la seña del 20%.' });
      }

      const cleanTime = String(time).slice(0, 5);
      const [pubMap, bookedAppts] = await Promise.all([
        getPublishedSchedulesMap(),
        getBookedTimesForDate(date)
      ]);

      // Validar si el horario está tachado manualmente o ya ocupado por otro turno activo
      const publishedDay = pubMap.days && pubMap.days[date];
      if (publishedDay && publishedDay.published !== false && Array.isArray(publishedDay.slots)) {
        const pubSlot = publishedDay.slots.find(s => String(s.time || '').slice(0, 5) === cleanTime);
        if (pubSlot && pubSlot.crossedOut) {
          return sendJson(res, 409, { error: 'Ese horario fue marcado como ocupado recientemente. Por favor elegí otro horario.' });
        }
      }
      if (isTimeOverlappingBooked(cleanTime, bookedAppts, 60)) {
        return sendJson(res, 409, { error: 'Ese horario acaba de ser reservado. Por favor elegí otro horario disponible.' });
      }

      const trimmedNotes = (notes || '').trim();
      const fullClientNotes = serviceName
        ? (trimmedNotes ? `Tratamiento: ${serviceName}\n${trimmedNotes}` : `Tratamiento: ${serviceName}`)
        : (trimmedNotes || null);

      let createdAppointment = null;

      if (supabase) {
        const crypto = require('crypto');
        const generatedId = crypto.randomUUID();
        // Formato para tabla appointments
        const appointmentRow = {
          id: generatedId,
          professional_id: '11111111-1111-1111-1111-111111111111',
          service_id: serviceId || '22222222-2222-2222-2222-222222222202',
          appointment_date: date,
          start_time: cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime,
          end_time: (endTime || '16:00').slice(0, 5) + ':00',
          price_ars: price || 34000,
          client_name: name,
          client_phone: phone,
          client_email: email || null,
          client_notes: fullClientNotes,
          deposit_ars: Number(depositArs) || Math.ceil(((Number(price) || 34000) * 0.2) / 100) * 100,
          deposit_receipt_url: depositReceipt,
          payment_method: 'transferencia',
          payment_status: 'pending',
          status: 'pending'
        };

        let { error } = await supabase
          .from('appointments')
          .insert(appointmentRow);

        // Compatibilidad si todavía no se ejecutó add-deposit-sena.sql
        if (error && /deposit_receipt_url/.test(error.message || '')) {
          const { deposit_receipt_url, ...legacyRow } = appointmentRow;
          legacyRow.client_notes = `${fullClientNotes || ''}\n[Seña $${appointmentRow.deposit_ars} - comprobante: ${depositReceipt}]`.trim();
          ({ error } = await supabase.from('appointments').insert(legacyRow));
        }

        if (error) {
          console.warn('[Supabase] Error al insertar turno:', error);
          // Fallback a memoria local
        } else {
          createdAppointment = { ...appointmentRow, service_name: serviceName || null, created_at: new Date().toISOString() };
        }
      }

      // Si no hay Supabase o falló la conexión, guardar en memoria local
      if (!createdAppointment) {
        createdAppointment = {
          id: 'turn_' + Date.now(),
          appointment_date: date,
          start_time: cleanTime,
          end_time: endTime || '16:00',
          price_ars: price || 34000,
          client_name: name,
          client_phone: phone,
          client_email: email || '',
          client_notes: fullClientNotes || '',
          service_name: serviceName || null,
          deposit_ars: Number(depositArs) || 0,
          deposit_receipt_url: depositReceipt,
          status: 'pending',
          created_at: new Date().toISOString()
        };
        localDatabase.appointments.push(createdAppointment);
      }

      // Enviar email personalizado de reserva si la clienta ingresó su correo
      const reqOrigin = req.headers.origin || `http://${req.headers.host || `localhost:${port}`}`;
      let emailNotification = { skipped: true };
      if (email && String(email).includes('@')) {
        emailNotification = await mailer.sendAppointmentEmail({
          supabase,
          type: 'booking',
          appointment: {
            ...createdAppointment,
            serviceName: serviceName || null
          },
          baseUrl: reqOrigin
        });
      }

      return sendJson(res, 201, {
        success: true,
        appointment: createdAppointment,
        emailNotification,
        mode: supabase ? 'supabase' : 'local'
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 6. GET /api/turnos (Listado de turnos para clientas o admin)
  if (req.method === 'GET' && pathname === '/api/turnos') {
    const email = queryParams.get('email');
    const status = queryParams.get('status');

    if (supabase) {
      let query = supabase.from('appointments').select('*, services(name)').order('appointment_date', { ascending: false }).order('start_time', { ascending: true });
      if (email) query = query.eq('client_email', email);
      if (status && status !== 'all') query = query.eq('status', status);

      let { data, error } = await query;
      if (error) {
        let fbQuery = supabase.from('appointments').select('*').order('appointment_date', { ascending: false });
        if (email) fbQuery = fbQuery.eq('client_email', email);
        if (status && status !== 'all') fbQuery = fbQuery.eq('status', status);
        const fbRes = await fbQuery;
        data = fbRes.data;
        error = fbRes.error;
      }
      if (!error && data) {
        return sendJson(res, 200, { appointments: data, count: data.length });
      }
    }

    let results = localDatabase.appointments;
    if (email) results = results.filter(a => a.client_email === email);
    if (status && status !== 'all') results = results.filter(a => a.status === status);
    return sendJson(res, 200, { appointments: results, count: results.length });
  }

  // 7. PATCH /api/turnos/:id (Actualizar estado de turno + enviar email personalizado al cancelar)
  if (req.method === 'PATCH' && pathname.startsWith('/api/turnos/')) {
    const id = pathname.replace('/api/turnos/', '');
    try {
      const body = await parseJsonBody(req);
      const newStatus = body.status;
      const cancelReason = body.cancelReason || '';
      const cancelledBy = body.cancelledBy || 'client';
      const reqOrigin = req.headers.origin || `http://${req.headers.host || `localhost:${port}`}`;

      if (!newStatus) {
        return sendJson(res, 400, { error: 'Se requiere el campo status.' });
      }

      if (supabase) {
        // Leer estado previo y datos completos (incluyendo nombre del servicio) antes de actualizar
        let prevRow = null;
        try {
          const prevRes = await supabase
            .from('appointments')
            .select('*, services(name)')
            .eq('id', id)
            .maybeSingle();
          if (prevRes.data) prevRow = prevRes.data;
        } catch (e) {}

        let { data, error } = await supabase
          .from('appointments')
          .update({
            status: newStatus,
            ...(newStatus === 'confirmed' ? { payment_status: 'partial' } : {}),
            ...(newStatus === 'cancelled' && cancelReason ? { internal_notes: cancelReason } : {})
          })
          .eq('id', id)
          .select('*, services(name)');

        if (error) {
          const fallbackUpd = await supabase
            .from('appointments')
            .update({ status: newStatus })
            .eq('id', id)
            .select('*');
          data = fallbackUpd.data;
          error = fallbackUpd.error;
        }

        if (!error && data && data.length > 0) {
          const updatedRow = data[0];
          let emailNotification = { skipped: true };
          if (newStatus === 'cancelled' && (!prevRow || prevRow.status !== 'cancelled') && updatedRow.client_email) {
            emailNotification = await mailer.sendAppointmentEmail({
              supabase,
              type: 'cancellation',
              appointment: updatedRow,
              baseUrl: reqOrigin,
              extra: { cancelReason, cancelledBy }
            });
          }
          return sendJson(res, 200, { success: true, appointment: updatedRow, emailNotification });
        }
      }

      const found = localDatabase.appointments.find(a => a.id === id);
      if (found) {
        const wasCancelled = found.status === 'cancelled';
        found.status = newStatus;
        let emailNotification = { skipped: true };
        if (newStatus === 'cancelled' && !wasCancelled && found.client_email) {
          emailNotification = await mailer.sendAppointmentEmail({
            supabase,
            type: 'cancellation',
            appointment: found,
            baseUrl: reqOrigin,
            extra: { cancelReason, cancelledBy }
          });
        }
        return sendJson(res, 200, { success: true, appointment: found, emailNotification });
      }

      return sendJson(res, 404, { error: 'Turno no encontrado.' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7a. DELETE /api/turnos/cancelled (Eliminar todos los turnos cancelados en bloque)
  if (req.method === 'DELETE' && (pathname === '/api/turnos/cancelled' || (pathname === '/api/turnos' && queryParams.get('status') === 'cancelled'))) {
    try {
      let deletedCount = 0;
      if (supabase) {
        const { data, error } = await supabase
          .from('appointments')
          .delete()
          .eq('status', 'cancelled')
          .select('id');
        if (!error && Array.isArray(data)) {
          deletedCount = data.length;
        }
      }
      const beforeCount = localDatabase.appointments.length;
      localDatabase.appointments = localDatabase.appointments.filter(a => a.status !== 'cancelled');
      const localRemoved = beforeCount - localDatabase.appointments.length;
      return sendJson(res, 200, {
        success: true,
        deletedCount: Math.max(deletedCount, localRemoved)
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7a-2. DELETE /api/turnos/:id (Eliminar un turno específico de forma permanente)
  if (req.method === 'DELETE' && /^\/api\/turnos\/[^/]+$/.test(pathname) && pathname !== '/api/turnos/cancelled') {
    const id = decodeURIComponent(pathname.replace('/api/turnos/', ''));
    try {
      let deletedFromDb = false;
      if (supabase) {
        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', id);
        if (!error) {
          deletedFromDb = true;
        }
      }
      const beforeCount = localDatabase.appointments.length;
      localDatabase.appointments = localDatabase.appointments.filter(a => a.id !== id && a.supabaseId !== id);
      const deletedLocal = localDatabase.appointments.length < beforeCount;

      return sendJson(res, 200, {
        success: true,
        id,
        deleted: deletedFromDb || deletedLocal
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7b. POST /api/turnos/:id/resend-email (Reenviar email personalizado de reserva o cancelación)
  if (req.method === 'POST' && /^\/api\/turnos\/[^/]+\/resend-email$/.test(pathname)) {
    const id = pathname.split('/')[3];
    try {
      const body = await parseJsonBody(req);
      const reqOrigin = req.headers.origin || `http://${req.headers.host || `localhost:${port}`}`;

      let targetRow = null;
      if (supabase) {
        const { data } = await supabase
          .from('appointments')
          .select('*, services(name)')
          .eq('id', id)
          .maybeSingle();
        if (data) targetRow = data;
      }
      if (!targetRow) {
        targetRow = localDatabase.appointments.find(a => a.id === id) || null;
      }
      if (!targetRow) {
        return sendJson(res, 404, { error: 'Turno no encontrado.' });
      }
      if (!targetRow.client_email) {
        return sendJson(res, 400, { error: 'Este turno no tiene un correo electrónico asociado.' });
      }

      const emailType = body.type || (targetRow.status === 'cancelled' ? 'cancellation' : 'booking');
      const emailNotification = await mailer.sendAppointmentEmail({
        supabase,
        type: emailType,
        appointment: targetRow,
        baseUrl: reqOrigin,
        extra: { forceSend: true, cancelReason: targetRow.internal_notes || targetRow.admin_notes || '' }
      });

      return sendJson(res, 200, { success: true, emailNotification });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 8. POST /api/courses/enroll (Inscripción a cursos)
  if (req.method === 'POST' && pathname === '/api/courses/enroll') {
    try {
      const body = await parseJsonBody(req);
      const { courseId, studentName, studentPhone, studentEmail, notes } = body;

      if (!studentName || !studentPhone || !studentEmail) {
        return sendJson(res, 400, { error: 'Faltan datos de la alumna.' });
      }

      if (supabase) {
        const { data, error } = await supabase
          .from('course_enrollments')
          .insert({
            course_id: courseId || '33333333-3333-3333-3333-333333333301',
            student_name: studentName,
            student_phone: studentPhone,
            student_email: studentEmail,
            notes: notes || null
          })
          .select()
          .single();

        if (!error && data) {
          return sendJson(res, 201, { success: true, enrollment: data });
        }
      }

      const localEnrollment = {
        id: 'enr_' + Date.now(),
        course_id: courseId,
        student_name: studentName,
        student_phone: studentPhone,
        student_email: studentEmail,
        created_at: new Date().toISOString()
      };
      localDatabase.enrollments.push(localEnrollment);
      return sendJson(res, 201, { success: true, enrollment: localEnrollment });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 9. GET /api/gallery (Listado de fotos de ejemplo para la web)
  if (req.method === 'GET' && pathname === '/api/gallery') {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('gallery_photos')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          const mapped = data.map(row => ({
            id: row.id,
            title: row.title,
            badge: row.badge,
            category: row.category,
            description: row.description,
            imageUrl: row.image_url,
            isFeatured: row.is_featured,
            isHero: row.is_hero,
            sortOrder: row.sort_order
          }));
          return sendJson(res, 200, { photos: mapped });
        }
      } catch (e) {
        console.warn('[Supabase] Error consultando gallery_photos:', e.message);
      }
    }
    // Asegurar que siempre hay datos cargados
    if (!localDatabase.gallery || localDatabase.gallery.length === 0) {
      localDatabase.gallery = loadGalleryData();
    }
    return sendJson(res, 200, { photos: localDatabase.gallery });
  }

  // 9b. POST /api/receipts/upload (Comprobante de seña -> bucket privado 'receipts')
  if (req.method === 'POST' && pathname === '/api/receipts/upload') {
    try {
      const body = await parseJsonBody(req);
      if (!body.data || !body.path) {
        return sendJson(res, 400, { error: 'Faltan datos del comprobante.' });
      }
      const safePath = String(body.path).replace(/[^a-zA-Z0-9/_.-]/g, '').replace(/\.\.+/g, '.').replace(/^\/+/, '');
      const contentType = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(body.contentType || '')
        ? body.contentType
        : 'image/jpeg';
      const buffer = Buffer.from(String(body.data).replace(/^data:[^;]+;base64,/, ''), 'base64');

      if (supabase) {
        await supabase.storage.createBucket('receipts', { public: false, fileSizeLimit: 8 * 1024 * 1024 }).catch(() => {});
        const { error } = await supabase.storage.from('receipts').upload(safePath, buffer, { contentType, upsert: false });
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 201, { success: true, path: safePath });
      }

      // Sin Supabase: guardar localmente
      const localDir = path.join(dir, 'receipts', path.dirname(safePath));
      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'receipts', safePath), buffer);
      return sendJson(res, 201, { success: true, path: safePath });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 9c. GET /api/receipts/signed?path= (URL temporal para que la admin vea el comprobante)
  if (req.method === 'GET' && pathname === '/api/receipts/signed') {
    const receiptPath = queryParams.get('path');
    if (!receiptPath) return sendJson(res, 400, { error: 'Falta path.' });
    if (!supabase) return sendJson(res, 404, { error: 'Supabase no configurado.' });
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(receiptPath, 3600);
    if (error || !data) return sendJson(res, 404, { error: error ? error.message : 'No encontrado' });
    return sendJson(res, 200, { url: data.signedUrl });
  }

  // 10. POST /api/gallery/upload (Subir archivo de imagen a Supabase Storage + respaldo local)
  if (req.method === 'POST' && pathname === '/api/gallery/upload') {
    try {
      const body = await parseJsonBody(req);
      if (!body.data) {
        return sendJson(res, 400, { error: 'Falta la imagen codificada en Base64 (body.data).' });
      }

      const uploadsDir = path.join(dir, 'images', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const mimeMatch = String(body.data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
      const detectedMime = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';
      const rawBase64 = String(body.data).replace(/^data:image\/[^;]+;base64,/, '');
      const buffer = Buffer.from(rawBase64, 'base64');

      let ext = '.jpg';
      if (detectedMime === 'image/png') ext = '.png';
      else if (detectedMime === 'image/webp') ext = '.webp';
      else if (detectedMime === 'image/gif') ext = '.gif';
      else if (body.filename) {
        const parsedExt = path.extname(body.filename).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(parsedExt)) {
          ext = parsedExt;
        }
      }

      const contentTypeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };
      const contentType = contentTypeMap[ext] || 'image/jpeg';

      const origBase = body.filename ? path.basename(body.filename, path.extname(body.filename)) : 'foto';
      const safeBase = (origBase || 'foto')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40) || 'foto';
      const filename = `ej-${Date.now()}-${safeBase}${ext}`;
      const targetPath = path.join(uploadsDir, filename);

      // Respaldo local en images/uploads/
      fs.writeFileSync(targetPath, buffer);
      const localUrl = `images/uploads/${filename}`;
      let finalUrl = localUrl;
      let storageMode = 'local';

      // Subir a Supabase Storage (URL pública permanente en CDN)
      if (supabase) {
        try {
          const bucketOk = await ensureGalleryBucket();
          if (bucketOk) {
            const { error: upErr } = await supabase.storage
              .from('gallery')
              .upload(filename, buffer, {
                contentType,
                cacheControl: '31536000',
                upsert: true
              });

            if (!upErr) {
              const { data: pubData } = supabase.storage.from('gallery').getPublicUrl(filename);
              if (pubData && pubData.publicUrl) {
                finalUrl = pubData.publicUrl;
                storageMode = 'supabase';
              }
            } else {
              console.warn('[Storage] Aviso al subir imagen a Supabase:', upErr.message);
            }
          }
        } catch (storageErr) {
          console.warn('[Storage] Excepción subiendo imagen:', storageErr.message);
        }
      }

      return sendJson(res, 201, {
        success: true,
        url: finalUrl,
        localUrl,
        storage: storageMode,
        filename
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 11. POST /api/gallery (Crear nueva foto de ejemplo)
  if (req.method === 'POST' && pathname === '/api/gallery') {
    try {
      const body = await parseJsonBody(req);
      const { title, badge, category, description, imageUrl, isFeatured, isHero, sortOrder } = body;

      if (!title || !imageUrl) {
        return sendJson(res, 400, { error: 'Título e imagen son obligatorios.' });
      }

      let created = null;

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('gallery_photos')
            .insert({
              title,
              badge: badge || 'Look Más Pedido',
              category: category || 'volumen',
              description: description || '',
              image_url: imageUrl,
              is_featured: !!isFeatured,
              is_hero: !!isHero,
              sort_order: sortOrder || (localDatabase.gallery.length + 1)
            })
            .select()
            .single();

          if (!error && data) {
            created = {
              id: data.id,
              title: data.title,
              badge: data.badge,
              category: data.category,
              description: data.description,
              imageUrl: data.image_url,
              isFeatured: data.is_featured,
              isHero: data.is_hero,
              sortOrder: data.sort_order
            };
          }
        } catch (e) {
          console.warn('[Supabase] Error insertando en gallery_photos:', e.message);
        }
      }

      if (!created) {
        created = {
          id: 'photo_' + Date.now(),
          title,
          badge: badge || 'Look Más Pedido',
          category: category || 'volumen',
          description: description || '',
          imageUrl,
          isFeatured: !!isFeatured,
          isHero: !!isHero,
          sortOrder: sortOrder || (localDatabase.gallery.length + 1)
        };
      }

      localDatabase.gallery.push(created);
      saveGalleryData(localDatabase.gallery);

      return sendJson(res, 201, { success: true, photo: created });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 12. PUT /api/gallery/:id (Actualizar foto de ejemplo existente)
  if ((req.method === 'PUT' || req.method === 'PATCH') && pathname.startsWith('/api/gallery/')) {
    const id = pathname.replace('/api/gallery/', '');
    try {
      const body = await parseJsonBody(req);
      let updated = null;

      if (supabase) {
        try {
          const updateObj = {};
          if (body.title !== undefined) updateObj.title = body.title;
          if (body.badge !== undefined) updateObj.badge = body.badge;
          if (body.category !== undefined) updateObj.category = body.category;
          if (body.description !== undefined) updateObj.description = body.description;
          if (body.imageUrl !== undefined) updateObj.image_url = body.imageUrl;
          if (body.isFeatured !== undefined) updateObj.is_featured = body.isFeatured;
          if (body.isHero !== undefined) updateObj.is_hero = body.isHero;
          if (body.sortOrder !== undefined) updateObj.sort_order = body.sortOrder;

          const { data, error } = await supabase
            .from('gallery_photos')
            .update(updateObj)
            .eq('id', id)
            .select();

          if (!error && data && data.length > 0) {
            const row = data[0];
            updated = {
              id: row.id,
              title: row.title,
              badge: row.badge,
              category: row.category,
              description: row.description,
              imageUrl: row.image_url,
              isFeatured: row.is_featured,
              isHero: row.is_hero,
              sortOrder: row.sort_order
            };
          }
        } catch (e) {
          console.warn('[Supabase] Error actualizando gallery_photos:', e.message);
        }
      }

      const idx = localDatabase.gallery.findIndex(p => p.id === id);
      if (idx !== -1) {
        localDatabase.gallery[idx] = {
          ...localDatabase.gallery[idx],
          ...body,
          id // garantizar id constante
        };
        saveGalleryData(localDatabase.gallery);
        if (!updated) updated = localDatabase.gallery[idx];
      }

      if (updated) {
        return sendJson(res, 200, { success: true, photo: updated });
      }

      return sendJson(res, 404, { error: 'Foto de ejemplo no encontrada' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 13. DELETE /api/gallery/:id (Eliminar foto de ejemplo)
  if (req.method === 'DELETE' && pathname.startsWith('/api/gallery/')) {
    const id = pathname.replace('/api/gallery/', '');
    try {
      if (supabase) {
        try {
          await supabase.from('gallery_photos').delete().eq('id', id);
        } catch (e) {
          console.warn('[Supabase] Error borrando de gallery_photos:', e.message);
        }
      }

      localDatabase.gallery = localDatabase.gallery.filter(p => p.id !== id);
      saveGalleryData(localDatabase.gallery);

      return sendJson(res, 200, { success: true, id });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 14. POST /api/gallery/reset (Restablecer a las 6 fotos originales)
  if (req.method === 'POST' && pathname === '/api/gallery/reset') {
    try {
      const defaultPhotos = [
        {
          id: "44444444-4444-4444-4444-444444444401",
          title: "Volumen Híbrido Glam",
          badge: "★ Look Más Pedido",
          category: "volumen",
          description: "Densidad suave, textura esponjosa y abanicos ultralivianos realizados a medida de la mirada.",
          imageUrl: "images/ej-volumen-hibrido.jpg",
          isFeatured: true,
          isHero: true,
          sortOrder: 1
        },
        {
          id: "44444444-4444-4444-4444-444444444402",
          title: "Lifting de Pestañas & Nutrición Botox",
          badge: "🌿 100% Pestaña Natural",
          category: "lifting",
          description: "Elevación desde la raíz de la pestaña natural, nutrición profunda con botox y tinte negro azabache.",
          imageUrl: "images/ej-lifting-botox.jpg",
          isFeatured: true,
          isHero: true,
          sortOrder: 2
        },
        {
          id: "44444444-4444-4444-4444-444444444403",
          title: "Laminado & Perfilado de Cejas HD",
          badge: "✨ Antes & Después HD",
          category: "cejas",
          description: "Antes y después real. Direccionamiento folicular orgánico, perfilado con pinza y nutrición.",
          imageUrl: "images/ej-laminado-cejas.jpg",
          isFeatured: false,
          isHero: false,
          sortOrder: 3
        },
        {
          id: "44444444-4444-4444-4444-444444444404",
          title: "Comparativa Real en Camilla",
          badge: "👁️ Comparativa en Directo",
          category: "comparativa",
          description: "Impacto visual directo: ojo con pestaña aplicada vs ojo natural sin intervenir. Resalta la luminosidad y apertura de la mirada.",
          imageUrl: "images/ej-comparativa-real.jpg",
          isFeatured: true,
          isHero: true,
          sortOrder: 4
        },
        {
          id: "44444444-4444-4444-4444-444444444405",
          title: "Mega Volumen Ruso 3D-5D",
          badge: "🔥 Máxima Densidad",
          category: "volumen",
          description: "Máxima densidad aterciopelada con abanicos hechos a mano. Cero peso sobre la raíz.",
          imageUrl: "images/ej-volumen-ruso.jpg",
          isFeatured: true,
          isHero: true,
          sortOrder: 5
        },
        {
          id: "44444444-4444-4444-4444-444444444406",
          title: "Aislación Milimétrica & Curvatura",
          badge: "🔬 Técnica de Precisión",
          category: "clasicas",
          description: "Vista de perfil de alta definición. Curvatura uniforme, raíz limpia sin exceso de adhesivo y separación perfecta.",
          imageUrl: "images/ej-perfil-curvatura.jpg",
          isFeatured: false,
          isHero: false,
          sortOrder: 6
        }
      ];

      if (supabase) {
        try {
          const defaultIds = defaultPhotos.map(p => p.id);
          await supabase.from('gallery_photos').delete().not('id', 'in', `(${defaultIds.join(',')})`);
          const rows = defaultPhotos.map(p => ({
            id: p.id,
            title: p.title,
            badge: p.badge,
            category: p.category,
            description: p.description,
            image_url: p.imageUrl,
            is_featured: p.isFeatured,
            is_hero: p.isHero,
            sort_order: p.sortOrder
          }));
          await supabase.from('gallery_photos').upsert(rows, { onConflict: 'id' });
        } catch (e) {
          console.warn('[Supabase] Error restableciendo gallery_photos:', e.message);
        }
      }

      localDatabase.gallery = defaultPhotos;
      saveGalleryData(defaultPhotos);

      return sendJson(res, 200, { success: true, photos: defaultPhotos });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 15. GET /api/schedule (Horarios semanales de trabajo)
  if (req.method === 'GET' && pathname === '/api/schedule') {
    const profId = '11111111-1111-1111-1111-111111111111';
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('weekly_schedule')
          .select('*')
          .eq('professional_id', profId)
          .order('day_of_week', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          return sendJson(res, 200, { schedule: data });
        }
      } catch (e) {
        console.warn('[Supabase] Error consultando weekly_schedule:', e.message);
      }
    }

    const fallbackSchedule = [1, 2, 3, 4, 5, 6].map(d => ({
      professional_id: profId,
      day_of_week: d,
      start_time: '10:00:00',
      end_time: d === 6 ? '18:00:00' : '19:00:00',
      break_start: '13:00:00',
      break_end: '14:00:00',
      slot_duration_min: 60,
      is_active: true
    }));
    return sendJson(res, 200, { schedule: localDatabase.schedule || fallbackSchedule });
  }

  // 16. PUT /api/schedule (Guardar horarios semanales de trabajo)
  if (req.method === 'PUT' && pathname === '/api/schedule') {
    try {
      const body = await parseJsonBody(req);
      const days = Array.isArray(body.days) ? body.days : [];
      const profId = '11111111-1111-1111-1111-111111111111';

      const rows = days.map(item => ({
        professional_id: profId,
        day_of_week: Number(item.day_of_week),
        is_active: !!item.is_active,
        start_time: (item.start_time || '10:00').slice(0, 5) + ':00',
        end_time: (item.end_time || '19:00').slice(0, 5) + ':00',
        break_start: item.break_start ? item.break_start.slice(0, 5) + ':00' : null,
        break_end: item.break_end ? item.break_end.slice(0, 5) + ':00' : null,
        slot_duration_min: Number(item.slot_duration_min) || 60
      }));

      localDatabase.schedule = rows;

      if (supabase && rows.length > 0) {
        const { error } = await supabase
          .from('weekly_schedule')
          .upsert(rows, { onConflict: 'professional_id,day_of_week' });
        if (error) {
          console.warn('[Supabase] Error guardando weekly_schedule:', error.message);
          return sendJson(res, 500, { error: error.message });
        }
      }

      return sendJson(res, 200, { success: true, schedule: rows });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 17. GET /api/instagram/slots?date=YYYY-MM-DD&interval=60 (Horarios para Historia de Instagram estilo Vasca)
  if (req.method === 'GET' && pathname === '/api/instagram/slots') {
    const dateValue = queryParams.get('date');
    const intervalParam = queryParams.get('interval') || '60';
    if (!dateValue) {
      return sendJson(res, 400, { error: 'Se requiere ?date=YYYY-MM-DD' });
    }

    const timeToMin = (t) => {
      if (!t) return 0;
      const [hh, mm] = String(t).split(':').map(Number);
      return (hh || 0) * 60 + (mm || 0);
    };
    const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    const profId = '11111111-1111-1111-1111-111111111111';
    const dayOfWeek = new Date(`${dateValue}T12:00:00`).getDay();

    let schedRow = null;
    let bookedAppts = [];
    let isBlocked = false;

    if (supabase) {
      try {
        const [schedRes, apptRes, blockRes] = await Promise.all([
          supabase.from('weekly_schedule').select('*').eq('professional_id', profId).eq('day_of_week', dayOfWeek).maybeSingle(),
          supabase.from('appointments').select('start_time,end_time').eq('appointment_date', dateValue).neq('status', 'cancelled'),
          supabase.from('blocked_dates').select('id').eq('blocked_date', dateValue)
        ]);

        if (blockRes.data && blockRes.data.length > 0) {
          isBlocked = true;
        }
        if (schedRes.data) {
          schedRow = schedRes.data;
        }
        if (Array.isArray(apptRes.data)) {
          bookedAppts = apptRes.data;
        }
      } catch (e) {
        console.warn('[Supabase] Error en /api/instagram/slots:', e.message);
      }
    } else {
      bookedAppts = localDatabase.appointments
        .filter(a => (a.appointment_date === dateValue || a.date === dateValue) && a.status !== 'cancelled')
        .map(a => ({ start_time: a.start_time || a.time, end_time: a.end_time || a.endTime || '11:30' }));
    }

    const forceGenerate = queryParams.get('forceGenerate') === '1' || queryParams.get('forceGenerate') === 'true';
    const pubMap = await getPublishedSchedulesMap();
    const publishedDay = pubMap.days && pubMap.days[dateValue];
    const crossedByTime = {};
    if (publishedDay && Array.isArray(publishedDay.slots)) {
      publishedDay.slots.forEach(s => {
        if (s && s.time) crossedByTime[String(s.time).slice(0, 5)] = !!s.crossedOut;
      });
    }

    if (!forceGenerate && publishedDay && publishedDay.published !== false && Array.isArray(publishedDay.slots) && publishedDay.slots.length > 0) {
      const mergedSlots = publishedDay.slots.map(s => {
        const t = String(s.time || '').slice(0, 5);
        const autoBooked = isTimeOverlappingBooked(t, bookedAppts, 60);
        const crossedOut = !!s.crossedOut;
        return {
          time: t,
          crossedOut,
          autoBooked,
          isBooked: crossedOut || autoBooked
        };
      });
      return sendJson(res, 200, {
        slots: mergedSlots,
        isPublished: true,
        updatedAt: publishedDay.updatedAt || null,
        isBlocked: false,
        noSchedule: false
      });
    }

    if (isBlocked) {
      return sendJson(res, 200, { slots: [], isPublished: false, isBlocked: true, noSchedule: false });
    }

    if (!schedRow) {
      if (dayOfWeek === 0) {
        return sendJson(res, 200, { slots: [], isPublished: false, isBlocked: false, noSchedule: true });
      }
      schedRow = {
        is_active: true,
        start_time: '10:00:00',
        end_time: dayOfWeek === 6 ? '18:00:00' : '19:00:00',
        break_start: '13:00:00',
        break_end: '14:00:00'
      };
    }

    if (!schedRow.is_active) {
      return sendJson(res, 200, { slots: [], isPublished: false, isBlocked: false, noSchedule: true });
    }

    const slots = [];
    if (intervalParam === 'studio') {
      const studioTimes = ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];
      const endMin = timeToMin(schedRow.end_time);
      for (const t of studioTimes) {
        const sStart = timeToMin(t);
        if (sStart >= endMin) continue;
        const sEnd = sStart + 90;
        const autoBooked = bookedAppts.some(appt => {
          const aStart = timeToMin(appt.start_time);
          const aEnd = appt.end_time ? timeToMin(appt.end_time) : aStart + 90;
          return sStart < aEnd && sEnd > aStart;
        });
        const crossedOut = !!crossedByTime[t];
        slots.push({ time: t, crossedOut, autoBooked, isBooked: crossedOut || autoBooked });
      }
    } else {
      const duration = Math.max(30, parseInt(intervalParam, 10) || 60);
      let current = timeToMin(schedRow.start_time);
      const end = timeToMin(schedRow.end_time);
      const breakStart = schedRow.break_start ? timeToMin(schedRow.break_start) : null;
      const breakEnd = schedRow.break_end ? timeToMin(schedRow.break_end) : null;

      while (current + duration <= end) {
        const slotStart = current;
        const slotEnd = current + duration;

        if (breakStart !== null && breakEnd !== null && slotStart < breakEnd && slotEnd > breakStart) {
          current = breakEnd;
          continue;
        }

        const timeStr = minToTime(slotStart);
        const autoBooked = bookedAppts.some(appt => {
          const apptStart = timeToMin(appt.start_time);
          const apptEnd = appt.end_time ? timeToMin(appt.end_time) : apptStart + duration;
          return slotStart < apptEnd && slotEnd > apptStart;
        });
        const crossedOut = !!crossedByTime[timeStr];

        slots.push({ time: timeStr, crossedOut, autoBooked, isBooked: crossedOut || autoBooked });
        current += duration;
      }
    }

    return sendJson(res, 200, { slots, isPublished: Boolean(publishedDay && publishedDay.published !== false), isBlocked: false, noSchedule: false });
  }

  // 18. GET /api/published-schedules (Consultar horarios subidos por el admin para web pública y panel)
  if (req.method === 'GET' && pathname === '/api/published-schedules') {
    const singleDate = queryParams.get('date');
    const onlyUpcoming = queryParams.get('upcoming') !== 'false';
    const pubMap = await getPublishedSchedulesMap();
    const allDaysObj = pubMap.days || {};

    if (singleDate) {
      const dayEntry = allDaysObj[singleDate];
      if (!dayEntry || dayEntry.published === false) {
        return sendJson(res, 200, { date: singleDate, isPublished: false, slots: [] });
      }
      const bookedAppts = await getBookedTimesForDate(singleDate);
      const enrichedSlots = (dayEntry.slots || []).map(s => {
        const t = String(s.time || '').slice(0, 5);
        const autoBooked = isTimeOverlappingBooked(t, bookedAppts, 60);
        const crossedOut = !!s.crossedOut;
        return { time: t, crossedOut, autoBooked, isBooked: crossedOut || autoBooked };
      });
      return sendJson(res, 200, {
        date: singleDate,
        isPublished: true,
        updatedAt: dayEntry.updatedAt || null,
        slots: enrichedSlots
      });
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const datesList = Object.keys(allDaysObj)
      .filter(d => allDaysObj[d] && allDaysObj[d].published !== false && Array.isArray(allDaysObj[d].slots) && allDaysObj[d].slots.length > 0)
      .filter(d => !onlyUpcoming || d >= todayStr)
      .sort();

    let apptsByDate = {};
    if (datesList.length > 0) {
      if (supabase) {
        try {
          const { data } = await supabase
            .from('appointments')
            .select('appointment_date,start_time,end_time')
            .in('appointment_date', datesList)
            .neq('status', 'cancelled');
          if (Array.isArray(data)) {
            data.forEach(r => {
              if (!apptsByDate[r.appointment_date]) apptsByDate[r.appointment_date] = [];
              apptsByDate[r.appointment_date].push(r);
            });
          }
        } catch (e) {}
      } else {
        localDatabase.appointments.forEach(a => {
          const d = a.appointment_date || a.date;
          if (datesList.includes(d) && a.status !== 'cancelled') {
            if (!apptsByDate[d]) apptsByDate[d] = [];
            apptsByDate[d].push({ start_time: a.start_time || a.time, end_time: a.end_time || a.endTime || '' });
          }
        });
      }
    }

    const daysResult = datesList.map(d => {
      const entry = allDaysObj[d];
      const dayBooked = apptsByDate[d] || [];
      const slots = (entry.slots || []).map(s => {
        const t = String(s.time || '').slice(0, 5);
        const autoBooked = isTimeOverlappingBooked(t, dayBooked, 60);
        const crossedOut = !!s.crossedOut;
        return { time: t, crossedOut, autoBooked, isBooked: crossedOut || autoBooked };
      });
      return {
        date: d,
        isPublished: true,
        updatedAt: entry.updatedAt || null,
        slots
      };
    });

    return sendJson(res, 200, { days: daysResult });
  }

  // 19. PUT /api/published-schedules (Subir / publicar horarios de un día desde Admin)
  if (req.method === 'PUT' && pathname === '/api/published-schedules') {
    try {
      const body = await parseJsonBody(req);
      const date = body.date;
      const rawSlots = Array.isArray(body.slots) ? body.slots : [];

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return sendJson(res, 400, { error: 'Fecha inválida (formato requerido YYYY-MM-DD).' });
      }

      const seen = new Set();
      const normalizedSlots = [];
      rawSlots.forEach(item => {
        const time = String(typeof item === 'string' ? item : (item.time || '')).trim().slice(0, 5);
        if (/^\d{2}:\d{2}$/.test(time) && !seen.has(time)) {
          seen.add(time);
          normalizedSlots.push({
            time,
            crossedOut: Boolean(item && item.crossedOut)
          });
        }
      });

      normalizedSlots.sort((a, b) => a.time.localeCompare(b.time));

      const pubMap = await getPublishedSchedulesMap();
      if (!pubMap.days) pubMap.days = {};

      pubMap.days[date] = {
        date,
        published: true,
        updatedAt: new Date().toISOString(),
        slots: normalizedSlots
      };

      await savePublishedSchedulesMap(pubMap);

      const bookedAppts = await getBookedTimesForDate(date);
      const enrichedSlots = normalizedSlots.map(s => {
        const autoBooked = isTimeOverlappingBooked(s.time, bookedAppts, 60);
        return {
          time: s.time,
          crossedOut: s.crossedOut,
          autoBooked,
          isBooked: s.crossedOut || autoBooked
        };
      });

      return sendJson(res, 200, {
        success: true,
        date,
        isPublished: true,
        updatedAt: pubMap.days[date].updatedAt,
        slots: enrichedSlots
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 20. PATCH /api/published-schedules/toggle (Tachar o habilitar un horario en tiempo real)
  if (req.method === 'PATCH' && pathname === '/api/published-schedules/toggle') {
    try {
      const body = await parseJsonBody(req);
      const { date, time, crossedOut, fallbackSlots } = body;
      const cleanTime = String(time || '').trim().slice(0, 5);

      if (!date || !/^\d{2}:\d{2}$/.test(cleanTime)) {
        return sendJson(res, 400, { error: 'Se requieren date (YYYY-MM-DD) y time (HH:MM).' });
      }

      const pubMap = await getPublishedSchedulesMap();
      if (!pubMap.days) pubMap.days = {};

      if (!pubMap.days[date] || !Array.isArray(pubMap.days[date].slots) || pubMap.days[date].slots.length === 0) {
        const baseList = Array.isArray(fallbackSlots) && fallbackSlots.length > 0
          ? fallbackSlots.map(s => ({
              time: String(s.time || s).slice(0, 5),
              crossedOut: Boolean(s.crossedOut)
            }))
          : [{ time: cleanTime, crossedOut: false }];
        pubMap.days[date] = {
          date,
          published: true,
          updatedAt: new Date().toISOString(),
          slots: baseList
        };
      }

      const targetDay = pubMap.days[date];
      const existingSlot = targetDay.slots.find(s => s.time === cleanTime);
      if (existingSlot) {
        existingSlot.crossedOut = typeof crossedOut === 'boolean' ? crossedOut : !existingSlot.crossedOut;
      } else {
        targetDay.slots.push({
          time: cleanTime,
          crossedOut: typeof crossedOut === 'boolean' ? crossedOut : true
        });
        targetDay.slots.sort((a, b) => a.time.localeCompare(b.time));
      }
      targetDay.published = true;
      targetDay.updatedAt = new Date().toISOString();

      await savePublishedSchedulesMap(pubMap);

      const bookedAppts = await getBookedTimesForDate(date);
      const enrichedSlots = targetDay.slots.map(s => {
        const autoBooked = isTimeOverlappingBooked(s.time, bookedAppts, 60);
        return {
          time: s.time,
          crossedOut: !!s.crossedOut,
          autoBooked,
          isBooked: !!s.crossedOut || autoBooked
        };
      });

      return sendJson(res, 200, {
        success: true,
        date,
        isPublished: true,
        updatedAt: targetDay.updatedAt,
        slots: enrichedSlots
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 21. DELETE /api/published-schedules?date=YYYY-MM-DD (Quitar horarios publicados de un día)
  if (req.method === 'DELETE' && pathname === '/api/published-schedules') {
    try {
      const date = queryParams.get('date');
      if (!date) {
        return sendJson(res, 400, { error: 'Se requiere ?date=YYYY-MM-DD' });
      }
      const pubMap = await getPublishedSchedulesMap();
      if (pubMap.days && pubMap.days[date]) {
        delete pubMap.days[date];
        await savePublishedSchedulesMap(pubMap);
      }
      return sendJson(res, 200, { success: true, date });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 22. GET /api/email/settings (Plantillas personalizadas, estado EmailJS/SMTP/Resend e historial reciente)
  if (req.method === 'GET' && pathname === '/api/email/settings') {
    try {
      const templates = await mailer.getEmailTemplates(supabase);
      const provider = mailer.getProviderStatus(templates);
      const logs = mailer.loadEmailLogs().slice(0, 20);
      return sendJson(res, 200, { templates, provider, logs });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 23. PUT /api/email/templates (Guardar textos personalizados de reserva y cancelación)
  if (req.method === 'PUT' && pathname === '/api/email/templates') {
    try {
      const body = await parseJsonBody(req);
      const current = await mailer.getEmailTemplates(supabase);
      const incoming = body.templates || body;
      const templates = await mailer.saveEmailTemplates(supabase, {
        ...current,
        ...incoming,
        emailjs: { ...(current.emailjs || {}), ...(incoming.emailjs || {}) }
      });
      return sendJson(res, 200, { success: true, templates });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 24. PUT /api/email/provider (Configurar EmailJS 24/7 para GitHub Pages y/o credenciales SMTP en .env local)
  if (req.method === 'PUT' && pathname === '/api/email/provider') {
    try {
      const body = await parseJsonBody(req);
      const current = await mailer.getEmailTemplates(supabase);
      const updatedEmailJs = {
        ...(current.emailjs || {}),
        ...(body.emailjsPublicKey !== undefined ? { publicKey: String(body.emailjsPublicKey || '').trim() } : {}),
        ...(body.emailjsServiceId !== undefined ? { serviceId: String(body.emailjsServiceId || '').trim() } : {}),
        ...(body.emailjsTemplateId !== undefined ? { templateId: String(body.emailjsTemplateId || '').trim() } : {}),
        ...(body.senderName !== undefined ? { senderName: String(body.senderName || 'Mica Lashes').trim() } : {}),
        ...(body.replyTo !== undefined ? { replyTo: String(body.replyTo || 'micalashes.estudio@gmail.com').trim() } : {}),
        ...(body.adminEmail !== undefined ? { adminEmail: String(body.adminEmail || 'micalashes.estudio@gmail.com').trim() } : {})
      };
      const savedTemplates = await mailer.saveEmailTemplates(supabase, {
        ...current,
        emailjs: updatedEmailJs
      });
      mailer.updateEmailEnvConfig({
        SMTP_HOST: body.smtpHost,
        SMTP_PORT: body.smtpPort,
        SMTP_USER: body.smtpUser || body.replyTo,
        SMTP_PASS: body.smtpPass,
        EMAIL_FROM: body.emailFrom,
        ADMIN_EMAIL: body.adminEmail,
        RESEND_API_KEY: body.resendApiKey,
        EMAILJS_PUBLIC_KEY: body.emailjsPublicKey,
        EMAILJS_SERVICE_ID: body.emailjsServiceId,
        EMAILJS_TEMPLATE_ID: body.emailjsTemplateId
      });
      const provider = mailer.getProviderStatus(savedTemplates);
      return sendJson(res, 200, { success: true, provider, templates: savedTemplates });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 25. POST /api/email/preview (Renderizar vista previa HTML en vivo con datos de ejemplo)
  if (req.method === 'POST' && pathname === '/api/email/preview') {
    try {
      const body = await parseJsonBody(req);
      const type = body.type === 'cancellation' ? 'cancellation' : 'booking';
      const currentTemplates = await mailer.getEmailTemplates(supabase);
      const mergedTemplates = body.templates ? {
        ...currentTemplates,
        ...body.templates,
        booking: { ...currentTemplates.booking, ...(body.templates.booking || {}) },
        cancellation: { ...currentTemplates.cancellation, ...(body.templates.cancellation || {}) }
      } : currentTemplates;

      const sampleAppt = {
        clientName: 'Valentina Gómez',
        serviceName: 'Volumen Híbrido Glam',
        date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
        time: '15:30',
        endTime: '17:30',
        price: 34000,
        clientEmail: 'valentina@ejemplo.com',
        clientNotes: 'Primera vez en el estudio ✨'
      };
      const reqOrigin = req.headers.origin || `http://${req.headers.host || `localhost:${port}`}`;
      const vars = mailer.buildAppointmentVars(sampleAppt, mergedTemplates, {
        cancelReason: type === 'cancellation' ? 'Reprogramación solicitada con anticipación.' : ''
      });
      const rendered = mailer.buildEmailLayout({ type, templates: mergedTemplates, vars, baseUrl: reqOrigin });
      return sendJson(res, 200, { success: true, subject: rendered.subject, html: rendered.html });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 26. POST /api/email/test (Enviar un email real o de prueba de Reserva / Cancelación)
  if (req.method === 'POST' && pathname === '/api/email/test') {
    try {
      const body = await parseJsonBody(req);
      const to = String(body.to || '').trim();
      const type = body.type === 'cancellation' ? 'cancellation' : 'booking';
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return sendJson(res, 400, { error: 'Ingresá un correo electrónico de destino válido.' });
      }
      const reqOrigin = req.headers.origin || `http://${req.headers.host || `localhost:${port}`}`;
      const testAppt = {
        clientName: body.clientName || 'Valentina Gómez (Prueba)',
        serviceName: 'Volumen Híbrido Glam',
        date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        time: '16:00',
        endTime: '18:00',
        price: 34000,
        clientEmail: to,
        clientNotes: 'Correo de prueba enviado desde el Panel Admin'
      };
      const result = await mailer.sendAppointmentEmail({
        supabase,
        type,
        appointment: testAppt,
        baseUrl: reqOrigin,
        extra: {
          forceSend: true,
          isTest: true,
          cancelReason: type === 'cancellation' ? 'Este es un ejemplo de cómo recibe tu clienta el aviso de cancelación.' : ''
        }
      });
      return sendJson(res, result.success ? 200 : 500, result);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Endpoint no encontrado
  return sendJson(res, 404, { error: 'Endpoint de API no encontrado' });
}

// Servidor HTTP Principal
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Interceptar rutas de la API (/api/...)
  if (pathname.startsWith('/api/')) {
    return handleApiRequest(req, res, pathname, urlObj.searchParams);
  }

  // Servir archivos estáticos de forma segura (bloqueando archivos sensibles del servidor)
  let reqPath = decodeURIComponent(pathname);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const baseName = path.basename(reqPath).toLowerCase();
  const blockedFiles = new Set(['.env', '.env.example', 'server.js', 'mailer.js', 'email-logs.json', 'package.json', 'package-lock.json']);
  if (baseName.startsWith('.') || blockedFiles.has(baseName)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  const filePath = path.resolve(dir, '.' + reqPath);
  if (!filePath.startsWith(path.resolve(dir))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found - Mica Lash Art');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, () => {
  console.log(`\n============================================================`);
  console.log(`✨ MICA LASH ART — SERVIDOR Y BACKEND SUPABASE ACTIVO ✨`);
  console.log(`============================================================`);
  console.log(`🌐 Servidor local: http://localhost:${port}`);
  console.log(`📅 Turnos online:  http://localhost:${port}/turnos.html`);
  console.log(`🔐 Iniciar sesión: http://localhost:${port}/login.html`);
  console.log(`👑 Panel Admin:    http://localhost:${port}/admin.html`);
  console.log(`📡 API Health:     http://localhost:${port}/api/health`);
  console.log(`============================================================\n`);
});
