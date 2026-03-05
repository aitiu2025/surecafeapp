<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import {
  fetchAllRecords, createRecord, updateRecord, deleteRecord,
  deleteRecordsByFormula, TABLES,
} from '@/services/airtableService.js';

const router = useRouter();

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE  = 10;
const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/u/1/folders/1FnO_hVvXSO_QsjhR1A-UBUfOyFMOCzPI?usp=sharing';
const DRIVE_JD_FOLDER_ID = '12X_tXF3OdGv0IcO-AkX2QL_8PHrJYMo2';
const N8N_WEBHOOK_URL = 'https://surecafe.app.n8n.cloud/webhook/1a681a73-b6fd-4c41-9d2a-e38c9276ec89';
const GOOGLE_CLIENT_ID = '539057910222-lgejefkrkr8kamj6uihvko3no1a82pa3.apps.googleusercontent.com';
const DISCOVERY_DOC  = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES         = 'https://www.googleapis.com/auth/drive.file';

const COMMA_FIELDS = [
  'Required_Skills','Preferred_Skills','Programming_Languages','Tools_Platforms',
  'Databases','Domain_Expertise','Frameworks_Libraries','Key_Responsibilities',
  'Certifications','Methodologies',
];

const JOB_FILTER_KEYS = {
  employmentType:   'Employment_Type',
  experienceLevel:  'Experience_Level',
  requiredSkills:   'Required_Skills',
  responsibilities: 'Key_Responsibilities',
  status:           'Status',
};

// ─── State ────────────────────────────────────────────────────────────────────
const allJobs       = ref([]);
const filteredJobs  = ref([]);
const allClients    = ref([]);
const allStatuses   = ref([]);
const jobStatuses   = ref([]);

const currentPage   = ref(1);
const isLoading     = ref(true);
const searchTerm    = ref('');
const expandedCards = ref(new Set());

// Filter
const activeFilters = reactive({ employmentType: [], experienceLevel: [], requiredSkills: [], responsibilities: [], status: [] });
const openFilter    = ref(null);
const filterSearch  = reactive({ employmentType: '', experienceLevel: '', requiredSkills: '', responsibilities: '', status: '' });

// Upload section
const gapiInited       = ref(false);
const gisInited        = ref(false);
const uploadStatus     = ref('Loading Google API...');
const uploadProgress   = ref('');
const selectedFile     = ref(null);
const uploadClientId   = ref('');
let   tokenClient      = null;

// Modals
const modal = reactive({ result: false, resultMsg: '', resultTitle: 'Status', status: false, client: false, confirmEdit: false });

// Form
const isEditMode   = ref(false);
const isSaving     = ref(false);
const currentEditId = ref(null);
const form = reactive({
  Job_Title: '', Location: '', Employment_Type: 'Full-time', Experience_Years: '',
  Status: '', Priority: 'High', Department: '', Experience_Level: 'Senior',
  'Job Description': '', Required_Skills: '', Preferred_Skills: '', Programming_Languages: '',
  Tools_Platforms: '', Databases: '', Domain_Expertise: '', Frameworks_Libraries: '',
  Key_Responsibilities: '', Certifications: '', Salary_Range: '', Methodologies: '',
  Client_id: '',
});

// Delete
const deleteJobId  = ref(null);
const isDeleting   = ref(false);

// Status modal
const statusModal = reactive({ jobId: '', jobName: '', newStatus: '' });
const isUpdatingStatus = ref(false);

// Client modal
const clientModal = reactive({ jobId: '', jobName: '', clientId: '' });
const isUpdatingClient = ref(false);

// Bootstrap modals
let bsJobModal    = null;
let bsDeleteModal = null;
let bsConfirmModal = null;

// ─── Computed ─────────────────────────────────────────────────────────────────
const totalPages = computed(() => Math.max(1, Math.ceil(filteredJobs.value.length / PAGE_SIZE)));
const paginatedJobs = computed(() => {
  const s = (currentPage.value - 1) * PAGE_SIZE;
  return filteredJobs.value.slice(s, s + PAGE_SIZE);
});
const pageButtons = computed(() => {
  const t = totalPages.value;
  let s = Math.max(1, currentPage.value - 2);
  let e = Math.min(t, s + 4);
  if (e - s < 4) s = Math.max(1, e - 4);
  return Array.from({ length: e - s + 1 }, (_, i) => s + i);
});

const clientsMap = computed(() => {
  const map = {};
  allClients.value.forEach(c => { map[c.id] = c.fields; });
  return map;
});

// Filter options (distinct values from data)
function getFilterOptions(fieldKey) {
  const vals = new Set();
  allJobs.value.forEach(r => {
    const v = r.fields[fieldKey];
    if (Array.isArray(v)) v.forEach(x => vals.add(x));
    else if (v) vals.add(v);
  });
  return Array.from(vals).sort();
}

const filterOptions = computed(() => {
  const opts = {};
  Object.entries(JOB_FILTER_KEYS).forEach(([k, field]) => {
    opts[k] = getFilterOptions(field).filter(v =>
      v.toLowerCase().includes((filterSearch[k] || '').toLowerCase())
    );
  });
  return opts;
});

