
-- Enable Realtime Authorization on realtime.messages (Supabase Realtime RLS)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior version of our policy so this migration is idempotent
DROP POLICY IF EXISTS "Authenticated can read own strategy-job channels" ON realtime.messages;

-- Authenticated users may read realtime messages either:
--  - on any non strategy-job topic (preserves existing behavior), OR
--  - on a strategy-job-<uuid> topic whose underlying strategy_jobs row they own.
CREATE POLICY "Authenticated can read own strategy-job channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'strategy-job-%' THEN EXISTS (
      SELECT 1 FROM public.strategy_jobs sj
      WHERE sj.id::text = substring(realtime.topic() from length('strategy-job-') + 1)
        AND sj.user_id = (SELECT auth.uid())
    )
    ELSE true
  END
);
