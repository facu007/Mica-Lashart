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
  ]
};

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

// Helper para parsear JSON body en requests POST/PATCH
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
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
