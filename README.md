# Antigone

Appointments from Google Calendar, colour-coded through notes, invoicing and rebooking. See [DESIGN.md](DESIGN.md) for how it works.

Runs in the browser on iPhone, iPad and laptop, and can be added to the Home Screen. There is no backend.

## Setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Calendar API**.
2. Under **Google Auth Platform**, configure the consent screen (External) and add each person who will use the app as a test user.
3. Create an **OAuth client ID** of type *Web application* with these **Authorized redirect URIs**:
   - `https://devjonny.github.io/Antigone/`
   - `http://localhost:5173/Antigone/`
4. In the GitHub repo, add a repository variable `GOOGLE_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables) and set Pages to deploy from **GitHub Actions**.
5. Push to `main` to deploy.

The client ID isn't secret; it ends up in the published page either way.

## Development

```bash
npm install
```

```bash
echo "VITE_GOOGLE_CLIENT_ID=<your client id>" > .env.local
```

```bash
npm run dev
```

Open http://localhost:5173/Antigone/. Run tests with `npm test`.

## Using it on iPhone or iPad

Open the site in Safari, tap Share → **Add to Home Screen**. It then opens full screen and works offline from its cache.
