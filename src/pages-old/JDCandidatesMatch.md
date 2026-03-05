# JDCandidatesMatch.vue — Documentation

> Migrated from `JD-Candidate Matching.html`
> Vue 3 `<script setup>` — Composition API

---

## Overview

The **JD Candidates Match** page allows users to:
1. Upload Job Descriptions (JDs) to Google Drive, triggering n8n automation to process them into Airtable.
2. Browse all active/open/matched jobs.
3. View AI-matched candidate profiles per job, with ranked scoring.
4. Select candidates to add to the pipeline (`candidate_applications` table).
5. Send email notifications via n8n.
6. Export matched candidates as CSV.

---

## External Dependencies

| Resource | Source |
|---|---|
| Google API (GAPI) | `https://apis.google.com/js/api.js` |
| Google Identity Services (GIS) | `https://accounts.google.com/gsi/client` |
| Bootstrap 5.3 | CDN (`window.bootstrap`) |
| Airtable REST API | Direct `fetch()` for Matched Resumes table |

---

## Config Constants

```js
CLIENT_ID     = '539057910222-lgejefkrkr8kamj6uihvko3no1a82pa3.apps.googleusercontent.com'
JD_FOLDER_ID  = '12X_tXF3OdGv0IcO-AkX2QL_8PHrJYMo2'          // Google Drive upload folder
JD_FOLDER_URL = 'https://drive.google.com/drive/u/1/folders/1FnO_hVvXSO_QsjhR1A-UBUfOyFMOCzPI?usp=sharing'
DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
SCOPES        = 'https://www.googleapis.com/auth/drive.file'
```

### n8n Webhooks

| Purpose | URL |
|---|---|
| JD Processing (trigger AI analysis) | `https://surecafe.app.n8n.cloud/webhook/1a681a73-b6fd-4c41-9d2a-e38c9276ec89` |
| Email Notification | `https://surecafe.app.n8n.cloud/webhook/c79a7ebb-1c69-4aa8-9198-e58f0e6ec475` |
| Candidate Matching | `https://surecafe.app.n8n.cloud/webhook/00a73afd-6527-443b-abf0-190de06affdb` |

---

## Airtable Tables Used

### `Job_Descriptions` (via `fetchAllRecords`)
- Filtered to `Status = Active, Matched, or Open`
- Sorted by `updated_at DESC`

**Fields read:**

| Field | Description |
|---|---|
| `JD_ID` | Custom job ID string (falls back to airtable record id) |
| `Job_Title` | Display title |
| `Job_Description` | Full description text |
| `Location` | Job location |
| `Employment_Type` | Full-time / Part-time etc. |
| `Experience_Level` | Junior / Mid / Senior etc. |
| `Experience_Years` | Required years of experience |
| `Required_Skills` | Array of skills |
| `Date` | Posting date |
| `Status` | Active / Matched / Open |
| `Department` | Department name |
| `Priority` | High / Medium / Low |
| `Salary_Range` | Salary range text |
| `Key_Responsibilities` | Array of strings |
| `Domain_Expertise` | Array of strings |
| `Programming_Languages` | Array of strings |
| `Frameworks_Libraries` | Array of strings |
| `Tools_Platforms` | Array of strings |
| `Methodologies` | Array of strings |

---

### `Matched Resumes` (direct `fetch()` — not via airtableService)
- Filtered by `job_id` (one or many jobs)
- Only candidates with `overall_score > 10` are kept
- Displayed: `overall_score >= 30` by default; `>= 11` with "Show All"

**Fields read (exact Airtable field names):**

