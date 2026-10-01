# DataMind Codebase Audit Report

## 1. Project Structure

**`frontend/src/`**
```
frontend/src/
├── App.jsx
├── main.jsx
├── index.css
├── assets/
│   └── image.png
├── components/
│   ├── ContextStep.jsx
│   ├── GoogleSignInButton.jsx
│   ├── Navbar.jsx
│   ├── PageHeader.jsx
│   ├── PageHelpDocs.jsx
│   ├── Sidebar.jsx
│   ├── Profiler/
│   │   ├── Badges.jsx
│   │   └── LoadingOverlay.jsx
│   ├── charts/
│   │   ├── AIInsightsCard.jsx
│   │   ├── AnchorScatterPanel.jsx
│   │   ├── ChartComponents.jsx
│   │   └── CorrelationSuggestions.jsx
│   └── cleaner/
│       └── ManualCleanWorkspace.jsx
├── constants/
│   └── ui.js
├── contexts/
│   ├── AuthContext.jsx
│   ├── FileSessionContext.jsx
│   └── ToastContext.jsx
├── pages/
│   ├── Cleaner.jsx
│   ├── Demo.jsx
│   ├── Docs.jsx
│   ├── Home.jsx
│   ├── HowItWorks.jsx
│   ├── LandingPage.jsx
│   ├── Login.jsx
│   ├── Pipeline.jsx
│   ├── Pricing.jsx
│   ├── Profiler.jsx
│   ├── Register.jsx
│   ├── Report.jsx
│   ├── Visualize.jsx
│   ├── Wallet.jsx
│   └── task.md (Unused/Orphaned artifact)
└── services/
    ├── authService.js
    ├── axiosClient.js
    ├── cleanerService.js
    ├── paymentService.js
    ├── profilerService.js
    └── visualizeService.js
```

**`backend/app/`**
```
backend/app/
├── __init__.py
├── main.py
├── core/
│   ├── __init__.py
│   ├── cache.py
│   ├── database.py
│   ├── dependencies.py
│   ├── errors.py
│   ├── limiter.py
│   └── security.py
├── models/
│   └── __init__.py
├── routers/
│   ├── __init__.py
│   ├── auth.py
│   ├── credits.py
│   ├── files.py
│   ├── packages.py
│   ├── report.py
│   └── visualize.py
├── schemas/
│   ├── __init__.py
│   ├── auth.py
│   ├── cleaner.py
│   └── files.py
├── services/
│   ├── __init__.py
│   ├── ai_explain_service.py
│   ├── chart_insights.py
│   ├── cleaner_service.py
│   ├── context_builder.py
│   ├── llm_service.py
│   ├── profiler_service.py
│   ├── semantic_rules.py
│   └── visualize_service.py
└── utils/
    └── (Empty directory)
```

## 2. Backend — What each service file actually does

### `services/`
* **`ai_explain_service.py`**
  * `check_ai_access(current_user, db)`: Receives user and DB session, returns `CreditsWallet` or None. Reads `credits_wallets` table.
  * `call_gemini_explain(prompt)`: Receives string prompt, calls Gemini API (`gemini-1.5-flash`), returns explanation string.
  * `compute_cramers_v(df, col_a, col_b)`: Receives DataFrame and column names, returns Cramér's V float.
  * `get_correlation_suggestions(df, summary)`: Returns list of correlation dictionaries.
* **`chart_insights.py`**
  * `generate_insights(stats)`: Receives chart stats, returns list of insight dictionaries.
* **`cleaner_service.py`**
  * `detect_issues(df, profile_data, column_semantics, dataset_context)`: Returns dictionary of data issues (missing, duplicates, etc.).
  * `auto_clean(...)`: Applies automatic cleaning strategies to a DataFrame based on detected issues.
  * `validate_clean_dataset(df)`: Validates cleaned DataFrame constraints.
  * `build_report_header(...)`: Returns summary dictionary of cleaning results.
  * `build_summary_for_module3(df)`: Builds summary dictionary for visualization.
  * `apply_manual_actions(df, actions)`: Applies user-defined cleaning operations on DataFrame.
