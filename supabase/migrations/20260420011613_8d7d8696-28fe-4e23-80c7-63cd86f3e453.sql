-- 1. Add provider_id to bookings for assignment-scoped access
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON public.bookings(provider_id);

-- 2. Replace the overly broad provider SELECT policy
DROP POLICY IF EXISTS "Providers can view assigned bookings" ON public.bookings;

CREATE POLICY "Providers can view assigned bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'provider'::app_role)
  AND provider_id = auth.uid()
);

-- Allow providers to update only bookings assigned to them (e.g., progress notes)
CREATE POLICY "Providers can update assigned bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'provider'::app_role)
  AND provider_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'provider'::app_role)
  AND provider_id = auth.uid()
);

-- 3. Remove the user UPDATE policy entirely.
-- Clients should not be able to mutate payment_status, status, or amount.
-- All such changes must go via admin actions or the PayFast IPN (service role).
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;