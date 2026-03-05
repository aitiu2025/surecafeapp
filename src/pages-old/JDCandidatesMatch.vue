<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { fetchAllRecords, TABLES } from '@/services/airtableService.js';
import { useRouter } from 'vue-router';

const router = useRouter();

// ─── Config ───────────────────────────────────────────────────────────────────
const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const CLIENT_ID     = '539057910222-lgejefkrkr8kamj6uihvko3no1a82pa3.apps.googleusercontent.com';
const JD_FOLDER_ID  = '12X_tXF3OdGv0IcO-AkX2QL_8PHrJYMo2';
const JD_FOLDER_URL = 'https://drive.google.com/drive/u/1/folders/1FnO_hVvXSO_QsjhR1A-UBUfOyFMOCzPI?usp=sharing';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES        = 'https://www.googleapis.com/auth/drive.file';
const N8N_JD_WEBHOOK    = 'https://surecafe.app.n8n.cloud/webhook/1a681a73-b6fd-4c41-9d2a-e38c9276ec89';
const N8N_EMAIL_WEBHOOK = 'https://surecafe.app.n8n.cloud/webhook/c79a7ebb-1c69-4aa8-9198-e58f0e6ec475';
const N8N_MATCH_WEBHOOK = 'https://surecafe.app.n8n.cloud/webhook/00a73afd-6527-443b-abf0-190de06affdb';

// ─── Upload State ─────────────────────────────────────────────────────────────
const selectedClientId  = ref('');
const allClients        = ref([]);
const statusMsg         = ref('Loading Google API...');
const progressMsg       = ref('');
const uploadBtnDisabled = ref(true);
let gapiInited = false, gisInited = false, tokenClient;

// ─── Result Modal ─────────────────────────────────────────────────────────────
const resultModalVisible = ref(false);
const resultModalMessage = ref('');
function openModal(msg) { resultModalMessage.value = msg; resultModalVisible.value = true; }
function closeModal() { resultModalVisible.value = false; }

// ─── Jobs State ───────────────────────────────────────────────────────────────
let jobsData = [];
const filteredJobs   = ref([]);
const jobsLoading    = ref(true);
const jobSearch      = ref('');
const jobCurrentPage = ref(1);
const JOB_PAGE_SIZE  = 10;
const jobPageCount   = computed(() => Math.max(1, Math.ceil(filteredJobs.value.length / JOB_PAGE_SIZE)));
const pagedJobs      = computed(() => filteredJobs.value.slice((jobCurrentPage.value-1)*JOB_PAGE_SIZE, jobCurrentPage.value*JOB_PAGE_SIZE));
let existingJobsIds  = [];

// ─── Candidate Matching State (plain JS — not Vue reactive, used in innerHTML rendering) ─
let allCandidateData       = {};
let allCandidatesData      = [];
let filteredCandidatesData = [];
let JobCandidateUniqueData = [];
let currentCandidatePage   = {};
let showAllMatchedProfiles = {};
let storedResults          = [];
let activeFilters          = {};
const candidatePageSize    = 10;

const matchingLoading    = ref(false);
const matchProgress      = reactive({ visible: false, pct: 0 });
const hasCandidateResults = ref(false);

// Filter refs (for v-model in template)
const scoreFilter      = ref('');
const skillsFilter     = ref('');
const experienceFilter = ref('');
const domainFilter     = ref('');

// ─── Load Jobs ────────────────────────────────────────────────────────────────
async function loadJobs() {
  jobsLoading.value = true;
  try {
    const formula = `OR({Status}="Active",{Status}="Matched",{Status}="Open")`;
    const records = await fetchAllRecords(TABLES.JOB_DESCRIPTIONS, [], {
      sort: [{ field: 'updated_at', direction: 'desc' }],
      filterByFormula: formula,
    });
    jobsData = records.map(r => ({
      airtableId: r.id,
      id: r.fields['JD_ID'] || r.id,
      title: r.fields['Job_Title'] || '-',
      description: r.fields['Job_Description'] || '',
      location: r.fields['Location'] || '-',
      employmentType: r.fields['Employment_Type'] || '-',
      experienceLevel: r.fields['Experience_Level'] || '-',
      experienceYears: r.fields['Experience_Years'] || '-',
      requiredSkills: r.fields['Required_Skills'] || [],
      date: r.fields['Date'] || '-',
      status: r.fields['Status'] || '',
      department: r.fields['Department'] || '-',
      priority: r.fields['Priority'] || '-',
      salaryRange: r.fields['Salary_Range'] || '-',
      keyResponsibilities: r.fields['Key_Responsibilities'] || [],
      domainExpertise: r.fields['Domain_Expertise'] || [],
      programmingLanguages: r.fields['Programming_Languages'] || [],
      frameworksLibraries: r.fields['Frameworks_Libraries'] || [],
      toolsPlatforms: r.fields['Tools_Platforms'] || [],
      methodologies: r.fields['Methodologies'] || [],
      allData: r.fields,
    }));
    filteredJobs.value = [...jobsData];
    existingJobsIds = jobsData.map(j => j.id);
  } catch(e) {
    console.error('Error loading jobs:', e);
  } finally {
    jobsLoading.value = false;
  }
}

async function loadClients() {
  try {
    const records = await fetchAllRecords(TABLES.CLIENTS, ['company_name','contact_person'], { sort:[{field:'company_name',direction:'asc'}] });
    allClients.value = records.map(r => ({
      id: r.id,
      name: (r.fields.contact_person ? r.fields.contact_person + '-' : '') + (r.fields.company_name || ''),
    }));
  } catch(e) { console.error('Error loading clients:', e); }
}

function filterJobs() {
  const q = jobSearch.value.toLowerCase().trim();
  filteredJobs.value = q
    ? jobsData.filter(j => (j.title+j.location+j.employmentType+j.status).toLowerCase().includes(q))
    : [...jobsData];
  jobCurrentPage.value = 1;
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', { year:'numeric', month:'2-digit', day:'2-digit', hour:'numeric', minute:'2-digit', hour12:true });
}

