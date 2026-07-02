import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { name, email, phone, reason } = await req.json()
    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'name and email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY_1') ?? Deno.env.get('RESEND_API_KEY')
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'email not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const escape = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]!))

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">New "I Want This!" Submission</h2>
        <p style="margin:0 0 8px"><strong>Name:</strong> ${escape(name)}</p>
        <p style="margin:0 0 8px"><strong>Email:</strong> ${escape(email)}</p>
        <p style="margin:0 0 8px"><strong>Phone:</strong> ${escape(phone || '—')}</p>
        <p style="margin:16px 0 4px"><strong>Reason:</strong></p>
        <p style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px;margin:0">${escape(reason || '—')}</p>
        <p style="margin:24px 0 0;color:#666;font-size:12px">Sent from Phaos AI sandbox</p>
      </div>`

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Phaos AI <onboarding@resend.dev>',
        to: ['daniel@phaosai.com'],
        reply_to: email,
        subject: `I Want This! — ${name}`,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'send_failed', details: data }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
