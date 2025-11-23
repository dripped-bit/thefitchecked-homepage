# Resend Email Setup for Waitlist

## Why We Switched from Gmail SMTP

The Gmail SMTP library (`deno.land/x/smtp`) is incompatible with Supabase Edge Functions due to deprecated Deno APIs. Resend is the recommended email service for Supabase Edge Functions.

## Setup Instructions

### Step 1: Create Resend Account

1. Go to: https://resend.com/signup
2. Sign up for a free account
3. Verify your email

### Step 2: Get API Key

1. Go to: https://resend.com/api-keys
2. Click "Create API Key"
3. Name it: "Supabase Waitlist"
4. Copy the API key (starts with `re_`)

### Step 3: Verify Domain (Optional but Recommended)

**For production emails:**
1. Go to: https://resend.com/domains
2. Click "Add Domain"
3. Enter: `thefitcheckedhomepage.com`
4. Add the DNS records they provide to your domain registrar
5. Wait for verification (usually 5-10 minutes)

**For testing (no domain verification needed):**
- You can send emails immediately using `onboarding@resend.dev` as the from address
- Limited to 100 emails/day

### Step 4: Add API Key to Supabase

Run these commands in your terminal:

```bash
# Set token
export SUPABASE_ACCESS_TOKEN=sbp_eadc67a7eab5ef5bf09002edb5f408bd84d716d5

# Navigate to project
cd /Users/genevie/Developer/webpage

# Add Resend API key
supabase secrets set RESEND_API_KEY=re_your_api_key_here

# Optional: Update from email if domain is verified
supabase secrets set GMAIL_EMAIL=hello@thefitcheckedhomepage.com

# If domain not verified, use Resend's onboarding email
supabase secrets set GMAIL_EMAIL=onboarding@resend.dev
```

### Step 5: Deploy Functions

```bash
supabase functions deploy waitlist-signup --no-verify-jwt
supabase functions deploy waitlist-confirm --no-verify-jwt
```

### Step 6: Test

1. Go to your website
2. Sign up with your email
3. Check inbox for confirmation email
4. Click confirmation link
5. Check inbox for welcome email

---

## Email Configuration

### Using Verified Domain (Recommended)
```bash
RESEND_API_KEY=re_xxxxx
GMAIL_EMAIL=hello@thefitcheckedhomepage.com  # Your verified domain
```

### Using Resend's Test Email (For Testing)
```bash
RESEND_API_KEY=re_xxxxx
GMAIL_EMAIL=onboarding@resend.dev  # Resend's test address
```

---

## Resend Features

✅ **Free Tier:**
- 100 emails/day
- 3,000 emails/month
- Perfect for waitlist

✅ **Reliable:**
- Works perfectly with Supabase Edge Functions
- No SMTP connection issues
- Fast delivery

✅ **Simple API:**
- Just HTTP POST requests
- No complex SMTP libraries
- Works with Deno fetch

---

## Troubleshooting

### "Domain not verified"
**Solution:** Use `onboarding@resend.dev` for testing, or verify your domain

### "API key invalid"
**Solution:** Make sure you copied the full key starting with `re_`

### "Rate limit exceeded"
**Solution:** Upgrade to paid plan or wait until next day (free tier resets daily)

---

## Pricing

**Free Plan:**
- 100 emails/day
- 3,000 emails/month
- Perfect for starting out

**Pro Plan ($20/month):**
- 50,000 emails/month
- Custom domains
- Analytics

---

## Next Steps

1. Sign up at https://resend.com
2. Get your API key
3. Run the setup commands above
4. Test your waitlist!

---

## Support

- Resend Docs: https://resend.com/docs
- Supabase + Resend: https://resend.com/docs/send-with-supabase-edge-functions
