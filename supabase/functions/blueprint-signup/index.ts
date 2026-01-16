/**
 * Blueprint Signup Edge Function
 * Handles signups for Zero To App Store Blueprint lead magnet
 * Sends welcome email with PDF download link via Resend
 * Notifies referrers when someone uses their link
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PDF URLs
const PREVIEW_PDF_URL = 'https://kxmtbetklikewluwntyx.supabase.co/storage/v1/object/public/blueprints/Zero_To_App_Store_PREVIEW.pdf'
const FULL_PDF_URL = 'https://kxmtbetklikewluwntyx.supabase.co/storage/v1/object/public/blueprints/Zero_To_App_Store_FULL.pdf'
const GUMROAD_URL = 'https://drippedfit.gumroad.com/l/trkfz'

interface BlueprintRequest {
  email: string;
  name?: string;
  referred_by?: string;
  action?: 'signup' | 'check_progress';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: BlueprintRequest = await req.json()
    const { email, name, referred_by, action = 'signup' } = body

    // Validate email
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Handle "check progress" action
    if (action === 'check_progress') {
      const { data: user } = await supabase
        .from('blueprint_downloads')
        .select('*')
        .eq('email', email.toLowerCase())
        .single()

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Email not found. Please sign up first.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            email: user.email,
            name: user.name,
            referral_code: user.referral_code,
            referral_count: user.referral_count || 0,
            unlocked_full_guide: user.unlocked_full_guide || false,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Regular signup flow
    if (!name || name.trim().length < 1) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('blueprint_downloads')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    let userData;
    let isReturningUser = false;

    if (existingUser) {
      userData = existingUser
      isReturningUser = true
    } else {
      // Create new user
      const insertData: any = {
        email: email.toLowerCase(),
        name: name.trim(),
      }

      // Validate and add referral
      let validReferrer = null
      if (referred_by) {
        const { data: referrer } = await supabase
          .from('blueprint_downloads')
          .select('*')
          .eq('referral_code', referred_by)
          .single()

        if (referrer) {
          insertData.referred_by = referred_by
          validReferrer = referrer
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

      // Send welcome email to new user
      await sendWelcomeEmail(email.toLowerCase(), name.trim(), userData.referral_code)

      // If there was a valid referrer, update their count and notify them
      if (validReferrer) {
        // Increment referrer's count
        const newCount = (validReferrer.referral_count || 0) + 1
        const unlocked = newCount >= 3

        await supabase
          .from('blueprint_downloads')
          .update({
            referral_count: newCount,
            unlocked_full_guide: unlocked,
            updated_at: new Date().toISOString()
          })
          .eq('referral_code', referred_by)

        // Send notification email to referrer
        await sendReferralNotificationEmail(
          validReferrer.email,
          validReferrer.name,
          newCount,
          unlocked
        )
      }
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

// Email template styles (shared)
const emailStyles = `
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.7;
    color: #000000;
    background-color: #FFFFFF;
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
    color: #F8B4D9;
    letter-spacing: -0.5px;
  }
  .card {
    background: #FFF9FB;
    border-radius: 16px;
    padding: 40px 32px;
    border: 1px solid #F8B4D9;
  }
  h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 28px;
    font-weight: 600;
    color: #000000;
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
    background: #F8B4D9;
    color: #000000;
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
    background: #A7C7E7;
    color: #000000;
    padding: 14px 28px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    text-align: center;
  }
  .referral-box {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 24px;
    margin: 28px 0;
    border: 2px dashed #F8B4D9;
  }
  .referral-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #A7C7E7;
    margin-bottom: 8px;
  }
  .referral-link {
    font-size: 14px;
    color: #000000;
    word-break: break-all;
    background: #F5FAFF;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #A7C7E7;
  }
  .progress-box {
    background: #F5FAFF;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    margin: 20px 0;
  }
  .progress-number {
    font-size: 48px;
    font-weight: 700;
    color: #F8B4D9;
  }
  .divider {
    height: 1px;
    background: #E8E8E8;
    margin: 28px 0;
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
`

async function sendWelcomeEmail(email: string, name: string, referralCode: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('GMAIL_EMAIL') || 'onboarding@resend.dev'

  if (!resendApiKey) {
    console.log('No RESEND_API_KEY configured - skipping email')
    return
  }

  console.log('Attempting to send welcome email to:', email, 'from:', fromEmail)

  const referralLink = `https://thefitcheckedhomepage.com/blueprint?ref=${referralCode}`
  const firstName = name.split(' ')[0]

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${emailStyles}</style>
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
        <a href="${PREVIEW_PDF_URL}" class="button-primary">Download Free Preview (PDF)</a>
      </div>

      <div class="referral-box">
        <div class="referral-label">Your Referral Link</div>
        <div class="referral-link">${referralLink}</div>
        <p style="font-size: 14px; color: #4A4A4A; margin-top: 12px; margin-bottom: 0;">
          Share with 3 friends to unlock the complete 13-part guide, or grab instant access for $29.
        </p>
      </div>

      <div class="divider"></div>

      <div style="text-align: center; padding: 24px 0;">
        <p style="font-size: 18px; font-weight: 600; color: #000; margin-bottom: 8px;">Want the full guide now?</p>
        <p style="font-size: 14px; color: #4A4A4A; margin-bottom: 16px;">Skip the wait and get all 13 parts + 3 appendices instantly.</p>
        <a href="${GUMROAD_URL}" class="button-secondary">Get Full Guide - $29</a>
      </div>

      <div class="signature">
        <p style="margin-bottom: 4px;">Happy building,</p>
        <p style="font-weight: 600; color: #000; margin-bottom: 0;">Genevie</p>
        <p style="font-size: 13px; color: #888; margin-top: 4px;">Creator of The Fit Checked</p>
      </div>
    </div>

    <div class="footer">
      <p>&copy; 2025 TheFitChecked. All rights reserved.</p>
      <p style="margin-top: 8px;">
        <a href="https://thefitcheckedhomepage.com" style="color: #F8B4D9; text-decoration: none;">thefitcheckedhomepage.com</a>
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
        from: `Genevie <${fromEmail}>`,
        to: email,
        subject: 'Your Zero To App Store Blueprint is here',
        html: emailHtml,
      }),
    })

    const responseText = await response.text()
    if (response.ok) {
      console.log('Welcome email sent successfully to:', email, 'Response:', responseText)
    } else {
      console.error('Resend API error:', response.status, responseText)
    }
  } catch (emailError) {
    console.error('Email sending error:', emailError)
  }
}

async function sendReferralNotificationEmail(email: string, name: string, count: number, unlocked: boolean) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('GMAIL_EMAIL') || 'onboarding@resend.dev'

  if (!resendApiKey) {
    console.log('No RESEND_API_KEY configured - skipping referral notification')
    return
  }

  const firstName = name.split(' ')[0]
  const remaining = 3 - count

  if (unlocked) {
    // Send "You unlocked the full guide!" email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">TheFitChecked</div>
    </div>

    <div class="card">
      <h1 style="text-align: center;">You Unlocked the Full Blueprint!</h1>

      <p>Hey ${firstName},</p>

      <p>Congrats! 3 friends have signed up using your referral link. As promised, here's your complete Zero To App Store Blueprint with all 13 parts and 3 appendices.</p>

      <div style="text-align: center;">
        <a href="${FULL_PDF_URL}" class="button-primary">Download Full Guide (PDF)</a>
      </div>

      <div class="progress-box">
        <div class="progress-number">3/3</div>
        <p style="margin: 0; color: #4A4A4A;">Referrals Complete!</p>
      </div>

      <p>Thanks for spreading the word about the Blueprint. Now go build something amazing!</p>

      <div class="signature">
        <p style="margin-bottom: 4px;">Cheers,</p>
        <p style="font-weight: 600; color: #000; margin-bottom: 0;">Genevie</p>
        <p style="font-size: 13px; color: #888; margin-top: 4px;">Creator of The Fit Checked</p>
      </div>
    </div>

    <div class="footer">
      <p>&copy; 2025 TheFitChecked. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Genevie <${fromEmail}>`,
          to: email,
          subject: 'You unlocked the full Blueprint!',
          html: emailHtml,
        }),
      })
      console.log('Unlock email sent to:', email)
    } catch (err) {
      console.error('Failed to send unlock email:', err)
    }

  } else {
    // Send "Someone signed up" notification
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">TheFitChecked</div>
    </div>

    <div class="card">
      <h1>Someone just signed up with your link!</h1>

      <p>Hey ${firstName},</p>

      <p>Great news! Someone just grabbed the Blueprint using your referral link.</p>

      <div class="progress-box">
        <div class="progress-number">${count}/3</div>
        <p style="margin: 0; color: #4A4A4A;">${remaining} more to unlock the full guide!</p>
      </div>

      <p>Keep sharing your link to unlock the complete 13-part guide with all the advanced topics: AI integration, monetization, App Store submission, and more.</p>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${GUMROAD_URL}" class="button-secondary">Or get instant access for $29</a>
      </div>

      <div class="signature">
        <p style="margin-bottom: 4px;">Keep it up!</p>
        <p style="font-weight: 600; color: #000; margin-bottom: 0;">Genevie</p>
      </div>
    </div>

    <div class="footer">
      <p>&copy; 2025 TheFitChecked. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Genevie <${fromEmail}>`,
          to: email,
          subject: 'Someone just signed up with your link!',
          html: emailHtml,
        }),
      })
      console.log('Referral notification sent to:', email)
    } catch (err) {
      console.error('Failed to send referral notification:', err)
    }
  }
}
