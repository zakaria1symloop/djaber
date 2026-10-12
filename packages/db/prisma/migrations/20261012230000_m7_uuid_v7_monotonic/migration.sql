-- uuid_generate_v7(): keep insertion order inside one millisecond (RFC 9562 §6.2 methods 3 + 1).
-- The M0 version filled everything after the 48-bit timestamp with random bytes, so rows inserted in the same
-- millisecond (order / sale / purchase lines of one createMany) sorted randomly by id. Now:
--   bytes 0-5  unix time in ms
--   byte  6-7  version 7 + 12 bits of sub-millisecond fraction (from clock_timestamp() microseconds)
--   byte  8-9  variant 10 + 14 bits of a global sequence (orders calls inside the same microsecond)
--   byte 10-15 random
CREATE SEQUENCE IF NOT EXISTS uuid_v7_seq AS bigint MINVALUE 0 MAXVALUE 16383 CYCLE;

CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
DECLARE
  us bigint := floor(extract(epoch from clock_timestamp()) * 1000000)::bigint;
  frac int := ((us % 1000) * 4096 / 1000)::int;
  seq int := nextval('uuid_v7_seq')::int;
  uuid_bytes bytea;
BEGIN
  uuid_bytes = substring(int8send(us / 1000) from 3) || '\x00000000'::bytea || gen_random_bytes(6);
  uuid_bytes = set_byte(uuid_bytes, 6, 112 | (frac >> 8));
  uuid_bytes = set_byte(uuid_bytes, 7, frac & 255);
  uuid_bytes = set_byte(uuid_bytes, 8, 128 | (seq >> 8));
  uuid_bytes = set_byte(uuid_bytes, 9, seq & 255);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;
