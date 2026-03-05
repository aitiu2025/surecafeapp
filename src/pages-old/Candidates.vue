<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { fetchAllRecords, createRecord, updateRecord, deleteRecord, deleteRecordsByFormula, TABLES } from '@/services/airtableService.js';

// ─── Google Drive Config ──────────────────────────────────────────────────────
const CLIENT_ID       = '539057910222-lgejefkrkr8kamj6uihvko3no1a82pa3.apps.googleusercontent.com';
const ONSHORE_FOLDER  = '111vwuPGv8OhMyj9KZvAal6HFjnL59S3E';
const OFFSHORE_FOLDER = '1XxrhIkveyGdD0LEFgyq7WtO3vTjhrBpp';
const DISCOVERY_DOC   = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES          = 'https://www.googleapis.com/auth/drive.file';

const DRIVE_CONFIG = {
  originalFolderUrl_Onshore_USA:        'https://drive.google.com/drive/folders/1gGyU2Z4Id_M1kG4_tS9OGgv2QW6BZPFL?usp=drive_link',
  formattedFolderUrl_Onshore_USA:       'https://drive.google.com/drive/folders/153VNbPNyj0sABZlnN89FwkWTRyMq27YV?usp=drive_link',
  originalFolderUrl_OffShore_India:     'https://drive.google.com/drive/folders/1qNjdoiE6Tbrv-fbC_y5qOioGIYrLx8Ju?usp=drive_link',
  formattedFolderUrl_Offshore_India:    'https://drive.google.com/drive/folders/1qh8gqRtkUh-riklVqi3mh30I3Vh6O42S?usp=drive_link',
};

const PROCESS_RESUME_CONFIG = {
  offshore: 'https://surecafe.app.n8n.cloud/webhook/80b8a796-1b0f-4e20-b627-a45c202bd945',
  onshore:  'https://surecafe.app.n8n.cloud/webhook/a660e981-ac35-402a-918e-c1e91dd9f70e',
};

const ADDRESS_MAP = {
  india:  'Plot no. 18/1, 2nd Floor. IT Park Gayatri Nagar, Nagpur, Maharashtra 440022',
  usa:    '2000 Auburn Drive Suite 200, Beachwood, Ohio 44122',
};

// ─── Upload Section State ─────────────────────────────────────────────────────
const companyFor       = ref('offshore');
const resumeTemplate   = ref('simple');
const selectedFiles    = ref([]);
const dontUseAddrLogo  = ref(false);
const addressOption    = ref('india');
const customAddress    = ref('');
const logoOption       = ref('default');
const logoFile         = ref(null);
const statusMsg        = ref('Loading Google API...');
const progressMsg      = ref('');
const uploadBtnDisabled= ref(true);
let gapiInited = false;
let gisInited  = false;
let tokenClient;
let selectedLogoFile   = null;
let lastCreatedRecordId= null;
let uploadedFileName   = '';
let uploadedFileId     = '';

// ─── Result Modal ─────────────────────────────────────────────────────────────
const resultModal  = reactive({ visible:false, title:'Status', message:'' });
function openModal(msg, title='Status') {
  resultModal.title   = title;
  resultModal.message = msg;
  resultModal.visible = true;
}
function closeModal() { resultModal.visible = false; }

// ─── Candidate List State ─────────────────────────────────────────────────────
const allCandidates     = ref([]);
const filteredCandidates= ref([]);
const expandedIds       = ref(new Set());
const searchInput       = ref('');
const activeFilters     = reactive({ skills:[], programming:[], frameworks:[], methodologies:[], status:[] });
const openFilterKey     = ref(null);
const filterSearch      = reactive({ skills:'', programming:'', frameworks:'', methodologies:'', status:'' });
const currentPage       = ref(1);
const PAGE_SIZE         = 10;
const listLoading       = ref(true);
const totalCandidates   = computed(() => filteredCandidates.value.length);

