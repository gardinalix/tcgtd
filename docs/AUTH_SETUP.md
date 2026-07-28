# Authentication Setup

The cockpit UI stays in React/Vite. Real authentication runs through `server/authServer.mjs`, using SQLite, `httpOnly` session cookies and OAuth callbacks.

## Environment

Copy `.env.example` to `.env`.

```env
AUTH_SECRET=use-a-long-random-secret
APP_URL=http://127.0.0.1:4173
AUTH_SERVER_PORT=4180
DATABASE_URL=file:./data/gundam.db
```


## OAuth Callbacks

Use these local callback URLs:

```text
Google:   http://127.0.0.1:4173/auth/callback/google
Discord:  http://127.0.0.1:4173/auth/callback/discord
Facebook: http://127.0.0.1:4173/auth/callback/facebook
```

For production, replace `http://127.0.0.1:4173` with your real `https://` domain.

## Provider Variables

Google:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Discord:

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

Facebook:

```env
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
```

## Local Test

```powershell
npm run migrate:auth
npm run auth
```

In another terminal:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:4173/login
```

## Production

```powershell
npm run build
npm run start
```

Set `APP_URL` to your production domain. If it starts with `https://`, cookies are issued with the `Secure` flag.

## Security Notes

Passwords use server-side `scrypt` hashing with `AUTH_SECRET`. Sessions are stored as token hashes in SQLite and sent to the browser through `httpOnly`, `SameSite=Lax` cookies. Do not commit `.env` or OAuth secrets.
