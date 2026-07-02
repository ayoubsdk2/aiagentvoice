DROP POLICY IF EXISTS "Authenticated can read own strategy-job channels" ON realtime.messages;

CREATE POLICY "Authenticated can read own strategy-job channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'strategy-job-%' THEN EXISTS (
      SELECT 1 FROM public.strategy_jobs sj
      WHERE sj.id::text = substring(realtime.topic() from length('strategy-job-') + 1)
        AND sj.user_id = auth.uid()
    )
    ELSE false
  END
);