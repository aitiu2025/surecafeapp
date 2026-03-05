# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (vite)
npm run build      # Production build
npm run preview    # Preview production build
```

No test framework is configured. Build with `npm run build` to check for compilation errors — this is the primary way to validate changes.

## Architecture

**SureCafe AI** is a Vue 3 SPA (recruitment management app) migrated from plain HTML files located at `D:\Project\SureCafe_AI_New_Project-Original Files\`. When in doubt about intended behavior, check the corresponding `.html` source file.

### App Shell (`src/App.vue` + `src/main.js`)
- Header + collapsible sidebar + `<router-view>` layout
- All 7 routes imported eagerly in `src/main.js` — no lazy loading
- Routes: `/` Dashboard, `/candidate-pipelines`, `/candidates`, `/job-descriptions`, `/jd-candidates-match`, `/clients`, `/reports`

### Pages (`src/pages/`)
Each page is a self-contained `.vue` file using `<script setup>`. No Vuex/Pinia — all state is local to each page component via `ref`/`reactive`/`computed`.

### Shared Service (`src/services/airtableService.js`)
Centralized Airtable CRUD with pagination. Key exports:
- `fetchAllRecords(tableName, fields?, options?)` — handles pagination automatically
- `createRecord`, `updateRecord`, `deleteRecord`, `deleteRecordsByFormula`
- `TABLES` constants (see below)

### External Libraries (CDN — NOT npm)
Loaded in `index.html`, accessed via `window.*`:
- Bootstrap 5.3.3 → `window.bootstrap.Modal`
- Chart.js 4.4.0 → `window.Chart`
- chartjs-plugin-datalabels 2.2.0 → `window.ChartDataLabels`

**Important:** Chart.js plugin is auto-registered globally by CDN. Pass `plugins: [window.ChartDataLabels]` per-chart in the Chart constructor config.

### Environment Variables (`.env`)
```
VITE_AIRTABLE_API_KEY=...
VITE_AIRTABLE_BASE_ID=...
```
Used in `airtableService.js` via `import.meta.env.VITE_*`. In `CandidatePipelines.vue` a local `AIRTABLE_CONFIG` object also holds these (hardcoded from original HTML migration).

## Airtable Data Model

### Table Names (case-sensitive — these exact strings go in API calls)
| `TABLES` constant | Actual table name |
|---|---|
| `TABLES.CANDIDATES` | `Candidates` |
| `TABLES.JOB_DESCRIPTIONS` | `Job_Descriptions` |
| `TABLES.CANDIDATE_APPLICATIONS` | `candidate_applications` |
| `TABLES.CANDIDATE_INTERVIEWS` | `candidate_interviews` |
| `TABLES.CLIENTS` | `Clients` |
| `TABLES.STATUSES` | `Statuses` |

> `CandidatePipelines.vue` uses its own `AIRTABLE_CONFIG` with `statusesTable: 'statuses'` (lowercase) — inconsistency from original HTML migration.

### Field Name Conventions by Table
- **Job_Descriptions**: PascalCase + underscores — `Job_Title`, `Status`, `Location`, `Employment_Type`, `Experience_Level`, `Department`, `Priority`, `Experience_Years`, `Salary_Range`, `Date`, `Client_id`
- **candidate_applications**: lowercase snake_case — `candidate_name`, `candidate_email`, `job_title`, `status`, `application_date`, `candidate_exp`, `candidate_role`, `job_id`
- **Candidates**: Mixed — `Candidate Name`, `CandidateStatus`, `gmail`, `Current Role`, `Total Experience`, `Phone`, `Phone Number`, `Location`, `Current Company`, `Date`
- **Clients**: lowercase — `company_name`, `email`, `contact_person`
- **statuses/Statuses**: lowercase — `status_id`, `status`, `entity_type`, `parent_id`, `seq_order`
- **candidate_interviews**: lowercase — `candidate_id`, `job_id`, `application_id`, `interviewType`, `interview_bot_feedback`

### Raw vs Flattened Records
Most pages flatten records immediately after fetch. `CandidatePipelines.vue` works with raw Airtable records (`.fields` access) for interviews and applications:
- Raw: `record.fields.candidate_id`, `record.fields.status`
- Flattened (after `.map()`): `job.job_title`, `client.email`

## Key Patterns

### CandidatePipelines.vue — Hybrid Page
This is the most complex page (~2000+ lines). It uses direct `fetch()` calls to Airtable (not `airtableService.js`) and n8n webhooks. Functions referenced from dynamically-generated `innerHTML` must be assigned to `window.xxx` in `onMounted`. Key function signatures documented in `MEMORY.md`.

### Bootstrap Modals
```js
new window.bootstrap.Modal(document.getElementById('myModal')).show()
window.bootstrap.Modal.getInstance(el)?.hide()
```

### `v-model` in Templates
Must bind to a plain `ref()` only. Never use ternary expressions or computed values directly in `v-model` — causes build errors. Use `v-if/v-else-if/v-else` with separate inputs instead.

### Large File Edits
`CandidatePipelines.vue` is ~2000 lines. When making extensive edits, split into multiple `Edit` calls targeting specific function blocks. The `Write` tool requires reading the file first.

### Dashboard → Page Navigation (cross-page filter)
Dashboard.vue `showDetails(type)` saves to `localStorage` then uses `router.push(path)`. Destination pages read and clear localStorage in `onMounted` after data loads, applying case-insensitive matches against actual Airtable field values:
- **Pipeline** → `/candidate-pipelines`: saves `selectedStatuses=[type]`, read by CandidatePipelines.vue as `selectedMainStatus`
- **Candidates** → `/candidates`: saves lowercase status aliases (`['active','available']` etc.), Candidates.vue matches case-insensitively against `CandidateStatus` field
- **Jobs** → `/job-descriptions`: saves lowercase aliases (`['active','matched','open']` etc.), JobDescriptions.vue matches against `Status` field

### loggedInUser Pattern (CandidatePipelines)
```js
loggedInUserEmail = window.logged_in_user?.softr_user_email || 'rbanothe@tiuconsulting.com';
loggedInUserName  = window.logged_in_user?.softr_user_full_name || 'Raj Banothe';
```
