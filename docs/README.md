# Pringroup Lease Dashboard (CYL-2699)

Real-time lease expiration tracking for commercial real estate brokers.

**Status:** Phase 1 Development  
**Target Launch:** May 26, 2026  
**Design:** Modern (Dark Navy header, Gold badge)  

## Quick Start

### Backend
```bash
cd backend
npm install
node backend-starter.js
# Server runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm start
# App runs on http://localhost:3000
```

## Features
- Real-time lease expiration tracking
- 4 time-bucket views (All / 12-mo / 6-mo / 4-mo)
- Broker filtering (William / Steven / Marc / Andrew)
- Urgency badges (red/gold/green)
- PDF upload capability
- CSV export

## Tech Stack
- Backend: Express.js + PostgreSQL
- Frontend: React + TypeScript
- Design: Tailwind CSS
- Deployment: Vercel

## Deployment
```
pringroup-dashboard.vercel.app/dashboard
```
