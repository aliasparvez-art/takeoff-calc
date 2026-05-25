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

## Test Credentials
- Admin: `admin@qto.com` / `admin123` (auto-seeded with sample project)

## Routes
- `/login` - Login page
- `/register` - Registration page
- `/dashboard` - Projects list
- `/project/:projectId` - Project detail view

## API Endpoints (all under /api)
- POST /auth/register, /auth/login, /auth/logout, GET /auth/me
- GET/POST /projects, GET/PUT/DELETE /projects/{id}
- GET/POST /projects/{id}/boq-rows, PUT/DELETE /projects/{id}/boq-rows/{row_id}
- GET/POST /projects/{id}/drawings, GET /drawings/{id}/download, PUT /drawings/{id}/scale
- GET/POST /projects/{id}/rate-analysis
