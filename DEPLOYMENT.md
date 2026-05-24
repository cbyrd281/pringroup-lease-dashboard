# Deployment Guide - Pringroup Lease Dashboard (CYL-2699)

## Overview
- **Frontend**: React + Vite (deploy to Vercel)
- **Backend**: Express.js + PostgreSQL (deploy to Render)
- **Deadline**: May 26, 2026

## Step 1: Database Setup (Render PostgreSQL)

1. Go to [render.com](https://render.com)
2. Create new PostgreSQL database:
   - Name: `pringroup-leases`
   - Version: 15+
   - Region: Virginia (US East)
3. Copy the connection string (Internal Database URL for backend)
4. Run migration:
   ```bash
   psql <connection-string> < docs/db-migration.sql
   ```

## Step 2: Backend Deployment (Render)

1. Create new Web Service on Render
2. Connect GitHub repository: `cbyrd281/pringroup-lease-dashboard`
3. Configure:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node server.js`
   - **Port**: 5000
4. Set Environment Variables:
   - `DATABASE_URL`: PostgreSQL connection string from Step 1
   - `PORT`: 5000
   - `NODE_ENV`: production
   - `CORS_ORIGIN`: `https://pringroup-dashboard.vercel.app`
5. Deploy

## Step 3: Frontend Deployment (Vercel)

1. Go to [vercel.com](https://vercel.com)
2. Import GitHub project: `cbyrd281/pringroup-lease-dashboard`
3. Configure:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Set Environment Variables:
   - `VITE_API_URL`: `https://<backend-url>.onrender.com/api`
5. Deploy
6. Custom Domain: `pringroup-dashboard.vercel.app`

## Step 4: Verification

### Backend API
```bash
# Health check
curl https://<backend-url>.onrender.com/health

# Fetch leases
curl https://<backend-url>.onrender.com/api/leases
```

### Frontend
- Visit: `https://pringroup-dashboard.vercel.app`
- Test workflow:
  1. View all leases (should load from API)
  2. Filter by broker
  3. Filter by time bucket
  4. Add new lease
  5. Export CSV

## Local Development

### Backend
```bash
cd backend
npm install
PORT=5000 node server-dev.js  # Uses mock data, no DB needed
# or with PostgreSQL:
node server.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:3000
```

## Environment Variables Summary

### Backend (.env)
```
DATABASE_URL=postgresql://...
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://pringroup-dashboard.vercel.app
```

### Frontend (.env.local or Vercel dashboard)
```
VITE_API_URL=https://<backend-url>/api
```

## Troubleshooting

**Frontend shows blank page**: Check that `VITE_API_URL` is set correctly and backend is accessible

**API errors**: Verify `DATABASE_URL` and PostgreSQL is running

**CORS errors**: Ensure `CORS_ORIGIN` matches your frontend domain

## Rollback

If needed, previous versions are available in GitHub commit history. Use Vercel/Render dashboard to redeploy earlier versions.
