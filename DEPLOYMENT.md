# Production Deployment Guide: Smart Interview Scheduler & Mock Assessment Platform

This document details the exact steps, environment configurations, operational requirements, and architectural considerations for deploying the Smart Interview Scheduler & Mock Assessment Platform to production.

---

## 1. System Architecture Overview & Live Deployments

### Active Live Production Environments
- **Frontend SPA (Vercel)**: [`https://smart-interview-scheduler-chi.vercel.app`](https://smart-interview-scheduler-chi.vercel.app)
- **Backend API (Render)**: [`https://smart-interview-scheduler-api-flgk.onrender.com`](https://smart-interview-scheduler-api-flgk.onrender.com)
- **API Health Check**: [`https://smart-interview-scheduler-api-flgk.onrender.com/health`](https://smart-interview-scheduler-api-flgk.onrender.com/health) (and `/api/health`)
- **API Base Route**: `https://smart-interview-scheduler-api-flgk.onrender.com/api`

### Core Components
- **Backend**: Node.js & Express API ([`server/server.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/server.js))
- **Frontend**: React 18 SPA built with Vite ([`client/`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/client))
- **Database**: MongoDB Atlas (Cloud Database-as-a-Service)
- **Background Tasks**: Embedded `node-cron` worker for assessment attempt auto-expiry
- **File Storage**: Multi-part resume upload pipeline (`server/uploads/resumes`)

---

## 2. Production Environment Variables Reference

### Backend (`server/.env`)

| Variable | Required | Example / Recommended Value | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enforces production security behaviors (Helmet headers, strict CORS, rate limiting, JWT secret assertions, and error message masking). |
| `PORT` | Auto / Yes | `5000` (or injected by PaaS) | Port for Express HTTP listener. Managed automatically by PaaS environments (e.g. Render, Railway, Heroku). |
| `CLIENT_URL` | **Yes** | `https://smart-interview-scheduler-chi.vercel.app` | Exact origin of deployed frontend SPA. Supports comma-separated origins (e.g. `https://smart-interview-scheduler-chi.vercel.app,https://customdomain.com`). Used strictly by CORS middleware in production. |
| `MONGODB_URI` | **Yes** | `mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/smart_prep_prod?retryWrites=true&w=majority` | MongoDB connection string (typically a MongoDB Atlas cluster URI). |
| `JWT_SECRET` | **Yes** | `d4f8a9e1b2c3d5e7f8a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2` | Cryptographic secret for signing session JWTs. **Enforced minimum length of 32 characters** at startup in production. |
| `JWT_EXPIRES_IN` | No | `7d` | Lifetime of candidate and admin authentication tokens (default `7d`). |
| `MAX_FILE_SIZE_MB` | No | `5` | Maximum allowable resume file size in megabytes (default `5`). Must match `VITE_MAX_FILE_SIZE_MB`. |
| `EMAIL_HOST` | Recommended | `smtp.sendgrid.net` (or Mailgun/SES/Postmark) | SMTP server hostname for platform notifications. |
| `EMAIL_PORT` | Recommended | `587` | SMTP server port (usually `587` for TLS or `465` for SSL). |
| `EMAIL_USER` | Recommended | `apikey` | SMTP authentication username. |
| `EMAIL_PASS` | Recommended | `SG.xxxxxxxxxxxxxxxxxxxx` | SMTP authentication password / API key. |
| `EMAIL_FROM` | Recommended | `"SmartPrep Platform" <no-reply@smartprep.com>` | Sender name and address for booking and assessment notification emails. |
| `ENABLE_SWAGGER` | No | `false` | Set to `true` only if public OpenAPI / Swagger documentation (`/api-docs`) should be exposed in production. Defaults to `false`. |

> [!IMPORTANT]
> If SMTP credentials (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`) are omitted or incomplete in production, the application will not crash: emails will log a simulated dispatch warning (`[EmailService] SMTP credentials not fully configured. Email was simulated.`), and all booking/assessment database operations will complete successfully without interruption.

---

### Frontend (`client/.env`)

| Variable | Required | Example / Recommended Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** | `https://smart-interview-scheduler-api-flgk.onrender.com/api` | Base URL of the deployed Express backend API including the `/api` prefix (must NOT have a trailing slash). |
| `VITE_MAX_FILE_SIZE_MB` | No | `5` | Maximum client-side resume validation size in megabytes. Must match `MAX_FILE_SIZE_MB` in backend. |

---

## 3. Database Configuration (MongoDB Atlas)

1. **Create Atlas Cluster**:
   - Create a free (M0) or production tier cluster on MongoDB Atlas.
   - Database name recommendation: `smart_interview_prod`.

2. **Network Access / IP Whitelist**:
   - Because PaaS providers (Render, Railway, Vercel) utilize dynamic outbound IP ranges, navigate to **Atlas Network Access** and add `0.0.0.0/0` (Allow Access from Anywhere), or configure static egress NAT IPs if using an enterprise cloud provider (AWS/GCP).

3. **Database User Credentials**:
   - Create a database user with `readWrite` permissions on the targeted database.
   - Ensure the password contains only alphanumeric characters or is URL-encoded if it contains special symbols (`@`, `:`, `/`, `%`, etc.).

4. **Connection String Format**:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/<database-name>?retryWrites=true&w=majority
   ```

5. **Index Initialization**:
   - Mongoose indexes defined in schema models ([`User.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/User.js), [`InterviewSlot.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/InterviewSlot.js), [`InterviewBooking.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/InterviewBooking.js), [`AssessmentAttempt.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/AssessmentAttempt.js), [`Notification.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/models/Notification.js)) will build automatically on the first server connection.
   - For high-scale production databases, `autoIndex: false` can be configured once initial indexes are established.

---

## 4. Backend Deployment Steps (e.g. Render / Railway / VPS)

### Option A: Render (Web Service) — Active Deployment

- **Live Deployed Backend URL**: `https://smart-interview-scheduler-api-flgk.onrender.com`
- **Health Check Path**: `/health` (and `/api/health`)
- **API Base Route**: `https://smart-interview-scheduler-api-flgk.onrender.com/api`

1. Link your GitHub repository in Render dashboard.
2. Select **Web Service**.
3. Set the configuration:
   - **Environment**: `Node`
   - **Plan**: `Free`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (or `node server.js`)
4. In the **Environment Variables** tab, input all backend environment variables from Section 2.
5. In **Health Check Path**, enter: `/health` (or `/api/health`).
6. Click **Create Web Service**.
7. Once deployed, note down your web service URL (e.g., `https://smart-interview-scheduler-api-flgk.onrender.com`).

### Option B: Railway

1. New Project -> **Deploy from GitHub repo**.
2. Set Root Directory to `/server`.
3. Railway automatically detects `server/package.json` and runs `npm install` and `npm start`.
4. Add environment variables under the **Variables** tab.
5. Generate a public domain under **Settings -> Networking -> Generate Domain**.

### Option C: Linux VPS (Ubuntu / Debian + PM2 + Nginx)

1. Clone repository to `/var/www/smart-interview-scheduler`.
2. Install production dependencies:
   ```bash
   cd /var/www/smart-interview-scheduler/server
   npm install --omit=dev
   ```
3. Configure `/var/www/smart-interview-scheduler/server/.env` with production secrets.
4. Launch with PM2 process manager:
   ```bash
   pm2 start server.js --name "smart-interview-api"
   pm2 save
   pm2 startup
   ```
5. Configure Nginx reverse proxy with SSL (Let's Encrypt / Certbot) passing requests from `https://api.yourdomain.com` to `http://127.0.0.1:5000`.

---

## 5. Frontend Deployment Steps (e.g. Vercel / Netlify / Render Static Site)

### Option A: Vercel (Recommended)

1. **Import Project into Vercel**:
   - Navigate to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** -> **"Project"**.
   - Select your GitHub repository: `smart-interview-scheduler`.

2. **Configure Project Settings**:
   - **Framework Preset**: `Vite` (Vercel automatically detects Vite).
   - **Root Directory**: Click **"Edit"**, select `client`, and click **"Save"**.
   - **Build Command**: `npm run build` (default).
   - **Output Directory**: `dist` (default).
   - **Install Command**: `npm install` (default).

3. **Configure Environment Variables in Vercel**:
   In the **Environment Variables** expandable section, add the following key-value pairs (for Production, Preview, and Development environments):
   - **`VITE_API_BASE_URL`**:
     `https://smart-interview-scheduler-api-flgk.onrender.com/api`
     *(Must contain the exact backend URL with `/api` and no trailing slash)*
   - **`VITE_MAX_FILE_SIZE_MB`**:
     `5`
     *(Matches the backend 5 MB resume upload size limit)*

4. **Verify SPA Client-Side Routing Rewrite**:
   The repository already includes [`client/vercel.json`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/client/vercel.json) with:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   This ensures that browser refreshes on deep links (e.g., `/candidate/dashboard`, `/candidate/slots`, `/login`, `/admin/candidates/:id`) will route through `index.html` without returning HTTP 404.

5. **Deploy**:
   Click **"Deploy"**. Vercel built and deployed the application to:
   [`https://smart-interview-scheduler-chi.vercel.app`](https://smart-interview-scheduler-chi.vercel.app).

6. **Post-Deployment Step: Bind Vercel Domain to Backend CORS on Render (Resolved)**:
   - **Live Production URL**: `https://smart-interview-scheduler-chi.vercel.app` (no trailing slash).
   - In **Render Dashboard** -> Open `smart-interview-scheduler-api-flgk` -> **Environment** tab:
     ```env
     CLIENT_URL=https://smart-interview-scheduler-chi.vercel.app
     ```
   - **Initial CORS Resolution**: On the initial deployment, cross-origin HTTPS requests from the Vercel frontend were blocked by Render's CORS policy (`Blocked by CORS policy`) because `CLIENT_URL` had not yet been pointed to the newly provisioned Vercel domain. Updating `CLIENT_URL` on Render and triggering the rolling restart resolved the CORS block immediately.
   - **Live E2E Verification**: End-to-end candidate registration was manually verified working against the live deployed stack (`POST https://smart-interview-scheduler-api-flgk.onrender.com/api/auth/register` succeeded, issued auth tokens, and successfully redirected into the candidate dashboard).

### Option B: Netlify

1. New site from Git -> select repository.
2. Base directory: `client`
3. Build command: `npm run build`
4. Publish directory: `client/dist`
5. Environment variables: `VITE_API_BASE_URL`, `VITE_MAX_FILE_SIZE_MB`.
6. SPA routing rewrite:
   Create `client/public/_redirects`:
   ```text
   /*    /index.html   200
   ```
7. Deploy.

---

## 6. Resume File Storage: Local Disk vs. Cloud Storage Tradeoffs

### Current Implementation
The application currently uses Multer with local disk storage ([`server/middleware/upload.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/middleware/upload.js)), saving files to `server/uploads/resumes/` on the server's filesystem.

### Critical Production Limitation: Ephemeral Filesystems
> [!CAUTION]
> **Ephemeral Filesystem Data Loss on PaaS Free/Hobby Tiers**:
> Most cloud PaaS hosts (Render, Railway, Fly.io, Heroku) operate on containerized **ephemeral filesystems**.
> 
> **What Breaks**:
> Every time the server restarts, sleeps due to inactivity, or redeploys from a git commit, the local filesystem container is destroyed and recreated cleanly from the build image.
> - Candidate database records (`CandidateProfile.resume.fileName`) remain in MongoDB Atlas.
> - But the actual physical file at `server/uploads/resumes/<uuid>.pdf` is permanently deleted.
> - Subsequent download requests from either the candidate or an administrator will fail with `404 Not Found` (*"Resume file not found on server"*).

### Comparison Matrix

| Feature | Local Disk Storage (Current) | Cloud Object Storage (S3 / Cloudinary) |
| :--- | :--- | :--- |
| **Cost** | Free (included in server disk) | Free tier available (AWS S3 5GB, Cloudinary 25GB) |
| **Setup Complexity** | Zero external credentials needed | Requires AWS/Cloudinary IAM keys and bucket configuration |
| **PaaS Redeploy Resilience** | **Fails** on free/hobby PaaS without persistent disk mounts | **100% resilient**; files persist independently of container lifecycles |
| **Horizontal Scaling** | Multiple API instances cannot share local disk | All API instances share the same centralized cloud bucket |
| **CDN Acceleration** | None; served directly through Express stream | Supported natively via CloudFront or Cloudinary CDN |

### Recommended Production Migration Paths

1. **Zero-Code-Change Solution (Persistent Volume Mount)**:
   If deploying to Render or Railway, attach a **Persistent Disk** (e.g. Render Disk mounted at `/opt/render/project/src/server/uploads/resumes`). The filesystem will persist across deploys without changing application code.

2. **Cloud Object Storage Solution (Recommended for Production Scale)**:
   Migrate [`server/middleware/upload.js`](file:///c:/Users/SUBHASH/OneDrive/Desktop/Project%20smart/server/middleware/upload.js) to stream files to Amazon S3 using `multer-s3`:
   - Store the S3 object key or public/signed URL in `profile.resume.url`.
   - Update `deleteResume` to call `s3.deleteObject()`.
   - Update `getResume` to generate a presigned download URL or stream the S3 object directly to the response.

---

## 7. Pre-Deployment Verification Checklist

Before opening the platform to public users, verify these 7 checkpoints:

- [x] **1. JWT Secret Entropy**: Verified `JWT_SECRET` is at least 32 random characters (the server enforces this at boot in `production` mode).
- [x] **2. CORS Whitelisting**: `CLIENT_URL` configured in Render environment variables matching `https://smart-interview-scheduler-chi.vercel.app`.
- [x] **3. MongoDB Atlas Whitelist**: `0.0.0.0/0` allowed in Atlas Network Access.
- [x] **4. Build Command**: `npm --prefix client run build` compiles with 0 errors (`dist/` generated with dead-code eliminated localhost URLs).
- [x] **5. Start Command**: `npm --prefix server start` executes `node server.js` cleanly on Render.
- [x] **6. Email Service Fallback**: Verified SMTP simulated fallback logging when credentials are unset.
- [x] **7. SPA Routing Rewrite**: Verified `client/vercel.json` rewrite `{ "source": "/(.*)", "destination": "/index.html" }` prevents 404s on browser refreshes.

---

## 8. Post-Deployment Smoke Test Runbook

Perform this sequential smoke test immediately following deployment:

1. **Health Check**: Open `https://smart-interview-scheduler-api-flgk.onrender.com/health` (or `https://smart-interview-scheduler-api-flgk.onrender.com/api/health`) -> expect HTTP 200 `{ status: 'ok', message: 'Smart Interview Scheduler API is running' }` (confirms Express + Helmet are live and healthy on Render). **[VERIFIED - HTTP 200]**
2. **Registration & Welcome**: Register a candidate account at `https://smart-interview-scheduler-chi.vercel.app/register` -> verify successful dashboard redirect. **[VERIFIED - Tested end-to-end against live deployed stack]**
3. **Profile & Resume**: Complete candidate profile, upload a sample PDF resume -> verify completion percentage updates to 100%.
4. **Interview Booking**: Navigate to `/candidate/slots` -> book an available interview -> verify confirmation modal.
5. **Assessment Arena**: Navigate to `/candidate/assessments` -> start an assessment -> submit answers -> verify score report is rendered.
6. **Administrative 360 View**: Log in as admin -> inspect `/admin/dashboard` -> open `/admin/candidates/:id` -> download candidate's uploaded resume -> verify blob download succeeds.
7. **Cross-Origin & SSL**: Verify browser dev tools console reports zero CORS errors and all resources load securely over HTTPS. **[VERIFIED - CORS origin whitelisted for https://smart-interview-scheduler-chi.vercel.app]**
