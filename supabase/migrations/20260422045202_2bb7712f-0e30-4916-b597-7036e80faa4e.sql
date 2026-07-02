-- Private bucket for Content Lab post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-lab-images', 'content-lab-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "daniel referrizer reads content-lab-images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'content-lab-images' AND public.is_email('daniel@referrizer.com'));

CREATE POLICY "daniel referrizer uploads content-lab-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-lab-images' AND public.is_email('daniel@referrizer.com'));

CREATE POLICY "daniel referrizer updates content-lab-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'content-lab-images' AND public.is_email('daniel@referrizer.com'));

CREATE POLICY "daniel referrizer deletes content-lab-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'content-lab-images' AND public.is_email('daniel@referrizer.com'));