
---

## Step 5: Test Locally

```bash
# Terminal 1: Start database
cd DataMind/backend
docker-compose up -d

# Wait ~10 seconds, then check:
docker-compose ps
# Should show: postgres ✓, redis ✓

# Terminal 2: Start backend
cd DataMind/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env.local
uvicorn app.main:app --reload

# Should see: "Uvicorn running on http://0.0.0.0:8000"
# Test: curl http://localhost:8000/health

# Terminal 3: Start frontend
cd DataMind/frontend
npm install
cp .env.example .env.local
npm run dev

# Should see: "VITE v5.x.x ready in xxx ms"
# Visit: http://localhost:3000