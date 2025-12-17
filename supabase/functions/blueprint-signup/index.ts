/**
 * Blueprint Signup Edge Function
 * Handles signups for Zero To App Store Blueprint lead magnet
 * Sends welcome email with PDF download link via Resend
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BlueprintRequest {
  email: string;
  name: string;
  referred_by?: string; // Referral code if they came from a referral link
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, name, referred_by }: BlueprintRequest = await req.json()

    // Validate inputs
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!name || name.trim().length < 1) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('blueprint_downloads')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    let userData;
    let isReturningUser = false;

    if (existingUser) {
      // User already exists - return their data
      userData = existingUser
      isReturningUser = true
    } else {
      // Create new user
      const insertData: any = {
        email: email.toLowerCase(),
        name: name.trim(),
      }

      // Add referral if valid
      if (referred_by) {
        // Verify the referral code exists
        const { data: referrer } = await supabase
          .from('blueprint_downloads')
          .select('referral_code')
          .eq('referral_code', referred_by)
          .single()

        if (referrer) {
          insertData.referred_by = referred_by
        }
      }

      const { data: newUser, error: insertError } = await supabase
        .from('blueprint_downloads')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('Database insert error:', insertError)
        throw new Error(`Failed to save signup: ${insertError.message}`)
      }

      userData = newUser

      // Send welcome email to new users only
      await sendWelcomeEmail(email.toLowerCase(), name.trim(), userData.referral_code)
    }

    return new Response(
      JSON.stringify({
        success: true,
        isReturningUser,
        user: {
          email: userData.email,
          name: userData.name,
          referral_code: userData.referral_code,
          referral_count: userData.referral_count || 0,
          unlocked_full_guide: userData.unlocked_full_guide || false,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Blueprint signup error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process signup' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendWelcomeEmail(email: string, name: string, referralCode: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

  if (!resendApiKey) {
    console.log('No RESEND_API_KEY configured - skipping email')
    return
  }

  const pdfUrl = 'https://kxmtbetklikewluwntyx.supabase.co/storage/v1/object/public/blueprints/Zero_To_App_Store_PREVIEW.pdf'
  const referralLink = `https://thefitcheckedhomepage.com/blueprint?ref=${referralCode}`
  const gumroadUrl = 'https://drippedfit.gumroad.com/l/trkfz'
  const firstName = name.split(' ')[0]

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7;
      color: #2C2C2C;
      background-color: #FAF9F6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .logo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px;
      font-weight: 700;
      color: #D4A5A5;
      letter-spacing: -0.5px;
    }
    .card {
      background: #FFFFFF;
      border-radius: 16px;
      padding: 40px 32px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    }
    h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      font-weight: 600;
      color: #2C2C2C;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    p {
      font-size: 16px;
      color: #4A4A4A;
      margin: 0 0 16px 0;
    }
    .button-primary {
      display: inline-block;
      background: linear-gradient(135deg, #D4A5A5 0%, #87CEEB 100%);
      color: #FFFFFF;
      padding: 16px 32px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      margin: 24px 0;
    }
    .button-secondary {
      display: inline-block;
      background: transparent;
      color: #D4A5A5;
      padding: 14px 28px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      border: 2px solid #D4A5A5;
      text-align: center;
    }
    .referral-box {
      background: #FAF9F6;
      border-radius: 12px;
      padding: 24px;
      margin: 28px 0;
      border: 1px dashed #D4A5A5;
    }
    .referral-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #87CEEB;
      margin-bottom: 8px;
    }
    .referral-link {
      font-size: 14px;
      color: #2C2C2C;
      word-break: break-all;
      background: #FFFFFF;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #E8E8E8;
    }
    .divider {
      height: 1px;
      background: #E8E8E8;
      margin: 28px 0;
    }
    .unlock-section {
      text-align: center;
      padding: 24px 0;
    }
    .unlock-title {
      font-size: 18px;
      font-weight: 600;
      color: #2C2C2C;
      margin-bottom: 8px;
    }
    .unlock-text {
      font-size: 14px;
      color: #666666;
      margin-bottom: 16px;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
    }
    .footer p {
      font-size: 13px;
      color: #888888;
    }
    .signature {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #E8E8E8;
    }
    .signature-name {
      font-weight: 600;
      color: #2C2C2C;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">TheFitChecked</div>
    </div>

    <div class="card">
      <h1>Your Blueprint is Ready</h1>

      <p>Hey ${firstName},</p>

      <p>Thank you for grabbing the Zero To App Store Blueprint! Here's your free preview covering Parts 1-4: Mindset, Account Setup, Dev Environment, and Project Setup.</p>

      <div style="text-align: center;">
        <a href="${pdfUrl}" class="button-primary">Download Free Preview (PDF)</a>
      </div>

      <div class="referral-box">
        <div class="referral-label">Your Referral Link</div>
        <div class="referral-link">${referralLink}</div>
        <p style="font-size: 14px; color: #666; margin-top: 12px; margin-bottom: 0;">
          Share with 3 friends to unlock the complete 13-part guide, or grab instant access for $29.
        </p>
      </div>

      <div class="divider"></div>

      <div class="unlock-section">
        <div class="unlock-title">Want the full guide now?</div>
        <div class="unlock-text">Skip the wait and get all 13 parts + 3 appendices instantly.</div>
        <a href="${gumroadUrl}" class="button-secondary">Get Full Guide - $29</a>
      </div>

      <div class="signature">
        <p style="margin-bottom: 4px;">Happy building,</p>
        <p class="signature-name" style="margin-bottom: 0;">Genevie</p>
        <p style="font-size: 13px; color: #888; margin-top: 4px;">Creator of The Fit Checked</p>
      </div>
    </div>

    <div class="footer">
      <p>&copy; 2025 TheFitChecked. All rights reserved.</p>
      <p style="margin-top: 8px;">
        <a href="https://thefitcheckedhomepage.com" style="color: #D4A5A5; text-decoration: none;">thefitcheckedhomepage.com</a>
      </p>
    </div>
  </div>
</body>
</html>
`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Genevie <hello@thefitcheckedhomepage.com>',
        to: email,
        subject: 'Your Zero To App Store Blueprint is here',
        html: emailHtml,
      }),
    })

    if (response.ok) {
      console.log('Welcome email sent successfully to:', email)
    } else {
      const errorData = await response.text()
      console.error('Resend API error:', errorData)
    }
  } catch (emailError) {
    console.error('Email sending error:', emailError)
  }
}
