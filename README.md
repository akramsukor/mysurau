# MySurau

MySurau is a mobile-first web app for finding suraus and mosques across Malaysia. It shows nearby prayer halls on an interactive map, displays live prayer times for your JAKIM zone, and includes a Qibla compass and a community feedback flow. Write actions (adding or editing venues) require the iOS app; the web surface is read-only by design. An admin dashboard at `/dashboard` lets approved contributors review and approve community-submitted surau records.

## Route table

| Route | Surface | Auth required |
|---|---|---|
| `/` | Public map + prayer times | None |
| `/dashboard` | Admin review queue + detail page | Supabase Google OAuth (`profiles.admin = true`) |

## Known limitations

- **Prayer notifications are foreground-only.** The Web Notifications API fires alerts while the tab is open. Background / lock-screen notifications require the iOS app.
- **No write actions on web.** Suggesting edits or adding a new surau opens the "Download App" sheet — all contributions flow through the iOS app.
- **Mobile Safari notifications require PWA install.** The browser permission prompt only appears after the user adds MySurau to their home screen.

---

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

Copy `.env.example` → `.env.local` and fill in the three variables before running.

---

## Admin dashboard (`/dashboard`)

Access is gated to users where `profiles.admin = true` in Supabase.

### Environment variables

| Variable | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` + Vercel | Public — safe to expose |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` + Vercel | Public — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + Vercel | **Server-only.** Never prefix with `VITE_`. Used only in `/api/*.js` serverless functions. |

---

## Google OAuth — required configuration

Two places need to be updated before "Sign in with Google" works.

### 1. Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

Add both of these:

```
http://localhost:3000/dashboard
https://mysurau.com/dashboard
```

> These are the URLs Supabase is permitted to redirect users back to after a successful OAuth flow. Without them, Supabase rejects the redirect and auth fails.

### 2. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorised redirect URIs

Add this one URI:

```
https://ovcnjzokrcxhdqdooooa.supabase.co/auth/v1/callback
```

> This is Supabase's callback endpoint. Google sends the user here after they approve access, then Supabase exchanges the code for a session and redirects to the `redirectTo` URL above.

### 3. Supabase Dashboard → Authentication → Providers → Google

Paste the **Client ID** and **Client Secret** from the Google Cloud Console OAuth 2.0 credential you created above.

### Summary of the OAuth flow

```
User clicks "Sign in with Google"
  → supabase.signInWithOAuth({ redirectTo: origin + '/dashboard' })
  → browser → Google consent screen
  → Google → https://ovcnjzokrcxhdqdooooa.supabase.co/auth/v1/callback
  → Supabase exchanges code for session
  → Supabase → https://mysurau.com/dashboard  (or localhost:3000/dashboard)
  → AuthGuard checks profiles.admin = true
```

---

## Vercel deployment

Push to `main` — Vercel auto-deploys. The `vercel.json` rewrite sends all non-`/api` routes to `index.html` for client-side routing. `/api/*.js` serverless functions are served directly.
