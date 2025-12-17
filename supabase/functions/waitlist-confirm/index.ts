/**
 * Waitlist Confirmation Edge Function
 * Confirms email addresses and sends welcome email via Gmail
 * Includes blueprint referral link promotion
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get or create blueprint referral code
async function getOrCreateBlueprintCode(supabase: any, email: string, name?: string): Promise<string> {
  const normalizedEmail = email.toLowerCase()

  // Check if user already has a blueprint entry
  const { data: existing } = await supabase
    .from('blueprint_downloads')
    .select('referral_code')
    .eq('email', normalizedEmail)
    .single()

  if (existing?.referral_code) {
    return existing.referral_code
  }

  // Create new blueprint entry
  const { data: newEntry, error } = await supabase
    .from('blueprint_downloads')
    .insert({
      email: normalizedEmail,
      name: name || 'Friend',
    })
    .select('referral_code')
    .single()

  if (error) {
    console.error('Failed to create blueprint entry:', error)
    return ''
  }

  return newEntry?.referral_code || ''
}

// Blueprint P.S. section for emails
function getBlueprintPS(referralCode: string): string {
  if (!referralCode) return ''

  return `
    <div style="margin-top: 40px; padding-top: 30px; border-top: 2px dashed #F8B4D9;">
      <p style="font-size: 0.95rem; color: #4A4A4A; margin-bottom: 15px;">
        <strong>P.S.</strong> Want to build your own app? I created a free guide showing exactly how I built The Fit Checked with no coding experience.
      </p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="https://thefitcheckedhomepage.com/blueprint?ref=${referralCode}"
           style="display: inline-block; background: #F8B4D9; color: #000; padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: 600;">
          Get the Free Blueprint
        </a>
      </p>
      <p style="font-size: 0.85rem; color: #666; text-align: center;">
        Share with 3 friends to unlock the full guide!
      </p>
    </div>
  `
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get token from URL params
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(
        'Missing confirmation token',
        { status: 400, headers: corsHeaders }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find signup by token
    const { data: signup, error: fetchError } = await supabase
      .from('waitlist_signups')
      .select('*')
      .eq('confirmation_token', token)
      .single()

    if (fetchError || !signup) {
      return new Response(
        'Invalid or expired confirmation link',
        { status: 404, headers: corsHeaders }
      )
    }

    // Check if already confirmed
    if (signup.confirmed) {
      // Redirect to success page
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': 'https://thefitcheckedhomepage.com/?confirmed=already'
        }
      })
    }

    // Update signup to confirmed
    const { error: updateError } = await supabase
      .from('waitlist_signups')
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        confirmation_token: null // Clear token after use
      })
      .eq('id', signup.id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error('Failed to confirm signup')
    }

    console.log('Waitlist confirmed for:', signup.email)

    // Get or create blueprint referral code
    const blueprintCode = await getOrCreateBlueprintCode(supabase, signup.email, signup.name)
    const blueprintPS = getBlueprintPS(blueprintCode)

    // Send welcome email via Gmail SMTP
    const gmailEmail = Deno.env.get('GMAIL_EMAIL')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    const welcomeEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #2C2C2C; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 40px; }
          .logo { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, #FF69B4, #9370DB); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .content { background: #FFF5F7; border-radius: 20px; padding: 40px; }
          .badge { display: inline-block; background: linear-gradient(135deg, #FF69B4, #9370DB); color: white; padding: 8px 20px; border-radius: 20px; font-weight: 600; margin-bottom: 20px; }
          .benefits { text-align: left; margin: 30px 0; }
          .benefit { margin: 15px 0; padding-left: 30px; position: relative; }
          .benefit:before { content: '✨'; position: absolute; left: 0; font-size: 1.2rem; }
          .button { display: inline-block; background: linear-gradient(135deg, #FF69B4, #9370DB); color: white; padding: 16px 40px; border-radius: 50px; text-decoration: none; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; margin-top: 40px; color: #666; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">TheFitChecked</div>
          </div>
          <div class="content">
            <span class="badge">✅ CONFIRMED</span>
            <h1 style="color: #FF69B4; margin-bottom: 20px;">Welcome to the Fashion Revolution!</h1>
            <p style="font-size: 1.1rem; margin-bottom: 30px;">
              ${signup.name ? `Hi ${signup.name}, ` : 'Hi there! '}
              You're now on the official TheFitChecked waitlist! 🎉
            </p>
            
            <div class="benefits">
              <div class="benefit">
                <strong>50% OFF Lifetime Premium</strong><br>
                Lock in exclusive launch pricing forever
              </div>
              <div class="benefit">
                <strong>Early Access</strong><br>
                Be first to try AI styling & virtual try-ons
              </div>
              <div class="benefit">
                <strong>Exclusive Updates</strong><br>
                Get insider fashion tips & feature previews
              </div>
              <div class="benefit">
                <strong>VIP Support</strong><br>
                Priority access to our styling team
              </div>
            </div>

            <p style="margin-top: 30px; color: #666;">
              We'll notify you as soon as we launch. Get ready to transform your wardrobe! 💃
            </p>

            <a href="https://thefitcheckedhomepage.com" class="button">Visit Our Website</a>
            ${blueprintPS}
          </div>
          <div class="footer">
            <p>Follow us for style inspiration:</p>
            <p>
              <a href="#" style="color: #FF69B4; margin: 0 10px;">Instagram</a> |
              <a href="#" style="color: #FF69B4; margin: 0 10px;">TikTok</a> |
              <a href="#" style="color: #FF69B4; margin: 0 10px;">Pinterest</a>
            </p>
            <p style="margin-top: 20px;">&copy; 2025 TheFitChecked. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      
      if (resendApiKey) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `TheFitChecked <${gmailEmail}>`,
            to: signup.email,
            subject: '🎉 Welcome to TheFitChecked Waitlist!',
            html: welcomeEmailHtml,
          }),
        })

        if (emailResponse.ok) {
          console.log('Welcome email sent to:', signup.email)
        } else {
          const errorData = await emailResponse.text()
          console.error('Resend API error:', errorData)
        }
      } else {
        console.log('Email would be sent to:', signup.email)
        console.log('No email service configured - add RESEND_API_KEY secret')
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError)
      console.error('Error details:', JSON.stringify(emailError, null, 2))
    }

    // Redirect to success page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': 'https://thefitcheckedhomepage.com/?confirmed=success'
      }
    })

  } catch (error) {
    console.error('Confirmation error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to confirm signup',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
