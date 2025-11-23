/**
 * Contact Form Edge Function
 * Handles contact form submissions with smart email routing and auto-responses
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContactFormData {
  name: string;
  email: string;
  subject_type: string;
  subject_display: string;
  message: string;
}

// Email routing configuration
const emailRouting: Record<string, string> = {
  'support': 'support@thefitchecked.com',
  'press': 'press@thefitchecked.com',
  'general': 'hello@thefitchecked.com',
  'feedback': 'hello@thefitchecked.com',
  'partnership': 'hello@thefitchecked.com',
  'careers': 'hello@thefitchecked.com',
  'other': 'hello@thefitchecked.com',
}

// Auto-response email templates
function generateAutoResponseEmail(data: ContactFormData, ticketId: string): { subject: string; html: string } {
  const { name, subject_type, subject_display, message } = data
  
  const templates: Record<string, { subject: string; content: string }> = {
    support: {
      subject: "We've received your support request 🛠️",
      content: `
        <h2>Thanks for reaching out to TheFitChecked Support!</h2>
        <p><strong>Support Ticket:</strong> #${ticketId}</p>
        <p><strong>Subject:</strong> ${subject_display}</p>
        <p><strong>Priority:</strong> Standard (24-48 hour response)</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p><strong>Your issue:</strong></p>
          <p>${message}</p>
        </div>
        
        <h3>What's next?</h3>
        <ol>
          <li>Our support team is reviewing your request</li>
          <li>You'll hear back within 24-48 hours</li>
          <li>Premium users get priority support!</li>
        </ol>
        
        <p><strong>Need faster help?</strong></p>
        <ul>
          <li>Check our FAQ: <a href="https://thefitcheckedhomepage.com/support.html">Support Center</a></li>
          <li>DM us on social media for quick questions</li>
        </ul>
        
        <p>We're here to help!</p>
        <p><strong>TheFitChecked Support Team</strong><br>support@thefitchecked.com</p>
      `
    },
    press: {
      subject: "Press Inquiry Received - TheFitChecked Media Kit 📰",
      content: `
        <h2>Thank you for your interest in covering TheFitChecked!</h2>
        <p>We've received your press inquiry and our media team will respond within 24 hours.</p>
        
        <h3>Quick Facts:</h3>
        <ul>
          <li>🚀 <strong>Launch:</strong> January 2026</li>
          <li>💡 <strong>Product:</strong> AI-powered fashion styling & wardrobe management</li>
          <li>👥 <strong>Team:</strong> Austin, Texas-based startup</li>
          <li>🎯 <strong>Mission:</strong> Making fashion accessible through AI</li>
        </ul>
        
        <h3>Press Resources:</h3>
        <ul>
          <li>High-res logos & screenshots (coming soon)</li>
          <li>Founder bio & story</li>
          <li>Product demo access</li>
          <li>Interview opportunities</li>
        </ul>
        
        <p><strong>Questions?</strong><br>
        Email: press@thefitchecked.com<br>
        Follow: @thefitchecked on all platforms</p>
        
        <p>Looking forward to connecting!</p>
        <p><strong>TheFitChecked Media Team</strong></p>
      `
    },
    general: {
      subject: "Thanks for reaching out to TheFitChecked! 👋",
      content: `
        <h2>Thank you for contacting TheFitChecked!</h2>
        <p>We've received your message and our team will review it shortly.</p>
        
        <h3>What happens next?</h3>
        <ul>
          <li>✅ Our team reviews your message (usually within 24-48 hours)</li>
          <li>📧 We'll respond directly to this email address</li>
          <li>💬 Need immediate help? DM us on Instagram @thefitchecked</li>
        </ul>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p><strong>Your message:</strong></p>
          <p>${message}</p>
        </div>
        
        <h3>In the meantime:</h3>
        <ul>
          <li>🎁 Join our waitlist for 50% off lifetime premium</li>
          <li>🚀 Follow us for launch updates</li>
          <li>📱 Download the app (coming Jan 2026)</li>
        </ul>
        
        <p>Thanks for being part of the TheFitChecked community!</p>
        <p><strong>Best,<br>The TheFitChecked Team</strong><br>
        <a href="https://thefitcheckedhomepage.com">thefitcheckedhomepage.com</a></p>
      `
    }
  }
  
  const template = templates[subject_type] || templates.general
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #2C2C2C; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { font-family: 'Playfair Display', serif; color: #FF69B4; }
        a { color: #FF69B4; text-decoration: none; }
        ul, ol { padding-left: 20px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #f0f0f0; color: #666; font-size: 0.9rem; text-align: center; }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 2rem; background: linear-gradient(135deg, #FF69B4, #9370DB); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">TheFitChecked</h1>
      </div>
      
      <p>Hi ${name},</p>
      
      ${template.content}
      
      <div class="footer">
        <p>&copy; 2025 TheFitChecked. All rights reserved.</p>
        <p>Austin, Texas, USA</p>
      </div>
    </body>
    </html>
  `
  
  return {
    subject: template.subject,
    html
  }
}

// Team notification email
function generateTeamNotification(data: ContactFormData, ticketId: string, routedTo: string): string {
  const { name, email, subject_type, subject_display, message } = data
  const timestamp = new Date().toISOString()
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: monospace; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .message-box { background: #fff5f7; padding: 20px; border-left: 4px solid #FF69B4; margin: 20px 0; }
        .metadata { color: #666; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>🔔 New Contact Form Submission</h2>
        <p class="metadata">Ticket #${ticketId} | ${timestamp}</p>
      </div>
      
      <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
      <p><strong>Subject:</strong> ${subject_display}</p>
      <p><strong>Type:</strong> ${subject_type}</p>
      <p><strong>Routed To:</strong> ${routedTo}</p>
      
      <div class="message-box">
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      </div>
      
      <hr>
      
      <p><strong>Status:</strong> Awaiting response</p>
      <p><strong>Auto-response:</strong> ✅ Sent to customer</p>
      
      <p><em>Reply to this email to respond directly to the customer.</em></p>
    </body>
    </html>
  `
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const data: ContactFormData = await req.json()
    
    // Validate required fields
    if (!data.name || !data.email || !data.subject_type || !data.message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (!emailRegex.test(data.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Determine routing
    const routedTo = emailRouting[data.subject_type] || emailRouting.general
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Save to database
    const { data: submission, error: dbError } = await supabase
      .from('contact_submissions')
      .insert({
        name: data.name,
        email: data.email.toLowerCase(),
        subject_type: data.subject_type,
        subject_display: data.subject_display,
        message: data.message,
        routed_to: routedTo,
        status: 'new',
      })
      .select()
      .single()
    
    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error(`Failed to save submission: ${dbError.message}`)
    }
    
    const ticketId = submission.id.substring(0, 8).toUpperCase()
    console.log('Contact form submitted:', { ticketId, email: data.email, type: data.subject_type })
    
    // Send emails via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('GMAIL_EMAIL') || 'onboarding@resend.dev'
    
    let autoResponseSent = false
    let teamEmailSent = false
    
    if (resendApiKey) {
      try {
        // Send auto-response to customer
        const autoResponse = generateAutoResponseEmail(data, ticketId)
        const customerEmailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `TheFitChecked <${fromEmail}>`,
            to: data.email,
            subject: autoResponse.subject,
            html: autoResponse.html,
          }),
        })
        
        if (customerEmailResponse.ok) {
          autoResponseSent = true
          console.log('Auto-response sent to:', data.email)
        } else {
          console.error('Auto-response failed:', await customerEmailResponse.text())
        }
        
        // Send notification to team
        const teamNotification = generateTeamNotification(data, ticketId, routedTo)
        const teamEmailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `TheFitChecked Contact Form <${fromEmail}>`,
            to: routedTo,
            replyTo: data.email,
            subject: `New Contact: ${data.subject_display} - Ticket #${ticketId}`,
            html: teamNotification,
          }),
        })
        
        if (teamEmailResponse.ok) {
          teamEmailSent = true
          console.log('Team notification sent to:', routedTo)
        } else {
          console.error('Team notification failed:', await teamEmailResponse.text())
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError)
      }
      
      // Update database with email status
      await supabase
        .from('contact_submissions')
        .update({
          auto_response_sent: autoResponseSent,
          team_email_sent: teamEmailSent,
        })
        .eq('id', submission.id)
    } else {
      console.log('No Resend API key - emails not sent')
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contact form submitted successfully',
        ticketId,
        autoResponseSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Contact form error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process contact form',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