// ─── Fetch Candidates from Matched Resumes ────────────────────────────────────
async function fetchCandidatesFromAirtable(jobIds) {
  const skillsToArray = (skills) => {
    if (!skills) return [];
    if (Array.isArray(skills)) return skills.map(s => typeof s === 'object' && s?.name ? s.name.toString().trim() : s.toString().trim());
    if (typeof skills === 'string') return skills.split(',').map(s => s.trim()).filter(Boolean);
    return [skills.toString().trim()];
  };
  const filterFormula = jobIds.length === 1
    ? `job_id = "${jobIds[0]}"`
    : `OR(${jobIds.map(id=>`job_id = "${id}"`).join(',')})`;
  let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Matched Resumes')}?pageSize=100&filterByFormula=${encodeURIComponent(filterFormula)}`;
  let offset = null, allRecords = [];
  do {
    const res = await fetch(url + (offset ? `&offset=${offset}` : ''), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  const allMapped = allRecords.map(record => {
    const f = record.fields;
    return {
      jobId: f['job_id'] || '',
      id: f['candidate_id'] || record.id,
      name: f['Candidate_name'] || 'Unknown',
      currentRole: f['current_role'] || '-',
      overallScore: f['overall_score'] || 0,
      email: f['email'] || '',
      formattedUrl: f['formatted url'] || '',
      surevafeVerdict: f['surecafe_verdict'] || '',
      skillsMatchScore: f['skills_match_score'] || 0,
      experienceMatchScore: f['experience_match_score'] || 0,
      domainIndustryScore: f['domain_industry_score'] || 0,
      mustHaveList: f['must_have_list'] || '',
      niceToHaveList: f['nice_to_have_list'] || '',
      matchedDetails: f['matched_details'] || '',
      partiallyMatchedDetails: f['partially_matched_details'] || '',
      missingDetails: f['missing_details'] || '',
      keyStrengths: f['key_strengths'] || '',
      keyRisksGaps: f['key_risks_gaps'] || '',
      all_scores_justification: f['all_scores_justification'] || '',
      skills_justification: f['skills_justification'] || '',
      overall_score_justification: f['overall_score_justification'] || '',
      experience_justification: f['experience_justification'] || '',
      rank: f['candidate_rank'] || '-',
      matchPercentage: f['match_percentage'] || 0,
      profileFitLevel: f['profile_fit_level'] || '-',
      experienceLevelMatch: f['experience_level_match'] || '-',
      requiredSkills: skillsToArray(f['Required_Skills']),
      candidateSkills: skillsToArray(f['candidate_skills']),
      matchingSkills: skillsToArray(f['matching_skills']),
      missingSkills: skillsToArray(f['missing_skills']),
      experience: f['total_expeience'] || '-',
      currentCompany: f['current_company'] || '-',
      location: f['candidate_location'] || '-',
      phone: f['phone'] || '-',
    };
  });

  // Only include score > 10
  const candidates = allMapped.filter(c => (parseFloat(c.overallScore)||0) > 10);
  const candidatesByJob = {};
  candidates.forEach(c => {
    if (!candidatesByJob[c.jobId]) candidatesByJob[c.jobId] = [];
    candidatesByJob[c.jobId].push(c);
  });
  Object.keys(candidatesByJob).forEach(jid => {
    candidatesByJob[jid].sort((a,b) => (parseFloat(b.overallScore)||0) - (parseFloat(a.overallScore)||0));
  });
  return candidatesByJob;
}

async function fetchCandidateApplications(jobIds) {
  try {
    const filterFormula = jobIds.length === 1
      ? `{job_id} = "${jobIds[0]}"`
      : `OR(${jobIds.map(id=>`{job_id} = "${id}"`).join(',')})`;
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('candidate_applications')}?pageSize=100&filterByFormula=${encodeURIComponent(filterFormula)}`;
    let offset = null, allRecords = [];
    do {
      const res = await fetch(url + (offset ? `&offset=${offset}` : ''), {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
      });
      const data = await res.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset;
    } while (offset);
    JobCandidateUniqueData = [];
    allRecords.forEach(r => {
      const cid = r.fields.candidate_id;
      const jid = r.fields.job_id;
      if (cid && jid) JobCandidateUniqueData.push(`${cid}-${jid}`);
    });
  } catch(e) { console.error('Error fetching applications:', e); JobCandidateUniqueData = []; }
}

async function fetchCandidates(jobId) {
  const jobIds = [jobId];
  matchProgress.visible = true; matchProgress.pct = 0;
  matchingLoading.value = true;
  openModal("<div class='spinner-border processSpin' role='status'></div> Fetching candidates... Please wait.");
  try {
    matchProgress.pct = 20;
    const candidatesByJob = await fetchCandidatesFromAirtable(jobIds);
    matchProgress.pct = 50;
    await fetchCandidateApplications(jobIds);
    matchProgress.pct = 80;
    const results = jobIds.map(jid => ({
      job: jobsData.find(j => j.id === jid),
      candidates: candidatesByJob[jid] || [],
    }));
    matchProgress.pct = 100;
    closeModal();
    displayCandidateResults(results, true);
    setTimeout(() => { matchProgress.visible = false; matchProgress.pct = 0; }, 2000);
  } catch(e) {
    console.error('Error fetching candidates:', e);
    closeModal(); matchProgress.visible = false;
    openModal('❌ Failed to fetch candidates. Please try again.');
  } finally {
    matchingLoading.value = false;
  }
}

// ─── Display Candidate Results (innerHTML-based, same structure as HTML) ────────
function displayCandidateResults(results, isInitialRender = false) {
  storedResults = results;
  if (isInitialRender) {
    allCandidateData = {}; allCandidatesData = [];
    results.forEach(r => r.candidates.forEach(c => { allCandidateData[c.id] = c; allCandidatesData.push(c); }));
    filteredCandidatesData = [...allCandidatesData];
    results.forEach(r => { if (r.job && !currentCandidatePage[r.job.id]) currentCandidatePage[r.job.id] = 1; });
    scoreFilter.value = ''; skillsFilter.value = ''; experienceFilter.value = ''; domainFilter.value = '';
    activeFilters = {};
    Object.keys(showAllMatchedProfiles).forEach(k => delete showAllMatchedProfiles[k]);
  }

  const container = document.getElementById('candidatesResultsContainer');
  if (!container) return;

  const totalCandidates = results.reduce((s,r) => s + r.candidates.length, 0);
  const summaryEl = document.getElementById('candidateResultsSummary');
  if (summaryEl) {
    summaryEl.textContent = `Found ${totalCandidates} matching candidates across ${results.length} job(s)`;
    summaryEl.style.display = 'block';
    setTimeout(() => {
      summaryEl.style.display = 'none';
    }, 1000);
  }

  container.innerHTML = results.map(result => {
    if (!result.job) return '';
    const jobId = result.job.id;
    const total = result.candidates.length;
    return `
    <div class="job-candidates-section">
      <div class="job-candidates-header" onclick="window._jdm_toggleCandidates('${jobId}')">
        <div style="flex:1;display:flex;align-items:center;gap:15px;flex-wrap:wrap;">
          <div class="job-candidates-title" onclick="event.stopPropagation();window._jdm_showJobDetails('${jobId}')" title="Show Job Details">${result.job.title}</div>
          <div class="job-candidates-meta">
            <span style="color:#FF6F21;font-size:16px;" title="${jobId}"><i class="bi bi-info-circle"></i></span> •
            <span id="candidates-count-${jobId}">${total} candidates (Out of ${total} candidates)</span> •
            <span>${result.job.location}</span> •
            <span>${result.job.experienceLevel}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button class="fetch-btn" id="show-all-btn-${jobId}" style="white-space:nowrap;" onclick="event.stopPropagation();window._jdm_toggleShowAllMatched('${jobId}')">Show All Profile(Including Weak Profiles)</button>
          <button class="toggle-candidates-btn" id="toggle-btn-${jobId}" style="white-space:nowrap;margin:0;">Hide Candidates</button>
        </div>
      </div>
      <div class="candidates-detailed-grid" id="candidates-list-${jobId}" style="display:grid;"></div>
      <div class="pagination-controls" id="pagination-${jobId}" style="display:flex;gap:6px;margin-top:15px;justify-content:flex-end;padding:0 5px;"></div>
    </div>`;
  }).join('');

  hasCandidateResults.value = true;
  updateFilterStats();
  results.forEach(r => { if (r.job) renderCandidatesForJob(r.job.id); });
  const filterSection = document.getElementById('candidateFiltersSection');
  if (filterSection) filterSection.style.display = 'block';
  const matchingContent = document.getElementById('matchingCandidatesContent');
  if (matchingContent) {
    matchingContent.style.display = 'block';
    setTimeout(() => matchingContent.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
  }
}

function renderCandidatesForJob(jobId) {
  const candidatesForJob = filteredCandidatesData.filter(c => c.jobId === jobId);
  const list = document.getElementById('candidates-list-' + jobId);
  if (!list) return;
  updateCandidateCountDisplay(jobId);
  if (!currentCandidatePage[jobId]) currentCandidatePage[jobId] = 1;

  let displayCandidates = !showAllMatchedProfiles[jobId]
    ? candidatesForJob.filter(c => (parseFloat(c.overallScore)||0) >= 30)
    : candidatesForJob.filter(c => (parseFloat(c.overallScore)||0) >= 11);

  const totalPages = Math.ceil(displayCandidates.length / candidatePageSize);
  const start = (currentCandidatePage[jobId]-1) * candidatePageSize;
  const paged  = displayCandidates.slice(start, start + candidatePageSize);
  const jobInfo = jobsData.find(j => j.id === jobId);

  list.innerHTML = paged.length === 0
    ? '<div style="padding:40px;text-align:center;color:#6B7280;grid-column:1/-1;">No matching candidates found for this job</div>'
    : paged.map(c => {
        const key = `${String(c.id).trim()}-${String(jobId).trim()}`;
        const isSelected = JobCandidateUniqueData.includes(key);
        const os   = c.overallScore   ? parseFloat(c.overallScore).toFixed(1)   : 'N/A';
        const sms  = c.skillsMatchScore   ? parseFloat(c.skillsMatchScore).toFixed(1)   : 0;
        const ems  = c.experienceMatchScore ? parseFloat(c.experienceMatchScore).toFixed(1) : 0;
        const dms  = c.domainIndustryScore  ? parseFloat(c.domainIndustryScore).toFixed(1)  : 0;
        const safeEmail = (c.email||'').replace(/'/g, "\\'");
        const safeTitle = ((jobInfo?.title)||'').replace(/'/g, "\\'");
        const safeName  = (c.name||'').replace(/'/g, "\\'");
        const safeRole  = (c.currentRole||'').replace(/'/g, "\\'");
        const safeExp   = (c.experience||'').replace(/'/g, "\\'");
        return `
        <div class="detailed-candidate-card">
          <div style="display:flex;gap:15px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
            <div style="font-weight:600;font-size:14px;color:#1976d2;">${c.name}</div>
            <div style="font-size:12px;color:#666;"> • ${c.currentRole}</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;padding:8px;background:#f0f9ff;border-radius:8px;border:0.5px solid #d4f0ff;">
            <div style="text-align:center;padding:4px 8px;">
              <div style="font-size:11px;color:#666;font-weight:500;">Overall Score</div>
              <div style="font-size:14px;font-weight:bold;color:#0284c7;">${os}</div>
            </div>
            <div style="text-align:center;padding:4px 8px;border-radius:4px;">
              <div style="font-size:11px;color:#1e40af;font-weight:500;">Skills</div>
              <div style="font-size:14px;font-weight:bold;color:#1e40af;">${sms}%</div>
            </div>
            <div style="text-align:center;padding:4px 8px;border-radius:4px;">
              <div style="font-size:11px;color:#166534;font-weight:500;">Experience</div>
              <div style="font-size:14px;font-weight:bold;color:#166534;">${ems}%</div>
            </div>
            <div style="text-align:center;padding:4px 8px;border-radius:4px;">
              <div style="font-size:11px;color:#831843;font-weight:500;">Domain</div>
              <div style="font-size:14px;font-weight:bold;color:#831843;">${dms}%</div>
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <div id="details-${c.id}" data-expanded="false" style="max-height:72px;overflow:hidden;transition:max-height 0.35s ease;padding:10px 0;font-size:13px;">
              ${c.keyStrengths ? `<div style="margin-bottom:8px;"><strong style="color:#079b3f;">Key Strengths:</strong> <span style="color:#555;">${c.keyStrengths}</span></div>` : ''}
              ${c.keyRisksGaps ? `<div style="margin-bottom:8px;"><strong style="color:#cd6a22;">Key Risks &amp; Gaps:</strong> <span style="color:#555;">${c.keyRisksGaps}</span></div>` : ''}
            </div>
            <button class="show-more-btn" onclick="window._jdm_toggleDetailSection('${c.id}')">
              <span id="toggle-text-${c.id}">Show More</span>
              <i id="toggle-icon-${c.id}" class="bi bi-chevron-down" style="font-size:12px;"></i>
            </button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button class="btn-candidate-action primary" onclick="window._jdm_viewCandidateProfile('${c.id}')"><i class="bi bi-person-circle"></i> View Profile</button>
            ${isSelected
              ? `<button class="btn-candidate-action selected-button" id="select-btn-${c.id}">&#10004; Selected</button>`
              : `<button class="btn-candidate-action" id="select-btn-${c.id}" onclick="window._jdm_selectCandidateClicked(this)"
                  data-candidate-id="${c.id}" data-candidate-name="${safeName}" data-job-id="${jobId}"
                  data-job-title="${safeTitle}" data-job-location="${jobInfo?.location||''}"
                  data-candidate-role="${safeRole}" data-candidate-experience="${safeExp}" data-candidate-email="${safeEmail}">
                  <i class="bi bi-person-check-fill"></i> Select Candidate</button>`}
            ${c.email ? `<button class="btn-candidate-action" onclick="window._jdm_openSendEmailModal('${safeTitle}','${safeEmail}','Leads')"><i class="bi bi-envelope"></i> Send Email</button>` : ''}
            ${c.formattedUrl ? `<a href="${c.formattedUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;text-decoration:none;color:#3b82f6;font-size:12px;font-weight:600;padding:5px 4px;" class="btn-candidate-action"><i class="bi bi-file-earmark-text"></i> View Resume</a>` : ''}
          </div>
        </div>`;
      }).join('');

  renderCandidatePagination(jobId, displayCandidates.length, totalPages);
}

function renderCandidatePagination(jobId, totalRecords, totalPages) {
  const container = document.getElementById(`pagination-${jobId}`);
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) return;
  const make = (label, disabled, onClick) => {
    const b = document.createElement('button');
    b.textContent = label; b.disabled = disabled; b.onclick = onClick; return b;
  };
  container.appendChild(make('First', currentCandidatePage[jobId]===1, () => { currentCandidatePage[jobId]=1; renderCandidatesForJob(jobId); }));
  container.appendChild(make('Prev',  currentCandidatePage[jobId]===1, () => { if(currentCandidatePage[jobId]>1){ currentCandidatePage[jobId]--; renderCandidatesForJob(jobId); }}));
  let sp = Math.max(1, currentCandidatePage[jobId]-2), ep = Math.min(totalPages, sp+4);
  if (ep-sp < 4) sp = Math.max(1, ep-4);
  for (let i=sp; i<=ep; i++) {
    const b = make(i, false, (() => { const pi=i; return () => { currentCandidatePage[jobId]=pi; renderCandidatesForJob(jobId); }; })());
    if (i===currentCandidatePage[jobId]) b.className='active';
    container.appendChild(b);
  }
  container.appendChild(make('Next', currentCandidatePage[jobId]===totalPages, () => { if(currentCandidatePage[jobId]<totalPages){ currentCandidatePage[jobId]++; renderCandidatesForJob(jobId); }}));
  container.appendChild(make('Last', currentCandidatePage[jobId]===totalPages, () => { currentCandidatePage[jobId]=totalPages; renderCandidatesForJob(jobId); }));
}

function updateCandidateCountDisplay(jobId) {
  const allForJob      = allCandidatesData.filter(c => c.jobId === jobId);
  const filteredForJob = filteredCandidatesData.filter(c => c.jobId === jobId);
  const display = !showAllMatchedProfiles[jobId]
    ? filteredForJob.filter(c => (parseFloat(c.overallScore)||0) >= 30)
    : filteredForJob.filter(c => (parseFloat(c.overallScore)||0) >= 11);
  const el = document.getElementById(`candidates-count-${jobId}`);
  if (el) el.textContent = `${display.length} candidates (Out of ${allForJob.length} candidates)`;
}

function toggleCandidates(jobId) {
  const list       = document.getElementById(`candidates-list-${jobId}`);
  const btn        = document.getElementById(`toggle-btn-${jobId}`);
  const pagination = document.getElementById(`pagination-${jobId}`);
  if (!list) return;
  if (list.style.display === 'none') {
    list.style.display = 'grid';
    if (pagination) pagination.style.display = 'flex';
    if (btn) btn.textContent = 'Hide Candidates';
    renderCandidatesForJob(jobId);
  } else {
    list.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (btn) btn.textContent = 'Show Candidates';
  }
}

function toggleShowAllMatched(jobId) {
  showAllMatchedProfiles[jobId] = !showAllMatchedProfiles[jobId];
  const btn = document.getElementById(`show-all-btn-${jobId}`);
  if (btn) btn.textContent = showAllMatchedProfiles[jobId] ? 'Hide Weak Profiles' : 'Show All Profile(Including Weak Profiles)';
  currentCandidatePage[jobId] = 1;
  renderCandidatesForJob(jobId);
  const grid = document.getElementById(`candidates-list-${jobId}`);
  if (grid && grid.style.display === 'none') {
    grid.style.display = 'grid';
    const p = document.getElementById(`pagination-${jobId}`);
    if (p) p.style.display = 'flex';
  }
}

function toggleDetailSection(candidateId) {
  const div  = document.getElementById(`details-${candidateId}`);
  const text = document.getElementById(`toggle-text-${candidateId}`);
  const icon = document.getElementById(`toggle-icon-${candidateId}`);
  if (!div) return;
  const isExpanded = div.getAttribute('data-expanded') === 'true';
  if (isExpanded) {
    div.style.maxHeight = '72px';
    div.setAttribute('data-expanded', 'false');
    if (text) text.textContent = 'Show More';
    if (icon) { icon.classList.remove('bi-chevron-up'); icon.classList.add('bi-chevron-down'); }
  } else {
    div.style.maxHeight = div.scrollHeight + 200 + 'px';
    div.setAttribute('data-expanded', 'true');
    if (text) text.textContent = 'Show Less';
    if (icon) { icon.classList.remove('bi-chevron-down'); icon.classList.add('bi-chevron-up'); }
  }
}

// ─── Candidate Filters ────────────────────────────────────────────────────────
function applyCandidateFilters() {
  const filters = { overallScore: scoreFilter.value, skillsMatch: skillsFilter.value, experienceMatch: experienceFilter.value, domainMatch: domainFilter.value };
  activeFilters = Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== ''));
  filteredCandidatesData = allCandidatesData.filter(c => {
    if (filters.overallScore) {
      const s = parseFloat(c.overallScore)||0;
      if (filters.overallScore==='80' && s<80) return false;
      if (filters.overallScore==='60' && (s<60||s>80)) return false;
      if (filters.overallScore==='40' && (s<40||s>60)) return false;
      if (filters.overallScore==='30' && (s<30||s>40)) return false;
      if (filters.overallScore==='below30' && s>=30) return false;
    }
    if (filters.skillsMatch) {
      const s = parseFloat(c.skillsMatchScore)||0;
      if (filters.skillsMatch==='80' && s<80) return false;
      if (filters.skillsMatch==='60' && (s<60||s>80)) return false;
      if (filters.skillsMatch==='40' && (s<40||s>60)) return false;
      if (filters.skillsMatch==='30' && (s<30||s>40)) return false;
      if (filters.skillsMatch==='below30' && s>=30) return false;
    }
    if (filters.experienceMatch) {
      const s = parseFloat(c.experienceMatchScore)||0;
      if (filters.experienceMatch==='80' && s<80) return false;
      if (filters.experienceMatch==='60' && (s<60||s>80)) return false;
      if (filters.experienceMatch==='40' && (s<40||s>60)) return false;
      if (filters.experienceMatch==='30' && (s<30||s>40)) return false;
      if (filters.experienceMatch==='below30' && s>=30) return false;
    }
    if (filters.domainMatch) {
      const s = parseFloat(c.domainIndustryScore)||0;
      if (filters.domainMatch==='80' && s<80) return false;
      if (filters.domainMatch==='60' && (s<60||s>80)) return false;
      if (filters.domainMatch==='40' && (s<40||s>60)) return false;
      if (filters.domainMatch==='30' && (s<30||s>40)) return false;
      if (filters.domainMatch==='below30' && s>=30) return false;
    }
    return true;
  });
  Object.keys(currentCandidatePage).forEach(jid => { currentCandidatePage[jid] = 1; });
  updateCandidateDisplay();
  updateFilterStats();
}

function updateCandidateDisplay() {
  storedResults.forEach(r => { if (r.job) renderCandidatesForJob(r.job.id); });
}

function updateFilterStats() {
  const total = allCandidatesData.length;
  const filtered = filteredCandidatesData.length;
  const ac = Object.keys(activeFilters).length;
  const totalEl = document.getElementById('totalCandidateCount');
  const filteredEl = document.getElementById('filteredCandidateCount');
  const activeEl = document.getElementById('activeFiltersCount');
  if (totalEl) totalEl.textContent = total;
  if (filteredEl) filteredEl.textContent = filtered;
  if (activeEl) activeEl.textContent = ac === 0 ? 'No filters applied' : `${ac} filter${ac>1?'s':''} applied`;
}

function resetAllFilters() {
  scoreFilter.value = ''; skillsFilter.value = ''; experienceFilter.value = ''; domainFilter.value = '';
  activeFilters = {};
  filteredCandidatesData = [...allCandidatesData];
  Object.keys(showAllMatchedProfiles).forEach(jid => {
    showAllMatchedProfiles[jid] = false;
    const btn = document.getElementById(`show-all-btn-${jid}`);
    if (btn) btn.textContent = 'Show All Profile(Including Weak Profiles)';
  });
  document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
  Object.keys(currentCandidatePage).forEach(jid => { currentCandidatePage[jid] = 1; renderCandidatesForJob(jid); });
  updateFilterStats();
}

function applyQuickFilter(type, event) {
  resetAllFilters();
  document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  const shouldShowOnlyStrong = ['score80plus','score60to80'].includes(type);
  if (type==='score80plus')  scoreFilter.value='80';
  else if (type==='score60to80')  scoreFilter.value='60';
  else if (type==='score40to60')  scoreFilter.value='40';
  else if (type==='score30to40')  scoreFilter.value='30';
  else if (type==='scoreLess30')  scoreFilter.value='below30';
  allCandidatesData.forEach(c => {
    if (!(c.jobId in showAllMatchedProfiles)) showAllMatchedProfiles[c.jobId] = false;
    showAllMatchedProfiles[c.jobId] = !shouldShowOnlyStrong;
    const btn = document.getElementById(`show-all-btn-${c.jobId}`);
    if (btn) btn.textContent = showAllMatchedProfiles[c.jobId] ? 'Hide Weak Profiles' : 'Show All Profile(Including Weak Profiles)';
  });
  applyCandidateFilters();
}

// ─── Select Candidate ─────────────────────────────────────────────────────────
function selectCandidateClicked(btn) {
  const candidateId       = btn.getAttribute('data-candidate-id');
  const candidateName     = btn.getAttribute('data-candidate-name');
  const jobId             = btn.getAttribute('data-job-id');
  const jobTitle          = btn.getAttribute('data-job-title');
  const jobLocation       = btn.getAttribute('data-job-location');
  const candidateRole     = btn.getAttribute('data-candidate-role');
  const candidateExperience = btn.getAttribute('data-candidate-experience');
  const candidateEmail    = btn.getAttribute('data-candidate-email');
  showConfirmationModal(
    'This action will select the candidate as leads for the candidate pipeline processing.',
    () => selectCandidate(candidateId, candidateName, jobId, jobTitle, jobLocation, candidateRole, candidateExperience, candidateEmail)
  );
}

async function selectCandidate(candidateId, candidateName, jobId, jobTitle, jobLocation, candidateRole='NA', candidateExperience='NA', candidateEmail='NA') {
  openModal("<div class='spinner-border processSpin' role='status'></div> Processing... Please wait.");
  const loggedInUserEmail = window.logged_in_user?.softr_user_email || 'rbanothe@tiuconsulting.com';
  try {
    const appUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('candidate_applications')}`;
    const res = await fetch(appUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields: {
        "job_id": jobId, "candidate_id": candidateId, "status_id": 4, "status": "Leads",
        "application_type": "In house", "candidate_name": candidateName, "job_title": jobTitle,
        "candidate_email": candidateEmail, "candidate_role": candidateRole, "candidate_exp": candidateExperience,
        "comment": "The candidate has been added by recruiter.", "comment_by": loggedInUserEmail,
      }}] }),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const uniqueKey = `${candidateId}-${jobId}`;
    if (!JobCandidateUniqueData.includes(uniqueKey)) JobCandidateUniqueData.push(uniqueKey);
    openModal('✅ Candidate selected Successfully!');
    const btn = document.getElementById(`select-btn-${candidateId}`);
    if (btn) { btn.textContent = '✔ Selected'; btn.classList.add('selected-button'); btn.disabled = true; }
  } catch(e) {
    console.error('Select failed:', e);
    openModal('❌ Update failed.');
  }
}

