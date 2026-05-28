# QTO Application - Product Requirements Document

## Original Problem Statement
Build a full-featured, production-grade Quantity Take-Off (QTO) web application as a React app with FastAPI backend. The app must be professional, visually polished, and functionally complete with a refined industrial/utilitarian aesthetic — engineering precision: dark navy/charcoal backgrounds, amber/yellow accents, monospaced fonts for numbers, clean data-dense layouts.

## User Choices
- **Data Persistence**: Backend + MongoDB for multi-user access and cloud storage
- **DWG Handling**: Spec fallback (PDF/PNG/JPG uploads accepted)
- **Auth**: JWT-based custom authentication (httpOnly cookies)
- **Cost Estimation**: Full rate analysis integration enabled
- **Aesthetic**: Industrial dark theme (navy #0F172A, amber #F59E0B)
- **Build**: Complete app in one go with sample seed data

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver) + Object Storage (Emergent)
- **Frontend**: React 19 + React Router 7 + Tailwind CSS + PDF.js + Lucide React
- **Auth**: JWT (access 15min, refresh 7 days) in httpOnly cookies + bcrypt + brute force lockout
- **Storage**: Emergent Object Storage for drawings (PDF/PNG/JPG)

## What's Been Implemented (25 May 2026)

### Backend (FastAPI)
- ✅ JWT auth: register, login, logout, /me with httpOnly cookies
- ✅ Email-based brute force lockout (5 attempts → 15min lockout)
- ✅ Projects CRUD with full metadata (name, number, client, prepared/checked by, revision, status)
- ✅ BOQ Rows CRUD with auto-calculated quantity (Nos × L × B × D, supports partial dims)
- ✅ Drawing upload via multipart, list, download (object storage)
- ✅ Drawing scale calibration endpoint
- ✅ Rate Analysis CRUD with materials/labor/equipment/overhead/profit
- ✅ Owner-scoped authorization on all endpoints
- ✅ Admin auto-seeded with 7-row sample project on first startup
- ✅ MongoDB indexes (users.email unique, login_attempts.identifier)

### Frontend (React)
- ✅ Login/Register pages (industrial dark theme, amber accents)
- ✅ AuthContext + ProtectedRoute
- ✅ Dashboard: project cards with status badges, create project modal
- ✅ Project View: collapsible header, 3 tabs (BOQ/Drawings/Rates)
- ✅ ProjectHeader: editable metadata with auto-save
- ✅ BOQTable: inline editing, add/duplicate/delete, deductions, units (m/m²/m³/nr/kg/t/ls), live totals
- ✅ DrawingManager: drag-drop upload, file cards with metadata
- ✅ DrawingMeasurement modal: PDF.js viewer, scale calibration, linear/rectangle/polygon tools, transfer to BOQ row
- ✅ RateAnalysis: full cost estimation with materials/labor/equipment + overhead + profit + grand total
- ✅ Exports: CSV, JSON, Print (A3 landscape compatible)
- ✅ Industrial typography: Chivo (headings), IBM Plex Sans (body), JetBrains Mono (numbers)
- ✅ data-testid attributes on all interactive elements

## Test Results
- **Backend**: 24/24 tests passing (after brute force fix)
- **Frontend**: 27/27 tests passing (all flows verified)

## User Personas
1. **Senior Estimator / Quantity Surveyor**: Creates BOQ take-offs, measures from drawings, exports for reports
2. **Project Manager**: Reviews estimates, checks status, approves revisions
3. **Site Engineer**: Quick lookups, measurement validation on tablet/laptop

## Core Requirements (Static)
- Multi-user authentication
- Project-level data isolation
- Real-time quantity calculation
- Drawing-based measurement with scale calibration
- Cost estimation with overhead/profit
- Multiple export formats
- Industrial engineering UI aesthetic

## Prioritized Backlog (Future)

### P1 - High Value
- DWG native rendering (currently requires PDF/PNG conversion)
- Multi-page PDF support (currently first page only)
- Group BOQ rows under section headings with subtotals
- Search/filter rows by description, location, or drawing ref
- Saved rate-library (reusable material/labor rates)

### P2 - Medium Value
- Reorder BOQ rows (drag handle or up/down arrows)
- Keyboard navigation (Tab moves between cells)
- Collapse/expand BOQ section groups
- PDF report export (formatted A3 landscape with signature blocks)
- Team collaboration (multiple users per project)
- Version control / project history

### P3 - Nice to Have
- AI-powered measurement (auto-detect dimensions from drawings)
- Mobile responsive layout (currently optimized for 1280px+)
- Integration with cost databases (RSMeans, BCIS)
- Email notifications for revision updates
- Currency selector / multi-currency cost analysis

