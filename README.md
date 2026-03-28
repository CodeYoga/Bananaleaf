# Nourish — Meal Tracker Setup Guide

A PWA to track your daily meals (Breakfast, Lunch, Dinner, Snack), 
with data stored privately in your Google Drive.

---

## File Structure

```
nourish/
├── index.html      ← Main app UI
├── style.css       ← Styles
├── app.js          ← App logic + Google Drive sync
├── sw.js           ← Service worker (PWA)
├── manifest.json   ← PWA manifest
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Step 1 — Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **"New Project"** at the top
3. Name it `Nourish` (or anything you like) → click **Create**
4. Make sure the new project is selected in the top dropdown

---

## Step 2 — Enable Required APIs

1. In the left sidebar go to **APIs & Services → Library**
2. Search for **"Google Drive API"** → click it → click **Enable**
3. Search for **"Google People API"** (or "Google OAuth2 API") → Enable it too
   (This lets us fetch your profile picture for the avatar)

---

## Step 3 — Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** → click **Create**
3. Fill in:
   - **App name**: `Nourish`
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue**
5. On the **Scopes** page → click **Add or Remove Scopes**
6. Add these two scopes:
   - `https://www.googleapis.com/auth/drive.appdata`
   - `https://www.googleapis.com/auth/userinfo.profile`
7. Click **Update** → **Save and Continue**
8. On the **Test users** page → click **Add Users**
9. Add your own Google email address → **Save and Continue**
10. Click **Back to Dashboard**

> **Note**: While in "Testing" mode, only the users you add here can sign in.
> This is fine for personal use. To publish publicly, you'd submit for verification.

---

## Step 4 — Create OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Choose **Application type: Web application**
4. Name it `Nourish Web`
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:8080` (for local testing)
   - Your GitHub Pages URL, e.g.: `https://YOUR_USERNAME.github.io`
6. Under **Authorized redirect URIs**, add the same URLs:
   - `http://localhost:8080/`
   - `http://localhost:8080/index.html`
   - `https://YOUR_USERNAME.github.io/nourish/`
   - `https://YOUR_USERNAME.github.io/nourish/index.html`
7. Click **Create**
8. Copy the **Client ID** shown (looks like: `123456789-abc...apps.googleusercontent.com`)

---

## Step 5 — Add Your Client ID to the App

1. Open `app.js` in a text editor
2. Find this line near the top:
   ```js
   CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
   ```
3. Replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
4. Save the file

---

## Step 6 — Create App Icons

You need two PNG icons: `icon-192.png` and `icon-512.png`.
Create a folder called `icons/` inside your project and add them.

**Quick option**: Use any image editor or online tool like https://favicon.io
to create a simple icon (a green ✦ on a dark background works great).

Or use this SVG as a base — save it and convert to PNG at 192×192 and 512×512:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#0f0f1a"/>
  <text x="256" y="340" font-size="280" text-anchor="middle" fill="#c8f542">✦</text>
</svg>
```

---

## Step 7 — Test Locally

You need a local HTTPS/HTTP server (browsers block OAuth from `file://`).

**Option A — Python (easiest):**
```bash
cd nourish/
python3 -m http.server 8080
```
Then open: http://localhost:8080

**Option B — Node.js (npx):**
```bash
npx serve nourish/ -p 8080
```

**Option C — VS Code Live Server extension:**
Right-click `index.html` → "Open with Live Server"

Sign in with your Google account (the test user you added), and check that:
- ✅ You're redirected back after signing in
- ✅ Your profile picture appears in the top-right
- ✅ The week table loads
- ✅ Clicking a row opens the edit modal
- ✅ Saving a meal shows "Saved to Drive ✓"

---

## Step 8 — Deploy to GitHub Pages

1. Create a new GitHub repository (e.g., `nourish`)
2. Push all files to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/nourish.git
   git push -u origin main
   ```
3. In GitHub: **Settings → Pages → Source: Deploy from branch → main / (root)**
4. Your app will be live at: `https://YOUR_USERNAME.github.io/nourish/`
5. Go back to Google Cloud Console → **Credentials → your OAuth Client** → add the GitHub Pages URL to **Authorized JavaScript origins** and **Authorized redirect URIs**

---

## How the App Works

| Feature | How it's done |
|---|---|
| Sign in | Google OAuth 2.0 implicit token flow |
| Data storage | Google Drive `appDataFolder` — hidden from user's Drive UI |
| Sync | Saves a single `nourish-meals.json` file to Drive on every save |
| Offline | Service worker caches the app shell |
| Week navigation | ← → arrows flip through Mon–Sun weeks |
| Edit meals | Click any row to open the edit modal |
| Auto-save | Every time you hit "Save Day", it syncs to Drive |

---

## Troubleshooting

**"redirect_uri_mismatch" error**
→ The URL you're using isn't in your Authorized Redirect URIs in Google Cloud Console. 
  Add the exact URL (including trailing slash) and wait 5 min for it to propagate.

**"Access blocked: app not verified"**
→ You need to add yourself as a Test User in the OAuth consent screen (Step 3, item 9).

**Blank screen after sign-in**
→ Check browser console for errors. Often the Client ID is wrong or not saved in app.js.

**Data not saving**
→ Confirm the Drive API is enabled in your Google Cloud project (Step 2).
