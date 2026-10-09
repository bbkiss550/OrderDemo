# Mobile Web Studio preview

Enable this local-only mode from the FoodOrderDemo folder:

```powershell
docker compose -f compose.yml -f compose.preview.yml up -d --build app
```

Open `http://127.0.0.1:3000` and enter `http://127.0.0.1:8088/admin/bills`.
The login page appears in the phone preview; sign in normally.
The `mobile-preview` Spring profile allows frames from the exact Studio origin
using `Content-Security-Policy: frame-ancestors 'self' http://127.0.0.1:3000`.
Authentication and CSRF protection remain enabled. The override binds the app
to loopback only. The Studio browser mode aligns localhost/127.0.0.1 target
hostnames with its own hostname so session cookies stay on the same site.

Restore the default frame blocking:

```powershell
docker compose -f compose.yml up -d app
```

Use the default configuration for deployment. Do not enable this profile on
a public server. Other websites may still block iframe embedding.