// ─── Pagination ───────────────────────────────────────────────────────────────
const totalPages  = computed(() => Math.max(1, Math.ceil(filteredCandidates.value.length / PAGE_SIZE)));
const pagedRows   = computed(() => filteredCandidates.value.slice((currentPage.value-1)*PAGE_SIZE, currentPage.value*PAGE_SIZE));
const visiblePages = computed(() => {
  const total = totalPages.value;
  const cur   = currentPage.value;
  let start = Math.max(1, cur - 2);
  let end   = Math.min(total, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

// ─── Filter options ───────────────────────────────────────────────────────────
const FILTER_FIELDS = { skills:'Key Skills', programming:'Programming Languages', frameworks:'Frameworks and Libraries', methodologies:'Methodologies', status:'CandidateStatus' };
const filterOptions = reactive({ skills:[], programming:[], frameworks:[], methodologies:[], status:[] });
const SEARCHABLE_FIELDS = ['Candidate Name','Current Role','Current Company','Total Experience','CandidateStatus','Key Skills','Programming Languages','Frameworks and Libraries','Methodologies','Tools and Platforms','Databases','Certifications'];

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
const FORM_FIELD_NAMES = ['Candidate Name','Current Company','Current Role','Total Experience','CandidateStatus','Key Skills','Professional Summary','Programming Languages','Tools and Platforms','Methodologies','Databases','Certifications','Formatted url','Frameworks and Libraries'];
const ARRAY_FIELDS = new Set(['Key Skills','Programming Languages','Tools and Platforms','Methodologies','Databases','Certifications']);

const addModal = reactive({ visible:false, isEdit:false, saving:false });
const form = reactive({
  'Candidate Name':'', 'Current Company':'', 'Current Role':'', 'Total Experience':'',
  'CandidateStatus':'', 'Key Skills':'', 'Professional Summary':'', 'Programming Languages':'',
  'Tools and Platforms':'', 'Methodologies':'', 'Databases':'', 'Certifications':'',
  'Formatted url':'', 'Frameworks and Libraries':'',
});
let currentEditId = null;
let bsAddModal = null;

// ─── Delete Modal ─────────────────────────────────────────────────────────────
const deleteModal = reactive({ visible:false, deleting:false });
let currentDeleteId = null;
let bsDeleteModal = null;

// ─── Status Change Modal ──────────────────────────────────────────────────────
const statusModal = reactive({ visible:false, candidateName:'', recordId:'', currentStatus:'', selectedStatus:'', updating:false });
const candidateStatuses = ref([]);
let allStatuses = [];

// ─── Address display ──────────────────────────────────────────────────────────
const addressDisplay = computed(() => {
  if (addressOption.value === 'india') return ADDRESS_MAP.india;
  if (addressOption.value === 'usa')   return ADDRESS_MAP.usa;
  return '';
});

// ─── Fetch Candidates ─────────────────────────────────────────────────────────
async function loadCandidates() {
  listLoading.value = true;
  try {
    const records = await fetchAllRecords(TABLES.CANDIDATES, [], {
      sort: [{ field:'updated_at', direction:'desc' }],
      filterByFormula: 'NOT({Candidate Name}="")',
    });
    allCandidates.value = records;
    filteredCandidates.value = records;
    buildFilterOptions(records);
    applyFilters();
  } catch(e) {
    console.error('Error loading candidates:', e);
  } finally {
    listLoading.value = false;
  }
}

// ─── Filter Logic ─────────────────────────────────────────────────────────────
function buildFilterOptions(records) {
  Object.keys(FILTER_FIELDS).forEach(key => {
    const field = FILTER_FIELDS[key];
    const vals = new Set();
    records.forEach(r => {
      const v = r.fields[field];
      if (Array.isArray(v)) v.forEach(i => i && vals.add(i.trim()));
      else if (v)           vals.add(String(v).trim());
    });
    filterOptions[key] = [...vals].sort();
  });
}

function applyFilters() {
  let data = allCandidates.value;
  const q = searchInput.value.toLowerCase().trim();
  if (q) {
    data = data.filter(r => SEARCHABLE_FIELDS.some(f => {
      const v = r.fields[f];
      if (Array.isArray(v)) return v.some(i => (i||'').toLowerCase().includes(q));
      return (v||'').toString().toLowerCase().includes(q);
    }));
  }
  Object.keys(FILTER_FIELDS).forEach(key => {
    const sel = activeFilters[key];
    if (!sel.length) return;
    const field = FILTER_FIELDS[key];
    data = data.filter(r => {
      const v = r.fields[field];
      if (Array.isArray(v)) return v.some(i => sel.includes((i||'').trim()));
      return sel.includes((v||'').toString().trim());
    });
  });
  filteredCandidates.value = data;
  currentPage.value = 1;
}

function resetFilters() {
  searchInput.value = '';
  Object.keys(activeFilters).forEach(k => { activeFilters[k] = []; });
  Object.keys(filterSearch).forEach(k => { filterSearch[k] = ''; });
  applyFilters();
  openFilterKey.value = null;
}

function toggleFilter(key) { openFilterKey.value = openFilterKey.value === key ? null : key; }

function toggleFilterVal(key, val) {
  const i = activeFilters[key].indexOf(val);
  if (i === -1) activeFilters[key].push(val); else activeFilters[key].splice(i, 1);
  applyFilters();
}

function toggleCard(id) {
  const s = new Set(expandedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  expandedIds.value = s;
}

// ─── CRUD Helpers ─────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', { year:'numeric', month:'2-digit', day:'2-digit', hour:'numeric', minute:'2-digit', hour12:true });
}

function getFieldsFromForm() {
  const fields = {};
  FORM_FIELD_NAMES.forEach(name => {
    const raw = (form[name]||'').trim();
    if (!raw) return;
    if (ARRAY_FIELDS.has(name)) {
      const arr = raw.split(',').map(s=>s.trim()).filter(Boolean);
      if (arr.length) fields[name] = arr;
    } else {
      fields[name] = raw;
    }
  });
  return fields;
}

function clearForm() {
  FORM_FIELD_NAMES.forEach(name => { form[name] = ''; });
}

function openAddModal() {
  currentEditId = null;
  clearForm();
  addModal.isEdit = false;
  bsAddModal?.show();
}

function openEditModal(record) {
  currentEditId = record.id;
  FORM_FIELD_NAMES.forEach(name => {
    const v = record.fields[name];
    form[name] = Array.isArray(v) ? v.join(', ') : (v||'');
  });
  addModal.isEdit = true;
  bsAddModal?.show();
}

async function saveCandidate() {
  addModal.saving = true;
  const fields = getFieldsFromForm();
  try {
    openModal("<span class='processSpin-wrap'><i class='bi bi-arrow-repeat spin-icon'></i></span> Processing... Please wait.");
    if (currentEditId) {
      const updated = await updateRecord(TABLES.CANDIDATES, currentEditId, fields);
      const idx = allCandidates.value.findIndex(r => r.id === currentEditId);
      if (idx > -1) allCandidates.value[idx].fields = updated.fields;
      filteredCandidates.value = [...allCandidates.value];
      applyFilters();
      bsAddModal?.hide();
      openModal('✅ Candidate updated successfully.');
    } else {
      const created = await createRecord(TABLES.CANDIDATES, fields);
      allCandidates.value.unshift(created);
      filteredCandidates.value = [...allCandidates.value];
      applyFilters();
      bsAddModal?.hide();
      openModal('✅ Candidate added successfully.');
    }
  } catch(e) {
    console.error('Save failed:', e);
    openModal('❌ Save failed. Please try again.');
  } finally {
    addModal.saving = false;
    currentEditId = null;
  }
}

function confirmDelete(id) {
  currentDeleteId = id;
  bsDeleteModal?.show();
}

async function doDelete() {
  if (!currentDeleteId) return;
  deleteModal.deleting = true;
  try {
    bsDeleteModal?.hide();
    openModal("<i class='bi bi-arrow-repeat spin-icon'></i> Deleting related records... Please wait.");
    await deleteRecord(TABLES.CANDIDATES, currentDeleteId);
    // Cascade delete related records
    await Promise.all([
      deleteRecordsByFormula(TABLES.CANDIDATE_APPLICATIONS, `{candidate_id}="${currentDeleteId}"`),
      deleteRecordsByFormula(TABLES.CANDIDATE_INTERVIEWS,   `{candidate_id}="${currentDeleteId}"`),
      deleteRecordsByFormula(TABLES.MATCHED_RESUMES,        `{candidate_id}="${currentDeleteId}"`),
    ]);
    allCandidates.value = allCandidates.value.filter(r => r.id !== currentDeleteId);
    filteredCandidates.value = filteredCandidates.value.filter(r => r.id !== currentDeleteId);
    openModal('✅ Deleted successfully.');
  } catch(e) {
    console.error('Delete failed:', e);
    openModal('❌ Something went wrong. Please try again.');
  } finally {
    deleteModal.deleting = false;
    currentDeleteId = null;
  }
}

// ─── Status Change ────────────────────────────────────────────────────────────
async function fetchStatuses() {
  try {
    const records = await fetchAllRecords(TABLES.STATUSES, [], { sort:[{field:'status', direction:'asc'}] });
    allStatuses = records;
    candidateStatuses.value = records.filter(r =>
      r.fields.entity_type && r.fields.entity_type.trim().toLowerCase() === 'candidate'
    ).map(r => r.fields);
  } catch(e) { console.error('Error fetching statuses:', e); }
}

function openStatusModal(record) {
  statusModal.recordId      = record.id;
  statusModal.candidateName = record.fields['Candidate Name'] || '';
  statusModal.currentStatus = record.fields['CandidateStatus'] || '';
  statusModal.selectedStatus= record.fields['CandidateStatus'] || '';
  statusModal.visible       = true;
}
function closeStatusModal() { statusModal.visible = false; }

async function updateCandidateStatus() {
  statusModal.updating = true;
  try {
    await updateRecord(TABLES.CANDIDATES, statusModal.recordId, { CandidateStatus: statusModal.selectedStatus });
    const rec = allCandidates.value.find(r => r.id === statusModal.recordId);
    if (rec) rec.fields['CandidateStatus'] = statusModal.selectedStatus;
    closeStatusModal();
    openModal('✅ Status updated successfully.');
  } catch(e) {
    console.error('Status update failed:', e);
    openModal('❌ Status update failed. Please try again.');
  } finally {
    statusModal.updating = false;
  }
}

// ─── Google Drive / Upload ────────────────────────────────────────────────────
function loadGoogleScripts() {
  return new Promise(resolve => {
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) { console.error('Auth failed:', tokenResponse); return; }
          window.gapi.client.setToken(tokenResponse);
          if (uploadBtnDisabled.value === false) {
            // was pending, now trigger
            await handleFileUpload();
          }
          updateUploadBtn();
        },
      });
      gisInited = true;
      updateUploadBtn();
    };
    document.head.appendChild(gisScript);

    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
        gapiInited = true;
        updateUploadBtn();
      });
    };
    document.head.appendChild(gapiScript);
  });
}