// ─── Profile Modal ─────────────────────────────────────────────────────────────
function viewCandidateProfile(candidateId) {
  const c = allCandidateData[candidateId];
  if (!c) return;
  showProfileModal(c);
}

function showProfileModal(c) {
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent = val||'-'; };
  set('profileCandidateName', c.name);
  const badgeEl = document.getElementById('profileStatusBadge');
  if (badgeEl) {
    const status = 'ACTIVE';
    badgeEl.textContent = status.toUpperCase();
  }
  set('profileCurrentRole', c.currentRole);
  set('profileCurrentCompany', c.currentCompany);
  set('profileTotalExperience', c.experience);
  set('profileLocation', c.location);
  set('profileEmail', c.email);
  set('profilePhone', c.phone);
  set('profileKeyStrengths', c.keyStrengths);
  set('profileMatchedDetails', c.matchedDetails);
  set('profileMissingDetails', c.missingDetails);
  set('profileAllScoresJustification', c.all_scores_justification);
  set('profileSkillsJustification', c.skills_justification);
  set('profileOverallScoreJustification', c.overall_score_justification);
  set('profileExperienceJustification', c.experience_justification);
  const skillsEl = document.getElementById('profileSkills');
  if (skillsEl) skillsEl.innerHTML = (c.candidateSkills||[]).length
    ? (c.candidateSkills||[]).map(s=>`<span style="display:inline-block;background:linear-gradient(135deg,#f5f5f5,#eeeeee);color:#616161;padding:3px 8px;border-radius:5px;font-size:12px;font-weight:600;border:1px solid #c4c3c3;margin:2px 3px;">${s}</span>`).join('')
    : '<span style="color:#9ca3af;font-style:italic;">No skills listed</span>';
  const modal = document.getElementById('profileModal');
  if (modal) { modal.style.display = 'block'; document.body.style.overflow = 'hidden'; }
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ─── Send Email Modal ──────────────────────────────────────────────────────────
function openSendEmailModal(jobTitle, candidateEmail, candidateStatus) {
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val||''; };
  const setText = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val||''; };
  setText('emailJobTitle', jobTitle);
  set('emailTo', candidateEmail);
  set('emailStatus', candidateStatus);
  set('emailSubject', `Opportunity: ${jobTitle}`);
  set('emailMessage', `Dear Candidate,\n\nWe are pleased to inform you that you have been "${candidateStatus}" for the position of "${jobTitle}". Please confirm your acceptance and share your availability for the next steps at your earliest convenience.\n\nLooking forward to your response.\n\nRegards\nSureCafe`);
  set('emailCc', ''); set('emailBcc', '');
  new window.bootstrap.Modal(document.getElementById('sendEmailModal')).show();
}

