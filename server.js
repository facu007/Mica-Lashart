require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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
    if (supabase) {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        return sendJson(res, 200, { services: data });
      }
    }
    return sendJson(res, 200, { services: localDatabase.services });
  }

  // 4. GET /api/turnos/availability
  if (req.method === 'GET' && pathname === '/api/turnos/availability') {
    const date = queryParams.get('date');
    if (!date) {
      return sendJson(res, 400, { error: 'El parámetro ?date=YYYY-MM-DD es obligatorio.' });
    }

    const defaultSlots = ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];
    let bookedTimes = [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('start_time')
          .eq('appointment_date', date)
          .neq('status', 'cancelled');

        if (!error && data) {
          bookedTimes = data.map(row => row.start_time.slice(0, 5));
        }
      } catch (e) {
        console.warn('Error querying appointments:', e);
      }
    } else {
      bookedTimes = localDatabase.appointments
        .filter(a => (a.appointment_date === date || a.date === date) && a.status !== 'cancelled')
        .map(a => ((a.start_time || a.time) + '').slice(0, 5));
    }

    const slots = defaultSlots.map(time => ({
      time,
      available: !bookedTimes.includes(time)
    }));

    return sendJson(res, 200, { date, slots });
  }

  // 5. POST /api/turnos (Crear turno)
  if (req.method === 'POST' && pathname === '/api/turnos') {
    try {
      const body = await parseJsonBody(req);
      const { serviceId, serviceName, date, time, endTime, name, phone, email, notes, price } = body;

      if (!date || !time || !name || !phone) {
        return sendJson(res, 400, { error: 'Faltan campos requeridos (date, time, name, phone).' });
      }

      let createdAppointment = null;

      if (supabase) {
        // Formato para tabla appointments
        const appointmentRow = {
          professional_id: '11111111-1111-1111-1111-111111111111',
          service_id: serviceId || '22222222-2222-2222-2222-222222222202',
          appointment_date: date,
          start_time: time.length === 5 ? `${time}:00` : time,
          end_time: (endTime || '16:00').slice(0, 5) + ':00',
          price_ars: price || 34000,
          client_name: name,
          client_phone: phone,
          client_email: email || null,
          client_notes: notes || (serviceName ? `Tratamiento: ${serviceName}` : null),
          status: 'pending'
        };

        const { data, error } = await supabase
          .from('appointments')
          .insert(appointmentRow)
          .select()
          .single();

        if (error) {
          console.warn('[Supabase] Error al insertar turno:', error);
          // Fallback a memoria local
        } else {
          createdAppointment = data;
        }
      }

      // Si no hay Supabase o falló la conexión, guardar en memoria local
      if (!createdAppointment) {
        createdAppointment = {
          id: 'turn_' + Date.now(),
          appointment_date: date,
          start_time: time,
          end_time: endTime || '16:00',
          price_ars: price || 34000,
          client_name: name,
          client_phone: phone,
          client_email: email || '',
          client_notes: notes || '',
          status: 'pending',
          created_at: new Date().toISOString()
        };
        localDatabase.appointments.push(createdAppointment);
      }

      return sendJson(res, 201, {
        success: true,
        appointment: createdAppointment,
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
      let query = supabase.from('appointments').select('*').order('appointment_date', { ascending: false });
      if (email) query = query.eq('client_email', email);
      if (status && status !== 'all') query = query.eq('status', status);

      const { data, error } = await query;
      if (!error && data) {
        return sendJson(res, 200, { appointments: data, count: data.length });
      }
    }

    let results = localDatabase.appointments;
    if (email) results = results.filter(a => a.client_email === email);
    if (status && status !== 'all') results = results.filter(a => a.status === status);
    return sendJson(res, 200, { appointments: results, count: results.length });
  }

  // 7. PATCH /api/turnos/:id (Actualizar estado de turno)
  if (req.method === 'PATCH' && pathname.startsWith('/api/turnos/')) {
    const id = pathname.replace('/api/turnos/', '');
    try {
      const body = await parseJsonBody(req);
      const newStatus = body.status;

      if (!newStatus) {
        return sendJson(res, 400, { error: 'Se requiere el campo status.' });
      }

      if (supabase) {
        const { data, error } = await supabase
          .from('appointments')
          .update({ status: newStatus })
          .eq('id', id)
          .select();

        if (!error && data) {
          return sendJson(res, 200, { success: true, appointment: data[0] });
        }
      }

      const found = localDatabase.appointments.find(a => a.id === id);
      if (found) {
        found.status = newStatus;
        return sendJson(res, 200, { success: true, appointment: found });
      }

      return sendJson(res, 404, { error: 'Turno no encontrado.' });
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

  // 10. POST /api/gallery/upload (Subir archivo de imagen para los ejemplos)
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

      const rawBase64 = body.data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(rawBase64, 'base64');
      
      let ext = '.jpg';
      if (body.filename) {
        const parsedExt = path.extname(body.filename).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(parsedExt)) {
          ext = parsedExt;
        }
      }

      const safeBase = (body.filename ? path.basename(body.filename, ext) : 'foto')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
      const filename = `ej-${Date.now()}-${safeBase}${ext}`;
      const targetPath = path.join(uploadsDir, filename);

      fs.writeFileSync(targetPath, buffer);
      const publicUrl = `images/uploads/${filename}`;

      return sendJson(res, 201, {
        success: true,
        url: publicUrl,
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
          id: "photo_1",
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
          id: "photo_2",
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
          id: "photo_3",
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
          id: "photo_4",
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
          id: "photo_5",
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
          id: "photo_6",
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

      localDatabase.gallery = defaultPhotos;
      saveGalleryData(defaultPhotos);

      return sendJson(res, 200, { success: true, photos: defaultPhotos });
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

  // Servir archivos estáticos
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(dir, reqPath);

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