* **`context_builder.py`**
  * `build_dataset_context(profile_data)`: Builds markdown string of dataset context.
  * `build_chart_context(...)`: Builds text context describing a specific chart.
  * `build_llm_context(...)`: Orchestrates combining dataset and chart contexts for LLM prompts.
* **`llm_service.py`**
  * `get_semantic_context(columns)`: Calls Gemini API (`gemini-1.5-flash`) to infer semantic meanings of columns.
  * `generate_report_intro(metadata, charts)`: Calls Gemini API to generate a report introduction.
* **`profiler_service.py`**
  * `is_disguised_numeric(series)`: Checks if a text series represents numbers.
  * `clean_to_numeric(series)`: Cleans currency/commas to return numeric series.
  * `_try_datetime(series)`: Checks if series parses to datetime.
  * `_classify_column(series)`: Assigns primary type (numeric, datetime, text, categorical).
  * `profile_dataframe(df)`: Main entry point, returns list of column profile dictionaries.
* **`semantic_rules.py`**
  * `is_valid_sequence(value)`: Checks for common invalid sequence placeholders (e.g., "?", "N/A").
  * `validate_cell(value, semantic_type)`: Validates cell value against regex rules based on semantic type.
  * `is_semantic_error_column(violation_count, total_non_null_rows)`: Threshold check for column validity.

### `routers/`
* **`auth.py`**
  * `register(...)`, `login(...)`, `login_with_google(...)`: Handle user authentication. Read/Write Postgres `User` table.
* **`credits.py`**
  * `get_wallet(...)`, `get_history(...)`: Return user credit balance and transactions. Read Postgres `CreditsWallet` and `TransactionHistory`.
* **`files.py`**
  * `profile_file(...)`: Uploads file, extracts bytes to Redis (`filebytes`), builds profile, saves to Redis (`profile`), returns profile.
  * `analyze_ai_context(...)`: Uses `llm_service` to build semantic context. Reads Redis `profile`, writes `llm_ctx`.
  * `save_session_context(...)`: Saves user intent context. Writes Redis `user_context`.
  * `detect_issues(...)`: Reads Redis `filebytes` and `profile`.
  * `auto_clean(...)`, `manual_clean_preview(...)`, `confirm_clean(...)`: Processes DataFrame modifications, updates Redis `filebytes` and `profile`.
* **`packages.py`**
  * `get_packages(...)`, `purchase_package(...)`, `my_subscription(...)`: Manage credit packages. Reads/Writes `CreditPackage`, `UserSubscription`, `TransactionHistory`.
* **`report.py`**
  * `get_report_intro(...)`: Generates introduction string for final report.
* **`visualize.py`**
  * `compute(...)`, `scatter_data(...)`, `explain_chart(...)`, `get_suggestions(...)`: Generate chart data and LLM explanations. Reads Redis `filebytes`, writes `session_metadata`, reads/writes `ai_explain:original/edited`.

## 3. Frontend — What each page component does

* **`Profiler.jsx`**
  * API Calls: `/files/profile` (upload), `/files/ai-context`, `/files/context`
  * FileSessionContext Read: None initially.
  * FileSessionContext Write: `fileHash`, `fileName`, `profileData`, `sessionId`, `userContext`
  * Navigation: `navigate("/dashboard/cleaner")` (when not in pipelineMode).
  * PipelineMode: Yes, supported via `onComplete()` callback.
* **`Cleaner.jsx`**
  * API Calls: `/files/detect-issues`, `/files/auto-clean`, `/files/manual-clean`, `/files/confirm-clean`
  * FileSessionContext Read: `fileHash`, `profileData`, `fileName`
  * FileSessionContext Write: Updated `profileData`, `capabilities`, `warnings`
  * Navigation: `navigate("/dashboard/visualize")` (when not in pipelineMode).
  * PipelineMode: Yes, supported.
* **`Visualize.jsx`**
  * API Calls: `/visualize/compute`, `/visualize/scatter`, `/visualize/explain`, `/visualize/suggestions`
  * FileSessionContext Read: `sessionId`, `fileHash`
  * FileSessionContext Write: `statisticalSummary`, `confirmedCharts`
  * Navigation: `navigate("/dashboard/report")` (when not in pipelineMode).
  * PipelineMode: Yes, supported.