function updateUploadBtn() {
  if (gapiInited && gisInited) {
    uploadBtnDisabled.value = false;
    statusMsg.value = '✅ Ready to upload files!';
  }
}

function onFilesSelected(e) {
  const files = Array.from(e.target.files || []);
  const allowed = ['.pdf', '.docx'];
  const validFiles = files.filter(f => allowed.some(ext => f.name.toLowerCase().endsWith(ext)));
  if (validFiles.length !== files.length) {
    openModal('Only .pdf or .docx files are allowed.', 'Alert!');
    e.target.value = '';
    selectedFiles.value = [];
    return;
  }
  selectedFiles.value = validFiles;
}

function onLogoSelected(e) {
  const file = e.target.files[0];
  if (file && !file.type.startsWith('image/')) {
    openModal('Only image files are allowed.', 'Alert!');
    e.target.value = '';
    selectedLogoFile = null;
    return;
  }
  selectedLogoFile = file || null;
}

async function handleFileUpload() {
  if (!selectedFiles.value.length) {
    openModal('❌ Please select files to upload.', 'Alert!');
    return;
  }
  if (!dontUseAddrLogo.value) {
    if (!addressOption.value || !logoOption.value) {
      openModal('❌ Please select both logo and address options before submitting.', 'Alert!');
      return;
    }
    if (addressOption.value === 'custom' && !customAddress.value.trim()) {
      openModal('❌ Please enter a custom address before submitting.', 'Alert!');
      return;
    }
    if (logoOption.value === 'custom' && !selectedLogoFile) {
      openModal('❌ Please select a logo file before submitting.', 'Alert!');
      return;
    }
  }

  const token = window.gapi?.client?.getToken();
  if (!token || token.expires_at < Date.now() / 1000) {
    statusMsg.value = 'Click the Upload & Process Resumes button to authorize Google Drive access and proceed further...';
    tokenClient.requestAccessToken({ prompt:'' });
    return;
  }

  openModal("<i class='bi bi-arrow-repeat spin-icon'></i> Uploading file(s)... Please wait.");
  uploadBtnDisabled.value = true;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < selectedFiles.value.length; i++) {
    const file = selectedFiles.value[i];
    progressMsg.value = `📤 Uploading ${i+1} of ${selectedFiles.value.length}: ${file.name}`;
    try {
      const result = await uploadFileToGoogleDrive(file);
      uploadedFileName = file.name;
      uploadedFileId   = result.id;
      await postCompanyAddressAndLogo(uploadedFileName, uploadedFileId);
      successCount++;
      statusMsg.value = `✅ Uploaded: ${file.name}`;
    } catch(e) {
      console.error('Upload failed:', e);
      failCount++;
      statusMsg.value = `❌ Failed to upload: ${file.name}. Error: ${e.message}`;
    }
  }

  selectedFiles.value = [];
  if (failCount === 0) {
    statusMsg.value = `🎉 Successfully uploaded all ${successCount} file(s)!`;
    progressMsg.value = '✅ Upload complete!';
    openModal("<i class='bi bi-arrow-repeat spin-icon'></i> Processing... Please wait.");
    await triggerN8nWorkflow();
  } else {
    openModal(`⚠️ Upload completed with errors. ${successCount} succeeded, ${failCount} failed.`);
    statusMsg.value = `⚠️ Upload complete: ${successCount} succeeded, ${failCount} failed`;
    progressMsg.value = '';
  }
  uploadBtnDisabled.value = false;
}

