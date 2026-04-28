-- Convert client_events to a monthly RANGE-partitioned table.
--
-- Strategy:
--  1. Rename the existing table to client_events_legacy (preserves data).
--  2. Recreate client_events as PARTITION BY RANGE (created_at).
--  3. Pre-create partitions for the previous, current, and next two months.
--  4. Copy any rows from the legacy table into the new structure.
--  5. Drop the legacy table only when the copy succeeded.
--
-- Helpers:
--  * ensure_client_events_partition(month_start date) creates a single monthly
--    partition idempotently. The cron `partition-rotate` job calls this for the
--    current and next month every day.
--  * drop_old_client_events_partitions(retention_months int) drops partitions
--    whose month is older than `retention_months` months.
--
-- This migration is intentionally idempotent: it skips work if client_events
-- is already partitioned (PG14+ exposes relkind='p' for partitioned tables).

DO $$
DECLARE
  is_partitioned boolean;
BEGIN
  SELECT relkind = 'p'
    INTO is_partitioned
    FROM pg_class
   WHERE relname = 'client_events'
     AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema());

  IF is_partitioned IS TRUE THEN
    RETURN;
  END IF;

  -- Rename the existing (non-partitioned) table out of the way
  EXECUTE 'ALTER TABLE client_events RENAME TO client_events_legacy';

  -- Re-create as a partitioned table mirroring the original schema
  EXECUTE $sql$
    CREATE TABLE client_events (
      id          SERIAL,
      event_type  TEXT NOT NULL,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_id  TEXT,
      product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
      order_id    INTEGER,
      metadata    JSONB,
      created_at  TIMESTAMP(3) NOT NULL DEFAULT now(),
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at)
  $sql$;

  EXECUTE 'CREATE INDEX client_events_event_type_created_at_idx ON client_events (event_type, created_at)';
  EXECUTE 'CREATE INDEX client_events_user_id_created_at_idx ON client_events (user_id, created_at)';
  EXECUTE 'CREATE INDEX client_events_session_id_idx ON client_events (session_id)';
END
$$;

-- Helper: ensure a single monthly partition exists for the supplied month start.
CREATE OR REPLACE FUNCTION ensure_client_events_partition(month_start date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  partition_name text;
  start_ts       timestamp;
  end_ts         timestamp;
BEGIN
  start_ts := date_trunc('month', month_start);
  end_ts   := start_ts + interval '1 month';
  partition_name := format('client_events_y%sm%s',
                           to_char(start_ts, 'YYYY'),
                           to_char(start_ts, 'MM'));

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = partition_name AND n.nspname = current_schema()
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF client_events FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_ts,
      end_ts
    );
  END IF;
END
$$;

-- Helper: drop partitions whose month ended more than `retention_months` ago.
CREATE OR REPLACE FUNCTION drop_old_client_events_partitions(retention_months integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  rec      record;
  cutoff   date;
  dropped  integer := 0;
BEGIN
  cutoff := (date_trunc('month', now()) - make_interval(months => retention_months))::date;
  FOR rec IN
    SELECT child.relname AS partition_name
      FROM pg_inherits inh
      JOIN pg_class parent ON parent.oid = inh.inhparent
      JOIN pg_class child  ON child.oid  = inh.inhrelid
     WHERE parent.relname = 'client_events'
  LOOP
    -- Partition naming convention: client_events_yYYYYmMM
    IF rec.partition_name ~ '^client_events_y[0-9]{4}m[0-9]{2}$' THEN
      DECLARE
        partition_year  integer := substring(rec.partition_name from 'y([0-9]{4})')::integer;
        partition_month integer := substring(rec.partition_name from 'm([0-9]{2})$')::integer;
        partition_date  date    := make_date(partition_year, partition_month, 1);
      BEGIN
        IF partition_date < cutoff THEN
          EXECUTE format('DROP TABLE %I', rec.partition_name);
          dropped := dropped + 1;
        END IF;
      END;
    END IF;
  END LOOP;
  RETURN dropped;
END
$$;

-- Pre-create partitions for previous, current, and next two months
DO $$
DECLARE
  base_month date := date_trunc('month', now())::date;
BEGIN
  PERFORM ensure_client_events_partition(base_month - interval '1 month');
  PERFORM ensure_client_events_partition(base_month);
  PERFORM ensure_client_events_partition(base_month + interval '1 month');
  PERFORM ensure_client_events_partition(base_month + interval '2 months');
END
$$;

-- Backfill data from the legacy table (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
     WHERE relname = 'client_events_legacy'
       AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
  ) THEN
    -- Rows older than the oldest partition would fail INSERT, so create
    -- catch-up partitions on demand for any month present in the legacy data.
    DECLARE
      legacy_month date;
    BEGIN
      FOR legacy_month IN
        SELECT DISTINCT date_trunc('month', created_at)::date
          FROM client_events_legacy
         ORDER BY 1
      LOOP
        PERFORM ensure_client_events_partition(legacy_month);
      END LOOP;
    END;

    INSERT INTO client_events (id, event_type, user_id, session_id, product_id, order_id, metadata, created_at)
    SELECT id, event_type, user_id, session_id, product_id, order_id, metadata, created_at
      FROM client_events_legacy
    ON CONFLICT DO NOTHING;

    -- Realign the SERIAL sequence so new inserts continue past legacy ids
    PERFORM setval(pg_get_serial_sequence('client_events', 'id'),
                   COALESCE((SELECT MAX(id) FROM client_events), 0) + 1,
                   false);

    DROP TABLE client_events_legacy;
  END IF;
END
$$;
