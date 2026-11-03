-- =============================================================================
-- MICA LASH ART — PARCHE DEFINITIVO DE POLÍTICAS RLS & STORAGE EN SUPABASE
-- Ejecutá este script una sola vez en Supabase Dashboard > SQL Editor > Run
-- Elimina los errores 500 (42P17 recursión en profiles) y habilita subida
-- directa de fotos al bucket 'gallery' desde GitHub Pages / cualquier navegador.
-- =============================================================================

-- 1. Función segura sin recursión para verificar rol de administradora
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Reemplazar todas las políticas recursivas por public.is_admin()
DROP POLICY IF EXISTS "Admins ven todos los perfiles" ON public.profiles;
CREATE POLICY "Admins ven todos los perfiles" ON public.profiles
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins gestionan servicios" ON public.services;
CREATE POLICY "Admins gestionan servicios" ON public.services
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins gestionan agenda" ON public.weekly_schedule;
CREATE POLICY "Admins gestionan agenda" ON public.weekly_schedule
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins gestionan bloqueos" ON public.blocked_dates;
CREATE POLICY "Admins gestionan bloqueos" ON public.blocked_dates
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins gestionan todos los turnos" ON public.appointments;
CREATE POLICY "Admins gestionan todos los turnos" ON public.appointments
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins gestionan galería" ON public.gallery_photos;
CREATE POLICY "Admins gestionan galería" ON public.gallery_photos
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins gestionan settings" ON public.settings;
CREATE POLICY "Admins gestionan settings" ON public.settings
  FOR ALL USING (public.is_admin());

-- 3. Asegurar bucket público 'gallery' y permisos completos de Storage para Admin
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
