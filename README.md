# SolarTech CRM

A lightweight CRM for SolarTech Industries: a drag-and-drop sales pipeline, contacts, and a
field audit form — all backed directly by your HubSpot account, shared across your whole team.

Unlike the earlier Claude artifact version, this is a real backend + web app. It doesn't depend
on any individual person's Claude account being connected to HubSpot — it talks to HubSpot
directly using one shared "private app" token, so it works the same for every rep.

## What's included

- `server.js` + `routes/` — an Express backend that talks to HubSpot's API
- `public/` — the CRM web app (pipeline board, contacts, audit form)
- Nothing here needs a database — HubSpot itself is the source of truth

## 1. Create a HubSpot Private App (one-time setup)

1. In HubSpot, click the settings gear icon → **Integrations** → **Private Apps**
2. Click **Create a private app**
3. Name it something like "SolarTech CRM Backend"
4. Go to the **Scopes** tab and add:
   - `crm.objects.contacts.read` and `crm.objects.contacts.write`
   - `crm.objects.companies.read` and `crm.objects.companies.write`
   - `crm.objects.deals.read` and `crm.objects.deals.write`
   - `crm.objects.notes.read` and `crm.objects.notes.write`
   - `crm.schemas.deals.read`
5. Click **Create app**, then copy the **Access token** shown (starts with `pat-...`).
   You won't be able to see it again, so store it somewhere safe.

## 2. Run it locally (optional, to test first)

```bash
npm install
cp .env.example .env
# paste your access token into .env as HUBSPOT_PRIVATE_APP_TOKEN
npm start
```

Then open `http://localhost:3000`.

## 3. Deploy it (recommended: Render — free tier, simplest setup)

1. Push this folder to a new GitHub repo (or use Render's "Upload" option if you'd rather not use git).
2. Go to [render.com](https://render.com) → **New** → **Web Service**.
3. Connect the repo (or upload the folder).
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment**, add an environment variable:
   - `HUBSPOT_PRIVATE_APP_TOKEN` = the token you copied in step 1
6. Click **Create Web Service**. Render will give you a URL like
   `https://solartech-crm.onrender.com` — that's the link the whole team uses.

**Note on Render's free tier:** the app "sleeps" after 15 minutes of no traffic and takes
~30–60 seconds to wake back up on the next request. Fine for a small team; if that's annoying,
upgrade to Render's cheapest paid tier ($7/mo) for an always-on instance, or use Railway.app
as an alternative.

## How the pieces fit together

- **Pipeline tab** — reads deals from your HubSpot account's default pipeline and lets you
  drag cards between stages. Dragging a card updates the deal's stage in HubSpot immediately.
- **Contacts tab** — lists and searches HubSpot contacts, and lets you add new ones.
- **New Audit tab** — the same field checklist as before (electrical photos, installer info,
  monitoring status, rep notes). Submitting it finds-or-creates the homeowner as a contact,
  creates a company + deal if this is a new lead (or reuses the existing deal if the homeowner
  already has one, so repeat visits don't create duplicates), and logs the full checklist as a
  note on the deal.

## Limitations / things to know

- **Photos aren't uploaded to HubSpot** — the form tracks which photos were captured and any
  notes on them, but the image files themselves stay on the rep's device. Wiring up actual
  photo uploads to HubSpot's Files API is a reasonable next step if you want that.
- **One shared HubSpot connection** — every rep uses the same private app token, so HubSpot
  will show all activity as coming from the private app rather than from an individual rep's
  HubSpot user. If you want per-rep attribution inside HubSpot, that would mean moving to
  OAuth with individual logins instead of a single private app token — a bigger lift, happy to
  help with that later if it becomes worth it.
- **Pipeline stages** come directly from your HubSpot account's default pipeline. If you want
  stages named specifically for a solar sales process (e.g. "Audit Scheduled," "Proposal Sent"),
  rename them in HubSpot under Settings → Objects → Deals → Pipelines — the app will pick up
  whatever labels are there automatically.