const FILTER_LABELS = {
  employmentType:   'Employment Type',
  experienceLevel:  'Experience Level',
  requiredSkills:   'Required Skills',
  responsibilities: 'Key Responsibilities',
  status:           'Status',
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  loadGoogleApis();
  const [, clients, statuses] = await Promise.all([
    loadJobs(),
    fetchAllRecords(TABLES.CLIENTS, ['company_name','contact_person','contact_number','email','status','address_line_1','address_line_2','city','state','country','zip_code'], { sort: [{ field: 'company_name' }] }),
    fetchAllRecords(TABLES.STATUSES, ['status','entity_type','seq_order'], { sort: [{ field: 'seq_order' }] }),
  ]);
  allClients.value   = clients;
  allStatuses.value  = statuses;
  jobStatuses.value  = statuses.filter(r => r.fields.entity_type?.trim().toLowerCase() === 'job').map(r => r.fields.status).filter(Boolean);

  // Restore filter if navigated from dashboard — match case-insensitively against actual Status field values
  const savedStatuses = JSON.parse(localStorage.getItem('selectedStatuses') || '[]');
  const savedType     = localStorage.getItem('selectedType') || '';
  if (savedStatuses.length && ['Open', 'Closed', 'On-Hold'].includes(savedType)) {
    const actualValues = [...new Set(allJobs.value.map(r => r.fields['Status']).filter(Boolean))];
    const matched = actualValues.filter(v => savedStatuses.includes(v.toLowerCase().trim()));
    if (matched.length) { activeFilters.status = matched; applyFilters(); }
  }
  localStorage.removeItem('selectedStatuses');
  localStorage.removeItem('selectedType');

  document.addEventListener('click', handleOutsideClick);
});

// ─── Google API Setup ─────────────────────────────────────────────────────────
function loadGoogleApis() {
  const gapiScript = document.createElement('script');
  gapiScript.src   = 'https://apis.google.com/js/api.js';
  gapiScript.onload = () => { window.gapi.load('client', initGapiClient); };
  document.head.appendChild(gapiScript);

  const gisScript  = document.createElement('script');
  gisScript.src    = 'https://accounts.google.com/gsi/client';
  gisScript.onload = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse.error) return;
        window.gapi.client.setToken(tokenResponse);
        await doUpload();
      },
    });
    gisInited.value = true;
    updateUploadButtons();
  };
  document.head.appendChild(gisScript);
}

async function initGapiClient() {
  await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
  gapiInited.value = true;
  updateUploadButtons();
}

function updateUploadButtons() {
  if (gapiInited.value && gisInited.value) {
    uploadStatus.value = '✅ Ready to upload files!';
  }
}

// ─── Data Fetching ────────────────────────────────────────────────────────────
async function loadJobs() {
  isLoading.value = true;
  try {
    const recs = await fetchAllRecords(TABLES.JOB_DESCRIPTIONS, [], {
      sort: [{ field: 'updated_at', direction: 'desc' }],
    });
    allJobs.value = recs;
    applyFilters();
  } catch (err) {
    showResult('❌ Failed to load jobs: ' + err.message);
  } finally {
    isLoading.value = false;
  }
}

async function reloadData() {
  resetFilters();
  await loadJobs();
}

// ─── Filtering ────────────────────────────────────────────────────────────────
function applyFilters() {
  const term = searchTerm.value.trim().toLowerCase();
  filteredJobs.value = allJobs.value.filter(rec => {
    const f = rec.fields || {};
    for (const [key, field] of Object.entries(JOB_FILTER_KEYS)) {
      if (!activeFilters[key].length) continue;
      const val = f[field];
      const vals = Array.isArray(val) ? val : [val];
      if (!activeFilters[key].some(s => vals.includes(s))) return false;
    }
    if (!term) return true;
    const search = ['Job_Title','Location','Job Description','Required_Skills','Experience_Years','Department','Status'];
    return search.some(fld => {
      const v = f[fld];
      return v && String(v).toLowerCase().includes(term);
    });
  });
  currentPage.value = 1;
}

function resetFilters() {
  searchTerm.value = '';
  Object.keys(activeFilters).forEach(k => { activeFilters[k] = []; });
  Object.keys(filterSearch).forEach(k => { filterSearch[k] = ''; });
  openFilter.value = null;
  filteredJobs.value = allJobs.value.slice();
  currentPage.value = 1;
}

function toggleFilter(key) { openFilter.value = openFilter.value === key ? null : key; }
function isFilterOpen(k)   { return openFilter.value === k; }
function hasSelection(k)   { return activeFilters[k].length > 0; }
function handleOutsideClick(e) {
  if (!e.target.closest('.filter-dropdown')) openFilter.value = null;
}
function onCheckboxChange(key, value, checked) {
  if (checked) { if (!activeFilters[key].includes(value)) activeFilters[key].push(value); }
  else         { activeFilters[key] = activeFilters[key].filter(v => v !== value); }
  applyFilters();
}

