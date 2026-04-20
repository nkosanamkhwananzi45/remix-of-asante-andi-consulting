import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function md5(input: string): Promise<string> {
  const { createHash } = await import('https://deno.land/std@0.177.0/node/crypto.ts')
  const hash = createHash('md5')
  hash.update(input)
  return hash.digest('hex') as string
}

async function generateSignature(data: Record<string, string>, passphrase?: string): Promise<string> {
  const params = Object.keys(data)
    .filter(key => data[key] !== '' && data[key] !== undefined)
    .sort()
    .map(key => `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}`)
    .join('&')

  const signatureString = passphrase ? `${params}&passphrase=${encodeURIComponent(passphrase)}` : params
  return await md5(signatureString)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const token = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const authedClient = createClient(supabaseUrl, anonKey)
    const { data: userData, error: userErr } = await authedClient.auth.getUser(token)
    if (userErr || !userData?.user) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const user = userData.user

    // 2. Validate input
    const body = await req.json().catch(() => null) as { bookingId?: string } | null
    const bookingId = body?.bookingId
    if (!bookingId || typeof bookingId !== 'string') {
      return json({ error: 'Missing bookingId' }, 400)
    }

    // 3. Fetch the canonical booking from DB (service role bypasses RLS for read)
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: booking, error: bErr } = await adminClient
      .from('bookings')
      .select('id, user_id, amount, package_selected, full_name, email')
      .eq('id', bookingId)
      .maybeSingle()

    if (bErr || !booking) {
      return json({ error: 'Booking not found' }, 404)
    }

    // 4. Ownership check
    if (booking.user_id !== user.id) {
      return json({ error: 'Forbidden' }, 403)
    }

    // 5. Server-trusted amount
    const amountNum = Number(booking.amount)
    if (!amountNum || amountNum <= 0) {
      return json({ error: 'Invalid booking amount' }, 400)
    }

    const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID') || '10000100'
    const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY') || '46f0cd694581a'
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') || ''
    const siteUrl = Deno.env.get('SITE_URL') || 'https://asanteandi.co.za'

    const firstName = (booking.full_name || '').split(' ')[0] || ''
    const itemName = (booking.package_selected || 'Booking').toString().substring(0, 100)

    const paymentData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${siteUrl}/book/success`,
      cancel_url: `${siteUrl}/book/cancel`,
      notify_url: `${supabaseUrl}/functions/v1/payfast-ipn`,
      email_address: booking.email || user.email || '',
      m_payment_id: booking.id,
      amount: amountNum.toFixed(2),
      item_name: itemName,
      name_first: firstName,
    }

    const signature = await generateSignature(paymentData, passphrase || undefined)
    paymentData.signature = signature

    const queryString = Object.entries(paymentData)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')

    return json({
      redirectUrl: `https://www.payfast.co.za/eng/process?${queryString}`,
      paymentData,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})
