# Railway Deployment Guide

## Prerequisites
- Railway account (you have this)
- GitHub repository connected (done: dejavoo21/Enterprise-GRC-Tool)
- Railway CLI installed (done)

## Current Status
- Project created: Enterprise-GRC-Tool
- PostgreSQL databases: 2 instances running (use one)

## Step 1: Get PostgreSQL Connection String

1. Go to Railway Dashboard: https://railway.com/project/8c3c3490-0edc-4553-ba5d-11ed4796cf0d
2. Click on **Postgres** service
3. Go to **Variables** tab
4. Copy the `DATABASE_URL` value (looks like: `postgresql://postgres:xxxxx@xxxxx.railway.app:5432/railway`)

## Step 2: Create Backend Service

1. Click **"+ Add"** in Railway dashboard
2. Select **"GitHub Repo"**
3. Choose **dejavoo21/Enterprise-GRC-Tool**
4. After creation, click on the new service
5. Go to **Settings** tab:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
6. Go to **Variables** tab and add:
   ```
   DATABASE_URL = <paste from Postgres service>
   JWT_SECRET = <generate and store a strong secret in Railway>
   PORT = 3001
   NODE_ENV = production
   ```
7. Go to **Settings** → **Networking** → Click **"Generate Domain"**
8. Note the backend URL (e.g., `https://backend-xxxx.up.railway.app`)

## Step 3: Create Frontend Service

1. Click **"+ Add"** again
2. Select **"GitHub Repo"**
3. Choose **dejavoo21/Enterprise-GRC-Tool** (same repo)
4. After creation, click on the new service
5. Go to **Settings** tab:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview -- --host 0.0.0.0 --port $PORT`
6. Go to **Variables** tab and add:
   ```
   VITE_API_BASE_URL = <your backend URL from Step 2>
   ```
7. Go to **Settings** → **Networking** → Click **"Generate Domain"**
8. Note the frontend URL (e.g., `https://frontend-xxxx.up.railway.app`)

## Step 4: Validate and Apply Database Migrations

Ordinary backend startup does not create or alter database objects. Keep
`ALLOW_RUNTIME_SCHEMA_BOOTSTRAP` unset in Railway; production startup rejects
that compatibility flag even when it is requested.

Before a controlled release, validate the deterministic migration manifest:
```bash
cd backend
npm run build
npm run migrate:validate
```

Apply migrations only through the approved release command and required release
approval variables. Do not run individual SQL files or automatically stamp a
baseline. If the existing migration ledger is not a contiguous manifest prefix,
stop and reconcile it manually before release.

## Step 5: Access Your Application

1. Open your frontend URL: `https://frontend-xxxx.up.railway.app/login`
2. Sign in with an administrator account provisioned through the approved identity and access process. No default production credentials are supplied.

## Troubleshooting

### Backend not starting?
- Check logs in Railway dashboard
- Ensure DATABASE_URL is correctly set
- Verify the Postgres service is running

### Frontend showing "Failed to fetch"?
- Ensure VITE_API_BASE_URL points to your backend URL
- Check CORS is enabled on backend (it is by default)
- Verify backend is running and healthy

### Database connection errors?
- Ensure you're using the correct Postgres instance
- Check the DATABASE_URL format is correct
- Try the connection string in a local client first

## Environment Variables Summary

### Backend (.env)
```
DATABASE_URL=postgresql://postgres:xxx@xxx.railway.app:5432/railway
JWT_SECRET=<Railway secret reference>
PORT=3001
NODE_ENV=production
OPENAI_API_KEY=sk-xxx (optional, for AI features)
```

### Frontend (.env)
```
VITE_API_BASE_URL=https://your-backend.up.railway.app
```