// ─── Card toggle ──────────────────────────────────────────────────────────────
function toggleCard(id) {
  const s = new Set(expandedCards.value);
  s.has(id) ? s.delete(id) : s.add(id);
  expandedCards.value = s;
}
function isExpanded(id) { return expandedCards.value.has(id); }

// ─── Pagination ───────────────────────────────────────────────────────────────
function goToPage(p) { if (p >= 1 && p <= totalPages.value) currentPage.value = p; }

// ─── Google Drive Upload ──────────────────────────────────────────────────────
function onFileChange(e) { selectedFile.value = e.target.files[0] || null; }

async function handleUpload() {
  if (!uploadClientId.value) { showResult('❌ Please select a client before uploading JDs.'); return; }
  if (!selectedFile.value)   { uploadStatus.value = '❌ Please select a file to upload.'; return; }
  const token = window.gapi?.client?.getToken();
  if (!token) {
    tokenClient?.requestAccessToken({ prompt: '' });
    return;
  }
  await doUpload();
}

async function doUpload() {
  if (!selectedFile.value) return;
  uploadStatus.value = '🚀 Starting upload...';
  showResult('<div class="spinner-border processSpin" role="status"></div> Uploading... Please wait.');
  try {
    await uploadFileToDrive(selectedFile.value);
    uploadStatus.value = '✅ Uploaded!';
    uploadProgress.value = '✅ Upload complete!';
    await triggerN8nWorkflow();
    await loadJobs();
  } catch (err) {
    uploadStatus.value = `❌ Upload failed: ${err.message}`;
    showResult('❌ Upload failed: ' + err.message);
  }
}

function uploadFileToDrive(file) {
  return new Promise((resolve, reject) => {
    const accessToken = window.gapi.client.getToken().access_token;
    const metadata = { name: file.name, parents: [DRIVE_JD_FOLDER_ID] };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.onload = () => { xhr.status === 200 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`HTTP ${xhr.status}`)); };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) uploadProgress.value = `📤 ${Math.round((e.loaded / e.total) * 100)}%`;
    };
    xhr.send(formData);
  });
}

async function triggerN8nWorkflow() {
  showResult('<div class="spinner-border processSpin" role="status"></div> Processing JD(s)... Please wait.');
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello from SureCafe Vue!', client_id: uploadClientId.value || null }),
    });
    showResult('✅ Successfully processed!');
  } catch {
    showResult('The process may take time in the background. Click <strong>Reload Data</strong> and check back later if the uploaded JD(s) are not visible.');
  }
}

// ─── Add / Edit Job Modal ─────────────────────────────────────────────────────
function openAddModal() {
  isEditMode.value  = false;
  currentEditId.value = null;
  resetForm();
  nextTick(() => {
    if (!bsJobModal) bsJobModal = new window.bootstrap.Modal(document.getElementById('jobModal'));
    bsJobModal.show();
  });
}

function openEditModal(id) {
  const rec = allJobs.value.find(r => r.id === id);
  if (!rec) return;
  isEditMode.value    = true;
  currentEditId.value = id;
  const f = rec.fields;
  Object.keys(form).forEach(key => {
    const val = f[key];
    form[key] = Array.isArray(val) ? val.join(', ') : (val ?? '');
  });
  nextTick(() => {
    if (!bsJobModal) bsJobModal = new window.bootstrap.Modal(document.getElementById('jobModal'));
    bsJobModal.show();
  });
}

function resetForm() {
  Object.keys(form).forEach(k => { form[k] = k === 'Employment_Type' ? 'Full-time' : k === 'Priority' ? 'High' : k === 'Experience_Level' ? 'Senior' : ''; });
}

async function saveJob() {
  if (isEditMode.value) {
    // Show confirmation modal
    nextTick(() => {
      if (!bsConfirmModal) bsConfirmModal = new window.bootstrap.Modal(document.getElementById('confirmJobUpdateModal'));
      bsConfirmModal.show();
    });
    return;
  }
  await doSaveJob();
}

async function confirmSaveJob() {
  bsConfirmModal?.hide();
  await doSaveJob();
}

async function doSaveJob() {
  isSaving.value = true;
  showResult('<div class="spinner-border processSpin" role="status"></div> Processing... Please wait.');
  const fields = {};
  Object.entries(form).forEach(([key, val]) => {
    const raw = String(val || '').trim();
    if (!raw) return;
    if (COMMA_FIELDS.includes(key)) fields[key] = raw.split(',').map(v => v.trim()).filter(Boolean);
    else fields[key] = raw;
  });
  try {
    if (isEditMode.value && currentEditId.value) {
      const updated = await updateRecord(TABLES.JOB_DESCRIPTIONS, currentEditId.value, fields);
      const idx = allJobs.value.findIndex(r => r.id === currentEditId.value);
      if (idx > -1) allJobs.value.splice(idx, 1, updated);
      applyFilters();
      bsJobModal?.hide();
      await triggerCandidateMatching(updated.id);
      showResult('✅ Job updated successfully.');
    } else {
      const created = await createRecord(TABLES.JOB_DESCRIPTIONS, fields);
      allJobs.value.unshift(created);
      applyFilters();
      bsJobModal?.hide();
      await triggerCandidateMatching(created.id);
      showResult('✅ Job added successfully.');
    }
  } catch (err) {
    showResult('❌ Save failed: ' + err.message);
  } finally {
    isSaving.value = false;
  }
}

