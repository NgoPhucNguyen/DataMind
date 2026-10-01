CONTEXT: DataMind Pipeline — Report, Cleaner, Visualization Relationship

DataMind is a data analytics pipeline with 4 stages: Profiler → Cleaner → 
Visualize → Report. This prompt describes how these stages should relate 
to each other conceptually, based on architecture decisions already made. 
Do NOT redesign UI — this is about data flow, state, and backend logic only.

## Core principle
Report is not a static final step. It is a reflection of everything that 
happened in Profiler, Cleaner, and Visualize. If any of those stages change 
(user goes back and re-cleans, re-visualizes, edits context), Report must 
be able to reflect the updated state — not just the last-confirmed snapshot.

## 1. Cleaner: track provenance, not just output
Cleaning functions (auto_clean, apply_manual_actions in cleaner_service.py) 
currently transform the DataFrame but don't persist WHAT they changed.

Add a structured change log emitted by every cleaning action, e.g.:
{
  "column": "salary",
  "action": "impute_median",
  "rows_affected": [12, 45, 88],
  "reason": "12% missing values, numeric column"
}

This log should be:
- Deterministic, backend-only (no LLM/API call needed to generate it — 
  it's just structured metadata from the cleaning operation itself)
- Persisted in Redis under a new key: cleaning_log:{user_id}:{file_hash}
- Overwritten (not appended) if the user goes back and re-cleans, so it 
  always reflects the CURRENT state of the data, not cleaning history

## 2. Visualize: reference provenance, don't duplicate it
Charts and stats (confirmedCharts, statisticalSummary) should be able to 
reference which cleaning actions affected the columns they use — e.g. a 
chart on "salary" can look up cleaning_log and know 12 rows were imputed 
for that column. This is a lookup against existing data, not new 
computation.

## 3. Report: build incrementally, not at the end
Instead of generating Report entirely at the /report/intro step, each 
stage should contribute its own section as the user progresses:
- Profiler contributes: dataset overview, user's stated purpose 
  (userContext already exists for this)
- Cleaner contributes: summary of what was cleaned and why 
  (from cleaning_log)
- Visualize contributes: confirmed charts + reasoning per chart

Store these as sections under a session-scoped Redis key, e.g.:
report_sections:{user_id}:{session_id}

Each section is OVERWRITTEN when its source stage is redone (e.g. user 
goes back to Cleaner, changes cleaning approach → cleaning section in 
report_sections updates, rest stays intact). This means Report is always 
assembled from current state, not regenerated from scratch, and naturally 
supports users going back and forth between stages.

## 4. Backward navigation must invalidate downstream state correctly
Currently users CAN navigate back to a previous stage (e.g. Visualize → 
Cleaner) but there's no explicit invalidation logic. When a user changes 
something in an earlier stage, downstream state that depended on the old 
version (statisticalSummary, confirmedCharts, report_sections) must be 
either recomputed or clearly marked stale — not silently left showing 
outdated results.

## What NOT to do in this pass
- Do not add new LLM/Gemini calls for provenance — it must stay 
  deterministic and backend-only
- Do not conflate "cleaning log" with "report sections" — they are 
  separate concerns (log = raw change data, report = assembled narrative)
- Do not change UI/UX in this pass — this is state/data-flow only