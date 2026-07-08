-- 1. live_accounts table
CREATE TABLE public.live_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  access_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_accounts_access_code_min_len CHECK (char_length(access_code) >= 5),
  CONSTRAINT live_accounts_access_code_unique UNIQUE (access_code)
);

CREATE INDEX idx_live_accounts_customer_id ON public.live_accounts(customer_id);
CREATE INDEX idx_live_accounts_active ON public.live_accounts(is_active) WHERE is_active = true;

ALTER TABLE public.live_accounts ENABLE ROW LEVEL SECURITY;

-- Only phaos_admin can do anything with this table directly.
CREATE POLICY "phaos admin manages live accounts"
ON public.live_accounts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'phaos_admin'))
WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'));

CREATE TRIGGER trg_live_accounts_updated_at
BEFORE UPDATE ON public.live_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. profile columns for hybrid persistence
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_mode text NOT NULL DEFAULT 'prototype'
    CHECK (last_mode IN ('prototype','live')),
  ADD COLUMN IF NOT EXISTS last_live_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- 3. Redeem function. SECURITY DEFINER so signed-in users can validate a code
-- without ever being able to SELECT from live_accounts.
CREATE OR REPLACE FUNCTION public.redeem_live_access_code(_code text)
RETURNS TABLE(customer_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.live_accounts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF _code IS NULL OR char_length(_code) < 5 THEN
    RETURN;
  END IF;

  SELECT * INTO _row
  FROM public.live_accounts
  WHERE access_code = _code AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET last_mode = 'live',
      last_live_customer_id = _row.customer_id,
      updated_at = now()
  WHERE id = auth.uid();

  customer_id := _row.customer_id;
  display_name := _row.display_name;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_live_access_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_live_access_code(text) TO authenticated;

-- 4. Helper: persist mode change without exposing live_accounts.
CREATE OR REPLACE FUNCTION public.set_account_mode(_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _mode NOT IN ('prototype','live') THEN
    RAISE EXCEPTION 'invalid mode';
  END IF;

  UPDATE public.profiles
  SET last_mode = _mode,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_account_mode(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_account_mode(text) TO authenticated;

-- 5. Helper: read the display name of the currently bound live customer
-- (so the header can render "Mode: Live – [Name]" without leaking codes).
CREATE OR REPLACE FUNCTION public.get_my_live_account()
RETURNS TABLE(customer_id uuid, display_name text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT last_live_customer_id INTO _cid
  FROM public.profiles WHERE id = auth.uid();

  IF _cid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT la.customer_id, la.display_name, la.is_active
  FROM public.live_accounts la
  WHERE la.customer_id = _cid
  ORDER BY la.updated_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_live_account() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_live_account() TO authenticated;