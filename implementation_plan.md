# Routing Restructure: /dashboard Nested Layout

## Goal
Move all authenticated tool pages under a `/dashboard` parent route. The URL structure becomes:

- `/` → Landing (public)
- `/login`, `/register`, `/pricing`, `/docs` → Public
- `/dashboard` → Redirect to `/dashboard/profiler`
- `/dashboard/profiler` → Profiler tool
- `/dashboard/cleaner` → Cleaner tool
- `/dashboard/visualize` → Visualize tool
- `/dashboard/report` → Report tool
- `/dashboard/pipeline`, `/dashboard/pipeline/:step` → Pipeline tool
- `/dashboard/wallet` → Wallet

## Architecture

Use React Router v6 **layout routes** with `<Outlet>`. A `DashboardLayout` component renders the Sidebar + mobile Navbar shell, and `<Outlet />` renders the active child page. All dashboard routes share one `RequireAuth` guard at the parent level.

```
<Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
  <Route index element={<Navigate to="profiler" replace />} />
  <Route path="profiler" element={<Profiler />} />
  <Route path="cleaner" element={<Cleaner />} />
  <Route path="visualize" element={<Visualize />} />
  <Route path="report" element={<Report />} />
  <Route path="pipeline" element={<Pipeline />} />
  <Route path="pipeline/:step" element={<Pipeline />} />
  <Route path="wallet" element={<Wallet />} />
</Route>
```

## Files to Change

---

### App.jsx
- `DashboardLayout` extracted from `Layout` — renders `<Sidebar>` + mobile `<Navbar>` + `<Outlet />`
- `PublicLayout` handles the Navbar-only public pages
- `/dashboard/*` nested routes with single `RequireAuth` wrapper
- `GuestOnly` redirects to `/dashboard/profiler`
- Redirect shims: `/profiler` → `/dashboard/profiler`, etc.

---

### Sidebar.jsx
- All `path` values updated to `/dashboard/profiler`, `/dashboard/cleaner`, etc.
- `location.pathname.startsWith(item.path)` still works correctly

---

### Navigate calls in tool pages (all relative to `/dashboard/...`)

| File | Old path | New path |
|---|---|---|
| Profiler.jsx:87,92 | `/cleaner` | `/dashboard/cleaner` |
| Profiler.jsx:119 | `/login` (keep) | `/login` ✓ |
| Profiler.jsx:220 | `/home` | `/dashboard/profiler` |
| Cleaner.jsx:618 | `/profiler` / `/home` | `/dashboard/profiler` |
| Cleaner.jsx:724 | `/profiler` | `/dashboard/profiler` |
| Cleaner.jsx:787 | `/home` | `/dashboard/profiler` |
| Cleaner.jsx:795 | `/visualize` | `/dashboard/visualize` |
| Visualize.jsx:491 | `/report` | `/dashboard/report` |
| Visualize.jsx:588 | `/profiler` | `/dashboard/profiler` |
| Visualize.jsx:594 | `/cleaner` | `/dashboard/cleaner` |
| Visualize.jsx:623 | `/cleaner` | `/dashboard/cleaner` |
| Pipeline.jsx:35,50,58 | `/pipeline/profiler` | `/dashboard/pipeline/profiler` |
| Pipeline.jsx:67,79 | `/pipeline/${step}` | `/dashboard/pipeline/${step}` |
| Pipeline.jsx:87 | `/home` | `/dashboard/profiler` |
| Pipeline.jsx:108 | `/pipeline/${s}` | `/dashboard/pipeline/${s}` |
| Wallet.jsx:27 | `/login` (keep) | `/login` ✓ |
| Wallet.jsx:53 | `/home` | `/dashboard/profiler` |
| LandingPage.jsx:60 | `/profiler` | `/dashboard/profiler` |
| Navbar.jsx | `/profiler` | `/dashboard/profiler` |
| Login.jsx `from` default | `/profiler` | `/dashboard/profiler` |
| AuthContext GuestOnly | `/profiler` | `/dashboard/profiler` |
| App.jsx `/` redirect | `/profiler` | `/dashboard/profiler` |
| Pricing.jsx:222 | `/wallet` | `/dashboard/wallet` |

---

## Verification Plan
- `/` with token → `/dashboard/profiler` ✓
- `/dashboard` without token → `/login` → login → back to `/dashboard/profiler` ✓
- Sidebar links work, active state highlights correctly ✓
- Pipeline step routing works ✓
- Old `/profiler` URL redirects to `/dashboard/profiler` ✓
