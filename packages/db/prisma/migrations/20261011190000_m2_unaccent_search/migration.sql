-- Accent-insensitive search ("theiere" finds "Théière"): unaccent + immutable wrapper usable in indexes.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE INDEX IF NOT EXISTS "Product_name_unaccent_trgm_idx" ON "Product" USING gin (f_unaccent("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_name_unaccent_trgm_idx" ON "Client" USING gin (f_unaccent("name") gin_trgm_ops);