// ─── Delete Job ───────────────────────────────────────────────────────────────
function openDeleteModal(id) {
  deleteJobId.value = id;
  nextTick(() => {
    if (!bsDeleteModal) bsDeleteModal = new window.bootstrap.Modal(document.getElementById('deleteJobModal'));
    bsDeleteModal.show();
  });
}

async function confirmDelete() {
  if (!deleteJobId.value) return;
  isDeleting.value = true;
  showResult('<div class="spinner-border processSpin" role="status"></div> Deleting related records... Please wait.');
  try {
    const id = deleteJobId.value;
    await deleteRecord(TABLES.JOB_DESCRIPTIONS, id);
    await Promise.all([
      deleteRecordsByFormula(TABLES.CANDIDATE_APPLICATIONS, `{job_id}="${id}"`),
      deleteRecordsByFormula(TABLES.CANDIDATE_INTERVIEWS, `{job_id}="${id}"`),
      deleteRecordsByFormula(TABLES.MATCHED_RESUMES, `{job_id}="${id}"`),
    ]);
    allJobs.value = allJobs.value.filter(r => r.id !== id);
    applyFilters();
    bsDeleteModal?.hide();
    showResult('✅ Job deleted successfully.');
  } catch (err) {
    showResult('❌ Delete failed: ' + err.message);
  } finally {
    isDeleting.value = false;
    deleteJobId.value = null;
  }
}

// ─── Status Modal ─────────────────────────────────────────────────────────────
function openStatusModal(id, currentStatus, title) {
  Object.assign(statusModal, { jobId: id, jobName: title, newStatus: currentStatus || '' });
  modal.status = true;
}

async function updateJobStatus() {
  isUpdatingStatus.value = true;
  modal.status = false;
  showResult('<div class="spinner-border processSpin" role="status"></div> Updating job status...');
  try {
    await updateRecord(TABLES.JOB_DESCRIPTIONS, statusModal.jobId, { Status: statusModal.newStatus });
    const idx = allJobs.value.findIndex(r => r.id === statusModal.jobId);
    if (idx > -1) allJobs.value[idx].fields.Status = statusModal.newStatus;
    applyFilters();
    showResult('✅ Status updated successfully!');
  } catch (err) {
    showResult('❌ Failed to update status.');
  } finally {
    isUpdatingStatus.value = false;
  }
}

// ─── Client Modal ─────────────────────────────────────────────────────────────
function openClientModal(id, title) {
  const rec = allJobs.value.find(r => r.id === id);
  Object.assign(clientModal, { jobId: id, jobName: title, clientId: rec?.fields?.Client_id || '' });
  modal.client = true;
}

async function updateJobClient() {
  isUpdatingClient.value = true;
  modal.client = false;
  showResult('<div class="spinner-border processSpin" role="status"></div> Updating client...');
  try {
    await updateRecord(TABLES.JOB_DESCRIPTIONS, clientModal.jobId, { Client_id: clientModal.clientId });
    const idx = allJobs.value.findIndex(r => r.id === clientModal.jobId);
    if (idx > -1) allJobs.value[idx].fields.Client_id = clientModal.clientId;
    applyFilters();
    showResult('✅ Client updated successfully!');
  } catch (err) {
    showResult('❌ Failed to update client.');
  } finally {
    isUpdatingClient.value = false;
  }
}

// ─── Open Google Drive Folder ─────────────────────────────────────────────────
function openDriveFolder() {
  window.open(DRIVE_FOLDER_URL, '_blank');
}

