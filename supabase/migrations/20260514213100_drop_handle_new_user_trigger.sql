-- ContAuditAI — Migración 006: Eliminar trigger de creación automática de perfil
--
-- El perfil ahora se crea desde el callback de auth (patrón LigaKit):
-- solo usuarios que realmente usan la app quedan en contauditai.profiles.
-- El trigger generaba filas fantasma al crear usuarios desde el dashboard de Supabase.

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