| Field | Mapped to |
|---|---|
| `job_id` | `jobId` |
| `candidate_id` | `candidateId` |
| `Candidate_name` | `candidateName` |
| `current_role` | `currentRole` |
| `overall_score` | `overallScore` |
| `email` | `email` |
| `formatted url` | `resumeUrl` |
| `surecafe_verdict` | `verdict` |
| `skills_match_score` | `skillsScore` |
| `experience_match_score` | `experienceScore` |
| `domain_industry_score` | `domainScore` |
| `must_have_list` | `mustHaveList` |
| `nice_to_have_list` | `niceToHaveList` |
| `matched_details` | `matchedDetails` |
| `partially_matched_details` | `partiallyMatchedDetails` |
| `missing_details` | `missingDetails` |
| `key_strengths` | `keyStrengths` |
| `key_risks_gaps` | `keyRisksGaps` |
| `all_scores_justification` | `allScoresJustification` |
| `skills_justification` | `skillsJustification` |
| `overall_score_justification` | `overallJustification` |
| `experience_justification` | `experienceJustification` |
| `candidate_rank` | `candidateRank` |
| `match_percentage` | `matchPercentage` |
| `profile_fit_level` | `profileFitLevel` |
| `experience_level_match` | `experienceLevelMatch` |
| `Required_Skills` | `requiredSkills` |
| `candidate_skills` | `candidateSkills` |
| `matching_skills` | `matchingSkills` |
| `missing_skills` | `missingSkills` |
| `total_expeience` | `totalExperience` *(note: typo in Airtable field name)* |
| `current_company` | `currentCompany` |
| `candidate_location` | `candidateLocation` |
| `phone` | `phone` |

---

### `candidate_applications` (direct `fetch()`)
- Fetched on load to build `JobCandidateUniqueData` (tracks which candidates are already in pipeline)
- Records created when user selects a candidate

**Fields written on select:**

| Field | Value |
|---|---|
| `candidate_name` | Candidate name string |
| `candidate_email` | Candidate email string |
| `job_title` | Job title string |
| `job_id` | Job ID string |
| `candidate_id` | Candidate ID string |
| `status` | `"Leads"` |
| `status_id` | `4` |
| `application_type` | `"In house"` |
| `candidate_role` | Candidate current role or "NA" |
| `candidate_exp` | Total experience or "NA" |
| `application_date` | ISO date string (today) |

---

### `Clients` (via `fetchAllRecords`)
- Used to populate the client dropdown for upload validation
- Fields: `company_name`, `email`
- Client selection is **required** before uploading a JD

---

## State Variables

### Vue Refs (reactive — used in template with `v-model`, `v-if`, etc.)

| Ref | Type | Purpose |
|---|---|---|
| `selectedClientId` | `string` | Currently selected client for upload |
| `allClients` | `array` | Loaded client records |
| `statusMsg` | `string` | Upload button status label |
| `progressMsg` | `string` | Upload progress message |
| `uploadBtnDisabled` | `boolean` | Controls upload button disabled state |
| `resultModalVisible` | `boolean` | Shows/hides the result/process modal |
| `resultModalMessage` | `string` | HTML message shown in result modal |
| `filteredJobs` | `array` | Jobs after search filter applied |
| `jobsLoading` | `boolean` | Loading state for jobs section |
| `jobSearch` | `string` | Job search input value |
| `jobCurrentPage` | `number` | Current page in job list pagination |
| `matchingLoading` | `boolean` | Loading spinner for match fetch |
| `matchProgress` | `{visible, pct}` | Progress bar state for matching |
| `hasCandidateResults` | `boolean` | Whether any candidates are loaded |
| `scoreFilter` | `string` | Score filter dropdown value |
| `skillsFilter` | `string` | Skills filter dropdown value |
| `experienceFilter` | `string` | Experience filter dropdown value |
| `domainFilter` | `string` | Domain filter dropdown value |

### Plain JS Variables (not reactive — used in innerHTML rendering)