function uploadFileToGoogleDrive(file) {
  return new Promise((resolve, reject) => {
    const accessToken = window.gapi.client.getToken().access_token;
    const folderId = companyFor.value === 'offshore' ? OFFSHORE_FOLDER : ONSHORE_FOLDER;
    const metadata = { name: file.name, parents: [folderId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type:'application/json' }));
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.onload = () => {
      if (xhr.status === 200) { resolve(JSON.parse(xhr.responseText)); }
      else {
        let msg = `HTTP ${xhr.status}`;
        try { msg = JSON.parse(xhr.responseText).error?.message || msg; } catch(_){}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.upload.onprogress = e => {
      if (e.lengthComputable)
        progressMsg.value = `📤 Uploading: ${file.name} - ${Math.round((e.loaded/e.total)*100)}%`;
    };
    xhr.send(form);
  });
}

async function postCompanyAddressAndLogo(fileName, fileId) {
  try {
    const companyAddress = addressOption.value === 'custom'
      ? customAddress.value.trim()
      : addressDisplay.value;

    let fields;
    if (dontUseAddrLogo.value) {
      fields = {
        'initial file name': fileName,
        'resumes file ids':  fileId,
        'company for':       companyFor.value,
        'custom address':    'none',
        'custom logo':       'none',
        'resume_template':   resumeTemplate.value,
      };
    } else {
      fields = {
        'initial file name': fileName,
        'resumes file ids':  fileId,
        'company for':       companyFor.value,
        'custom address':    addressOption.value,
        'custom logo':       logoOption.value,
        'company address':   companyAddress,
        'resume_template':   resumeTemplate.value,
      };
    }

    const rec = await createRecord(TABLES.CANDIDATES, fields);
    lastCreatedRecordId = rec.id;

    // Upload custom logo as Airtable attachment if selected
    if (!dontUseAddrLogo.value && logoOption.value === 'custom' && selectedLogoFile) {
      const base64File = await fileToBase64(selectedLogoFile);
      const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
      const attachUrl = `https://content.airtable.com/v0/${baseId}/${rec.id}/attached%20logo/uploadAttachment`;
      const res = await fetch(attachUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType: selectedLogoFile.type,
          file: base64File,
          filename: selectedLogoFile.name,
        }),
      });
      if (!res.ok) console.error('Logo attachment upload failed:', res.status);
    }
  } catch(e) { console.error('Error creating placeholder record:', e); }
}

async function triggerN8nWorkflow() {
  const webhookUrl = companyFor.value === 'offshore' ? PROCESS_RESUME_CONFIG.offshore : PROCESS_RESUME_CONFIG.onshore;
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastCreatedRecordId: lastCreatedRecordId || null }),
    });
    if (!response.ok) throw new Error(`n8n error: ${response.status}`);
    setTimeout(() => {
      loadCandidates();
      openModal('✅ Successfully processed!');
      statusMsg.value = '✅ Successfully uploaded & processed!';
      lastCreatedRecordId = null;
    }, 10000);
  } catch(e) {
    console.error('n8n error:', e);
    setTimeout(() => {
      loadCandidates();
      openModal('✅ Successfully processed!');
      statusMsg.value = '✅ Successfully uploaded & processed!';
    }, 10000);
  }
}

function openOriginalResumes() {
  const url = companyFor.value === 'offshore' ? DRIVE_CONFIG.originalFolderUrl_OffShore_India : DRIVE_CONFIG.originalFolderUrl_Onshore_USA;
  window.open(url, '_blank');
}
function openFormattedResumes() {
  const url = companyFor.value === 'offshore' ? DRIVE_CONFIG.formattedFolderUrl_Offshore_India : DRIVE_CONFIG.formattedFolderUrl_Onshore_USA;
  window.open(url, '_blank');
}

