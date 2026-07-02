ALTER TABLE public.content_queue
ADD COLUMN IF NOT EXISTS user_id uuid;

WITH admin_owner AS (
  SELECT user_id
  FROM public.user_roles
  WHERE role = 'phaos_admin'::public.app_role
  ORDER BY user_id
  LIMIT 1
)
UPDATE public.content_queue cq
SET user_id = admin_owner.user_id
FROM admin_owner
WHERE cq.user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.content_queue
    WHERE user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'content_queue still has rows without user_id after backfill';
  END IF;
END $$;

ALTER TABLE public.content_queue
ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.content_queue
ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_queue_user_id_created_at
ON public.content_queue (user_id, created_at DESC);

DROP POLICY IF EXISTS "content_queue users select own" ON public.content_queue;
DROP POLICY IF EXISTS "content_queue users insert own" ON public.content_queue;
DROP POLICY IF EXISTS "content_queue users update own" ON public.content_queue;
DROP POLICY IF EXISTS "content_queue users delete own" ON public.content_queue;

CREATE POLICY "content_queue users select own"
ON public.content_queue
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "content_queue users insert own"
ON public.content_queue
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "content_queue users update own"
ON public.content_queue
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "content_queue users delete own"
ON public.content_queue
FOR DELETE
TO authenticated
USING (user_id = auth.uid());