async function sendEmail() {
  const get = (id) => { const el=document.getElementById(id); return el ? el.value : ''; };
  const rawMsg = get('emailMessage');
  const body = rawMsg.replace(/\n/g, '<br>');
  const payload = {
    to: get('emailTo'), cc: get('emailCc'), bcc: get('emailBcc'), subject: get('emailSubject'), body,
  };
  openModal("<div class='spinner-border processSpin' role='status'></div> Sending email... Please wait.");
  try {
    const res = await fetch(N8N_EMAIL_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    openModal('✅ Email sent successfully!');
    window.bootstrap.Modal.getInstance(document.getElementById('sendEmailModal'))?.hide();
  } catch(e) { console.error('Email failed:', e); openModal('❌ Failed to send email.'); }
}

// ─── Job Details Modal ────────────────────────────────────────────────────────
function showJobDetails(jobId) {
  const jobInfo = jobsData.find(j => j.id === jobId);
  if (!jobInfo) return;
  const job = jobInfo.allData || {};
  const renderList = (arr) => arr && arr.length
    ? arr.map(i=>`<span style="display:inline-block;padding:3px 8px;margin:2px 3px 2px 0;font-size:12px;font-weight:500;background-color:#e8f0f9;color:#254868;border:1px solid #a8c3e1;border-radius:5px;">${i}</span>`).join('')
    : '<span style="color:#9ca3af;font-style:italic;">Not specified</span>';
  const container = document.getElementById('jobDetailsContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="job-section">
      <p style="font-size:16px;font-weight:700;color:#3a69a7;">Job Title - <span style="color:#FF6F21;font-weight:700;">${job.Job_Title||'Untitled Job'}</span></p>
      <div class="row job-info-grid g-1">
        <div class="col-md-4 mb-1"><span class="head-name">Status:</span> ${job.Status||'-'}</div>
        <div class="col-md-4 mb-1"><span class="head-name">Department:</span> ${job.Department||'-'}</div>
        <div class="col-md-4 mb-1"><span class="head-name">Priority:</span> ${job.Priority||'-'}</div>
        <div class="col-md-4 mb-1"><span class="head-name">Location:</span> ${job.Location||'-'}</div>
        <div class="col-md-4 mb-1"><span class="head-name">Employment Type:</span> ${job.Employment_Type||'-'}</div>
        <div class="col-md-4 mb-1"><span class="head-name">Experience Level:</span> ${job.Experience_Level||'-'}</div>
        <div class="col-md-4 mb-1"><span class="head-name">Experience Years:</span> ${job.Experience_Years||'-'}</div>
        <div class="col-md-4 mb-1"><span class="head-name">Salary Range:</span> ${job.Salary_Range||'-'}</div>
        <div class="col-md-4 mb-1"><span class="head-name">Posted On:</span> ${formatDate(job.Date)||'-'}</div>
      </div>
      <hr class="my-3"/>
      <div class="row">
        <div class="col-md-6 mb-3">
          <h6 class="text-heading head-name">Job Description</h6>
          <div class="job-description-box">${job['Job_Description']||job['Job Description']||'No description available.'}</div>
        </div>
        <div class="col-md-6 mb-3">
          <h6 class="text-heading head-name">Key Responsibilities</h6>
          <div class="responsibilities-box">${(job.Key_Responsibilities||[]).map(r=>`<li>${r}</li>`).join('')||'<li class="text-muted">Not specified</li>'}</div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3"><h6 class="text-heading head-name">Required Skills</h6><div>${renderList(job.Required_Skills)}</div></div>
        <div class="col-md-6 mb-3"><h6 class="text-heading head-name">Domain Expertise</h6><div>${renderList(job.Domain_Expertise)}</div></div>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3"><h6 class="text-heading head-name">Programming Languages</h6><div>${renderList(job.Programming_Languages)}</div></div>
        <div class="col-md-6 mb-3"><h6 class="text-heading head-name">Frameworks / Libraries</h6><div>${renderList(job.Frameworks_Libraries)}</div></div>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3"><h6 class="text-heading head-name">Tools / Platforms</h6><div>${renderList(job.Tools_Platforms)}</div></div>
        <div class="col-md-6 mb-3"><h6 class="text-heading head-name">Methodologies</h6><div>${renderList(job.Methodologies)}</div></div>
      </div>
    </div>`;
  new window.bootstrap.Modal(document.getElementById('jobDetailsModal')).show();
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────
function showConfirmationModal(message, onConfirm) {
  const confirmModal = document.getElementById('confirmModal');
  const msgEl = document.getElementById('confirmMessage');
  if (msgEl) msgEl.innerHTML = `<p>${message}</p><p style="color:#666;">Do you want to proceed?</p>`;
  const yesBtn = document.getElementById('confirmYesBtn');
  if (yesBtn) yesBtn.onclick = () => {
    const m = window.bootstrap.Modal.getInstance(confirmModal) || new window.bootstrap.Modal(confirmModal);
    m.hide(); onConfirm();
  };
  new window.bootstrap.Modal(confirmModal).show();
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportFilteredCandidates() {
  if (!filteredCandidatesData.length) { openModal('No candidates to export. Please adjust your filters.'); return; }
  const csv = [
    ['Candidate ID','Candidate Name','Current Role','Current Company','Total Experience','Location','Email','Phone','Overall Score','Skills Match %','Experience Match %','Domain Industry Match %','Verdict','Key Strengths','Key Risks & Gaps','Matched Details','Missing Details','Candidate Skills'].join(','),
    ...filteredCandidatesData.map(c => [
      c.id||'', `"${c.name||''}"`, `"${c.currentRole||''}"`, `"${c.currentCompany||''}"`,
      c.experience||'', `"${c.location||''}"`, c.email||'', c.phone||'',
      c.overallScore ? parseFloat(c.overallScore).toFixed(1) : '',
      c.skillsMatchScore ? parseFloat(c.skillsMatchScore).toFixed(1) : '',
      c.experienceMatchScore ? parseFloat(c.experienceMatchScore).toFixed(1) : '',
      c.domainIndustryScore ? parseFloat(c.domainIndustryScore).toFixed(1) : '',
      c.surevafeVerdict||'', `"${c.keyStrengths||''}"`, `"${c.keyRisksGaps||''}"`,
      `"${c.matchedDetails||''}"`, `"${c.missingDetails||''}"`, `"${(c.candidateSkills||[]).join('; ')}"`
    ].join(','))
  ].join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`filtered-candidates-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Trigger Candidate Matching ───────────────────────────────────────────────
async function triggerCandidateMatching(jobId) {
  try {
    await fetch(N8N_MATCH_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ job_id: jobId }) });
  } catch(e) { console.error('Error triggering candidate matching:', e); }
}