| Variable | Type | Purpose |
|---|---|---|
| `jobsData` | `array` | All loaded job objects (full data) |
| `allCandidateData` | `object` | Map of `jobId → candidate array` |
| `allCandidatesData` | `array` | All candidates across all jobs (flat) |
| `filteredCandidatesData` | `array` | Candidates after filter applied |
| `JobCandidateUniqueData` | `array` | Strings like `"candidateId-jobId"` — already selected |
| `currentCandidatePage` | `object` | Map of `jobId → current page number` |
| `showAllMatchedProfiles` | `object` | Map of `jobId → boolean` (show >= 11 vs >= 30) |
| `storedResults` | `array` | Flat result array for export/filter |
| `activeFilters` | `object` | Current filter values for results section |
| `existingJobsIds` | `array` | Job IDs before a new upload (for detecting newly added) |

---

## Computed Properties

| Computed | Description |
|---|---|
| `jobPageCount` | Total pages for job list (`ceil(filteredJobs.length / JOB_PAGE_SIZE)`) |
| `pagedJobs` | Slice of `filteredJobs` for current page |

---

## Functions Reference

### Google Drive / Upload

| Function | Description |
|---|---|
| `gapiLoaded()` | Called when GAPI script loads; initializes `gapi.client` |
| `gisLoaded()` | Called when GIS script loads; creates token client |
| `initializeDriveClient()` | Loads Drive API discovery doc |
| `checkAndEnableUpload()` | Enables upload button once both GAPI + GIS are ready |
| `handleFileUpload()` | Entry point on file input change; validates client selected, then calls `uploadFilesToDrive()` |
| `uploadFilesToDrive(files)` | Shows token prompt or calls `uploadWithToken(files)` |
| `uploadWithToken(files)` | Iterates files; calls `uploadFileToDrive()` per file; then `triggerN8nWorkflow()` |
| `uploadFileToDrive(file)` | Uploads single file via multipart MIME to Drive API; returns `{id, name}` |
| `triggerN8nWorkflow()` | POSTs `{client_id}` to JD webhook; reloads jobs; detects newly added jobs; calls `fetchCandidates()` on first new job |

### Jobs

| Function | Description |
|---|---|
| `loadJobs()` | Fetches all active/matched/open jobs from Airtable `Job_Descriptions` |
| `filterJobs()` | Filters `jobsData` by `jobSearch` value; resets to page 1 |
| `showJobDetails(jobId)` | Populates and shows the Bootstrap Job Details Modal (modal-xl) |

### Candidates

| Function | Description |
|---|---|
| `fetchCandidates(jobId?)` | Entry point: if `jobId` given, fetches for that job only; else fetches for all jobs |
| `fetchCandidatesFromAirtable(jobIds)` | Direct fetch to Matched Resumes table; filters to `overall_score > 10`; builds candidate objects |
| `fetchCandidateApplications(jobIds)` | Fetches existing `candidate_applications` for given jobs; populates `JobCandidateUniqueData` |
| `renderAllCandidates()` | Calls `renderCandidatesForJob()` for each job with candidates |
| `renderCandidatesForJob(jobId, page?)` | Renders the collapsible candidate grid for a job; handles pagination and score filter |
| `renderCandidatePagination(jobId, total, totalPages, currentPage)` | Renders pagination controls for a job's candidate list |
| `applyFilters()` | Applies `scoreFilter`, `skillsFilter`, `experienceFilter`, `domainFilter` refs to candidates |

### Window-Exposed Functions (for innerHTML onclick)
All exposed as `window._jdm_xxx` in `onMounted`:

| Function | Description |
|---|---|
| `toggleCandidates(jobId)` | Collapses/expands candidate section for a job |
| `toggleShowAllMatched(jobId)` | Toggles score threshold for a job (>= 30 ↔ >= 11) |
| `toggleDetailSection(btn, section)` | Expands/collapses a detail section in a candidate card |
| `viewCandidateProfile(candidateId, jobId)` | Opens the custom Profile Modal with full candidate details |
| `selectCandidateClicked(btn)` | Reads data attributes from button; shows confirmation modal |
| `openSendEmailModal(candidateId, jobId)` | Populates and shows Bootstrap Send Email modal |
| `showJobDetails(jobId)` | Exposed for inline onclick calls |

