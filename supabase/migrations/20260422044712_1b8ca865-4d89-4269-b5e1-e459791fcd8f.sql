-- Helper: check if the current auth user matches a specific email (case-insensitive).
-- SECURITY DEFINER so we can read auth.users; restricted by hard-coded email match only.
CREATE OR REPLACE FUNCTION public.is_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) = lower(_email)
  );
$$;

-- ============================================================
-- brand_vault
-- ============================================================
CREATE TABLE public.brand_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('data_point','success_story','technical')),
  content text NOT NULL,
  source_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daniel referrizer full access brand_vault"
ON public.brand_vault
FOR ALL
TO authenticated
USING (public.is_email('daniel@referrizer.com'))
WITH CHECK (public.is_email('daniel@referrizer.com'));

-- ============================================================
-- content_queue
-- ============================================================
CREATE TABLE public.content_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_at timestamp with time zone,
  post_type text NOT NULL DEFAULT 'single' CHECK (post_type IN ('single','bulk')),
  category text NOT NULL DEFAULT 'industry' CHECK (category IN ('industry','faith')),
  blog_body text,
  linkedin_hook text,
  facebook_body text,
  image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  seo_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daniel referrizer full access content_queue"
ON public.content_queue
FOR ALL
TO authenticated
USING (public.is_email('daniel@referrizer.com'))
WITH CHECK (public.is_email('daniel@referrizer.com'));

CREATE TRIGGER content_queue_set_updated_at
BEFORE UPDATE ON public.content_queue
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_content_queue_status ON public.content_queue (status);
CREATE INDEX idx_content_queue_scheduled_at ON public.content_queue (scheduled_at);
CREATE INDEX idx_brand_vault_category ON public.brand_vault (category);