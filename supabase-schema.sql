-- ==============================================================================
-- MICA LASH ART — ESQUEMA COMPLETO PARA SUPABASE (POSTGRESQL)
-- ==============================================================================
-- Instrucciones:
-- 1. Ingresá a tu proyecto en Supabase (https://supabase.com/dashboard)
-- 2. Hacé clic en "SQL Editor" en el menú lateral izquierdo
-- 3. Hacé clic en "New query", pegá este script completo y pulsá "Run" (Ejecutar)
-- ==============================================================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función de utilidad para actualizar el timestamp updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. TABLA: professionals (Staff / Artistas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS professionals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL DEFAULT 'Master Lash Artist',
  avatar_url      TEXT,
  bio             TEXT,
  whatsapp        TEXT DEFAULT '5492914491141',
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. TABLA: services (Tratamientos de Pestañas & Cejas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS services (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  badge               TEXT,
  description         TEXT,
  duration_minutes    INT NOT NULL DEFAULT 90,
  price_ars           DECIMAL(12, 2) NOT NULL,
  deposit_ars         DECIMAL(12, 2) DEFAULT 0,
  icon                TEXT DEFAULT '✨',
  category            TEXT DEFAULT 'extensiones' CHECK (category IN ('extensiones', 'lifting', 'cejas', 'combo')),
  is_active           BOOLEAN DEFAULT TRUE,
  sort_order          INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. TABLA: courses (Academia & Capacitaciones)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS courses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title               TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  level               TEXT NOT NULL DEFAULT 'Inicial',
  modality            TEXT NOT NULL DEFAULT 'Presencial Intensivo',
  duration_hours      TEXT NOT NULL DEFAULT '1 Jornada (8 hs)',
  price_ars           DECIMAL(12, 2) NOT NULL,
  deposit_ars         DECIMAL(12, 2) DEFAULT 0,
  includes_kit        BOOLEAN DEFAULT TRUE,
  badge               TEXT DEFAULT 'Certificado Incluido',
  description         TEXT,
  syllabus            JSONB DEFAULT '[]'::jsonb,
  is_active           BOOLEAN DEFAULT TRUE,
  sort_order          INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. TABLA: weekly_schedule (Horarios Semanales de Atención)
-- day_of_week: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
-- ==============================================================================
CREATE TABLE IF NOT EXISTS weekly_schedule (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id     UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  day_of_week         INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time          TIME NOT NULL DEFAULT '10:00',
  end_time            TIME NOT NULL DEFAULT '19:00',
  break_start         TIME,
  break_end           TIME,
  slot_duration_min   INT NOT NULL DEFAULT 90,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(professional_id, day_of_week)
);

-- ==============================================================================
-- 6. TABLA: blocked_dates (Días Feriados o Vacaciones)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS blocked_dates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id     UUID REFERENCES professionals(id) ON DELETE CASCADE,
  blocked_date        DATE NOT NULL,
  reason              TEXT DEFAULT 'No laborable / Feriado',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. TABLA: profiles (Perfiles vinculados a auth.users con Roles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT,
  phone               TEXT,
  role                TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  avatar_url          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. TABLA: clients (Directorio de Clientas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name           TEXT NOT NULL,
  phone               TEXT NOT NULL,
  email               TEXT,
  instagram           TEXT,
  notes               TEXT,
  total_visits        INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. TABLA: appointments (Turnos y Citas en Vivo)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  professional_id     UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  service_id          UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  
  appointment_date    DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  
  status              TEXT NOT NULL DEFAULT 'pending' 
                      CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  
  price_ars           DECIMAL(12, 2) NOT NULL,
  deposit_ars         DECIMAL(12, 2) DEFAULT 0,
  payment_method      TEXT DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'transferencia', 'mercadopago', 'tarjeta', NULL)),
  payment_status      TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  
  client_name         TEXT NOT NULL,
  client_phone        TEXT NOT NULL,
  client_email        TEXT,
  client_notes        TEXT,
  internal_notes      TEXT,
  
  google_calendar_url TEXT,
  whatsapp_sent       BOOLEAN DEFAULT FALSE,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. TABLA: course_enrollments (Inscripciones a Cursos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS course_enrollments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_name        TEXT NOT NULL,
  student_phone       TEXT NOT NULL,
  student_email       TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 11. TABLA: reviews (Reseñas & Testimonios)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS reviews (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id      UUID REFERENCES appointments(id) ON DELETE SET NULL,
  client_name         TEXT NOT NULL,
  rating              INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             TEXT NOT NULL,
  is_approved         BOOLEAN DEFAULT TRUE,
  is_published        BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 12. TABLA: settings (Configuraciones del Estudio)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS settings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key                 TEXT NOT NULL UNIQUE,
  value               JSONB NOT NULL DEFAULT '{}'::jsonb,
  description         TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ÍNDICES PARA RENDIMIENTO RÁPIDO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_prof_date ON appointments(professional_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_auth ON clients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates ON blocked_dates(blocked_date);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_prof ON weekly_schedule(professional_id, day_of_week);

-- ==============================================================================
-- TRIGGERS DE ACTUALIZACIÓN AUTOMÁTICA (updated_at)
-- ==============================================================================
CREATE OR REPLACE TRIGGER trg_professionals_updated BEFORE UPDATE ON professionals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_services_updated BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_courses_updated BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_settings_updated BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==============================================================================
-- TRIGGER PARA SINCRONIZAR USUARIOS REGISTRADOS EN auth.users
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_role TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  v_phone     := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_role      := COALESCE(NEW.raw_user_meta_data->>'role', 'client');

  -- 1. Insertar perfil en profiles
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (NEW.id, v_full_name, v_phone, v_role)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone;

  -- 2. Vincular o crear ficha en clients
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    INSERT INTO public.clients (auth_user_id, full_name, phone, email)
    VALUES (NEW.id, COALESCE(NULLIF(v_full_name, ''), 'Clienta'), COALESCE(NULLIF(v_phone, ''), 'Sin especificar'), NEW.email)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 1. Tablas Públicas de Lectura (Catálogo, Profesional, Horarios)
CREATE POLICY "Public can read professionals" ON professionals FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can read services" ON services FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can read courses" ON courses FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can read weekly_schedule" ON weekly_schedule FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can read blocked_dates" ON blocked_dates FOR SELECT USING (TRUE);
CREATE POLICY "Public can read published reviews" ON reviews FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Public can read settings" ON settings FOR SELECT USING (TRUE);

-- 2. Turnos (Appointments)
-- Todos pueden crear turnos (incluso clientas invitadas sin cuenta)
CREATE POLICY "Anyone can create appointment" ON appointments FOR INSERT WITH CHECK (TRUE);

-- Clientas autenticadas pueden ver sus propios turnos
CREATE POLICY "Clients can view their appointments" ON appointments FOR SELECT
  USING (
    client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid()) OR
    client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Clientas pueden cancelar sus turnos pendientes
CREATE POLICY "Clients can cancel their appointments" ON appointments FOR UPDATE
  USING (
    client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid()) OR
    client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (status IN ('cancelled', 'pending'));

-- 3. Inscripciones a Cursos
CREATE POLICY "Anyone can enroll in courses" ON course_enrollments FOR INSERT WITH CHECK (TRUE);

-- 4. Perfiles
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 5. Clientes
CREATE POLICY "Users can read own client record" ON clients FOR SELECT USING (auth_user_id = auth.uid());

-- 6. Rol Administrador: Acceso Total a Todas las Tablas
CREATE POLICY "Admin full access to professionals" ON professionals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to services" ON services FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to courses" ON courses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to weekly_schedule" ON weekly_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to blocked_dates" ON blocked_dates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to profiles" ON profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to clients" ON clients FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to appointments" ON appointments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to course_enrollments" ON course_enrollments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to reviews" ON reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access to settings" ON settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ==============================================================================
-- 13. SEED DATA (DATOS INICIALES REALES DE MICA LASH ART)
-- ==============================================================================

-- Profesional: Micaela
INSERT INTO professionals (id, name, slug, title, avatar_url, bio, whatsapp, is_active, sort_order)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Micaela',
  'micaela',
  'Master Lash Artist & Educadora',
  'images/mica-bio-1.jpg',
  'Especialista en miradas VIP desde 2016 en Bahía Blanca. Más de 1.500 servicios realizados y decenas de alumnas formadas.',
  '5492914491141',
  TRUE,
  1
) ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    title = EXCLUDED.title,
    avatar_url = EXCLUDED.avatar_url;

-- Horarios Semanales de Micaela (Lunes a Sábado de 10:00 a 19:00 hs)
INSERT INTO weekly_schedule (professional_id, day_of_week, start_time, end_time, break_start, break_end, slot_duration_min, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 1, '10:00', '19:00', '13:00', '14:00', 90, TRUE), -- Lunes
  ('11111111-1111-1111-1111-111111111111', 2, '10:00', '19:00', '13:00', '14:00', 90, TRUE), -- Martes
  ('11111111-1111-1111-1111-111111111111', 3, '10:00', '19:00', '13:00', '14:00', 90, TRUE), -- Miércoles
  ('11111111-1111-1111-1111-111111111111', 4, '10:00', '19:00', '13:00', '14:00', 90, TRUE), -- Jueves
  ('11111111-1111-1111-1111-111111111111', 5, '10:00', '19:00', '13:00', '14:00', 90, TRUE), -- Viernes
  ('11111111-1111-1111-1111-111111111111', 6, '10:00', '18:00', '13:00', '14:00', 90, TRUE)  -- Sábado
ON CONFLICT (professional_id, day_of_week) DO UPDATE
SET start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time;

-- Catálogo de Tratamientos (6 Servicios Oficiales)
INSERT INTO services (id, name, slug, badge, description, duration_minutes, price_ars, deposit_ars, icon, category, sort_order)
VALUES
  (
    '22222222-2222-2222-2222-222222222201',
    'Clásicas Pelo a Pelo',
    'clasicas-pelo-a-pelo',
    'Efecto Rímel Natural',
    'Una extensión ultra liviana sobre cada pestaña natural. Ideal para el día a día sin maquillaje.',
    90,
    28000,
    5000,
    '✨',
    'extensiones',
    1
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    'Volumen Híbrido Glam',
    '★ Look Más Pedido',
    'Mezcla armoniosa de técnica clásica y abanicos 2D/3D. Textura esponjosa con máxima definición.',
    120,
    34000,
    5000,
    '👑',
    'extensiones',
    2
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    'Volumen Ruso 3D-5D',
    'Densidad & Mirada Intensa',
    'Abanicos artesanales ultralivianos hechos a mano. Densidad sofisticada y curvatura impecable.',
    135,
    42000,
    8000,
    '💎',
    'extensiones',
    3
  ),
  (
    '22222222-2222-2222-2222-222222222204',
    'Mega Volumen Velvet',
    'Impacto Black Intenso',
    'Máxima cobertura y textura aterciopelada. Fibras extra finas 0.03mm de máxima ligereza.',
    150,
    48000,
    10000,
    '🖤',
    'extensiones',
    4
  ),
  (
    '22222222-2222-2222-2222-222222222205',
    'Lifting de Pestañas + Botox',
    'Nutrición 100% Natural',
    'Arqueado desde la raíz con nutrición profunda de keratina, botox y tinte negro azabache.',
    60,
    24000,
    4000,
    '🌸',
    'lifting',
    5
  ),
  (
    '22222222-2222-2222-2222-222222222206',
    'Laminado & Diseño de Cejas',
    'Alisado + Henna HD',
    'Fijación y alineación del vello de cejas, perfilado simétrico y color semipermanente.',
    45,
    20000,
    4000,
    '✨',
    'cejas',
    6
  )
ON CONFLICT (slug) DO UPDATE
SET price_ars = EXCLUDED.price_ars,
    duration_minutes = EXCLUDED.duration_minutes,
    badge = EXCLUDED.badge;

-- Cursos Oficiales de Academia Mica Lash Art
INSERT INTO courses (id, title, slug, level, modality, duration_hours, price_ars, deposit_ars, includes_kit, badge, description, syllabus, sort_order)
VALUES
  (
    '33333333-3333-3333-3333-333333333301',
    'Curso Inicial: Extensiones Clásicas & Pelo a Pelo',
    'curso-inicial-clasicas',
    'Nivel Inicial (Sin experiencia previa)',
    'Presencial Intensivo en Estudio',
    '1 Jornada (8 horas completas)',
    85000,
    20000,
    TRUE,
    'Kit Completo + Certificado',
    'Formación desde cero con fundamentos teóricos, anatomía ocular, bioseguridad, técnicas de aislamiento, colocación precisa y práctica en modelo real.',
    '["Anatomía del ojo y ciclo ciliar", "Bioseguridad, higiene y asepsia", "Mapeos de mirada: Cat Eye, Doll Eye y Natural", "Uso correcto del adhesivo y parámetros de humedad", "Práctica en esponja y modelo real", "Estrategia para captar tus primeras clientas"]'::jsonb,
    1
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    'Masterclass: Volumen Ruso & Mega Volumen Avanzado',
    'masterclass-volumen-ruso',
    'Nivel Avanzado (Requiere dominar clásica)',
    'Teórico - Práctico en Estudio',
    '1 Jornada Intensiva (7 horas)',
    120000,
    30000,
    TRUE,
    'Perfeccionamiento VIP',
    'Aprendé a armar abanicos a mano perfectos sin apelmazar el adhesivo, técnicas de retención de hasta 5 semanas y transiciones de curvatura.',
    '["Técnicas de abanicado manual 2D a 6D", "Cálculo de peso y salud del folículo", "Línea perfecta y efecto eyeliner", "Secretos de retención extrema de 5 semanas", "Práctica en modelo real con supervisión paso a paso", "Fotografía e iluminación para Instagram"]'::jsonb,
    2
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    'Taller Dual: Lifting de Pestañas + Laminado de Cejas',
    'taller-lifting-laminado',
    'Todos los Niveles',
    'Teórico - Práctico con Práctica en Vivo',
    '1 Jornada (5 horas)',
    65000,
    15000,
    TRUE,
    'Doble Certificación Oficial',
    'El servicio más demandado y rentable. Aprendé elección de moldes de silicona, tiempos de exposición según grosor del pelo, tinte y aplicación de botox regenerador.',
    '["Diferencias entre permanente y lifting", "Selección de pads según tipo de párpado", "Tiempos químicos exactos según grosor", "Colorimetría y aplicación de tinte", "Laminado y perfilado de cejas simétrico", "Cuidados posteriores y venta de reventa"]'::jsonb,
    3
  )
ON CONFLICT (slug) DO UPDATE
SET price_ars = EXCLUDED.price_ars,
    description = EXCLUDED.description;

-- Configuraciones Iniciales del Negocio
INSERT INTO settings (key, value, description)
VALUES
  ('business_info', '{"name":"Mica Lash Art","city":"Bahía Blanca","address":"Zona Hospital Penna - Villa Cerrito","whatsapp":"5492914491141","instagram":"@mica.lashart"}'::jsonb, 'Datos de contacto'),
  ('booking_policy', '{"deposit_required":true,"deposit_percentage":20,"cancellation_notice_hours":24,"slot_interval_minutes":30}'::jsonb, 'Políticas de turnos y seña')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- ==============================================================================
-- FIN DEL SCRIPT SQL PARA SUPABASE
-- ==============================================================================
