# Supabase Waitlist Setup Guide

## Overview
This guide sets up a complete waitlist system for the TheFitChecked marketing website using Supabase Edge Functions and Gmail API for email confirmations.

## Prerequisites
- ✅ Separate Supabase project for marketing website
- ✅ Gmail API key installed in Supabase
- Node.js and npm installed

---

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

Verify installation:
```bash
supabase --version
```

---

## Step 2: Link to Your Supabase Project

```bash
cd /Users/genevie/Developer/webpage
supabase link --project-ref YOUR-PROJECT-REF
```

**To find your project ref:**
1. Go to https://app.supabase.com
2. Select your marketing website project
3. Go to Settings → API
4. Copy the "Project Reference ID"

**Example:**
```bash
supabase link --project-ref abcdefghijklmnop
```

---

## Step 3: Create Database Table

Run the migration to create the `waitlist_signups` table:

```bash
cd /Users/genevie/Developer/webpage
supabase db push
```

Or manually run the SQL in Supabase Dashboard:
1. Go to SQL Editor in your Supabase dashboard
2. Open `supabase/migrations/20251122_create_waitlist_table.sql`
3. Copy and paste the SQL
4. Run the query

---

## Step 4: Configure Environment Variables

In your Supabase project dashboard, go to **Settings → Edge Functions** and add these secrets:

```bash
# Your Gmail SMTP credentials
GMAIL_EMAIL=hello@thefitcheckedhomepage.com
GMAIL_APP_PASSWORD=sysxgwyvuekzkhh

# These are automatically available (no need to set):
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
```

**To set secrets:**
```bash
supabase secrets set GMAIL_EMAIL=hello@thefitcheckedhomepage.com
supabase secrets set GMAIL_APP_PASSWORD=sysxgwyvuekzkhh
```

Or via dashboard:
1. Project Settings → Edge Functions
2. Click "Add Secret"
3. Add each key-value pair

---

## Step 5: Deploy Edge Functions

Deploy both functions to Supabase:

```bash
cd /Users/genevie/Developer/webpage

# Deploy waitlist signup function
supabase functions deploy waitlist-signup

# Deploy waitlist confirmation function
supabase functions deploy waitlist-confirm
```

**After deployment, you'll get URLs like:**
```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/waitlist-signup
https://YOUR-PROJECT-REF.supabase.co/functions/v1/waitlist-confirm
```

---

## Step 6: Update Your Website HTML

### Update the waitlist form JavaScript in `index.html`:

Find this code (around line 841):
```javascript
// Waitlist form submission
document.getElementById('waitlist-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input[type="email"]').value;
    
    // Here you would typically send to your backend
    alert('Thank you for joining the waitlist! Check your email for confirmation.');
    this.reset();
});
```

**Replace with:**
```javascript
// Waitlist form submission
document.getElementById('waitlist-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const emailInput = this.querySelector('input[type="email"]');
    const submitButton = this.querySelector('button[type="submit"]');
    const email = emailInput.value;
    
    // Disable form during submission
    submitButton.disabled = true;
    submitButton.textContent = 'Joining...';
    
    try {
        const response = await fetch('https://YOUR-PROJECT-REF.supabase.co/functions/v1/waitlist-signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                source: 'homepage'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('🎉 Success! Check your email to confirm your waitlist signup.');
            this.reset();
        } else {
            alert(data.error || 'Failed to join waitlist. Please try again.');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Network error. Please check your connection and try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Get Early Access';
    }
});
```

**Don't forget to replace `YOUR-PROJECT-REF` with your actual Supabase project reference!**

---

## Step 7: Test the Waitlist Flow

### 7.1 Test Signup
1. Open your website: http://localhost:8080 (or production URL)
2. Scroll to "Join the Waitlist" section
3. Enter your email
4. Click "Get Early Access"
5. Should see success message

### 7.2 Test Email Confirmation
1. Check your email inbox
2. Open "Confirm your TheFitChecked waitlist signup" email
3. Click "Confirm My Email" button
4. Should redirect to homepage with success message

### 7.3 Verify in Database
Check Supabase dashboard:
1. Go to Table Editor
2. Open `waitlist_signups` table
3. Verify your email appears
4. Check `confirmed` column is `true` after clicking email link

---

## Step 8: Monitor & Manage Waitlist

### View All Signups
```sql
SELECT 
  email,
  name,
  source,
  confirmed,
  signup_date,
  confirmed_at
FROM waitlist_signups
ORDER BY signup_date DESC;
```

### Count Stats
```sql
SELECT 
  COUNT(*) as total_signups,
  COUNT(*) FILTER (WHERE confirmed = true) as confirmed_signups,
  COUNT(*) FILTER (WHERE confirmed = false) as pending_confirmations
FROM waitlist_signups;
```

### Export Confirmed Emails
```sql
SELECT email, name
FROM waitlist_signups
WHERE confirmed = true
ORDER BY confirmed_at;
```

---

## Troubleshooting

### Issue 1: "Failed to send confirmation email"
**Solution:**
- Check Gmail API key is valid
- Verify GMAIL_API_KEY secret is set in Supabase
- Check Gmail API is enabled in Google Cloud Console
- Ensure sending quota is not exceeded

### Issue 2: "Invalid or expired confirmation link"
**Solution:**
- Check if email was already confirmed
- Token may have been cleared after first use (this is normal)
- User should request new confirmation email

### Issue 3: CORS errors
**Solution:**
- Edge Functions already have CORS headers configured
- If issues persist, check browser console for specific errors

### Issue 4: Function not found (404)
**Solution:**
- Verify functions are deployed: `supabase functions list`
- Check function URLs match your project ref
- Redeploy if needed: `supabase functions deploy waitlist-signup`

---

## Production Checklist

Before going live:
- [ ] Supabase project created for marketing website
- [ ] Database migration applied (waitlist_signups table exists)
- [ ] Edge Functions deployed successfully
- [ ] Gmail API key configured in Supabase secrets
- [ ] GMAIL_FROM_EMAIL set to your verified domain email
- [ ] Website HTML updated with correct Supabase function URLs
- [ ] Test signup flow end-to-end
- [ ] Test email confirmation flow
- [ ] Verify emails are being delivered (check spam folder)
- [ ] Set up monitoring/alerts for function errors

---

## Gmail API Setup (If Not Done)

If you haven't set up Gmail API yet:

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create/select a project
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Set up OAuth consent screen
6. Get API key or OAuth token
7. Add to Supabase secrets

---

## File Structure

```
webpage/
├── supabase/
│   ├── functions/
│   │   ├── waitlist-signup/
│   │   │   └── index.ts          ✅ Signup handler with Gmail
│   │   └── waitlist-confirm/
│   │       └── index.ts          ✅ Email confirmation handler
│   └── migrations/
│       └── 20251122_create_waitlist_table.sql  ✅ Database schema
└── index.html                    ⚠️ Needs JavaScript update
```

---

## Next Steps

1. **Install Supabase CLI**: `npm install -g supabase`
2. **Link project**: `supabase link --project-ref YOUR-PROJECT-REF`
3. **Apply migration**: `supabase db push`
4. **Set secrets**: `supabase secrets set GMAIL_API_KEY=...`
5. **Deploy functions**: `supabase functions deploy waitlist-signup && supabase functions deploy waitlist-confirm`
6. **Update HTML**: Replace YOUR-PROJECT-REF in index.html
7. **Test**: Complete signup flow end-to-end

---

## Support

For issues:
- Supabase docs: https://supabase.com/docs/guides/functions
- Gmail API docs: https://developers.google.com/gmail/api
- Check function logs: `supabase functions logs waitlist-signup`
