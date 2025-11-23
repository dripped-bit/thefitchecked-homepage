#!/bin/bash
# Supabase Waitlist Deployment Script
# Run this after manual login: supabase login

set -e  # Exit on error

echo "🚀 Starting Supabase Waitlist Deployment..."
echo ""

# Navigate to project directory
cd /Users/genevie/Developer/webpage

echo "Step 1: Please run 'supabase login' manually first if you haven't already"
echo "Press Enter to continue after logging in..."
read

echo ""
echo "Step 2: Linking to project kxmtbetklikewluwntyx..."
supabase link --project-ref kxmtbetklikewluwntyx

echo ""
echo "Step 3: Creating database table..."
supabase db push

echo ""
echo "Step 4: Setting Gmail credentials..."
supabase secrets set GMAIL_EMAIL=hello@thefitcheckedhomepage.com
supabase secrets set GMAIL_APP_PASSWORD=sysxgwyvuekzkhh

echo ""
echo "Step 5: Deploying Edge Functions..."
supabase functions deploy waitlist-signup
supabase functions deploy waitlist-confirm

echo ""
echo "Step 6: Verifying deployment..."
supabase functions list

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Your waitlist system is now live at:"
echo "https://kxmtbetklikewluwntyx.supabase.co/functions/v1/waitlist-signup"
echo ""
echo "Next steps:"
echo "1. Test the waitlist form on your website"
echo "2. Check your email for confirmation"
echo "3. Verify in Supabase Dashboard → Table Editor"