* **`Report.jsx`**
  * API Calls: `/report/intro`
  * FileSessionContext Read: `statisticalSummary`, `confirmedCharts`, `profileData`
  * FileSessionContext Write: None
  * Navigation: `navigate("/dashboard/profiler")` (Reset flow).
  * PipelineMode: Yes, supported.
* **`Pipeline.jsx`**
  * Orchestrates the 4 main modules using `<Profiler>`, `<Cleaner>`, `<Visualize>`, `<Report>`.
  * Intercepts `onComplete` to step through the pipeline array `["profiler", "cleaner", "visualize", "report"]`.

## 4. FileSessionContext — Exact Current State Shape

**File:** `frontend/src/contexts/FileSessionContext.jsx`

**Exact Default State Object:**
```javascript
const defaultSession = {
  fileHash: null,              // string (UUID from backend) - set by Profiler
  fileName: null,              // string - set by Profiler
  profileData: null,           // object - set by Profiler/Cleaner
  overrides: {},               // object - initialized but rarely used directly
  sessionId: null,             // string (UUID) - set by Profiler
  statisticalSummary: null,    // object - set by Visualize
  confirmedCharts: null,       // array - set by Visualize
  capabilities: null,          // object - set by Cleaner
  warnings: [],                // array - set by Cleaner
  userContext: null,           // object - set by Profiler (purpose & description)
};
```
**Persistence Check:**
`localStorage` persistence IS implemented and fully working using `localStorage.getItem("datamind_session")` during state initialization and `localStorage.setItem` during `updateFileSession`.

## 5. Pipeline.jsx — Current Step Structure

* **STEPS array values:** `["profiler", "cleaner", "visualize", "report"]`
* **Component rendered at each step:** 
  * `profiler`: `<Profiler pipelineMode onComplete={...} onError={...} />`
  * `cleaner`: `<Cleaner pipelineMode onComplete={...} onError={...} />`
  * `visualize`: `<Visualize pipelineMode onComplete={...} onError={...} />`
  * `report`: `<Report pipelineMode onComplete={...} />`
* **Error handling:** Managed globally in `Pipeline.jsx`. It renders an inline error banner (`<div className="bg-[#FDEBEC]...">`) with two buttons:
  1. "Sửa lại ở bước này" (Stay on current step, clear error)
  2. "Bỏ qua, tiếp tục →" (Proceeds to next step with warning state)
* **Debug bar:** Yes, it exists as a fixed bottom bar. It is gated correctly by `import.meta.env.DEV`.

## 6. Redis Key Inventory

key pattern | TTL | set by | read by
---|---|---|---
`profile:{user_id, file_hash}` | 24h | `cache.set_profile` | `cache.get_profile`
`filebytes:{user_id, file_hash}` | 1h | `cache.set_file_bytes` | `cache.get_file_bytes`
`user_context:{user_id, session_id}` | 1h | `cache.set_user_context` | `cache.get_user_context`
`session_metadata:{user_id, session_id}` | 1h | `cache.set_session_metadata` | `cache.get_session_metadata`
`ai_explain:original:{file_hash}:{chart_type}:{col_x}:{col_y}:{tier}` | 30d | `cache.set_ai_explain_original` | `cache.get_ai_explain_original`
`ai_explain:edited:{user_id}:{file_hash}:{chart_type}:{col_x}:{col_y}:{tier}` | 30d | `cache.set_ai_explain_edited` | `cache.get_ai_explain_edited`
`llm_ctx:{user_id}:{file_hash}` | 24h | `cache.set_dataset_context_md` | `cache.get_dataset_context_md`

## 7. Gemini API Usage

* **Usage locations:** 
  1. `services/llm_service.py` -> `get_semantic_context`
  2. `services/llm_service.py` -> `generate_report_intro`
  3. `services/ai_explain_service.py` -> `call_gemini_explain`
