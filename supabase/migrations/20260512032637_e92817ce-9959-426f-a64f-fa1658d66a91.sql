-- Add provider_id column to intakes for assignment scoping
ALTER TABLE public.intakes ADD COLUMN IF NOT EXISTS provider_id uuid;
CREATE INDEX IF NOT EXISTS idx_intakes_provider_id ON public.intakes(provider_id);

-- Replace permissive provider policies with assignment-scoped ones
DROP POLICY IF EXISTS "Providers can view assigned intakes" ON public.intakes;
DROP POLICY IF EXISTS "Providers can update assigned intakes" ON public.intakes;

CREATE POLICY "Providers can view assigned intakes"
ON public.intakes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'provider'::app_role) AND provider_id = auth.uid());

CREATE POLICY "Providers can update assigned intakes"
ON public.intakes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'provider'::app_role) AND provider_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'provider'::app_role) AND provider_id = auth.uid());

-- Add restrictive policy: only admins may ever insert/update/delete user_roles (defense in depth)
CREATE POLICY "Restrict role inserts to admins"
ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Restrict role updates to admins"
ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Restrict role deletes to admins"
ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));