-- ============================================================
-- 005_add_kapso_phone_number_id.sql
--
-- Adds the kapso_phone_number_id column to the restaurants table.
-- This stores the Kapso.ai phone_number_id for each restaurant's
-- WhatsApp Business number — used in n8n to route outbound replies.
--
-- The column is text (Kapso returns an opaque string identifier)
-- and nullable because existing restaurants may not have it yet.
-- ============================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS kapso_phone_number_id text;
