# DataMind v1 - Project Overview

## 1. Infrastructure Stack & Hard Limits
Current infra constraints (based on Render free tier, Supabase free, Upstash free):
- **Upload Size Limit**: 10 MB maximum
- **Row Limit**: 50,000 rows maximum
- **RAM Constraint**: 512MB on Render (limits Pandas processing)
- **TTL (Time to Live)**:
  - `filebytes:{file_hash}` and `filebytes:{file_hash}_clean`: 1 hour
  - `profile:{file_hash}`: 24 hours
- **Supabase Storage**: 7-day signed URL expiry (clean file URL invalidates after 7 days)
- **Cleaner Limits**: Minimum 10 rows required post-clean. Requires at least 1 numeric column.

## 2. Constraints for Concurrent Users
- **Cold Starts**: Render free tier sleeps after 15 minutes of inactivity, causing 30-60s cold starts.
- **Resource Contention**: The 512MB RAM and shared CPU severely throttle concurrent Pandas operations. See [Concurrency Estimation](#3-concurrent-user-limit-estimation) below.

## 3. Concurrent-User Limit Estimation
*(Note: This is an estimation. Real limits require load testing script verification.)*
- **Render RAM Bottleneck**: A 10MB CSV loaded into Pandas can consume 50-100MB of RAM (especially during operations like `copy()` or type coercion). With 512MB total RAM (partially used by the OS and FastAPI app overhead), handling more than **3-4 simultaneous 10MB uploads** will likely cause an Out of Memory (OOM) crash.
- **Upstash Bottleneck**: Upstash free limits usually restrict connections to a low number (e.g., 10,000 requests/day, or max concurrent connections). However, Render's 512MB RAM will absolutely bottleneck and crash the container *before* Upstash rate limits are hit in a burst scenario.
- **Conclusion**: The system is safely designed for 1-2 concurrent heavy users, or ~10 light users (small 1MB files).

## 4. Capabilities Reference
For detailed feature-level context on what DataMind can detect, clean, and visualize, please see [CAPABILITIES.md](./CAPABILITIES.md).
