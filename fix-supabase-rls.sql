-- =============================================================================
-- MICA LASH ART — PARCHE DEFINITIVO DE POLÍTICAS RLS & STORAGE EN SUPABASE (v2)
-- Ejecutá este script COMPLETO en Supabase Dashboard > SQL Editor > Run
--
-- Corrige: 500 "infinite recursion detected in policy for relation profiles" (42P17)
--          400 al subir fotos al bucket 'gallery' desde GitHub Pages.
--
-- La v1 sólo reemplazaba políticas por nombre; en la base quedaban políticas
-- viejas (con otros nombres) que consultaban "profiles" desde "profiles".
-- Esta versión las elimina dinámicamente, sin importar cómo se llamen.
-- =============================================================================

-- 1. Función segura sin recursión para verificar rol de administradora
--    (SECURITY DEFINER => corre como owner y no dispara RLS de profiles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- 2. Borrar TODAS las políticas de profiles y cualquier política (public/storage)
--    que consulte "profiles" directamente (origen de la recursión infinita)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (schemaname = 'public' AND tablename = 'profiles')
       OR (schemaname IN ('public', 'storage')
           AND (COALESCE(qual, '') ILIKE '%profiles%'
                OR COALESCE(with_check, '') ILIKE '%profiles%'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'Política eliminada: %.% -> %', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END $$;

-- 3. Políticas limpias de profiles (sin subconsultas a sí misma)
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins ven todos los perfiles" ON public.profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. Acceso total de admin en el resto de las tablas vía public.is_admin()
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'professionals', 'services', 'courses', 'weekly_schedule', 'blocked_dates',
    'clients', 'appointments', 'course_enrollments', 'reviews', 'settings', 'gallery_photos'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admin full access to ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())',
        'Admin full access to ' || t, t
      );
    END IF;
  END LOOP;
END $$;

-- Lectura pública necesaria para la web (horarios publicados y galería)
DROP POLICY IF EXISTS "Public can read settings" ON public.settings;
CREATE POLICY "Public can read settings" ON public.settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Lectura pública de galería" ON public.gallery_photos;
CREATE POLICY "Lectura pública de galería" ON public.gallery_photos FOR SELECT USING (TRUE);

-- 5. Bucket público 'gallery' y permisos de Storage para Admin
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Lectura pública de fotos de galería" ON storage.objects;
CREATE POLICY "Lectura pública de fotos de galería" ON storage.objects
  FOR SELECT USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "Admins suben fotos a galería" ON storage.objects;
CREATE POLICY "Admins suben fotos a galería" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gallery' AND public.is_admin());

DROP POLICY IF EXISTS "Admins actualizan fotos de galería" ON storage.objects;
CREATE POLICY "Admins actualizan fotos de galería" ON storage.objects
  FOR UPDATE USING (bucket_id = 'gallery' AND public.is_admin());

DROP POLICY IF EXISTS "Admins eliminan fotos de galería" ON storage.objects;
CREATE POLICY "Admins eliminan fotos de galería" ON storage.objects
  FOR DELETE USING (bucket_id = 'gallery' AND public.is_admin());

-- 6. Verificación: no debería quedar NINGUNA fila (políticas que consultan profiles)
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND (COALESCE(qual, '') ILIKE '%profiles%' OR COALESCE(with_check, '') ILIKE '%profiles%');
