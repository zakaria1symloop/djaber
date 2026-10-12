-- All `timestamp` columns hold UTC (Prisma writes UTC). Raw SQL that compares them with timestamptz parameters
-- reads them in the session time zone, so every session must run in UTC whatever the server's OS zone is
-- (the embedded dev cluster on Windows inherited the machine zone, UTC+1, which shifted day boundaries by one hour).
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END $$;
