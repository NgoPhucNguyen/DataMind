# 🎯 DataMind Setup - Action Plan (Copy-Paste Ready)

Stack confirmed: **Alembic** (PostgreSQL migrations) · **FastAPI on Render** (backend) · **React + Vite + Tailwind CSS** (frontend) · **pgAdmin** (DB viewer, via Docker) · **SKILL.md** design system (style consistency for Antigravity/Claude when generating UI).

Follow these steps in order. Each code block is ready to copy.

---

## Step 1: Clone Your Repo & Setup Folder Structure

```bash
# Clone your repo
git clone https://github.com/NgoPhucNguyen/DataMind.git
cd DataMind

# Create folder structure
mkdir -p backend/{app/{models,routes,services,utils},migrations,tests}
mkdir -p frontend/{src,public}

# Verify structure
tree -L 2  # (install tree: brew install tree, or just use ls)
```

---

## Step 2: Create Backend Files

### `backend/requirements.txt` (your existing list, unchanged)

```
fastapi==0.110.1
uvicorn==0.29.0
python-multipart==0.0.9
pandas==2.2.1
numpy==1.26.4
openpyxl==3.1.2
upstash-redis==1.3.0
python-dotenv==1.0.1
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
alembic==1.12.1
redis==5.0.1
aioredis==2.0.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.1
google-generativeai==0.3.0
pydantic-settings==2.1.0
```

### `backend/.env.example`

```
# Local Development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/datamind_local
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key-change-in-production
DEBUG=True
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Production (set in Render dashboard)
# DATABASE_URL=postgresql://[user]:[pass]@[project].supabase.co:5432/postgres
# REDIS_URL=https://[token]@[region].upstash.io
```

### `backend/docker-compose.yml` — now includes **pgAdmin**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: datamind_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: datamind_local
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: datamind_redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: datamind_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@datamind.local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    volumes:
      - pgadmin_data:/var/lib/pgadmin

volumes:
  postgres_data:
  pgadmin_data:
```

> After `docker-compose up -d`, register a server in pgAdmin (`localhost:5050`) pointing host to `postgres` (the Docker service name, not `localhost`), port `5432`, user/pass `postgres`/`postgres`.

### `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### `backend/app/__init__.py`

```python
# Empty file - makes app a Python package
```

### `backend/app/models.py` — Alembic reads this to know your schema

```python
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class FileUpload(Base):
    __tablename__ = "file_uploads"

    id = Column(Integer, primary_key=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")  # pending, processing, completed, failed

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True)
    file_upload_id = Column(Integer, ForeignKey("file_uploads.id"))
    summary = Column(JSON)
    insights = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv(".env.local")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("DataMind API starting...")
    yield
    print("DataMind API shutting down...")

app = FastAPI(
    title="DataMind API",
    description="Excel/CSV Analysis Engine with AI Insights",
    version="0.1.0",
    lifespan=lifespan
)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "message": "DataMind API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "True") == "True"
    )
```

### `backend/.gitignore`

```
venv/
__pycache__/
*.pyc
*.egg-info/
.pytest_cache/
.env.local
.env.*.local
.vscode/
.idea/
*.swp
.DS_Store
*.log
```

### Initialize Alembic (one-time, run after the above files exist)

```bash
cd backend
source venv/bin/activate
alembic init migrations
```

Then edit `backend/migrations/env.py` — find the line `target_metadata = None` and replace with:

```python
from app.models import Base
target_metadata = Base.metadata
```

Also point Alembic at your `.env.local` instead of hardcoding a URL. In `backend/migrations/env.py`, near the top:

```python
import os
from dotenv import load_dotenv
load_dotenv(".env.local")

config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL"))
```

Generate and apply your first migration:

```bash
alembic revision --autogenerate -m "Create file_uploads and analysis_results tables"
alembic upgrade head
```

Verify in pgAdmin (`localhost:5050`) — you should see both tables under `Schemas > public > Tables`.

---

## Step 3: Design System — `SKILL.md` for Consistent Styling

This file isn't code the app runs — it's a **style contract** that Antigravity / Claude reads before generating any UI, so every screen (even built by different people or different AI sessions) looks like it came from the same designer. Drop it at the frontend root.

**File:** `frontend/SKILL.md`