// ─── Google Drive Upload ──────────────────────────────────────────────────────
function loadGoogleScripts() {
  const gisScript = document.createElement('script');
  gisScript.src = 'https://accounts.google.com/gsi/client';
  gisScript.onload = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { console.error('Auth failed:', resp); return; }
        window.gapi.client.setToken(resp);
        updateUploadBtn();
        const fileInput = document.getElementById('fileInputJDM');
        if (fileInput?.hasAttribute('data-pending-upload')) {
          fileInput.removeAttribute('data-pending-upload');
          await handleFileUpload();
        }
      },
    });
    gisInited = true; updateUploadBtn();
  };
  document.head.appendChild(gisScript);
  const gapiScript = document.createElement('script');
  gapiScript.src = 'https://apis.google.com/js/api.js';
  gapiScript.onload = () => {
    window.gapi.load('client', async () => {
      await window.gapi.client.init({ discoveryDocs:[DISCOVERY_DOC] });
      gapiInited = true; updateUploadBtn();
    });
  };
  document.head.appendChild(gapiScript);
}

function updateUploadBtn() {
  if (gapiInited && gisInited) { uploadBtnDisabled.value=false; statusMsg.value='✅ Ready to upload files!'; }
}

function onFilesSelected(e) {
  const files = Array.from(e.target.files||[]);
  const valid = files.filter(f => ['.txt','.pdf'].some(ext=>f.name.toLowerCase().endsWith(ext)));
  if (valid.length !== files.length) { openModal('❌ Only .txt or .pdf files are allowed.'); e.target.value=''; }
}

async function handleFileUpload() {
  const fileInput = document.getElementById('fileInputJDM');
  const files = fileInput ? fileInput.files : [];
  if (!selectedClientId.value) { openModal('❌ Please select a client before uploading JDs.'); return; }
  if (!files || files.length === 0) { openModal('❌ Please select files to upload.'); return; }
  const token = window.gapi?.client?.getToken();
  if (!token || token.expires_at < Date.now()/1000) {
    statusMsg.value = '🔐 Please authorize Google Drive access...';
    fileInput?.setAttribute('data-pending-upload', 'true');
    tokenClient.requestAccessToken({ prompt:'' });
    return;
  }
  openModal("<div class='spinner-border processSpin' role='status'></div> Processing... Please wait.");
  statusMsg.value = '🚀 Starting upload...';
  let successCount=0, failCount=0;
  for (let i=0; i<files.length; i++) {
    const file = files[i];
    progressMsg.value = `📤 Uploading ${i+1} of ${files.length}: ${file.name}`;
    try {
      await uploadFileToDrive(file);
      successCount++;
      statusMsg.value = `✅ Uploaded: ${file.name}`;
    } catch(e) { failCount++; statusMsg.value=`❌ Failed: ${file.name}. ${e.message}`; }
  }
  if (fileInput) fileInput.value = '';
  if (successCount > 0) {
    await triggerN8nWorkflow();
  } else {
    progressMsg.value = '';
    openModal(`⚠️ Upload: ${successCount} succeeded, ${failCount} failed.`);
  }
}

function uploadFileToDrive(file) {
  return new Promise((resolve, reject) => {
    const accessToken = window.gapi.client.getToken().access_token;
    const metadata = { name: file.name, parents: [JD_FOLDER_ID] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type:'application/json'}));
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true');
    xhr.setRequestHeader('Authorization','Bearer '+accessToken);
    xhr.onload = () => {
      if (xhr.status===200) resolve(JSON.parse(xhr.responseText));
      else { let m=`HTTP ${xhr.status}`; try{m=JSON.parse(xhr.responseText).error?.message||m;}catch(_){} reject(new Error(m)); }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.upload.onprogress = e => { if(e.lengthComputable) progressMsg.value=`📤 Uploading: ${file.name} - ${Math.round(e.loaded/e.total*100)}%`; };
    xhr.send(form);
  });
}

async function triggerN8nWorkflow() {
  openModal("<div class='spinner-border processSpin' role='status'></div> Processing... Please wait.");
  const oldJobsIds = [...existingJobsIds];
  try {
    const payload = { message: 'Hello from webpage!', client_id: selectedClientId.value || null };
    await fetch(N8N_JD_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    await loadJobs();
    statusMsg.value = '🎉 Successfully uploaded and processed!';
    progressMsg.value = '✅ Upload complete!';
    const newlyAdded = existingJobsIds.filter(id => !oldJobsIds.includes(id));
    if (newlyAdded.length > 0) fetchCandidates(newlyAdded[0]);
    openModal('✅ Successfully processed!');
  } catch(e) {
    console.error('n8n workflow error:', e);
    openModal('The process may take time in the background. Click <strong>Reload Data</strong> and check back later if the uploaded JD(s) are not visible.');
  }
}

function openDriveFolder() { window.open(JD_FOLDER_URL, '_blank'); }
function redirectToClients() { router.push('/clients'); }

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Expose window functions for innerHTML onclick handlers
  window._jdm_toggleCandidates       = toggleCandidates;
  window._jdm_toggleShowAllMatched   = toggleShowAllMatched;
  window._jdm_toggleDetailSection    = toggleDetailSection;
  window._jdm_viewCandidateProfile   = viewCandidateProfile;
  window._jdm_selectCandidateClicked = selectCandidateClicked;
  window._jdm_openSendEmailModal     = openSendEmailModal;
  window._jdm_showJobDetails         = showJobDetails;

  // Profile modal outside-click close
  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('profileModal')) closeProfileModal();
  });

  // Send Email form submit
  const emailForm = document.getElementById('sendEmailForm');
  if (emailForm) emailForm.addEventListener('submit', (e) => { e.preventDefault(); sendEmail(); });

  await Promise.all([loadJobs(), loadClients()]);
  loadGoogleScripts();

  // Check localStorage for pre-selected job (from JobDescriptions page)
  const savedJdId = localStorage.getItem('selectedJdId');
  if (savedJdId) {
    localStorage.removeItem('selectedJdId');
    const jdId = JSON.parse(savedJdId);
    const targetId = Array.isArray(jdId) ? jdId[0] : jdId;
    const job = jobsData.find(j => j.airtableId === targetId || j.id === targetId);
    if (job) fetchCandidates(job.id);
  }
});
</script>

