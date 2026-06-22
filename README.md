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