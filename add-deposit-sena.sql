-- =============================================================================
-- MICA LASH ART — SEÑA DEL 20% CON COMPROBANTE DE TRANSFERENCIA
-- Ejecutá este script en Supabase Dashboard > SQL Editor > Run
-- (después de fix-supabase-rls.sql)
-- =============================================================================

-- 1. Columna para guardar la ruta del comprobante en el bucket privado 'receipts'
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deposit_receipt_url TEXT;

-- 2. Política de seña: 20% obligatorio
INSERT INTO public.settings (key, value, description)
VALUES ('booking_policy',
        '{"deposit_required":true,"deposit_percentage":20,"cancellation_notice_hours":24,"slot_interval_minutes":30}'::jsonb,
        'Políticas de turnos y seña')
ON CONFLICT (key) DO UPDATE
  SET value = public.settings.value || '{"deposit_required":true,"deposit_percentage":20}'::jsonb;

-- 3. Datos de transferencia (editables luego desde el Panel Admin)
INSERT INTO public.settings (key, value, description)
VALUES ('payment_info',
        '{"alias":"","cbu":"","holder":"Micaela","bank":"","whatsapp":""}'::jsonb,
        'Datos de transferencia para la seña')
ON CONFLICT (key) DO NOTHING;

-- 4. Bucket PRIVADO para comprobantes (contienen datos bancarios de las clientas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 8388608,
        ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Cualquier clienta (con o sin cuenta) puede SUBIR su comprobante...
DROP POLICY IF EXISTS "Clientas suben comprobantes de seña" ON storage.objects;
CREATE POLICY "Clientas suben comprobantes de seña" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'receipts');

-- ...pero sólo la admin puede verlos o borrarlos
DROP POLICY IF EXISTS "Admin ve comprobantes de seña" ON storage.objects;
CREATE POLICY "Admin ve comprobantes de seña" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts' AND public.is_admin());

DROP POLICY IF EXISTS "Admin elimina comprobantes de seña" ON storage.objects;
CREATE POLICY "Admin elimina comprobantes de seña" ON storage.objects
  FOR DELETE USING (bucket_id = 'receipts' AND public.is_admin());