```markdown
---
name: datamind-ui
description: DataMind visual style — warm sage-green editorial minimalism, Vietnamese-optimized typography, flat bento layouts. Reference this before generating any component.
---

# DataMind Design System

## Typography
- Body/UI: 'Be Vietnam Pro', fallback 'Plus Jakarta Sans', sans-serif
- Headings: 'Newsreader', fallback 'Lora', serif — tight tracking (-0.02em to -0.04em)
- Monospace (data/code): 'Geist Mono', 'JetBrains Mono', monospace
- Body text color: #121A14 (never pure black). Secondary text: #626C65.

## Color Palette
| Role | Hex |
|---|---|
| Canvas/Background | #FBFBFA |
| Primary Text | #121A14 |
| Muted Text | #626C65 |
| Primary Accent (Deep Forest Green) | #1B4324 |
| Secondary Accent (Pale Sage) | #EAF2EB |
| Card Surface | #FFFFFF / #F9F9F8 |
| Borders/Dividers | #EAEAEA |
| Error/Warning | #FDEBEC bg, #9F2F2D text |
| Info | #E1F3FE bg, #1F6C9F text |
| Caution | #FBF3DB bg, #956400 text |

## Rules
- No gradients, no heavy shadows (max: ultra-diffuse, opacity < 0.05)
- No rounded-full on large containers; cards use 8-12px radius max
- 1px solid #EAEAEA borders on all cards/dividers
- Buttons: solid #111111 bg, white text, 4-6px radius, no shadow
- No emojis in UI copy or headings
- Generous whitespace: py-24/py-32 between major sections
```

### Wire the tokens into Tailwind so the skill isn't just a doc

**File:** `frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: '#FBFBFA',
        ink: '#121A14',
        muted: '#626C65',
        forest: '#1B4324',
        sage: '#EAF2EB',
        border: '#EAEAEA',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Newsreader"', '"Lora"', 'serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

This means any component generated later (by you, a teammate, or Antigravity reading `SKILL.md`) can just write `bg-canvas text-ink border-border` and stay on-brand automatically.

---

## Step 4: Create Frontend Files (React + Vite + Tailwind)

### `frontend/package.json`

```json
{
  "name": "datamind-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.35",
    "autoprefixer": "^10.4.18"
  }
}
```

### `frontend/postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### `frontend/.env.example`

```
VITE_API_URL=http://localhost:8000
```

### `frontend/vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
})
```

### `frontend/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600&display=swap" rel="stylesheet">
    <title>DataMind - Excel Analysis with AI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### `frontend/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  -webkit-font-smoothing: antialiased;
}
```

### `frontend/src/main.jsx`

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### `frontend/src/App.jsx` — using the design tokens, not inline styles

```jsx
import { useEffect, useState } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('checking...')

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then(res => res.json())
      .then(data => setApiStatus(data.status))
      .catch(() => setApiStatus('disconnected'))
  }, [])

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans px-8 py-24">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-4xl tracking-tight mb-2">DataMind</h1>
        <p className="text-muted mb-8">Excel/CSV analysis with AI-generated insights.</p>
        <div className="border border-border rounded-lg p-6 bg-white">
          <span className="text-sm text-muted">Backend status</span>
          <p className="font-mono text-sm mt-1">{apiStatus}</p>
        </div>
      </div>
    </div>
  )
}

export default App
```

### `frontend/.gitignore`

```
node_modules/
dist/
.env.local
.env.*.local
.vscode/
.idea/
.DS_Store
```

---

## Step 5: Create Root Files

### `.gitignore` (DataMind root)

```
**/__pycache__/
**/*.pyc
**/venv/
**/.env.local
**/node_modules/
**/dist/
.vscode/
.idea/
.DS_Store
```

### `README.md`

```markdown
# DataMind

Excel/CSV Analysis Engine with AI-Powered Insights.

## Stack
FastAPI + SQLAlchemy + Alembic (backend) · React + Vite + Tailwind (frontend)
PostgreSQL via Supabase (prod) / Docker (local) · Redis via Upstash (prod) / Docker (local)
pgAdmin for local DB inspection · Render (backend host) · Vercel (frontend host)

## Local Development

\`\`\`bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
docker-compose up -d
alembic upgrade head
uvicorn app.main:app --reload
\`\`\`

\`\`\`bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
\`\`\`

Visit http://localhost:3000 · pgAdmin at http://localhost:5050

## Design System
See \`frontend/SKILL.md\` before building any UI.
```

---

## Step 6: Test Locally

```bash
# Terminal 1: Database + Redis + pgAdmin
cd DataMind/backend
docker-compose up -d
docker-compose ps   # postgres ✓ redis ✓ pgadmin ✓

# Terminal 2: Backend
cd DataMind/backend
source venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload
# Test: curl http://localhost:8000/health

# Terminal 3: Frontend
cd DataMind/frontend
npm install
npm run dev
# Visit: http://localhost:3000
```

**Expected result:**
- Frontend loads styled with the sage/forest palette, not default browser fonts
- "Backend status" card shows `ok`
- `http://localhost:5050` (pgAdmin) shows your two tables with real columns

---

## Step 7: Git Init & Branching Workflow

You asked specifically about this — here's the order that avoids messy history later.

### 7.1 First commit goes straight to `main`

The very first commit (empty scaffold, no features yet) is safe to commit directly to `main` — there's nothing to break yet, and a branch only helps once `main` is something you don't want to risk breaking.

```bash
cd DataMind
git status              # see everything that's new
git add .
git commit -m "Initial setup: backend + frontend scaffold, Docker, SKILL.md"
git push -u origin main
```