<template>
  <div>
    <!-- Header -->
    <div style="margin-bottom:16px;">
      <h1 class="section-title">JD Management &amp; Job-Based Candidate Matching</h1>
    </div>

    <!-- ─── Upload + Drive Folder Row ─── -->
    <div style="display:grid;grid-template-columns:9fr 3fr;gap:20px;margin-bottom:24px;">
      <!-- Upload Card -->
      <div class="section-card" style="overflow:hidden;">
        <div class="card-header">
          <h3 class="card-title">
            <i class="bi bi-upload" style="color:orange;"></i>
            Upload JD(s)
          </h3>
          <div style="display:flex;align-items:center;gap:10px;margin-left:auto;">
            <label style="margin:0;font-weight:500;color:#333;font-size:14px;">Select Client:</label>
            <select v-model="selectedClientId" class="form-select" style="width:280px;padding:3px 8px;font-size:14px;">
              <option value="">-- Select Client --</option>
              <option v-for="c in allClients" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <span @click="redirectToClients" style="font-size:14px;color:#555;cursor:pointer;white-space:nowrap;margin-left:5px;">+ Add Client</span>
          </div>
        </div>
        <div class="upload-section">
          <div class="upload-desc">
            <span class="upload-desc-span">Upload Job Descriptions and manage your jobs collection</span>
            <span class="upload-desc-span" style="color:#d50e0e;">( Please upload .txt or .pdf files only. )</span>
          </div>
          <div class="upload-row d-flex align-items-center gap-2 justify-content-center">
            <input type="file" id="fileInputJDM" class="form-control" multiple accept=".txt,.pdf" @change="onFilesSelected" style="padding:4px;" />
            <button @click="handleFileUpload" :disabled="uploadBtnDisabled" class="btn btn-primary"
              style="white-space:nowrap; background:#4285f4;">
              Upload &amp; Process JDs
            </button>
          </div>
          <div class="upload-status-box mt-2">{{ statusMsg }}</div>
          <div class="upload-progress-box mt-1">{{ progressMsg }}</div>
        </div>
      </div>

      <!-- Drive Folder Card -->
      <div class="section-card" style="overflow:hidden;">
        <div class="card-header">
          <h3 class="card-title"><span class="full-width-cls">Job Descriptions Location</span></h3>
        </div>
        <div class="button-grid">
          <div class="folder-card" @click="openDriveFolder">
            <div class="folder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CD7A5C" stroke-width="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
            </div>
            <div class="folder-content">
              <h4 class="folder-title">Job Descriptions</h4>
              <p class="folder-subtitle">See Job Descriptions</p>
            </div>
            <div class="folder-arrow"><i class="bi bi-chevron-right"></i></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Job List Section ─── -->
    <div class="section-card" style="overflow:hidden;margin-bottom:24px;">
      <div class="card-header">
        <h3 class="card-title" id="totalJobs">
          <i class="bi bi-funnel" style="color:orange;"></i>
          Job List <span style="font-weight:400;color:#6B7280;">(Total Jobs: {{ filteredJobs.length }})</span>
        </h3>
      </div>
      <div class="filter-section">
        <!-- Search + Buttons -->
        <div class="search-container">
          <div class="search-section">
            <i class="bi bi-search" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:orange;"></i>
            <input v-model="jobSearch" @input="filterJobs" type="text" id="jobSearchInput" class="form-control"
              placeholder="Search jobs by title, location..." style="padding-left:30px;padding: 4px 30px !important;" />
          </div>
          <button id="resetFiltersBtn" @click="() => { jobSearch=''; filterJobs(); }" class="btn btn-primary"
            style="background:#4285f4;font-size:13px;padding:5px 10px;flex-shrink:0;white-space:nowrap;">
            <i class="bi bi-arrow-clockwise"></i> Reset Filters
          </button>
          <button id="refreshBtn" @click="loadJobs" class="btn btn-primary"
            style="background:#4285f4;font-size:13px;padding:5px 10px;flex-shrink:0;white-space:nowrap;">
            <i class="bi bi-arrow-repeat"></i> Reload Data
          </button>
        </div>

        <!-- Loading -->
        <div v-if="jobsLoading" class="loading-container">
          <div class="loading-spinner"></div>
          <span>Loading jobs...</span>
        </div>

        <!-- Jobs List -->
        <div v-else class="jobs-container" id="jobsContainer">
          <div v-if="!pagedJobs.length" style="padding:20px;text-align:center;color:#6B7280;">
            No jobs found matching your criteria
          </div>
          <div v-for="job in pagedJobs" :key="job.airtableId" class="job-item">
            <div class="job-details">
              <div class="job-header">
                <div class="job-title" @click="showJobDetails(job.id)" title="Show Job Details">{{ job.title }}</div>
                <div class="job-actions">
                  <button class="fetch-btn" @click="fetchCandidates(job.id)">Show Matched Candidates</button>
                </div>
              </div>
              <div class="job-meta">
                <span>{{ job.location }}</span>
                <span>{{ job.employmentType }}</span>
                <span>{{ job.experienceLevel }}</span>
                <span v-if="job.experienceYears && job.experienceYears !== '-'">{{ job.experienceYears }} experience</span>
                <span v-if="job.date && job.date !== '-'">Posted on: {{ formatDate(job.date) }}</span>
              </div>
            </div>
          </div>

          <!-- Job Pagination -->
          <div class="pagination-controls" id="jobPaginationControls" v-if="jobPageCount > 1">
            <button :disabled="jobCurrentPage===1" @click="jobCurrentPage=1">First</button>
            <button :disabled="jobCurrentPage===1" @click="jobCurrentPage--">Prev</button>
            <button v-for="p in jobPageCount" :key="p" :class="{active:jobCurrentPage===p}" @click="jobCurrentPage=p">{{ p }}</button>
            <button :disabled="jobCurrentPage===jobPageCount" @click="jobCurrentPage++">Next</button>
            <button :disabled="jobCurrentPage===jobPageCount" @click="jobCurrentPage=jobPageCount">Last</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Progress Bar ─── -->
    <div class="progress-container" v-if="matchProgress.visible">
      <div class="progress-header">
        <span class="progress-label">Fetching Candidates</span>
        <span class="progress-text">{{ matchProgress.pct }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="`width:${matchProgress.pct}%;`"></div>
      </div>
    </div>

    <!-- ─── Candidate Matching Section ─── -->
    <div class="section-card" id="candidateMatchingContainer" style="overflow:hidden;">
      <div class="card-header" style="padding:10px;">
        <h3 class="card-title">
          <i class="bi bi-people" style="color:orange;"></i>
          Candidate Matching Actions
        </h3>
        <div style="margin-left:auto;display:flex;gap:10px;">
          <button v-if="hasCandidateResults" @click="exportFilteredCandidates"
            style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:transparent;color:#666;border:1px solid #ddd;border-radius:8px;font-size:13px;cursor:pointer;">
            <i class="bi bi-download"></i> Export CSV
          </button>
        </div>
      </div>

      <div id="matchingCandidatesContent" style="display:none;">
        <!-- Results Summary -->
        <div class="results-summary" id="candidateResultsSummary" style="display:none;margin:4px 33px;"></div>

        <!-- Candidate Filters -->
        <div class="candidate-filters-section" id="candidateFiltersSection" style="display:none;">
          <div class="candidate-filters-header">
            <h4 class="filters-title">
              <i class="bi bi-funnel" style="color:orange;"></i>
              <span>Filter Candidates</span>
              <div class="results-stats" style="margin-left:10px;">
                <span class="active-filters-count" id="activeFiltersCount">No filters applied</span>
              </div>
            </h4>
            <div class="filter-controls">
              <button @click="resetAllFilters" class="btn-reset-filters"><i class="bi bi-arrow-left-right"></i> Reset All</button>
            </div>
          </div>

          <!-- Quick Filters -->
          <div class="quick-filters-section">
            <span class="quick-filters-label">Quick Filters:</span>
            <div class="quick-filters-grid">
              <button class="quick-filter-btn" @click="applyQuickFilter('score80plus', $event)">🏆 Overall Score 80+</button>
              <button class="quick-filter-btn" @click="applyQuickFilter('score60to80', $event)">⭐ Overall Score 60-80</button>
              <button class="quick-filter-btn" @click="applyQuickFilter('score40to60', $event)">👍 Overall Score 40-60</button>
              <button class="quick-filter-btn" @click="applyQuickFilter('score30to40', $event)">📊 Overall Score 30-40</button>
              <button class="quick-filter-btn" @click="applyQuickFilter('scoreLess30', $event)">⚠️ Overall Score &lt;30</button>
            </div>
          </div>

          <!-- Score Dropdowns -->
          <div class="filter-categories">
            <div class="filter-category">
              <h5 class="category-title"><i class="bi bi-funnel" style="color:orange;"></i> Performance Filters</h5>
              <div class="filter-grid">
                <div class="filter-group">
                  <label class="filter-label">Overall Score</label>
                  <select v-model="scoreFilter" @change="applyCandidateFilters" id="overallScoreFilter">
                    <option value="">All Scores</option><option value="80">80+ (Excellent)</option>
                    <option value="60">60-80 (Very Good)</option><option value="40">40-60 (Good)</option>
                    <option value="30">30-40 (Fair)</option><option value="below30">Below 30 (Poor)</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label class="filter-label">Skills Match %</label>
                  <select v-model="skillsFilter" @change="applyCandidateFilters" id="skillsMatchFilter">
                    <option value="">All Skill Matches</option><option value="80">80%+ (Excellent)</option>
                    <option value="60">60-80% (Very Good)</option><option value="40">40-60% (Good)</option>
                    <option value="30">30-40% (Fair)</option><option value="below30">Below 30% (Poor)</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label class="filter-label">Experience Match %</label>
                  <select v-model="experienceFilter" @change="applyCandidateFilters" id="experienceMatchPercentFilter">
                    <option value="">All Experience Matches</option><option value="80">80%+ (Excellent)</option>
                    <option value="60">60-80% (Very Good)</option><option value="40">40-60% (Good)</option>
                    <option value="30">30-40% (Fair)</option><option value="below30">Below 30% (Poor)</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label class="filter-label">Domain Match %</label>
                  <select v-model="domainFilter" @change="applyCandidateFilters" id="domainMatchFilter">
                    <option value="">All Domain Matches</option><option value="80">80%+ (Excellent)</option>
                    <option value="60">60-80% (Very Good)</option><option value="40">40-60% (Good)</option>
                    <option value="30">30-40% (Fair)</option><option value="below30">Below 30% (Poor)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Candidates Results Container (innerHTML-driven) -->
        <div class="candidates-results-container" id="candidatesResultsContainer"></div>
      </div>
    </div>

    <!-- ─── Profile Modal (Custom) ─── -->
    <div id="profileModal" class="profile-modal">
      <div class="profile-modal-content">
        <div class="profile-modal-header">
          <div class="profile-candidate-info">
            <div class="profile-candidate-name" id="profileCandidateName">Candidate Name</div>
            <span class="profile-status-badge" id="profileStatusBadge">ACTIVE</span>
          </div>
          <span class="profile-modal-close" @click="closeProfileModal">&times;</span>
        </div>
        <div class="profile-modal-body" style="max-height:70vh;overflow-y:auto;">
          <div class="candidate-profile-info row">
            <div class="col-md-6 profile-info-label">Email : <span class="profile-info-value" id="profileEmail">-</span></div>
            <div class="col-md-6 profile-info-label">Current Role : <span class="profile-info-value" id="profileCurrentRole">-</span></div>
            <div class="col-md-6 profile-info-label">Phone : <span class="profile-info-value" id="profilePhone">-</span></div>
            <div class="col-md-6 profile-info-label">Total Experience : <span class="profile-info-value" id="profileTotalExperience">-</span></div>
            <div class="col-md-6 profile-info-label">Location : <span class="profile-info-value" id="profileLocation">-</span></div>
            <div class="col-md-6 profile-info-label">Current Company : <span class="profile-info-value" id="profileCurrentCompany">-</span></div>
          </div>
          <div style="margin-top:15px;">
            <h6 style="margin:0 0 10px 0;font-weight:600;color:#013238;">Key Strengths</h6>
            <div style="padding:10px;background:#d9f8fc;border-radius:6px;border-left:3px solid #11bfd4;color:#013238;font-size:13px;line-height:1.6;" id="profileKeyStrengths">-</div>
          </div>
          <div style="margin-top:15px;">
            <h6 style="margin:0 0 10px 0;font-weight:600;color:#166534;">Matched Details</h6>
            <div style="padding:10px;background:#dcfce7;border-radius:6px;border-left:3px solid #22c55e;color:#166534;font-size:13px;line-height:1.6;max-height:160px;overflow-y:auto;" id="profileMatchedDetails">-</div>
          </div>
          <div style="margin-top:15px;">
            <h6 style="margin:0 0 10px 0;font-weight:600;color:#991b1b;">Missing Details</h6>
            <div style="padding:10px;background:#fee2e2;border-radius:6px;border-left:3px solid #ef4444;color:#991b1b;font-size:13px;line-height:1.6;max-height:150px;overflow-y:auto;" id="profileMissingDetails">-</div>
          </div>
          <div style="margin-top:15px;">
            <h6 style="margin:0 0 10px 0;font-weight:600;color:#7c3aed;">All Scores Justification</h6>
            <div style="padding:10px;background:#f3e8ff;border-radius:6px;border-left:3px solid #7c3aed;color:#5b21b6;font-size:13px;line-height:1.6;max-height:120px;overflow-y:auto;" id="profileAllScoresJustification">-</div>
          </div>
          <div style="margin-top:15px;">
            <h6 style="margin:0 0 10px 0;font-weight:600;color:#0369a1;">Skills Match Justification</h6>
            <div style="padding:10px;background:#e0f2fe;border-radius:6px;border-left:3px solid #0284c7;color:#003d66;font-size:13px;line-height:1.6;max-height:120px;overflow-y:auto;" id="profileSkillsJustification">-</div>
          </div>
          <div style="margin-top:15px;">
            <h6 style="margin:0 0 10px 0;font-weight:600;color:#059669;">Overall Score Justification</h6>
            <div style="padding:10px;background:#d1fae5;border-radius:6px;border-left:3px solid #10b981;color:#065f46;font-size:13px;line-height:1.6;max-height:120px;overflow-y:auto;" id="profileOverallScoreJustification">-</div>
          </div>
          <div style="margin-top:15px;">
            <h6 style="margin:0 0 10px 0;font-weight:600;color:#d97706;">Experience Match Justification</h6>
            <div style="padding:10px;background:#fef3c7;border-radius:6px;border-left:3px solid #f59e0b;color:#78350f;font-size:13px;line-height:1.6;max-height:120px;overflow-y:auto;" id="profileExperienceJustification">-</div>
          </div>
          <div class="profile-skills-section">
            <div class="profile-skills-title"><i class="bi bi-star-fill" style="color:orange;"></i> Candidate Skills</div>
            <div class="profile-skills-grid" id="profileSkills"></div>
          </div>
        </div>
        <div class="profile-modal-footer">
          <button class="profile-action-btn secondary" @click="closeProfileModal">Close</button>
        </div>
      </div>
    </div>

    <!-- ─── Result Modal (Custom) ─── -->
    <div id="resultModal" class="web-process-modal" :style="resultModalVisible ? 'display:flex;' : 'display:none;'" style="z-index:1100!important;">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="closeModal">&times;</span>
        <h3>Status</h3>
        <div id="resultMessage" v-html="resultModalMessage"></div>
      </div>
    </div>

    <!-- ─── Send Email Modal (Bootstrap) ─── -->
    <div class="modal fade" id="sendEmailModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header">
            <h5 class="modal-title">Send Email to Candidate</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="sendEmailForm">
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-12">
                  <p style="font-size:17px;font-weight:600;">Job Title - <span id="emailJobTitle"></span></p>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Status</label>
                  <select id="emailStatus" class="form-select" disabled>
                    <option value="Active">Active</option><option value="Rejected">Rejected</option>
                    <option value="Selected">Selected</option><option value="Leads">Leads</option>
                    <option value="Shortlisted">Shortlisted</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">To</label>
                  <input type="email" id="emailTo" class="form-control" multiple required placeholder="Enter email(s), separated by commas" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Cc</label>
                  <input type="email" id="emailCc" class="form-control" multiple />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Bcc</label>
                  <input type="email" id="emailBcc" class="form-control" multiple />
                </div>
                <div class="col-md-12">
                  <label class="form-label">Subject</label>
                  <input type="text" id="emailSubject" class="form-control" required />
                </div>
                <div class="col-md-12">
                  <label class="form-label">Message</label>
                  <textarea id="emailMessage" rows="6" class="form-control" required></textarea>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-success">Send Email</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- ─── Job Details Modal (Bootstrap xl) ─── -->
    <div class="modal fade" id="jobDetailsModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content rounded-3 shadow-lg border-0">
          <div class="modal-header">
            <h5 class="modal-title">Job Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="jobDetailsContainer" class="job-details-container"></div>
          </div>
          <div class="modal-footer border-top-0">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Confirmation Modal (Bootstrap) ─── -->
    <div class="modal fade" id="confirmModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header">
            <h5 class="modal-title">Confirm !</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="padding:15px;">
            <p id="confirmMessage" style="font-size:15px;line-height:1.6;margin:0;"></p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" style="color:#222121;">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirmYesBtn" style="background:#1976d2;">Yes, Proceed</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Upload Section ─── */
.upload-section { padding: 24px; text-align: center; }
.upload-desc { display: flex; align-items: center; gap: 5px; text-align: left; }
.upload-desc-span { font-size: 14px !important; font-weight: 400 !important; }
.upload-row { margin-top: 10px; }
.upload-status-box { margin: 8px 0; padding: 6px 10px; border-radius: 8px; background-color: #f2f8fc; color: #1976d2; border: 1px solid #bbdefb; text-align: center; font-size: 13px; }
.upload-progress-box { padding: 5px 10px; border-radius: 8px; font-weight: bold; background-color: #f3fff3; color: #388e3c; border: 1px solid #c8e6c9; text-align: center; font-size: 13px; min-height: 10px; }

/* ─── Card / Section ─── */
.card-header { padding: 10px; border-bottom: 2px solid #f5f5f5; background: linear-gradient(135deg, #fafafa, #fff); display: flex; justify-content: space-between; align-items: center; }
.card-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1976d2; margin: 0; }
.full-width-cls { width: 100% !important; }

/* ─── Folder Card ─── */
.button-grid { padding: 5px; display: grid; gap: 16px; }
.folder-card { display: flex; align-items: center; gap: 5px; padding: 10px; border: 1px solid #dadada !important; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; background: #FAFBFC; }
.folder-card:hover { border-color: #CD7A5C !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(205,122,92,0.15); }
.folder-icon { flex-shrink: 0; }
.folder-content { flex: 1; }
.folder-title { font-size: 14px; font-weight: 600; color: #1F2937; margin: 0; line-height: 14px; }
.folder-subtitle { font-size: 12px; color: #6B7280; margin: 0; }
.folder-arrow { flex-shrink: 0; color: #9CA3AF; }

/* ─── Job List ─── */
.filter-section { padding: 10px; }
.search-container { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
.search-section { position: relative; display: flex; align-items: center; flex: 1; }
#jobSearchInput { width: 100%; padding: 4px 30px 4px 35px; border-radius: 10px; font-size: 1rem; }
.loading-container { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 60px; color: #1976d2; font-weight: 500; }
.loading-spinner { width: 35px; height: 35px; border: 3px solid #e0e0e0; border-top: 3px solid #FF6F21; border-radius: 50%; animation: spin 1s linear infinite; }
.jobs-container { border: 2px solid #e0e0e0; border-radius: 10px; overflow: hidden; background: white; padding: 10px 0; }
.job-item { display: flex; align-items: center; gap: 16px; padding: 2px 24px 7px 24px; border-bottom: 1px solid #e5e5e5; transition: all 0.3s ease; }
.job-item:hover { background: linear-gradient(135deg, #fafafa, rgba(25,118,210,0.03)); }
.job-details { flex: 1; line-height: 1; }
.job-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.job-title { font-weight: 700; font-size: 15px; color: #1976d2; flex: 1; min-width: 150px; cursor: pointer; }
.job-title:hover { text-decoration: underline; color: #1259a7; }
.job-actions { display: flex; align-items: center; gap: 8px; }
.job-meta { font-size: 13px; color: #757575; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin-top: 4px; }
.fetch-btn { display: flex; align-items: center; background-color: #58a0e7; color: #fff; font-weight: 400; font-size: 12px; border: none; border-radius: 10px; padding: 7px 10px; cursor: pointer; transition: background 0.3s ease; }
.fetch-btn:hover { background-color: #1259a7; }

/* ─── Progress Bar ─── */
.progress-container { background: white; border-radius: 16px; padding: 7px 30px; box-shadow: 0 10px 15px rgba(0,0,0,0.1); border: 2px solid #e0e0e0; margin-bottom: 5px; }
.progress-header { display: flex; justify-content: space-between; align-items: center; }
.progress-label { font-size: 16px; font-weight: 700; color: #1976d2; }
.progress-text { font-size: 16px; font-weight: 700; color: #FF6F21; }
.progress-bar { height: 12px; background: #e0e0e0; border-radius: 8px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(135deg, #FF6F21, #f57c00); width: 0%; transition: width 0.4s ease; border-radius: 8px; }

/* ─── Candidate Filter Section ─── */
.candidate-filters-section { background: linear-gradient(135deg, #fafafa, #fff); border: 1px solid #bbdefb; border-radius: 16px; margin: 24px 32px; overflow: hidden; }
.candidate-filters-header { background: #f2f8fc; color: #1976d2; padding: 7px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #bbdefb; }
.filters-title { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; margin: 0; }
.results-stats { font-size: 12px; opacity: 0.9; color: #787878; }
.filter-controls { display: flex; gap: 12px; }
.btn-reset-filters { display: flex; align-items: center; gap: 6px; padding: 5px 10px; background: rgb(9 94 249 / 20%); color: #0d447e; border: 1px solid rgb(20 42 70 / 30%); border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-reset-filters:hover { background: #1259a7; color: white; }
.quick-filters-section { padding: 12px 24px; display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; }
.quick-filters-label { font-size: 14px; font-weight: 700; color: #616161; white-space: nowrap; }
.quick-filters-grid { display: flex; gap: 8px; flex-wrap: nowrap; }
.quick-filter-btn { padding: 2px 10px 3px 10px; background: #f5f5f5; color: #616161; border: 1px solid #e0e0e0; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
.quick-filter-btn:hover, .quick-filter-btn.active { background: linear-gradient(135deg, #ff9800, #f57c00); color: white; border-color: #ff9800; }
.filter-categories { padding: 5px 24px 12px; }
.filter-category { background: white; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; }
.category-title { background: linear-gradient(135deg, #f5f5f5, #eeeeee); color: #424242; padding: 7px 20px; margin: 0; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e0e0e0; }
.filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 20px; padding: 12px; }
.filter-group { display: flex; flex-direction: column; gap: 8px; }
.filter-label { font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; letter-spacing: 0.5px; }
.filter-group select { padding: 7px 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; }

/* ─── Results Container ─── */
.results-summary { font-size: 14px; color: #616161; background: linear-gradient(135deg, #fee3d5, #9ecdef); padding: 5px 15px; border-radius: 10px; border-left: 4px solid #1976d2; font-weight: 500; }
.candidates-results-container { padding: 0 32px 32px; }
.job-candidates-section { margin-bottom: 40px; border-radius: 6px; background: white; }
.job-candidates-header { background-color: #f2f8fc; padding: 12px 18px !important; color: #1976d2; cursor: pointer; transition: all 0.3s ease; border: 1px solid #bbdefb; font-weight: bold; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; gap: 15px; flex-wrap: wrap; }
.job-candidates-header:hover { background-color: #d2e7f5; }
.job-candidates-title { font-size: 18px; font-weight: 700; margin: 0; white-space: nowrap; cursor: pointer; }
.job-candidates-title:hover { color: #FF6F21; }
.job-candidates-meta { font-size: 14px; opacity: 0.9; font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toggle-candidates-btn { background: rgb(9 94 249 / 20%); color: #0d447e; border: 1px solid rgb(20 42 70 / 30%); padding: 5px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
.toggle-candidates-btn:hover { background: #1259a7; color: white; }
.candidates-detailed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); gap: 24px; padding: 10px 0; }
.detailed-candidate-card { background: white; border: 2px solid #e0e0e0; border-radius: 16px; padding: 24px; transition: all 0.3s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.detailed-candidate-card:hover { border-color: #ff9800; box-shadow: 0 10px 15px rgba(0,0,0,0.1); transform: translateY(-4px); }
.btn-candidate-action { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.2s ease, color 0.2s ease; background: transparent; color: #4b5563; text-decoration: none; }
.selected-button { background: #166534 !important; color: white !important; cursor: default !important; font-weight: 600 !important; border-radius: 6px !important; }
.selected-button:hover { background: #1565c0 !important; color: white !important; cursor: pointer !important; }

/* ─── Pagination ─── */
.pagination-controls { display: flex; justify-content: flex-end; gap: 6px; padding: 5px 20px; }
.pagination-controls button, :deep(.pagination-controls button) { border: none; background: #b9cde1; color: #071d38; padding: 4px 12px; border-radius: 5px; cursor: pointer; font-size: 14px; }
.pagination-controls button:hover { background: #3367d6; color: #fff; }
.pagination-controls button.active, :deep(.pagination-controls button.active) { background: #3367d6; color: white; }
.pagination-controls button:disabled { cursor: not-allowed; opacity: 0.5; }

/* ─── Profile Modal (Custom) ─── */
.profile-modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6); backdrop-filter: blur(4px); }
.profile-modal-content { background: white; margin: 3% auto; padding: 0; border-radius: 10px; width: 90%; max-width: 700px; box-shadow: 0 20px 25px rgba(0,0,0,0.15); }
.profile-modal-header { background: linear-gradient(135deg, #1976d2, #1565c0); color: white; display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #e0e0e0; border-radius: 8px 8px 0 0; position: relative; }
.profile-candidate-info { display: flex; align-items: center; gap: 16px; }
.profile-modal-close { position: absolute; right: 16px; cursor: pointer; color: white; font-size: 25px; font-weight: bold; }
.profile-candidate-name { font-size: 18px; font-weight: 600; margin: 5px; color: white; }
.profile-status-badge { background: #fd7e14; color: white; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.5px; align-self: center; white-space: nowrap; }
.profile-modal-body { padding: 20px 20px 10px 20px; }
.profile-info-label { font-size: 14px; font-weight: 600; color: #5a5858; line-height: 2; }
.profile-info-value { font-size: 14px; font-weight: 450; color: #424242; }
.profile-skills-section { margin-top: 10px; padding-top: 10px; border-top: 2px solid #f5f5f5; }
.profile-skills-title { font-size: 14px; font-weight: 700; color: #1976d2; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
.profile-skills-grid { display: flex; flex-wrap: wrap; gap: 5px; }
.profile-skill-tag { background: linear-gradient(135deg, #f5f5f5, #eeeeee); color: #616161; padding: 2px 7px 3px 7px; border-radius: 5px; font-size: 12px; font-weight: 600; border: 1px solid #c4c3c3; cursor: default; }
.profile-modal-footer { padding: 7px 10px; border-top: 2px solid #f5f5f5; display: flex; justify-content: flex-end; gap: 10px; }
.profile-action-btn { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
.profile-action-btn.secondary { background: transparent; color: #757575; border: 2px solid #e0e0e0; }
.profile-action-btn.secondary:hover { background: #f5f5f5; color: #424242; }

/* ─── Result Modal (Custom) ─── */
.web-process-modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); justify-content: center; align-items: center; }
.web-modal-content { background: #fff; padding: 20px; border-radius: 10px; width: 300px; max-width: 90%; text-align: left; box-shadow: 0 5px 20px rgba(0,0,0,0.3); position: relative; }
.web-close-btn { float: right; font-size: 22px; font-weight: bold; cursor: pointer; position: absolute; right: 7px; top: 1px; }
.web-modal-content h3 { margin-top: -5px; color: #1976d2; font-weight: 500; border-bottom: 1px solid #1976d2; padding-bottom: 5px; font-size: 20px; margin-bottom: 20px; }

/* ─── Job Details ─── */
.job-details-container { font-size: 14px; }
.job-section h6 { font-weight: 600; margin-bottom: 6px; }
.job-section .badge { font-size: 13px; padding: 3px 5px; background-color: #e8f0f9 !important; color: #254868; font-weight: 400; border: 1px solid #a8c3e1 !important; }
.job-description-box { border: 1px solid #dee2e6; border-radius: 0.375rem; background-color: #fdfdfd; padding: 1px 5px 6px 10px; min-height: 180px; max-height: 180px; overflow-y: auto; color: #555; white-space: pre-line; font-size: 0.9rem; }
.responsibilities-box { max-height: 180px; min-height: 180px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.375rem; background: #fdfdfd; padding: 10px; }
.job-info-grid .col-md-6 { margin-bottom: 0.4rem; }
.head-name { font-weight: 600; color: #3a69a7; }
.text-heading { font-size: 14px; }
.processSpin { width: 18px; height: 18px; vertical-align: text-bottom; border-width: 3px; color: #7fb4f9; }

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>

<!-- Global styles: scoped CSS does NOT apply to innerHTML-generated elements.
     These rules target the candidate sections, cards, buttons and pagination rendered via JS innerHTML. -->
<style>
/* ─── Job Candidates Section (innerHTML-generated) ─── */
.job-candidates-section { margin-bottom: 40px; border-radius: 6px; background: white; }
.job-candidates-header {
  background-color: #f2f8fc; padding: 12px 18px; color: #1976d2; cursor: pointer;
  transition: all 0.3s ease; border: 1px solid #bbdefb; font-weight: bold;
  border-radius: 16px; display: flex; align-items: center;
  justify-content: space-between; gap: 15px; flex-wrap: wrap;
}
.job-candidates-header:hover { background-color: #d2e7f5; }
.job-candidates-title { font-size: 18px; font-weight: 700; margin: 0; white-space: nowrap; cursor: pointer; }
.job-candidates-title:hover { color: #FF6F21; }
.job-candidates-meta { font-size: 14px; opacity: 0.9; font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ─── Toggle / Fetch Buttons (innerHTML) ─── */
.toggle-candidates-btn {
  background: rgb(9 94 249 / 20%); color: #0d447e;
  border: 1px solid rgb(20 42 70 / 30%); padding: 5px 10px;
  border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.toggle-candidates-btn:hover { background: #1259a7; color: white; }
.fetch-btn {
  display: flex; align-items: center; background-color: #58a0e7;
  color: #fff; font-weight: 400; font-size: 12px; border: none;
  border-radius: 10px; padding: 7px 10px; cursor: pointer;
  transition: background 0.3s ease; white-space: nowrap;
}
.fetch-btn:hover { background-color: #1259a7; }

/* ─── Candidate Grid & Cards (innerHTML) ─── */
.candidates-detailed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: 24px; padding: 10px 0;
}
.detailed-candidate-card {
  background: white; border: 2px solid #e0e0e0; border-radius: 16px;
  padding: 24px; transition: all 0.3s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}
.detailed-candidate-card:hover {
  border-color: #ff9800; box-shadow: 0 10px 15px rgba(0,0,0,0.1); transform: translateY(-4px);
}

/* ─── Candidate Action Buttons (innerHTML) ─── */
.btn-candidate-action {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 8px; border: none; border-radius: 6px;
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
  background: transparent; color: #4b5563; text-decoration: none;
}
.btn-candidate-action:hover {
  background: #1259a7;
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  color: white !important;
}
.selected-button {
  background: #166534 !important; color: white !important; cursor: default !important; font-weight: 600 !important; border-radius: 6px !important;
}

.selected-button:hover { background: #3d6e34 !important; transform: none !important; }

/* ─── Candidate Pagination (innerHTML JS-created buttons) ─── */
#candidatesResultsContainer .pagination-controls { display: flex; justify-content: flex-end; gap: 6px; padding: 5px 20px; flex-wrap: wrap; }
#candidatesResultsContainer .pagination-controls button {
  border: none; background: #b9cde1; color: #071d38;
  padding: 4px 12px; border-radius: 5px; cursor: pointer; font-size: 14px;
}
#candidatesResultsContainer .pagination-controls button:hover { background: #3367d6; color: #fff; }
#candidatesResultsContainer .pagination-controls button.active { background: #3367d6; color: white; }
#candidatesResultsContainer .pagination-controls button:disabled { cursor: not-allowed; opacity: 0.5; }

/* ─── Job Details Modal — inner labels and boxes (innerHTML-generated) ─── */
#jobDetailsContainer .head-name { font-weight: 700; color: #3a69a7; }
#jobDetailsContainer .text-heading { font-size: 14px; font-weight: 700; color: #3a69a7; margin-bottom: 6px; display: block; }
#jobDetailsContainer h6 { font-size: 14px; font-weight: 700; color: #3a69a7; margin-bottom: 8px; }
#jobDetailsContainer .job-description-box {
  border: 1px solid #dee2e6; border-radius: 6px; background: #fdfdfd;
  padding: 8px 10px; min-height: 180px; max-height: 180px;
  overflow-y: auto; white-space: pre-line; font-size: 0.9rem; color: #444;
}
#jobDetailsContainer .responsibilities-box {
  min-height: 180px; max-height: 180px; overflow-y: auto;
  border: 1px solid #dee2e6; border-radius: 6px; background: #fdfdfd; padding: 10px;
}
#jobDetailsContainer .responsibilities-box li { margin-bottom: 4px; font-size: 13px; color: #444; }

/* ─── Candidate card — Show More toggle button ─── */
.show-more-btn {
  margin-top: 6px; background: none; border: none; color: #3b82f6;
  font-weight: 600; font-size: 12px; cursor: pointer; padding: 4px 0;
  display: flex; align-items: center; gap: 4px;
}
.show-more-btn:hover { color: #1d4ed8; }
</style>