// ─── Trigger Candidate Matching Webhook ───────────────────────────────────────
async function triggerCandidateMatching(jobId) {
  try {
    await fetch('https://surecafe.app.n8n.cloud/webhook/00a73afd-6527-443b-abf0-190de06affdb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    });
    console.log('Candidate matching webhook triggered for job:', jobId);
  } catch (err) {
    console.error('Error triggering candidate matching:', err);
  }
}

// ─── Navigate to JD-Candidate Match ──────────────────────────────────────────
function fetchCandidates(id) {
  localStorage.setItem('selectedJdId', JSON.stringify(id));
  router.push('/jd-candidates-match');
}

// ─── View Client Details ──────────────────────────────────────────────────────
function viewClientDetails(clientId) {
  const client = clientsMap.value[clientId];
  if (!client) return;
  const html = `<div style="padding:10px;font-size:14px;">
    <div class="mb-2"><strong>Company Name:</strong> ${client.company_name || 'N/A'}</div>
    <div class="mb-2"><strong>Contact Person:</strong> ${client.contact_person || 'N/A'}</div>
    <div class="mb-2"><strong>Contact Number:</strong> ${client.contact_number || 'N/A'}</div>
    <div class="mb-2"><strong>Email:</strong> ${client.email || 'N/A'}</div>
    <div class="mb-2"><strong>Status:</strong> ${client.status || 'N/A'}</div>
    <div class="mb-2"><strong>Address Line 1:</strong> ${client.address_line_1 || 'N/A'}</div>
    <div class="mb-2"><strong>Address Line 2:</strong> ${client.address_line_2 || 'N/A'}</div>
    <div class="mb-2"><strong>City:</strong> ${client.city || 'N/A'}</div>
    <div class="mb-2"><strong>State:</strong> ${client.state || 'N/A'}</div>
    <div class="mb-2"><strong>Country:</strong> ${client.country || 'N/A'}</div>
    <div class="mb-2"><strong>Zip Code:</strong> ${client.zip_code || 'N/A'}</div>
  </div>`;
  showResult(html, `Client Details: ${client.company_name || ''}`);
}

// ─── Result Modal ─────────────────────────────────────────────────────────────
function showResult(msg, title = 'Status') {
  modal.resultMsg   = msg;
  modal.resultTitle = title;
  modal.result      = true;
}
function closeResult() { modal.result = false; }
</script>

<template>
  <div class="container" style="max-width: 1400px; margin: 0 auto;">
    <!-- ─── Upload Section ─────────────────────────────── -->
    <div class="dashboard-header mt-3">
      <h1 class="section-title">JD Management System</h1>
    </div>

    <div class="upload-container mb-3">
      <!-- Upload card -->
      <div class="section-card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h3 class="card-title" style="width: 30%;">
            <i class="bi bi-upload" style="color: orange; font-size: 18px;"></i>
            <span style="margin-left:6px;">Upload JD(s)</span>
          </h3>
          <div class="d-flex align-items-center gap-2 ms-auto">
            <label class="mb-0 fw-500" style="white-space:nowrap; font-weight:500;">Select Client:</label>
            <select v-model="uploadClientId" class="form-select" style="width:300px; padding:2px 8px; font-size:14px;">
              <option value="">-- Select Client --</option>
              <option v-for="c in allClients" :key="c.id" :value="c.id">{{ c.fields.company_name }}</option>
            </select>
          </div>
          <span class="ms-2" style="font-size:14px; color:#555; cursor:pointer;" @click="router.push('/clients')">+ Add Client</span>
        </div>

        <div class="upload-section">
          <div class="upload-desc mb-3">
            <span class="upload-desc-span">Upload Job Descriptions and manage your jobs collection </span>
            <span class="upload-desc-span" style="color:#d50e0e;">( Please upload .txt or .pdf files only. )</span>
          </div>
          <div class="upload-row d-flex align-items-center gap-2 justify-content-center">
            <input type="file" class="form-control" accept=".txt,.pdf" @change="onFileChange" style="padding:4px;" />
            <button @click="handleUpload" class="btn btn-primary" style="white-space:nowrap; background:#4285f4;"
              :disabled="!gapiInited || !gisInited">
              Upload &amp; Process JDs
            </button>
          </div>
          <div class="upload-status-box mt-2" style="background:#f2f8fc; color:#1976d2; border:1px solid #bbdefb; border-radius:8px; padding:5px; font-size:13px; text-align:center;">
            {{ uploadStatus }}
          </div>
          <div class="upload-progress-box mt-1" style="background:#f3fff3; color:#388e3c; border:1px solid #c8e6c9; border-radius:8px; padding:5px; font-size:13px; font-weight:bold; min-height:10px;">
            {{ uploadProgress }}
          </div>
        </div>
      </div>

      <!-- Folder card -->
      <div class="section-card">
        <div class="card-header">
          <h3 class="card-title"><span>Job Descriptions Location</span></h3>
        </div>
        <div style="padding:10px;">
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

    <!-- ─── Job List Section ───────────────────────────── -->
    <div class="dashboard-header d-flex justify-content-between align-items-center mb-3">
      <div>
        <h1 class="section-title">Job Descriptions</h1>
        <p class="section-subtitle">Represents information about job openings</p>
      </div>
    </div>

    <!-- Search & Controls -->
    <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
      <div class="position-relative flex-grow-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          style="position:absolute; right:10px; top:50%; transform:translateY(-50%); color:orange; z-index:1;">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input v-model="searchTerm" @input="applyFilters" type="text" placeholder="Search jobs..."
          class="form-control" style="padding:6px 35px 6px 12px !important; border-radius:8px !important;" />
      </div>
      <button @click="resetFilters" class="btn btn-primary" style="background:#4285f4; font-size:14px; padding:5px 10px; white-space:nowrap;">
        <i class="bi bi-arrow-clockwise"></i> Reset Filters
      </button>
      <button @click="reloadData" class="btn btn-primary" style="background:#4285f4; font-size:14px; padding:5px 10px; white-space:nowrap;">
        <i class="bi bi-arrow-repeat"></i> Reload Data
      </button>
      <button @click="openAddModal" class="btn btn-primary" style="background:#4285f4; font-size:14px; padding:5px 10px; white-space:nowrap;">
        + Add Job
      </button>
    </div>

    <div class="section-card" style="border-radius:6px; border:1px solid #b6e0ed; padding:20px !important;">
      <!-- Filter Dropdowns -->
      <div class="d-flex flex-wrap align-items-center mb-3" style="gap:12px;">
        <div v-for="(field, key) in JOB_FILTER_KEYS" :key="key"
          class="filter-dropdown" :class="{ active: isFilterOpen(key) }">
          <button class="filter-btn" :class="{ 'has-selection': hasSelection(key) }" @click.stop="toggleFilter(key)">
            {{ FILTER_LABELS[key] }} <span style="margin-left:20px; font-size:14px; color:#717271;">▼</span>
          </button>
          <div class="filter-menu">
            <input v-model="filterSearch[key]" type="text" placeholder="Search..." class="form-control form-control-sm mb-2 filter-search" />
            <label v-for="opt in filterOptions[key]" :key="opt">
              <input type="checkbox" :checked="activeFilters[key].includes(opt)"
                @change="e => onCheckboxChange(key, opt, e.target.checked)" />
              {{ opt }}
            </label>
          </div>
        </div>
      </div>

      <!-- Loader -->
      <div v-if="isLoading" class="text-center my-4">
        <div class="spinner-border text-warning" role="status"></div>
        <p class="mt-2 text-muted">Fetching jobs...</p>
      </div>

      <!-- Job List -->
      <div v-else>
        <div v-if="paginatedJobs.length === 0" class="text-center text-muted py-4">No jobs found.</div>

        <div v-for="rec in paginatedJobs" :key="rec.id" class="job-card">
          <!-- Summary Row -->
          <div class="row w-100 align-items-center row-details" style="cursor:pointer; margin:0;"
            @click.stop="toggleCard(rec.id)">
            <div class="col-md-3" style="font-weight:600; color:#313030; font-size:15px;">
              {{ rec.fields.Job_Title || '-' }}
            </div>
            <div class="col-md-1">
              <span class="badge-status" @click.stop="openStatusModal(rec.id, rec.fields.Status, rec.fields.Job_Title)">
                {{ rec.fields.Status || '-' }}
              </span>
            </div>
            <div class="col-md-2 text-muted" style="font-weight:500;">{{ rec.fields.Location || '-' }}</div>
            <div class="col-md-2 text-muted" style="font-weight:500;">{{ rec.fields.Experience_Years || '-' }}</div>
            <div class="col-md-2">
              <span class="change-client-link" @click.stop="openClientModal(rec.id, rec.fields.Job_Title)">
                <i class="bi" :class="rec.fields.Client_id && clientsMap[rec.fields.Client_id] ? 'bi-pencil-square' : 'bi-person'" style="color:#0066cc;"></i>
                {{ rec.fields.Client_id && clientsMap[rec.fields.Client_id]
                    ? clientsMap[rec.fields.Client_id].contact_person || 'Unknown'
                    : 'Assign Client' }}
              </span>
              <span v-if="rec.fields.Client_id && clientsMap[rec.fields.Client_id]"
                @click.stop="viewClientDetails(rec.fields.Client_id)"
                title="View Client Details" style="cursor:pointer; color:#0066cc; margin-left:4px;">
                <i class="bi bi-info-circle"></i>
              </span>
            </div>
            <div class="col-md-2 d-flex gap-2 justify-content-end align-items-center">
              <button title="Fetch Candidates" style="background:none;border:none;padding:0;color:#325632;cursor:pointer;font-size:18px;"
                @click.stop="fetchCandidates(rec.id)">
                <i class="bi bi-person-check"></i>
              </button>
              <button title="Edit Job" style="background:none;border:none;padding:0;color:#006db6;cursor:pointer;font-size:18px;"
                @click.stop="openEditModal(rec.id)">
                <i class="bi bi-pencil"></i>
              </button>
              <button title="Delete Job" style="background:none;border:none;padding:0;color:#FF6F21;cursor:pointer;font-size:18px;"
                @click.stop="openDeleteModal(rec.id)">
                <i class="bi bi-trash"></i>
              </button>
              <span class="toggle-icon">{{ isExpanded(rec.id) ? '▲ Hide' : '▼ Show' }}</span>
            </div>
          </div>

          <!-- Expanded Details -->
          <div v-if="isExpanded(rec.id)" class="detail-row mt-2">
            <table class="table table-sm mb-0">
              <tbody>
                <tr v-if="rec.fields.Jd_file_Id">
                  <th>JD Document</th>
                  <td><a :href="`https://drive.google.com/file/d/${rec.fields.Jd_file_Id}/view`" target="_blank">View Uploaded JD File</a></td>
                </tr>
                <tr><th style="width:25%">Department</th><td>{{ rec.fields.Department || '-' }}</td></tr>
                <tr><th>Employment Type</th><td>{{ rec.fields.Employment_Type || '-' }}</td></tr>
                <tr><th>Priority</th><td>{{ rec.fields.Priority || '-' }}</td></tr>
                <tr><th>Experience Level</th><td>{{ rec.fields.Experience_Level || '-' }}</td></tr>
                <tr><th>Job Description</th><td>{{ rec.fields['Job Description'] || '-' }}</td></tr>
                <tr><th>Required Skills</th><td><span v-for="s in (rec.fields.Required_Skills||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Preferred Skills</th><td><span v-for="s in (rec.fields.Preferred_Skills||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Programming Languages</th><td><span v-for="s in (rec.fields.Programming_Languages||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Frameworks</th><td><span v-for="s in (rec.fields.Frameworks_Libraries||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Tools &amp; Platforms</th><td><span v-for="s in (rec.fields.Tools_Platforms||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Databases</th><td><span v-for="s in (rec.fields.Databases||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Key Responsibilities</th><td><li v-for="s in (rec.fields.Key_Responsibilities||[])" :key="s">{{ s }}</li></td></tr>
                <tr><th>Domain Expertise</th><td><span v-for="s in (rec.fields.Domain_Expertise||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Certifications</th><td><span v-for="s in (rec.fields.Certifications||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Methodologies</th><td><span v-for="s in (rec.fields.Methodologies||[])" :key="s" class="tag">{{ s }}</span></td></tr>
                <tr><th>Salary</th><td>{{ rec.fields.Salary_Range || '-' }}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        <div class="pagination-controls mt-3">
          <button :disabled="currentPage===1||totalPages<=1" @click="goToPage(1)">First</button>
          <button :disabled="currentPage===1||totalPages<=1" @click="goToPage(currentPage-1)">Prev</button>
          <button v-for="p in pageButtons" :key="p" :class="{active:p===currentPage}" @click="goToPage(p)">{{ p }}</button>
          <button :disabled="currentPage===totalPages||totalPages<=1" @click="goToPage(currentPage+1)">Next</button>
          <button :disabled="currentPage===totalPages||totalPages<=1" @click="goToPage(totalPages)">Last</button>
        </div>
      </div>
    </div>

    <!-- ============ ADD/EDIT JOB MODAL ============ -->
    <div class="modal fade" id="jobModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditMode ? 'Edit Job' : 'Add Job' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form @submit.prevent="saveJob">
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Job Title *</label><input v-model="form.Job_Title" class="form-control" required style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-6"><label class="form-label">Location</label><input v-model="form.Location" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-6">
                  <label class="form-label">Client</label>
                  <select v-model="form.Client_id" class="form-select" style="padding:4px 12px; border-radius:5px;">
                    <option value="">-- No Client --</option>
                    <option v-for="c in allClients" :key="c.id" :value="c.id">{{ c.fields.company_name }}</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Employment Type</label>
                  <select v-model="form.Employment_Type" class="form-select" style="padding:4px 12px; border-radius:5px;">
                    <option>Full-time</option><option>Contract</option><option>Part-time</option><option>Internship</option><option>Not Specified</option>
                  </select>
                </div>
                <div class="col-md-6"><label class="form-label">Experience Years</label><input v-model="form.Experience_Years" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-6">
                  <label class="form-label">Status</label>
                  <select v-model="form.Status" class="form-select" style="padding:4px 12px; border-radius:5px;">
                    <option v-for="s in jobStatuses" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Priority</label>
                  <select v-model="form.Priority" class="form-select" style="padding:4px 12px; border-radius:5px;">
                    <option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </div>
                <div class="col-md-6"><label class="form-label">Department</label><input v-model="form.Department" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-6">
                  <label class="form-label">Experience Level</label>
                  <select v-model="form.Experience_Level" class="form-select" style="padding:4px 12px; border-radius:5px;">
                    <option>Senior</option><option>Mid</option><option>Entry</option><option>Not Specified</option>
                  </select>
                </div>
                <div class="col-md-6"><label class="form-label">Salary Range</label><input v-model="form.Salary_Range" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Job Description</label><textarea v-model="form['Job Description']" rows="3" class="form-control"></textarea></div>
                <div class="col-md-12"><label class="form-label">Required Skills <small class="text-muted">(comma separated)</small></label><input v-model="form.Required_Skills" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Preferred Skills</label><input v-model="form.Preferred_Skills" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Programming Languages</label><input v-model="form.Programming_Languages" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Tools &amp; Platforms</label><input v-model="form.Tools_Platforms" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Databases</label><input v-model="form.Databases" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Domain Expertise</label><input v-model="form.Domain_Expertise" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Frameworks / Libraries</label><input v-model="form.Frameworks_Libraries" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Key Responsibilities</label><input v-model="form.Key_Responsibilities" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Certifications</label><input v-model="form.Certifications" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
                <div class="col-md-12"><label class="form-label">Methodologies</label><input v-model="form.Methodologies" class="form-control" style="padding:4px 12px; border-radius:5px;" /></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" style="color:#212121;">Cancel</button>
              <button type="submit" class="btn btn-success" :disabled="isSaving" style="background:#3367d6;">
                {{ isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Job') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- ============ CONFIRM UPDATE MODAL ============ -->
    <div class="modal fade" id="confirmJobUpdateModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header"><h5 class="modal-title">Confirm Update</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body" style="padding:0 15px;">
            <p style="font-size:15px; line-height:1.6; color:#cd4c4c;">
              Changes to this job description will not impact candidates who have already been processed and are currently in the pipeline.
              <div>Do you want to proceed?</div>
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" style="color:#222121;">Cancel</button>
            <button type="button" class="btn btn-primary" @click="confirmSaveJob" style="background:#1976d2;">Yes, Proceed</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ DELETE JOB MODAL ============ -->
    <div class="modal fade" id="deleteJobModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header"><h5 class="modal-title">Delete Record</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">
            You are about to delete this item. Are you sure?
            <div style="color:#cf7e7e; font-size:13px;">All job-related information associated with it will also be deleted.</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" style="color:#222121;">Cancel</button>
            <button type="button" class="btn btn-danger" :disabled="isDeleting" @click="confirmDelete" style="background:#cd7140;">
              {{ isDeleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ STATUS MODAL ============ -->
    <div v-if="modal.status" class="web-process-modal" style="display:flex;">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="modal.status=false">&times;</span>
        <h3>Change Job Status</h3>
        <div class="mb-3"><strong>Job:</strong> {{ statusModal.jobName }}</div>
        <div class="mb-3">
          <label class="form-label">Change Status</label>
          <select v-model="statusModal.newStatus" class="form-select">
            <option v-for="s in jobStatuses" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button class="btn btn-secondary btn-sm" @click="modal.status=false">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="updateJobStatus" :disabled="isUpdatingStatus">Update</button>
        </div>
      </div>
    </div>

    <!-- ============ CLIENT MODAL ============ -->
    <div v-if="modal.client" class="web-process-modal" style="display:flex;">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="modal.client=false">&times;</span>
        <h3>Change Job Client</h3>
        <div class="mb-3"><strong>Job:</strong> {{ clientModal.jobName }}</div>
        <div class="mb-3">
          <label class="form-label">Select Client</label>
          <select v-model="clientModal.clientId" class="form-select">
            <option value="">-- No Client --</option>
            <option v-for="c in allClients" :key="c.id" :value="c.id">{{ c.fields.company_name }}</option>
          </select>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button class="btn btn-secondary btn-sm" @click="modal.client=false">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="updateJobClient" :disabled="isUpdatingClient">Update</button>
        </div>
      </div>
    </div>

    <!-- ============ RESULT MODAL ============ -->
    <div v-if="modal.result" class="web-process-modal" style="display:flex;">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="closeResult">&times;</span>
        <h3>{{ modal.resultTitle }}</h3>
        <div style="font-size:15px;" v-html="modal.resultMsg"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.web-process-modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1500;
  background-color: rgba(0,0,0,0.5);
  justify-content: center;
  align-items: center;
}
.web-modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 10px;
  width: 360px;
  max-width: 90%;
  text-align: left;
  box-shadow: 0 5px 20px rgba(0,0,0,0.3);
  position: relative;
}
.web-close-btn {
  float: right;
  font-size: 22px;
  font-weight: bold;
  cursor: pointer;
  position: absolute;
  right: 7px;
  top: 1px;
}
.web-modal-content h3 {
  margin-top: -5px;
  color: #1976d2;
  font-weight: 500;
  border-bottom: solid 1px #1976d2;
  padding-bottom: 5px;
  font-size: 16px;
  margin-bottom: 20px;
}
.badge-status.updated {
  background-color: #28a745 !important;
  color: white !important;
  transition: background-color 0.5s;
}
.upload-container {
  display: grid;
  grid-template-columns: 9fr 3fr;
  gap: 20px;
}

.card-header {
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 700;
  color: #1976d2;
  margin: 0;
}

.folder-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafbfc;
}

.folder-card:hover {
  border-color: #CD7A5C;
  background: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(205,122,92,0.15);
}

.folder-content { flex: 1; }
.folder-title { font-size: 14px; font-weight: 600; color: #1f2937; margin: 0; }
.folder-subtitle { font-size: 12px; color: #6b7280; margin: 0; }

.job-card {
  border: 0.5px solid #ded8d8;
  border-radius: 10px;
  padding: 5px 10px;
  margin-bottom: 10px;
  background: #f5fcff;
}

.badge-status {
  background: rgb(126 181 212 / 20%);
  font-size: 14px;
  padding: 1px 6px 2px;
  border-radius: 6px;
  border: 0.5px solid #a3c0d3;
  font-weight: 400;
  line-height: 14px;
  cursor: pointer;
}

.change-client-link {
  cursor: pointer;
  color: #444;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.change-client-link:hover { color: #0066cc; font-weight: 600; }

.detail-row {
  border-top: 1px solid #eee;
  padding-top: 12px;
  font-size: 14px;
}

.tag {
  display: inline-block;
  background: #f2f2f2;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 13px;
  margin: 2px;
}

.toggle-icon {
  cursor: pointer;
  color: #0d6efd;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

tbody { display: block; border: 0.5px solid #ddd7d7; padding: 0; border-radius: 2px; }
tbody, td, tfoot, th, thead, tr { border-color: #f3f3f3; border-style: solid; }
tr th { font-weight: 600; }

.upload-section {
  padding: 24px;
  text-align: center;
}
.upload-desc {
  margin-bottom: 12px;
  font-size: 13px;
  text-align: left;
}
.upload-desc-span {
  font-size: 14px;
}
@media (max-width: 768px) { .upload-container { grid-template-columns: 1fr; } }
</style>
