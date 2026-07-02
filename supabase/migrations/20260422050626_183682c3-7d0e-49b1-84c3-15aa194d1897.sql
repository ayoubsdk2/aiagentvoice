CREATE INDEX IF NOT EXISTS idx_content_queue_status_scheduled_at
  ON public.content_queue (status, scheduled_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_content_queue_last_error
  ON public.content_queue (last_attempt_at DESC)
  WHERE last_error IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_queue_category_scheduled_at
  ON public.content_queue (category, scheduled_at);