// ─── Base64 helper ────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Click-outside ─────────────────────────────────────────────────────────────
function onDocClick(e) {
  if (!e.target.closest('.filter-dropdown')) openFilterKey.value = null;
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  document.addEventListener('click', onDocClick);
  // Init Bootstrap modals
  bsAddModal    = new window.bootstrap.Modal(document.getElementById('addCandidateModal'));
  bsDeleteModal = new window.bootstrap.Modal(document.getElementById('deleteCandidateModal'));
  // Load data in parallel
  await Promise.all([loadCandidates(), fetchStatuses()]);
  // Load Google APIs
  loadGoogleScripts();
  // Restore filter if navigated from dashboard — match case-insensitively against actual field values
  const savedStatuses = JSON.parse(localStorage.getItem('selectedStatuses') || '[]');
  if (savedStatuses.length) {
    const actualValues = [...new Set(allCandidates.value.map(r => r.fields['CandidateStatus']).filter(Boolean))];
    const matched = actualValues.filter(v => savedStatuses.includes(v.toLowerCase().trim()));
    activeFilters.status = matched.length ? matched : savedStatuses;
    applyFilters();
  }
  localStorage.removeItem('selectedStatuses');
  localStorage.removeItem('selectedType');
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
});
</script>

<template>
  <div>
    <!-- ─── Header ─── -->
    <div style="margin-bottom:16px;">
      <h1 class="section-title">Candidate Resume Management</h1>
    </div>

    <!-- ─── Upload Section (9fr/3fr) ─── -->
    <div style="display:grid;grid-template-columns:9fr 3fr;gap:20px;margin-bottom:24px;">

      <!-- Upload Card -->
      <div class="section-card">
        <!-- Company + Template Row -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;padding:10px;border-bottom:1px solid #e7e6e6;">
          <div style="display:flex;align-items:center;gap:20px;">
            <label style="font-weight:600;color:#1F2937;margin:0;">Choose company for:</label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="radio" name="companyFor" value="offshore" v-model="companyFor" /> Offshore (India)
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="radio" name="companyFor" value="onshore" v-model="companyFor" /> Onshore (USA)
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <label style="font-weight:600;color:#1F2937;margin:0;">Resume Template:</label>
            <select v-model="resumeTemplate" style="padding:2px 12px;border:1px solid #7dbeda;border-radius:5px;font-size:14px;background:#f5fcff;min-width:140px;">
              <option value="simple">Simple</option>
              <option value="modern">Modern</option>
              <option value="creative">Creative</option>
            </select>
            <a href="https://drive.google.com/file/d/1bLlRIIyn01sKzeGEERoUihlohQEO-8r8/view" target="_blank">
              <i class="bi bi-info-circle" title="Show resume template formats"></i>
            </a>
          </div>
        </div>

        <!-- Upload Area -->
        <div style="padding:10px;">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#1976d2;margin-bottom:10px;">
            <i class="bi bi-upload" style="color:orange;"></i>
            Upload Resume(s)
            <span style="font-size:13px;font-weight:400;color:#d50e0e;">( Please upload .pdf or .docx files only. )</span>
          </h3>
          <input type="file" class="form-control" multiple accept=".pdf,.docx" @change="onFilesSelected" style="margin-bottom:10px;" />

          <!-- Don't use address/logo toggle -->
          <div style="margin-bottom:12px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:15px;font-weight:600;color:#1F2937;">
              <input type="checkbox" v-model="dontUseAddrLogo" /> Don't use address and logo
            </label>
          </div>

          <!-- Address + Logo section (hidden when dontUseAddrLogo) -->
          <div v-if="!dontUseAddrLogo" style="border:1px solid #e9e6e6;border-radius:16px;padding:15px;margin-bottom:12px;">
            <!-- Company Address -->
            <h4 style="font-size:15px;font-weight:700;color:#1976d2;margin-bottom:10px;">Company Address</h4>
            <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px;">
              <label v-for="opt in [{val:'india',lbl:'India Office'},{val:'usa',lbl:'USA Office'},{val:'custom',lbl:'Custom Address'},{val:'none',lbl:'No Address'}]" :key="opt.val"
                style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="radio" name="addressOption" :value="opt.val" v-model="addressOption" /> {{ opt.lbl }}
              </label>
            </div>
            <div v-if="addressOption !== 'none' && addressOption !== 'custom'" style="background:#f2f8fc;border:1px solid #bbdefb;border-radius:6px;padding:8px;margin-bottom:8px;font-size:14px;">
              {{ addressDisplay }}
            </div>
            <div v-if="addressOption === 'custom'" style="margin-bottom:8px;">
              <textarea v-model="customAddress" rows="1" class="form-control" placeholder="Enter company address..."></textarea>
            </div>

            <!-- Logo Customization -->
            <h4 style="font-size:15px;font-weight:700;color:#1976d2;margin-bottom:10px;margin-top:12px;">Logo Customization</h4>
            <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px;">
              <label v-for="opt in [{val:'default',lbl:'Use Default TIU Logo'},{val:'custom',lbl:'Upload Custom Logo'},{val:'none',lbl:'No Logo'}]" :key="opt.val"
                style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="radio" name="logoOption" :value="opt.val" v-model="logoOption" /> {{ opt.lbl }}
              </label>
            </div>
            <div v-if="logoOption === 'custom'">
              <input type="file" accept="image/*" class="form-control" @change="onLogoSelected" style="font-size:14px;" />
            </div>
          </div>

          <!-- Status + Progress -->
          <div style="font-size:13px;padding:5px;border-radius:8px;background:#f2f8fc;color:#1976d2;border:1px solid #bbdefb;margin-bottom:6px;text-align:center;">{{ statusMsg }}</div>
          <div v-if="progressMsg" style="font-size:13px;padding:5px;border-radius:8px;background:#f3fff3;color:#388e3c;border:1px solid #c8e6c9;margin-bottom:6px;text-align:center;">{{ progressMsg }}</div>

          <!-- Upload Button -->
          <button @click="handleFileUpload" :disabled="uploadBtnDisabled"
            style="background:#4285f4;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;"
            :style="uploadBtnDisabled ? 'background:#ccc;cursor:not-allowed;' : ''">
            Upload &amp; Process Resumes
          </button>
        </div>
      </div>

      <!-- Drive Folders Card -->
      <div class="section-card">
        <h3 style="font-size:16px;font-weight:700;color:#1976d2;padding:10px;border-bottom:1px solid #e5e7eb;margin:0;">Resumes Locations</h3>
        <div style="padding:10px;display:flex;flex-direction:column;gap:12px;">
          <div class="folder-card" @click="openOriginalResumes">
            <div>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CD7A5C" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;color:#1F2937;">Original Resumes</div>
              <div style="font-size:12px;color:#6B7280;">Raw uploaded files</div>
            </div>
            <i class="bi bi-chevron-right" style="color:#9CA3AF;"></i>
          </div>
          <div class="folder-card" @click="openFormattedResumes">
            <div>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;color:#1F2937;">Formatted Resumes</div>
              <div style="font-size:12px;color:#6B7280;">Processed &amp; standardized</div>
            </div>
            <i class="bi bi-chevron-right" style="color:#9CA3AF;"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Candidates List Section ─── -->
    <div style="margin-bottom:16px;">
      <h1 class="section-title">Candidates</h1>
      <p style="font-size:15px;color:#6B7280;margin:0;">
        Represents information about Candidates
        <span style="font-weight:700;">( Total Candidates : {{ totalCandidates }} )</span>
      </p>
    </div>

    <!-- Search + Buttons -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
      <div style="position:relative;flex:1;">
        <i class="bi bi-search" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:orange;"></i>
        <input v-model="searchInput" @input="applyFilters" type="text" class="form-control" placeholder="Search candidates..." style="padding-left:10px;border-radius:8px;" />
      </div>
      <button class="btn btn-primary" @click="resetFilters" style="background:#4285f4;font-size:14px;padding:5px 10px;display:flex;align-items:center;gap:5px;">
        <i class="bi bi-arrow-clockwise"></i> Reset Filters
      </button>
      <button class="btn btn-primary" @click="loadCandidates" style="background:#4285f4;font-size:14px;padding:5px 10px;display:flex;align-items:center;gap:5px;">
        <i class="bi bi-arrow-repeat"></i> Reload Data
      </button>
      <button class="btn btn-success" @click="openAddModal" style="background:#3367d6;font-size:14px;padding:5px 10px;display:none;align-items:center;gap:5px;">
        <i class="bi bi-person-plus"></i> Add Candidate
      </button>
    </div>

    <div class="section-card" style="border:1px solid #b6e0ed;padding:20px;">
      <!-- Filters -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px;">
        <div v-for="(field, key) in FILTER_FIELDS" :key="key" class="filter-dropdown" :class="{active: openFilterKey===key}">
          <button class="filter-btn" :class="{'has-selection': activeFilters[key].length}" @click.stop="toggleFilter(key)">
            {{ field === 'CandidateStatus' ? 'Candidate Status' : field }}
            {{ activeFilters[key].length ? `(${activeFilters[key].length})` : '' }}
            <span style="margin-left:8px;font-size:14px;color:#717271;">▼</span>
          </button>
          <div class="filter-menu" v-show="openFilterKey===key">
            <input type="text" class="form-control form-control-sm mb-2 filter-search" placeholder="Search..."
              v-model="filterSearch[key]" @click.stop style="font-size:13px;" />
            <label v-for="opt in filterOptions[key].filter(o => !filterSearch[key] || o.toLowerCase().includes(filterSearch[key].toLowerCase()))"
              :key="opt" style="display:flex;align-items:center;padding:6px 8px;cursor:pointer;font-size:13px;border-radius:6px;" class="filter-label">
              <input type="checkbox" :checked="activeFilters[key].includes(opt)" @change="toggleFilterVal(key, opt)" style="margin-right:8px;width:16px;height:16px;" />
              {{ opt }}
            </label>
            <div v-if="!filterOptions[key].length" style="padding:8px;color:#999;font-size:13px;">No options</div>
          </div>
        </div>
      </div>

      <!-- Loader -->
      <div v-if="listLoading" class="text-center my-4">
        <div class="spinner-border text-warning" role="status"></div>
        <p class="mt-2 text-muted">Fetching candidates...</p>
      </div>

      <!-- Candidate Cards -->
      <div v-else>
        <div v-if="!pagedRows.length" style="text-align:center;padding:40px;color:#999;">
          No candidates found matching your filters.
        </div>

        <div v-for="record in pagedRows" :key="record.id" class="candidate-card">
          <div class="row w-100 align-items-center row-details" style="cursor:pointer;" @click="toggleCard(record.id)">
            <div class="col-md-2" style="font-weight:600;">
              {{ record.fields['Candidate Name'] || '-' }}
            </div>
            <div class="col-md-2">
              <span class="badge-status" @click.stop="openStatusModal(record)" title="Change Status" style="cursor:pointer;">
                {{ record.fields['CandidateStatus'] || 'Active' }}
              </span>
            </div>
            <div class="col-md-3">
              <span class="text-muted" style="font-weight:500;">{{ record.fields['Total Experience'] || '-' }}</span>
            </div>
            <div class="col-md-3">
              <span class="text-muted" style="font-weight:500;">{{ record.fields['Current Role'] || '-' }}</span>
            </div>
            <div class="col-md-2 d-flex gap-2 justify-content-end">
              <button @click.stop="openEditModal(record)" class="btn btn-sm" style="background:none;border:none;padding:0;color:#006db6;cursor:pointer;font-size:18px;" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button @click.stop="confirmDelete(record.id)" class="btn btn-sm" style="background:none;border:none;padding:0;color:#FF6F21;cursor:pointer;font-size:18px;" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
              <span class="toggle-icon">
                {{ expandedIds.has(record.id) ? '▲ Hide' : '▼ Show' }}
              </span>
            </div>
          </div>

          <!-- Expanded Details -->
          <div v-if="expandedIds.has(record.id)" style="padding-top:12px;">
            <table class="table table-sm mb-0">
              <tbody>
                <tr><th style="width:18%;">Email | Phone</th><td>{{ record.fields['gmail'] || '-' }} | {{ record.fields['Phone'] || '-' }}</td></tr>
                <tr>
                  <th>Processed Document</th>
                  <td>
                    <a v-if="record.fields['Formatted url']" :href="record.fields['Formatted url']" target="_blank">View Formatted Resume</a>
                    <span v-else>N/A</span>
                  </td>
                </tr>
                <tr>
                  <th>Original Document</th>
                  <td>
                    <a v-if="record.fields['Source File ID']" :href="`https://drive.google.com/file/d/${record.fields['Source File ID']}/view`" target="_blank">View Original Resume</a>
                    <span v-else>N/A</span>
                  </td>
                </tr>
                <tr><th>Professional Summary</th><td>{{ record.fields['Professional Summary'] || '-' }}</td></tr>
                <tr><th>Current Company</th><td>{{ record.fields['Current Company'] || '-' }}</td></tr>
                <tr><th>Key Skills</th>
                  <td><span v-for="s in (record.fields['Key Skills']||[])" :key="s" class="tag">{{ s }}</span></td>
                </tr>
                <tr><th>Methodologies</th>
                  <td><span v-for="m in (record.fields['Methodologies']||[])" :key="m" class="tag">{{ m }}</span></td>
                </tr>
                <tr><th>Frameworks &amp; Libraries</th>
                  <td><span v-for="f in (record.fields['Frameworks and Libraries']||[])" :key="f" class="tag">{{ f }}</span></td>
                </tr>
                <tr><th>Databases</th>
                  <td><span v-for="d in (record.fields['Databases']||[])" :key="d" class="tag">{{ d }}</span></td>
                </tr>
                <tr><th>Certifications</th>
                  <td><span v-for="c in (record.fields['Certifications']||[])" :key="c" class="tag">{{ c }}</span></td>
                </tr>
                <tr><th>Programming Languages</th>
                  <td><span v-for="p in (record.fields['Programming Languages']||[])" :key="p" class="tag">{{ p }}</span></td>
                </tr>
                <tr><th>Tools &amp; Platforms</th>
                  <td><span v-for="t in (record.fields['Tools and Platforms']||[])" :key="t" class="tag">{{ t }}</span></td>
                </tr>
                <tr><th>Created At | Updated At</th>
                  <td>{{ formatDate(record.fields['Date']) }} | {{ formatDate(record.fields['updated_at']) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination-controls" style="justify-content:flex-end;">
          <button @click="currentPage=1" :disabled="currentPage===1">First</button>
          <button @click="currentPage--" :disabled="currentPage===1">Prev</button>
          <button v-for="p in visiblePages" :key="p" :class="{active:currentPage===p}" @click="currentPage=p">{{ p }}</button>
          <button @click="currentPage++" :disabled="currentPage===totalPages">Next</button>
          <button @click="currentPage=totalPages" :disabled="currentPage===totalPages">Last</button>
        </div>
      </div>
    </div>

    <!-- ─── ADD/EDIT CANDIDATE MODAL ─── -->
    <div class="modal fade" id="addCandidateModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header">
            <h5 class="modal-title">{{ addModal.isEdit ? 'Edit Candidate' : 'Add Candidate' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label">Candidate Name *</label>
                <input v-model="form['Candidate Name']" type="text" class="form-control" /></div>
              <div class="col-md-6"><label class="form-label">Current Company</label>
                <input v-model="form['Current Company']" type="text" class="form-control" /></div>
              <div class="col-md-6"><label class="form-label">Current Role</label>
                <input v-model="form['Current Role']" type="text" class="form-control" /></div>
              <div class="col-md-6"><label class="form-label">Total Experience</label>
                <input v-model="form['Total Experience']" type="text" class="form-control" placeholder="e.g. 8 years" /></div>
              <div class="col-md-6"><label class="form-label">Status</label>
                <select v-model="form['CandidateStatus']" class="form-select">
                  <option value="">-- Select Status --</option>
                  <option v-for="s in candidateStatuses" :key="s.status_id" :value="s.status">{{ s.status }}</option>
                </select>
              </div>
              <div class="col-12"><label class="form-label">Key Skills</label>
                <input v-model="form['Key Skills']" type="text" class="form-control" placeholder="Comma separated e.g. SQL, Python, AWS" /></div>
              <div class="col-12"><label class="form-label">Professional Summary</label>
                <textarea v-model="form['Professional Summary']" rows="4" class="form-control"></textarea></div>
              <div class="col-12"><label class="form-label">Programming Languages</label>
                <input v-model="form['Programming Languages']" type="text" class="form-control" placeholder="Comma separated e.g. Python, JavaScript" /></div>
              <div class="col-12"><label class="form-label">Frameworks and Libraries</label>
                <input v-model="form['Frameworks and Libraries']" type="text" class="form-control" placeholder="Comma separated e.g. React, Django" /></div>
              <div class="col-12"><label class="form-label">Tools and Platforms</label>
                <input v-model="form['Tools and Platforms']" type="text" class="form-control" placeholder="Comma separated e.g. JIRA, AWS, GitHub" /></div>
              <div class="col-12"><label class="form-label">Methodologies</label>
                <input v-model="form['Methodologies']" type="text" class="form-control" placeholder="Comma separated e.g. Scrum, SAFe, Kanban" /></div>
              <div class="col-12"><label class="form-label">Databases</label>
                <input v-model="form['Databases']" type="text" class="form-control" placeholder="Comma separated e.g. SQL Server, Oracle, PostgreSQL" /></div>
              <div class="col-12"><label class="form-label">Certifications</label>
                <input v-model="form['Certifications']" type="text" class="form-control" placeholder="Comma separated e.g. AWS Certified, PMP" /></div>
              <div class="col-12"><label class="form-label">Processed Document URL</label>
                <input v-model="form['Formatted url']" type="url" class="form-control" placeholder="Google Doc or PDF link" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-success" style="background:#3367d6;" @click="saveCandidate" :disabled="addModal.saving">
              {{ addModal.saving ? 'Saving...' : (addModal.isEdit ? 'Save Changes' : 'Save Candidate') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── DELETE CONFIRMATION MODAL ─── -->
    <div class="modal fade" id="deleteCandidateModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header"><h5 class="modal-title">Delete Record</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            You are about to delete this candidate. Are you sure?
            <div style="color:#cf7e7e;font-size:13px;margin-top:6px;">All candidate-related information will also be deleted.</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" style="background:#cd7140;" @click="doDelete" :disabled="deleteModal.deleting">
              {{ deleteModal.deleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── CHANGE STATUS MODAL ─── -->
    <div v-if="statusModal.visible" class="web-process-modal" style="display:flex;">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="closeStatusModal">&times;</span>
        <h3>Change Candidate Status</h3>
        <div class="mb-3">
          <strong>Candidate:</strong> {{ statusModal.candidateName }}
        </div>
        <div class="mb-3">
          <label class="form-label">Change Status</label>
          <select v-model="statusModal.selectedStatus" class="form-select">
            <option v-for="s in candidateStatuses" :key="s.status_id" :value="s.status">{{ s.status }}</option>
          </select>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button class="btn btn-secondary btn-sm" @click="closeStatusModal">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="updateCandidateStatus" :disabled="statusModal.updating">
            {{ statusModal.updating ? 'Updating...' : 'Update' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ─── RESULT MODAL ─── -->
    <div v-if="resultModal.visible" class="web-process-modal" style="display:flex;">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="closeModal">&times;</span>
        <h3>{{ resultModal.title }}</h3>
        <div v-html="resultModal.message" style="font-size:15px;"></div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.folder-card {
  display: flex; align-items: center; gap: 8px; padding: 10px;
  border: 1px solid #dadada; border-radius: 10px; cursor: pointer;
  transition: all 0.3s ease; background: #FAFBFC;
}
.folder-card:hover { border-color: #CD7A5C; background: white; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(205,122,92,0.15); }
.candidate-card { border: 0.5px solid #d7ecf5; border-radius: 5px; padding: 4px 10px; margin-bottom: 10px; background: #f5fcff; }
.badge-status { background: rgb(126 181 212 / 20%); font-size: 12px; padding: 2px 6px; border-radius: 6px; border: 0.5px solid #a3c0d3; }
.toggle-icon { cursor: pointer; color: #0d6efd; font-size: 14px; font-weight: 500; white-space: nowrap; }
.tag { display: inline-block; background: #f2f2f2; border-radius: 6px; padding: 1px 4px; font-size: 14px; margin: 1px; }
.filter-dropdown { position: relative; }
.filter-btn {
  padding: 5px 14px; border: 1px solid #d1d5db; background: #fff;
  border-radius: 8px; cursor: pointer; min-width: 150px; text-align: left; font-size: 14px; white-space: nowrap;
  transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.filter-btn:hover { border-color: #90caf9; background: #f8fbff; transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
.filter-btn.has-selection { background: #e3f2fd; border-color: #90caf9; font-weight: 600; }
.filter-label:hover { background: #f3f4f6; }
.filter-menu {
  position: absolute; top: 110%; left: 0; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 220px; max-height: 280px;
  overflow-y: auto; z-index: 1000; padding: 10px;
}
.pagination-controls { display: flex; gap: 6px; margin-top: 12px; }
.pagination-controls button {
  border: none; background: #b9cde1; color: #071d38;
  padding: 4px 12px; border-radius: 5px; cursor: pointer; font-size: 14px;
}
.pagination-controls button:hover { background: #3367d6; color: #fff; }
.pagination-controls button.active { background: #3367d6; color: white; }
.pagination-controls button:disabled { opacity: 0.5; cursor: not-allowed; }
.web-process-modal {
  display: none; position: fixed; inset: 0; z-index: 1200;
  background-color: rgba(0,0,0,0.5); justify-content: center; align-items: center;
}
.web-modal-content {
  background: #fff; padding: 20px; border-radius: 10px; width: 360px;
  max-width: 90%; box-shadow: 0 5px 20px rgba(0,0,0,0.3); position: relative;
}
.web-close-btn { float: right; font-size: 22px; font-weight: bold; cursor: pointer; position: absolute; right: 7px; top: 1px; }
.web-modal-content h3 { margin-top: -5px; color: #1976d2; font-weight: 500; border-bottom: 1px solid #1976d2; padding-bottom: 5px; font-size: 16px; margin-bottom: 20px; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spin-icon { animation: spin 1s linear infinite; display: inline-block; }
</style>
