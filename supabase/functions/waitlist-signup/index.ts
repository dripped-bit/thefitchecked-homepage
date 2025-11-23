/**
 * Waitlist Signup Edge Function
 * Handles email signups for TheFitChecked marketing waitlist
 * Sends confirmation email via Gmail API
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WaitlistRequest {
  email: string;
  name?: string;
  source?: string; // Where they signed up from (homepage, blog, etc.)
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { email, name, source = 'homepage' }: WaitlistRequest = await req.json()

    // Validate email
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Generate confirmation token
    const confirmationToken = crypto.randomUUID()
    const confirmationUrl = `${supabaseUrl}/functions/v1/waitlist-confirm?token=${confirmationToken}`

    // Check if email already exists
    const { data: existing } = await supabase
      .from('waitlist_signups')
      .select('id, confirmed')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      if (existing.confirmed) {
        return new Response(
          JSON.stringify({ 
            message: 'This email is already confirmed on our waitlist!',
            alreadyConfirmed: true 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else {
        // Resend confirmation email
        await supabase
          .from('waitlist_signups')
          .update({ 
            confirmation_token: confirmationToken,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
      }
    } else {
      // Insert new signup
      const { error: insertError } = await supabase
        .from('waitlist_signups')
        .insert({
          email: email.toLowerCase(),
          name: name || null,
          source,
          confirmation_token: confirmationToken,
          confirmed: false,
          signup_date: new Date().toISOString()
        })

      if (insertError) {
        console.error('Database insert error:', insertError)
        throw new Error(`Failed to save signup: ${insertError.message}`)
      }
    }

    // Send confirmation email via Gmail SMTP
    console.log('Sending confirmation email to:', email)
    
    const gmailEmail = Deno.env.get('GMAIL_EMAIL')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    // HTML email template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #2C2C2C; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 40px; }
          .logo { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, #FF69B4, #9370DB); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .content { background: #FFF5F7; border-radius: 20px; padding: 40px; text-align: center; }
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
            <h1 style="color: #FF69B4; margin-bottom: 20px;">You're Almost There!</h1>
            <p style="font-size: 1.1rem; margin-bottom: 30px;">
              ${name ? `Hi ${name}, ` : 'Hi there! '}
              Thank you for joining the TheFitChecked waitlist! Click the button below to confirm your email and secure your spot.
            </p>
            <a href="${confirmationUrl}" class="button">Confirm My Email</a>
            <p style="margin-top: 30px; color: #666;">
              🎁 As a waitlist member, you'll get:<br>
              ✨ 50% off lifetime premium<br>
              👗 Early access to all features<br>
              💎 Exclusive style tips & updates
            </p>
          </div>
          <div class="footer">
            <p>If you didn't sign up for TheFitChecked, please ignore this email.</p>
            <p>&copy; 2025 TheFitChecked. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const emailText = `
      Welcome to TheFitChecked!
      
      ${name ? `Hi ${name}, ` : 'Hi there! '}
      
      Thank you for joining our waitlist. Please confirm your email by clicking this link:
      ${confirmationUrl}
      
      As a waitlist member, you'll get:
      - 50% off lifetime premium
      - Early access to all features
      - Exclusive style tips & updates
      
      If you didn't sign up, please ignore this email.
      
      © 2025 TheFitChecked. All rights reserved.
    `

    // Send email using Gmail SMTP
    try {
      const client = new SmtpClient()
      
      await client.connectTLS({
        hostname: 'smtp.gmail.com',
        port: 465,
        username: gmailEmail,
        password: gmailPassword,
      })

      await client.send({
        from: gmailEmail,
        to: email,
        subject: 'Confirm your TheFitChecked waitlist signup',
        content: emailHtml,
        html: emailHtml,
      })

      await client.close()
      console.log('Confirmation email sent successfully to:', email)
    } catch (emailError) {
      console.error('Email sending error:', emailError)
      console.error('Error details:', JSON.stringify(emailError, null, 2))
      console.error('SMTP Config:', {
        hostname: 'smtp.gmail.com',
        port: 465,
        username: gmailEmail,
        hasPassword: !!gmailPassword,
        passwordLength: gmailPassword?.length
      })
      // Don't fail the request if email fails - the signup is saved
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Check your email to confirm your waitlist signup!',
        email 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Waitlist signup error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process signup',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
