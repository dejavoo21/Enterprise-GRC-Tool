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
   JWT_SECRET = enterprise-grc-jwt-secret-2024-secure-key
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

## Step 4: Apply Database Schema

After both services are deployed, you need to seed the database:

### Option A: Via Railway CLI
```bash
cd backend
railway run npm run seed:admin
railway run npm run seed:core
```

### Option B: Connect to Postgres directly
Use the connection string from Railway to connect with a PostgreSQL client (pgAdmin, DBeaver, etc.) and run the SQL files in `backend/sql/` folder.

## Step 5: Access Your Application

1. Open your frontend URL: `https://frontend-xxxx.up.railway.app/login`
2. Login with:
   - **Email**: `admin@example.com`
   - **Password**: `Password123!`

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
JWT_SECRET=enterprise-grc-jwt-secret-2024-secure-key
PORT=3001
NODE_ENV=production
OPENAI_API_KEY=sk-xxx (optional, for AI features)
```

### Frontend (.env)
```
VITE_API_BASE_URL=https://your-backend.up.railway.app
```