### Modals

| Function | Description |
|---|---|
| `openModal(msg)` | Shows result/process modal with given HTML message |
| `closeModal()` | Closes result/process modal |
| `showJobDetails(jobId)` | Shows Bootstrap modal with full job details (renders innerHTML) |
| `openSendEmailModal(candidateId, jobId)` | Shows Bootstrap send email modal pre-populated with candidate |
| `sendEmail()` | Reads email form fields; POSTs to `N8N_EMAIL_WEBHOOK` |
| `selectCandidateClicked(btn)` | Shows Bootstrap confirmation modal |
| `confirmSelectCandidate()` | Called by confirm modal "Yes" button; calls `selectCandidate()` |
| `selectCandidate(...)` | POSTs new record to `candidate_applications`; updates button state |
| `viewCandidateProfile(candidateId, jobId)` | Shows custom DOM profile modal |
| `closeProfileModal()` | Closes profile modal |

### Utilities

| Function | Description |
|---|---|
| `getScoreColor(score)` | Returns CSS color class based on score value |
| `getVerdictBadgeClass(verdict)` | Returns Bootstrap badge class for surecafe_verdict |
| `formatDate(date)` | Formats ISO date string to human-readable |
| `exportCSV()` | Exports `storedResults` as downloadable `.csv` file |

---

## UI Sections

### 1. Upload Section
- Client dropdown (required before upload)
- File input (accepts PDF, DOC, DOCX)
- Upload button (disabled until GAPI + GIS ready)
- See JD Folder link (opens Google Drive folder)
- Status message and progress message

### 2. Job List Section
- Search input (filters by title or ID)
- Job cards grid (paginated, 10 per page)
- Each job card shows: title, ID, location, employment type, experience level, date, status badge
- "View Details" button → Job Details Modal
- "Fetch Candidates" button → loads matched candidates for that job
- Pagination controls (numbered, prev/next)

### 3. Candidate Results Section
- Visible only when `hasCandidateResults = true`
- Filter dropdowns: Overall Score, Skills Score, Experience Score, Domain Score
- "Export CSV" button
- Per-job collapsible sections:
  - Job header with candidate count
  - "Show All / Show Qualified" toggle
  - Candidate cards grid (paginated, 10 per page, max 5 page numbers)
  - Each card shows: name, role, score badge, verdict badge, score breakdown bars, action buttons

### 4. Candidate Card Actions
- "View Profile" → Profile Modal (full justification details)
- "Select" → Confirmation Modal → adds to `candidate_applications`
- "Email" → Send Email Modal
- Already-selected candidates show "Already Shortlisted" badge (disabled button)

---

## Modals

### Result Modal (custom)
- Used for: upload progress, error messages, success confirmations
- Controlled by `resultModalVisible` / `resultModalMessage` refs
- Supports HTML content via `v-html`

### Job Details Modal (Bootstrap, modal-xl, id: `jobDetailsModal`)
- Populated via `innerHTML` from `showJobDetails(jobId)`
- Shows: title, ID, status, location, employment type, experience level/years, department, priority, salary range, required skills, key responsibilities, domain expertise, programming languages, frameworks/libraries, tools/platforms, methodologies

### Send Email Modal (Bootstrap, id: `sendEmailModal`)
- Form fields: To (readonly, pre-filled with candidate email), CC, BCC, Subject (pre-filled with job title), Message (textarea)
- Submit calls `sendEmail()` → POSTs to `N8N_EMAIL_WEBHOOK`
- Payload: `{ to, cc, bcc, subject, message, jobId, candidateId }`

### Confirmation Modal (Bootstrap, id: `confirmModal`)
- Generic: "Are you sure you want to select [name] for [job]?"
- Yes button calls `confirmSelectCandidate()` which reads pending state and calls `selectCandidate()`