* **Prompt template:** Sent dynamically. Prompts are constructed via `context_builder.py` (`build_llm_context`) which assembles extensive markdown containing the dataset dictionary, column stats, user purpose, and specific chart statistics.
* **Retry/Queue mechanism:** Implemented via custom asynchronous retry loops (e.g. `async def _call_gemini_with_retry(client, prompt)` in the services).
* **Model string:** Uses `gemini-1.5-flash` (Retrieved via `os.getenv("GEMINI_MODEL", "gemini-1.5-flash")`).

## 8. What is NOT yet implemented

* **Module 3.5 — Pattern Discovery (Apriori/FP-Growth):** missing entirely
* **Module 3.5 — Cluster Analysis (K-Means with silhouette validation):** missing entirely
* **Module 3.5 — Hypothesis Testing (ANOVA, Chi-square):** missing entirely
* **interpretation_signals / enrich_column_context function:** missing entirely
* **Module 4 — split panel chart editor (collapsible left panel):** missing entirely
* **Module 4 — editable chart titles:** missing entirely
* **Module 4 — chart type switching:** missing entirely
* **Module 5 — Report page UI (document-style with sidebar TOC):** partially implemented (Component exists but structure is basic, no sidebar TOC yet)
* **Module 5 — progressive loading text:** missing entirely
* **Module 5 — PDF export:** partially implemented (`html2canvas`/`jspdf` exist in `package.json`, print wrappers exist, but true PDF formatting is limited)
* **user_context saved to Redis (POST /session/context endpoint):** done (implemented in `cache.py` and `files.py`)
* **Cache versioning (CACHE_VERSION prefix on all Redis keys):** missing entirely
* **datetime parsing fix (format-first with dateutil fallback):** missing entirely (`profiler_service.py` still relies on `pd.to_datetime(errors="coerce")` alone)
* **SKILL.md design system applied consistently across all pages:** partially implemented

## 9. Known bugs still present

* **rediss:// SSL protocol error in Redis client initialization:** fixed (In `cache.py`, `ssl_cert_reqs=None` is explicitly supplied to the `redis_lib.from_url` call for `rediss://`).
* **detect-issues returning 404 when Redis GET fails:** fixed (Now raises a standardized `DataMindException` instead of bare 404, though lack of an exception handler may result in HTTP 500 mapping).
* **Unnamed: X columns not being filtered before profiling:** fixed (Logic was added to `_read_dataframe` in `files.py` to strip out all NaN `Unnamed` Pandas-generated columns).
* **datetime UserWarning in profiler_service.py line 95:** still present (`pd.to_datetime` will still emit warnings on mixed formats without `format="mixed"` or a dateutil fallback).
* **Pipeline onComplete() not being called:** fixed (Component props explicitly handle `if (pipelineMode && onComplete) onComplete();` in `Profiler.jsx`, `Cleaner.jsx`, `Visualize.jsx`).

## 10. Dependencies installed

### `backend/requirements.txt`
* fastapi==0.110.1
* uvicorn==0.29.0
* python-multipart==0.0.9
* pandas==2.2.1
* numpy==1.26.4
* openpyxl==3.1.2
* upstash-redis==1.3.0
* python-dotenv==1.0.1
* sqlalchemy==2.0.23
* psycopg2-binary==2.9.9
* alembic==1.12.1
* redis==5.0.1
* aioredis==2.0.1
* python-jose[cryptography]==3.3.0
* passlib[bcrypt]==1.7.4
* pytest==7.4.3
* pytest-asyncio==0.21.1
* httpx==0.25.1
* google-genai>=1.0.0
* pydantic-settings==2.1.0
* email-validator
* bcrypt==4.0.1
* tenacity>=8.0.0
* supabase>=2.0.0
* google-auth>=2.30.0
* scipy>=1.11.0
* slowapi==0.1.9

### `frontend/package.json`
**Dependencies:**
* axios (^1.18.1)
* html2canvas (^1.4.1)
* jspdf (^4.2.1)
* lucide-react (^1.21.0)
* react (^18.2.0)
* react-dom (^18.2.0)
* react-router-dom (^7.18.0)
* react-to-print (^3.3.0)
* recharts (^2.15.0)

**devDependencies:**
* @vitejs/plugin-react (^4.2.1)
* autoprefixer (^10.4.18)
* postcss (^8.4.35)
* tailwindcss (^3.4.1)
* vite (^5.0.0)
