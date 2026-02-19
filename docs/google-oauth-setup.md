# Google OAuth Setup Guide

Step-by-step guide to configure Google OAuth for Search Console access.

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Name it (e.g. "Agentic SEO") and click **Create**

## 2. Enable the Search Console API

1. Go to **APIs & Services** → **Library**
2. Search for **"Google Search Console API"**
3. Click **Enable**

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type → **Create**
3. Fill in the required fields:
   - App name: `agentic-seo` (or anything you like)
   - User support email: your email
   - Developer contact email: your email
4. Click **Save and Continue**
5. On the **Scopes** step, click **Add or Remove Scopes**, search for `webmasters.readonly`, check it, and click **Update** → **Save and Continue**
6. On the **Test users** step (**this is critical**):
   - Click **Add users**
   - Add your own Google email address (the one you'll use to log in)
   - Click **Save**

> **Why this matters:** Unverified apps in "Testing" mode only allow explicitly listed test users. Without adding yourself, you'll get a **403 access_denied** error saying "Google has not completed verification of agentic-seo".

## 4. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: anything (e.g. "Agentic SEO Local")
5. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
6. Click **Create**

### Finding Your Client ID and Secret

After creating the credential:
- You'll see a dialog with the Client ID — copy it
- **To find the Client Secret**: go back to **Credentials**, then **click the name** of your OAuth client (the blue link, not the copy icon). The Client ID and **Client Secret** are both shown on the detail page.

> **Common mistake:** Looking at the credentials list page only shows the Client ID. You must click into the credential detail page to see the secret.

> **Wrong credential type?** If you created a "Desktop app", "Chrome app", or "TVs and devices" type, you won't have redirect URIs or a usable secret for a web app. Delete it and create a new one as **"Web application"**.

## 5. Configure Your Environment

Create `.env.local` in the project root:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## 6. First Login

When you click "Connect Google Search Console" in the app:

1. You'll be redirected to Google's login page
2. You may see a warning: **"Google hasn't verified this app"**
   - This is normal for development
   - Click **"Advanced"** → **"Go to agentic-seo (unsafe)"**
3. Grant the requested permissions
4. You'll be redirected back to the app

## Troubleshooting

### "403: access_denied" / "Google has not completed verification"
- You haven't added yourself as a test user. Go to **OAuth consent screen** → **Audience/Test users** → add your email.

### "Failed to get authorization URL"
- Your `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is not set in `.env.local`
- Restart the dev server after editing `.env.local`

### "Token exchange failed"
- Your `GOOGLE_REDIRECT_URI` in `.env.local` doesn't match the one in Google Cloud Console
- Make sure both are exactly: `http://localhost:3000/api/auth/google/callback`

### No refresh token received
- The app uses `prompt: 'consent'` to force a new consent screen, which guarantees a refresh token
- If you previously authorized the app, go to [Google Account Permissions](https://myaccount.google.com/permissions), revoke access to "agentic-seo", and try again

### "redirect_uri_mismatch"
- The redirect URI in your `.env.local` must exactly match one of the **Authorized redirect URIs** in your Google Cloud credential
- Watch for trailing slashes, http vs https, and port numbers