### Profile Modal (custom DOM-based)
- Full-screen overlay with all candidate AI analysis fields
- Sections: Basic Info, Scores, Verdict, Must Have / Nice to Have, Matched / Partial / Missing Details, Key Strengths, Key Risks, All Scores Justification, Skills Justification, Experience Justification, Overall Justification, Skills Breakdown (required / candidate / matching / missing)

---

## Score Filtering Logic

```
On load:  display candidates with overallScore >= 30
Show All: display candidates with overallScore >= 11
Hidden:   candidates with overallScore <= 10 (never fetched/displayed)
```

Score color classes:
- >= 80 → `score-excellent` (green)
- >= 60 → `score-good` (blue)
- >= 40 → `score-fair` (orange)
- < 40  → `score-poor` (red)

---

## Select Candidate Flow

1. User clicks "Select" button on candidate card
2. `selectCandidateClicked(btn)` reads data attributes: `candidateId`, `candidateName`, `jobId`, `jobTitle`, `jobLocation`, `candidateRole`, `candidateExperience`, `candidateEmail`
3. Confirmation modal shown: "Are you sure you want to select [name] for [job]?"
4. User clicks "Yes" → `confirmSelectCandidate()` → `selectCandidate(...)`
5. `selectCandidate()` POSTs to `candidate_applications` with `status: "Leads"`, `status_id: 4`, `application_type: "In house"`
6. Unique key `"candidateId-jobId"` added to `JobCandidateUniqueData`
7. Button updated to show "Already Shortlisted" (disabled)

---

## Upload + n8n Trigger Flow

1. User selects a client from dropdown
2. User picks JD file(s) — PDF / DOC / DOCX
3. `handleFileUpload()` validates client selected
4. Token requested from Google (OAuth2 via GIS)
5. `uploadWithToken()` uploads each file to Google Drive folder (`JD_FOLDER_ID`) via multipart MIME
6. After all uploads complete: `triggerN8nWorkflow()` called
7. `triggerN8nWorkflow()` records current job IDs, then POSTs `{ client_id }` to `N8N_JD_WEBHOOK`
8. `loadJobs()` called to refresh jobs list
9. New job IDs (not in original list) detected → `fetchCandidates(newJobId)` called automatically

---

## Pagination

### Job List Pagination
- Page size: 10 jobs
- Controlled by `jobCurrentPage` ref
- Computed: `jobPageCount`, `pagedJobs`

### Candidate Pagination (per job)
- Page size: 10 candidates
- Stored in `currentCandidatePage[jobId]`
- Max 5 visible page numbers (centered around current page)
- Rendered via `renderCandidatePagination()`

---

## CSV Export

`exportCSV()` converts `storedResults` array to CSV with columns:
`Candidate Name`, `Current Role`, `Email`, `Phone`, `Location`, `Company`, `Total Experience`, `Overall Score`, `Skills Score`, `Experience Score`, `Domain Score`, `Verdict`, `Job ID`

Download triggered via `Blob` + `URL.createObjectURL`.

---

## Key Gotchas

1. **`Matched Resumes` table** is NOT in `TABLES` constants in `airtableService.js` — use direct `fetch()` calls.
2. **`total_expeience`** — Airtable field has a typo (missing 'r') — must match exactly.
3. **`formatted url`** — field name has a space — must be accessed as `f['formatted url']`.
4. **`JD_ID` field** — not all jobs have this; falls back to Airtable record `id`.
5. **Client selection required** — `handleFileUpload()` returns early with alert if no client selected.
6. **Window exposure** — functions called from `innerHTML` onclick must be exposed as `window._jdm_xxx` in `onMounted`.
7. **Score threshold** — `> 10` filter applied at fetch time; `>= 30` / `>= 11` applied at render time.
8. **`showAllMatchedProfiles[jobId]`** — plain JS object, not reactive; `renderCandidatesForJob()` must be called manually after toggling.