## Next Tasks
- Gather user feedback on first release
- Implement P1 features based on most-requested
- Performance optimization for large BOQ datasets (10,000+ rows)
- Add e2e tests for drawing measurement canvas interactions

## Recent Updates (28 May 2026 — Session 4: Multi-page + Inline Edit + Full Report)

### Frontend — Multi-page PDF support
- ✅ `pdfPagesRef` array holds one off-screen canvas per page
- ✅ Page navigation toolbar (prev/next + "Pg X/Y") in canvas — only shown when numPages > 1
- ✅ Marks filtered by `drawing_id` AND `page` so each PDF page shows only its own marks
- ✅ New marks save with `page: currentPage` (was hardcoded `1`)
- ✅ Auto-switch to mark's page when opened via References "Open" arrow

### Frontend — Inline Mark Edit on Canvas
- ✅ Clicking near an existing mark (≤18 px) when idle or in 'mark' mode opens `EditMarkPopover`
- ✅ Popover allows label edit (PATCH) and delete (DELETE)
- ✅ Enter saves, Escape cancels

### Frontend — Full Report PDF Export
- ✅ NEW button "Export Full Report" in References tab
- ✅ Generates landscape A4 PDF via jsPDF + jspdf-autotable:
  - Cover page (project name, timestamp, drawings + marks count)
  - One page per drawing-page with marks burned in
  - Final References Index table
- ✅ Filename: `<ProjectName>_FullReport.pdf` (sanitized, trimmed)
- ✅ Verified: 3-page 1.3 MB PDF for "Civil Arc" project

### Dependencies added
- `jspdf`, `jspdf-autotable` (and html2canvas pulled in transitively)

## Recent Updates (28 May 2026 — Session 3)
### Backend
- ✅ NEW `PATCH /api/projects/{project_id}/marks/{mark_id}` — update mark label and/or boq_row_id
- ✅ `BOQRowCreate` / `BOQRowResponse` now include `measurement_meta: dict` so the "measured from X" tooltips persist across page reloads
- ✅ GET/PUT/POST boq-rows endpoints now read/write `measurement_meta`

### Frontend — References tab UX overhaul
- ✅ Inline label editing (pencil icon → input → check/cancel)
- ✅ Delete mark (trash icon with confirm)
- ✅ "Open" arrow now opens the DrawingMeasurement modal focused on that mark (was previously a no-op tab switch)
- ✅ "Print Index" button with print-friendly CSS (white background, black borders, hides actions)

### Frontend — BOQ Table
- ✅ Ref badges in remarks now fall back to global marks lookup (fixes orphan-mark badges silently failing)
- ✅ Orphan badges (mark deleted) render red strikethrough + disabled with tooltip "Reference mark no longer exists"

### Frontend — DrawingMeasurement refactor
- ✅ Split 684-line `DrawingMeasurement.js` into 5 focused subcomponents under `/components/measurement/`:
  - `MarkPopover.js` — popover with Label/BOQ Row Link/Save controls
  - `ScaleControls.js` — calibration UI
  - `ToolPalette.js` — Linear / Curved / Rectangle / Polygon / Circle / Ref Mark buttons
  - `MeasurementsList.js` — captured measurements list
  - `SendToBOQPanel.js` — send-to-row action buttons (Linear→L/B, Polyline, Rectangle, Polygon, Circle Linear/Area, Area→L)

### Testing
- ✅ Backend: 33/33 tests pass (10 new tests for PATCH marks + measurement_meta)
- ✅ Frontend: all 6 References tab flows verified, badge orphan handling verified
- Note: Originally reported P0 "Label cannot be written or saved" was NOT REPRODUCIBLE — input works correctly. Actual UX gap was lack of edit/delete UI for existing marks, now addressed.

## Test Credentials
- Admin: `admin@qto.com` / `admin123` (auto-seeded with sample project)
- User: `alias.parvez@gmail.com` / `Km@249535678` (has "Civil Arc" project with 12 marks)

## Routes
- `/login` - Login page
- `/register` - Registration page
- `/dashboard` - Projects list
- `/project/:projectId` - Project detail view

## API Endpoints (all under /api)
- POST /auth/register, /auth/login, /auth/logout, GET /auth/me
- GET/POST /projects, GET/PUT/DELETE /projects/{id}
- GET/POST /projects/{id}/boq-rows, PUT/DELETE /projects/{id}/boq-rows/{row_id}  (now includes `measurement_meta`)
- GET/POST /projects/{id}/drawings, GET /drawings/{id}/download, PUT /drawings/{id}/scale
- GET/POST /projects/{id}/rate-analysis
- GET/POST /projects/{id}/marks, PATCH/DELETE /projects/{id}/marks/{mark_id}