### 7.2 From here on, work in feature branches

Once `main` actually runs locally end-to-end (Step 6 passed), treat it as the "known good" line. Every new piece of work — a route, a UI screen, an Alembic migration — gets its own branch:

```bash
# Create and switch to a new branch
git checkout -b feature/file-upload-endpoint

# ... do the work, commit as you go ...
git add .
git commit -m "Add /upload endpoint with pandas validation"

# Push the branch (not main)
git push -u origin feature/file-upload-endpoint
```

Then open a Pull Request on GitHub from `feature/file-upload-endpoint` → `main`, review it (even solo — it's a chance to re-read your own diff), and merge. Delete the branch after merging to keep the branch list clean.

### 7.3 Naming convention (pick one, stay consistent)

```
feature/<short-description>   → new functionality (feature/file-upload-endpoint)
fix/<short-description>       → bug fixes (fix/cors-error-on-upload)
chore/<short-description>     → tooling, deps, config (chore/add-pgadmin)
```

### 7.4 Keeping your branch up to date while `main` moves

```bash
git checkout feature/file-upload-endpoint
git fetch origin
git merge origin/main      # pull latest main into your branch
# resolve conflicts if any, then continue working
```

### 7.5 Quick mental model

```
main            ●──────●───────────●────────●     (always deployable)
                 \                /        /
feature/upload    ●──●──●────────●        /
                                   \      /
feature/insights                   ●────●
```

Render and Vercel should both be configured to **auto-deploy only from `main`**, so feature branches never touch production until merged.

---

## Step 8: Production Accounts (Do These Once)

### Supabase
- https://supabase.com → sign up with GitHub → New project
- Settings → Database → Connection Pooling → copy the `postgresql://...` string

### Upstash Redis
- https://console.upstash.com → New Redis database → copy REST API URL + token

### Render
- https://render.com → sign up with GitHub

### Vercel
- https://vercel.com → sign up with GitHub

---

## Step 9: Deploy Backend to Render

1. Render Dashboard → "New" → "Web Service"
2. Connect GitHub repo → select DataMind
3. **Settings:**
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt && alembic upgrade head`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Branch: `main` only
4. **Environment Variables:**
   ```
   DATABASE_URL = [Supabase connection string]
   REDIS_URL = [Upstash REST URL]
   SECRET_KEY = [random string]
   DEBUG = False
   CORS_ORIGINS = https://datamind.vercel.app
   ```
5. Deploy → wait ~3-5 min → note the URL (`https://datamind-api.onrender.com`)

---

## Step 10: Deploy Frontend to Vercel

1. Vercel Dashboard → "Add New" → "Project" → import DataMind
2. **Settings:**
   - Root Directory: `frontend`
   - Framework: Vite (auto-detect)
   - Build Command: `npm run build`
   - Branch: `main` only
3. **Environment Variable:**
   ```
   VITE_API_URL = https://datamind-api.onrender.com
   ```
4. Deploy → note the URL (`https://datamind.vercel.app`)

---

## ✅ Verification Checklist

- [ ] `docker-compose ps` shows postgres, redis, pgadmin all healthy
- [ ] `alembic upgrade head` runs without error, tables visible in pgAdmin
- [ ] Local backend: `http://localhost:8000/health` → `{"status":"ok"}`
- [ ] Local frontend: `http://localhost:3000` shows styled DataMind page, status `ok`
- [ ] First commit pushed to `main`
- [ ] Working in a feature branch for anything beyond the scaffold
- [ ] Render deploy succeeds, backend URL reachable
- [ ] Vercel deploy succeeds, frontend shows `ok` status from production backend

---

## Quick Reference URLs

```
Repo:      https://github.com/NgoPhucNguyen/DataMind
Frontend:  https://datamind.vercel.app
Backend:   https://datamind-api.onrender.com
pgAdmin:   http://localhost:5050 (local only)
Database:  [your-project].supabase.co (Supabase dashboard)
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `postgres: connection refused` | Run `docker-compose up -d` from `backend/` |
| pgAdmin can't connect to postgres | Use host `postgres` (service name), not `localhost` |
| `alembic.util.exc.CommandError: Target database is not up to date` | Run `alembic upgrade head` before generating a new revision |
| `npm: command not found` | Install Node.js from nodejs.org |
| Tailwind classes not applying | Confirm `tailwind.config.js` `content` array includes `src/**/*.{js,jsx}` |
| Port 3000 already in use | Change `vite.config.js` → `server.port` |
| Backend 500 on Render | Check Render logs — likely `DATABASE_URL` wrong |
| Frontend blank on Vercel | Check browser console (F12) — likely `VITE_API_URL` wrong |

---

**Next up:** build out `/backend/app/routes/` for file upload + analysis, and start composing UI screens in `frontend/src/` using the tokens from `SKILL.md`.
