<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { fetchAllRecords, createRecord, updateRecord, deleteRecord, TABLES } from '@/services/airtableService.js';
import { getCountryList, getStatesForCountry, getAllStates } from '@/utils/countries.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
const SEARCHABLE_FIELDS = ['client_id', 'company_name', 'contact_person', 'contact_number', 'email', 'city', 'state', 'country'];

// ─── State ────────────────────────────────────────────────────────────────────
const allClients      = ref([]);
const filteredClients = ref([]);
const currentPage     = ref(1);
const isLoading       = ref(true);

// Filter state
const searchTerm   = ref('');
const activeFilters = reactive({ country: [], state: [], status: [] });
const openFilterKey = ref(null);
const filterSearch  = reactive({ country: '', state: '', status: '' });

// Countries / states
const countryList  = getCountryList();
const allStateList = getAllStates();

// Modal state
const modal = reactive({
  status: false,
  result: false,
  resultMsg: '',
  resultTitle: 'Status',
});

// Form state
const form = reactive({
  recordId: '',
  company_name: '',
  contact_person: '',
  contact_number: '',
  email: '',
  status: 'Active',
  country: '',
  state: '',
  city: '',
  zip_code: '',
  address_line_1: '',
  address_line_2: '',
});

const formStates = ref([]);
const isEditMode = ref(false);
const isSaving   = ref(false);

// Delete
const deleteClientId = ref(null);
const isDeleting     = ref(false);

// Status change
const statusChangeClientId   = ref(null);
const statusChangeClientName = ref('');
const statusChangeValue      = ref('Active');
const isUpdatingStatus       = ref(false);

// Expand/collapse details per card
const expandedCards = ref(new Set());

// Bootstrap modal instances
let bsAddModal    = null;
let bsDeleteModal = null;

// ─── Computed ─────────────────────────────────────────────────────────────────
const totalPages = computed(() => Math.max(1, Math.ceil(filteredClients.value.length / PAGE_SIZE)));

const paginatedClients = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return filteredClients.value.slice(start, start + PAGE_SIZE);
});

const pageButtons = computed(() => {
  const total = totalPages.value;
  let start = Math.max(1, currentPage.value - 2);
  let end   = Math.min(total, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

const filteredCountries = computed(() =>
  countryList.filter(c => c.toLowerCase().includes(filterSearch.country.toLowerCase()))
);
const filteredStates = computed(() =>
  allStateList.filter(s => s.toLowerCase().includes(filterSearch.state.toLowerCase()))
);
const filteredStatuses = computed(() =>
  ['Active', 'Inactive'].filter(s => s.toLowerCase().includes(filterSearch.status.toLowerCase()))
);

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadClients();
  document.addEventListener('click', handleOutsideClick);
});

// ─── Data Fetching ────────────────────────────────────────────────────────────
async function loadClients() {
  isLoading.value = true;
  try {
    const records = await fetchAllRecords(TABLES.CLIENTS, [], {
      sort: [{ field: 'company_name', direction: 'asc' }],
    });
    allClients.value = records;
    applyFilters();
  } catch (err) {
    console.error('Error fetching clients:', err);
    showResult('❌ Failed to load clients: ' + err.message);
  } finally {
    isLoading.value = false;
  }
}

async function reloadData() {
  searchTerm.value = '';
  activeFilters.country = [];
  activeFilters.state   = [];
  activeFilters.status  = [];
  filterSearch.country  = '';
  filterSearch.state    = '';
  filterSearch.status   = '';
  openFilterKey.value   = null;
  await loadClients();
}

// ─── Filtering & Searching ────────────────────────────────────────────────────
function applyFilters() {
  const term = searchTerm.value.trim().toLowerCase();
  filteredClients.value = allClients.value.filter(rec => {
    const f = rec.fields || {};
    if (activeFilters.country.length && !activeFilters.country.includes(f.country)) return false;
    if (activeFilters.state.length   && !activeFilters.state.includes(f.state))     return false;
    if (activeFilters.status.length  && !activeFilters.status.includes(f.status))   return false;
    if (!term) return true;
    return SEARCHABLE_FIELDS.some(field => {
      const val = f[field];
      return val && String(val).toLowerCase().includes(term);
    });
  });
  currentPage.value = 1;
}

function resetFilters() {
  searchTerm.value      = '';
  activeFilters.country = [];
  activeFilters.state   = [];
  activeFilters.status  = [];
  filterSearch.country  = '';
  filterSearch.state    = '';
  filterSearch.status   = '';
  openFilterKey.value   = null;
  filteredClients.value = allClients.value.slice();
  currentPage.value = 1;
}

function toggleFilter(key) {
  openFilterKey.value = openFilterKey.value === key ? null : key;
}

function handleOutsideClick(e) {
  if (!e.target.closest('.filter-dropdown')) {
    openFilterKey.value = null;
  }
}

function isFilterOpen(key) { return openFilterKey.value === key; }

function onCheckboxChange(key, value, checked) {
  if (checked) {
    if (!activeFilters[key].includes(value)) activeFilters[key].push(value);
  } else {
    activeFilters[key] = activeFilters[key].filter(v => v !== value);
  }
  applyFilters();
}

function hasSelection(key) { return activeFilters[key].length > 0; }

// ─── Card Expand / Collapse ───────────────────────────────────────────────────
function toggleCard(id) {
  const s = new Set(expandedCards.value);
  if (s.has(id)) { s.delete(id); } else { s.add(id); }
  expandedCards.value = s;
}

function isExpanded(id) { return expandedCards.value.has(id); }

// ─── Pagination ───────────────────────────────────────────────────────────────
function goToPage(p) {
  if (p < 1 || p > totalPages.value) return;
  currentPage.value = p;
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function openAddModal() {
  isEditMode.value = false;
  resetForm();
  nextTick(() => {
    if (!bsAddModal) bsAddModal = new window.bootstrap.Modal(document.getElementById('clientModal'));
    bsAddModal.show();
  });
}

function openEditModal(id) {
  const rec = allClients.value.find(r => r.id === id);
  if (!rec) return;
  isEditMode.value = true;
  const f = rec.fields;
  Object.assign(form, {
    recordId:      id,
    company_name:  f.company_name  || '',
    contact_person: f.contact_person || '',
    contact_number: f.contact_number || '',
    email:         f.email         || '',
    status:        f.status        || 'Active',
    country:       f.country       || '',
    city:          f.city          || '',
    zip_code:      f.zip_code      || '',
    address_line_1: f.address_line_1 || '',
    address_line_2: f.address_line_2 || '',
  });
  formStates.value = f.country ? getStatesForCountry(f.country) : [];
  nextTick(() => {
    form.state = f.state || '';
    if (!bsAddModal) bsAddModal = new window.bootstrap.Modal(document.getElementById('clientModal'));
    bsAddModal.show();
  });
}

function onCountryChange() {
  formStates.value = form.country ? getStatesForCountry(form.country) : [];
  form.state = '';
}

function resetForm() {
  Object.assign(form, {
    recordId: '', company_name: '', contact_person: '', contact_number: '',
    email: '', status: 'Active', country: '', state: '', city: '',
    zip_code: '', address_line_1: '', address_line_2: '',
  });
  formStates.value = [];
}

async function saveClient() {
  isSaving.value = true;
  showResult('<div class="spinner-border processSpin" role="status"></div> Processing... Please wait.');
  const fields = {
    company_name:   form.company_name.trim(),
    contact_person: form.contact_person.trim(),
    contact_number: form.contact_number.trim(),
    email:          form.email.trim(),
    status:         form.status,
    country:        form.country,
    state:          form.state,
    city:           form.city.trim(),
    zip_code:       form.zip_code.trim(),
    address_line_1: form.address_line_1.trim(),
  };
  if (form.address_line_2.trim()) fields.address_line_2 = form.address_line_2.trim();

  try {
    if (isEditMode.value) {
      const updated = await updateRecord(TABLES.CLIENTS, form.recordId, fields);
      const idx = allClients.value.findIndex(r => r.id === form.recordId);
      if (idx > -1) allClients.value[idx] = updated;
      applyFilters();
      bsAddModal?.hide();
      showResult('✅ Client updated successfully.');
    } else {
      const created = await createRecord(TABLES.CLIENTS, fields);
      allClients.value.unshift(created);
      applyFilters();
      bsAddModal?.hide();
      showResult('✅ Client added successfully.');
    }
  } catch (err) {
    console.error('Save failed:', err);
    showResult('❌ Save failed: ' + err.message);
  } finally {
    isSaving.value = false;
  }
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function openDeleteModal(id) {
  deleteClientId.value = id;
  nextTick(() => {
    if (!bsDeleteModal) bsDeleteModal = new window.bootstrap.Modal(document.getElementById('deleteClientModal'));
    bsDeleteModal.show();
  });
}

async function confirmDelete() {
  if (!deleteClientId.value) return;
  isDeleting.value = true;
  try {
    await deleteRecord(TABLES.CLIENTS, deleteClientId.value);
    allClients.value = allClients.value.filter(r => r.id !== deleteClientId.value);
    applyFilters();
    bsDeleteModal?.hide();
    showResult('✅ Client deleted successfully.');
  } catch (err) {
    console.error('Delete failed:', err);
    showResult('❌ Delete failed: ' + err.message);
  } finally {
    isDeleting.value = false;
    deleteClientId.value = null;
  }
}

// ─── Status Change Modal ──────────────────────────────────────────────────────
function openStatusModal(id, currentStatus, companyName) {
  statusChangeClientId.value   = id;
  statusChangeClientName.value = companyName;
  statusChangeValue.value      = currentStatus || 'Active';
  modal.status = true;
}

function closeStatusModal() { modal.status = false; }

async function updateStatus() {
  if (!statusChangeClientId.value) return;
  isUpdatingStatus.value = true;
  closeStatusModal();
  showResult('<div class="spinner-border processSpin" role="status"></div> Updating client status... Please wait.');
  try {
    await updateRecord(TABLES.CLIENTS, statusChangeClientId.value, { status: statusChangeValue.value });
    const idx = allClients.value.findIndex(r => r.id === statusChangeClientId.value);
    if (idx > -1) allClients.value[idx].fields.status = statusChangeValue.value;
    applyFilters();
    showResult('✅ Status updated successfully!');
  } catch (err) {
    console.error('Status update failed:', err);
    showResult('❌ Failed to update client status.');
  } finally {
    isUpdatingStatus.value = false;
  }
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
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-3" style="margin-top: 20px;">
      <div>
        <h1 class="section-title">Clients Management</h1>
        <p class="section-subtitle">
          Represents information about Clients
          <span style="font-weight: 700;">( Total Clients : {{ allClients.length }} )</span>
        </p>
      </div>
    </div>

    <!-- Search & Controls -->
    <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
      <div class="position-relative flex-grow-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: orange; z-index:1;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchTerm"
          @input="applyFilters"
          type="text"
          placeholder="Search clients..."
          class="form-control"
          style="padding: 4px 35px 4px 12px !important; border-radius: 8px !important;"
        />
      </div>
      <button @click="resetFilters" class="btn btn-primary" style="background-color: #4285f4; font-size: 14px; padding: 5px 10px; white-space: nowrap;">
        <i class="bi bi-arrow-clockwise"></i> Reset Filters
      </button>
      <button @click="reloadData" class="btn btn-primary" style="background-color: #4285f4; font-size: 14px; padding: 5px 10px; white-space: nowrap;">
        <i class="bi bi-arrow-repeat"></i> Reload Data
      </button>
      <button @click="openAddModal" class="btn btn-primary" style="background-color: #4285f4; font-size: 14px; padding: 5px 10px; white-space: nowrap;">
        + Add Client
      </button>
    </div>

    <!-- Section Card -->
    <div class="section-card" style="border-radius: 6px; border: 1px solid #b6e0ed; padding: 20px !important;">
      <!-- Filter Dropdowns -->
      <div class="d-flex flex-wrap align-items-center mb-3" style="gap: 12px;">
        <!-- Country Filter -->
        <div class="filter-dropdown" :class="{ active: isFilterOpen('country') }">
          <button class="filter-btn" :class="{ 'has-selection': hasSelection('country') }" @click.stop="toggleFilter('country')">
            Country <span style="margin-left: 20px; font-size: 14px; color: #717271;">▼</span>
          </button>
          <div class="filter-menu">
            <input v-model="filterSearch.country" type="text" placeholder="Search..." class="form-control form-control-sm mb-2 filter-search" />
            <label v-for="country in filteredCountries" :key="country">
              <input type="checkbox" :checked="activeFilters.country.includes(country)"
                @change="e => onCheckboxChange('country', country, e.target.checked)" />
              {{ country }}
            </label>
          </div>
        </div>

        <!-- State Filter -->
        <div class="filter-dropdown" :class="{ active: isFilterOpen('state') }">
          <button class="filter-btn" :class="{ 'has-selection': hasSelection('state') }" @click.stop="toggleFilter('state')">
            State <span style="margin-left: 20px; font-size: 14px; color: #717271;">▼</span>
          </button>
          <div class="filter-menu">
            <input v-model="filterSearch.state" type="text" placeholder="Search..." class="form-control form-control-sm mb-2 filter-search" />
            <label v-for="state in filteredStates" :key="state">
              <input type="checkbox" :checked="activeFilters.state.includes(state)"
                @change="e => onCheckboxChange('state', state, e.target.checked)" />
              {{ state }}
            </label>
          </div>
        </div>

        <!-- Status Filter -->
        <div class="filter-dropdown" :class="{ active: isFilterOpen('status') }">
          <button class="filter-btn" :class="{ 'has-selection': hasSelection('status') }" @click.stop="toggleFilter('status')">
            Status <span style="margin-left: 20px; font-size: 14px; color: #717271;">▼</span>
          </button>
          <div class="filter-menu">
            <input v-model="filterSearch.status" type="text" placeholder="Search..." class="form-control form-control-sm mb-2 filter-search" />
            <label v-for="s in filteredStatuses" :key="s">
              <input type="checkbox" :checked="activeFilters.status.includes(s)"
                @change="e => onCheckboxChange('status', s, e.target.checked)" />
              {{ s }}
            </label>
          </div>
        </div>
      </div>

      <!-- Loader -->
      <div v-if="isLoading" class="text-center my-4">
        <div class="spinner-border text-warning" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">Fetching clients...</p>
      </div>

      <!-- Client List -->
      <div v-else>
        <div v-if="paginatedClients.length === 0" class="text-center text-muted py-4">
          No clients found.
        </div>

        <div v-for="record in paginatedClients" :key="record.id" class="client-card">
          <!-- Summary row -->
          <div class="row w-100 align-items-center client-row" style="cursor: pointer; margin: 0;"
            @click.stop="toggleCard(record.id)">
            <div class="col-md-3 d-flex align-items-center" style="font-weight: 600; color: #313030; font-size: 15px;">
              {{ record.fields.company_name || '-' }}
            </div>
            <div class="col-md-2">
              <span class="text-muted" style="font-weight: 500;">{{ record.fields.contact_person || '-' }}</span>
            </div>
            <div class="col-md-2">
              <span class="text-muted" style="font-weight: 500;">{{ record.fields.country || '-' }}</span>
            </div>
            <div class="col-md-2">
              <span class="badge-status"
                @click.stop="openStatusModal(record.id, record.fields.status, record.fields.company_name)">
                {{ record.fields.status || 'Active' }}
              </span>
            </div>
            <div class="col-md-3 d-flex gap-2 justify-content-end align-items-center">
              <button class="btn btn-sm" title="Edit Client"
                style="background: none; border: none; padding: 0; color: #006db6; cursor: pointer; font-size: 18px;"
                @click.stop="openEditModal(record.id)">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm" title="Delete Client"
                style="background: none; border: none; padding: 0; color: #FF6F21; cursor: pointer; font-size: 18px;"
                @click.stop="openDeleteModal(record.id)">
                <i class="bi bi-trash"></i>
              </button>
              <span class="toggle-icon">{{ isExpanded(record.id) ? '▲ Hide' : '▼ Show' }}</span>
            </div>
          </div>

          <!-- Expanded details -->
          <div v-if="isExpanded(record.id)" class="detail-row mt-2">
            <table class="table table-sm mb-0">
              <tbody>
                <tr><th>Client ID</th><td>{{ record.fields.client_id || '-' }}</td></tr>
                <tr><th>Contact Number</th><td>{{ record.fields.contact_number || '-' }}</td></tr>
                <tr><th>Email</th><td>{{ record.fields.email || '-' }}</td></tr>
                <tr><th>Address Line 1</th><td>{{ record.fields.address_line_1 || '-' }}</td></tr>
                <tr><th>Address Line 2</th><td>{{ record.fields.address_line_2 || '-' }}</td></tr>
                <tr><th>City</th><td>{{ record.fields.city || '-' }}</td></tr>
                <tr><th>State</th><td>{{ record.fields.state || '-' }}</td></tr>
                <tr><th>Zip Code</th><td>{{ record.fields.zip_code || '-' }}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        <div class="pagination-controls mt-3">
          <button :disabled="currentPage === 1 || totalPages <= 1" @click="goToPage(1)">First</button>
          <button :disabled="currentPage === 1 || totalPages <= 1" @click="goToPage(currentPage - 1)">Prev</button>
          <button v-for="p in pageButtons" :key="p" :class="{ active: p === currentPage }" @click="goToPage(p)">{{ p }}</button>
          <button :disabled="currentPage === totalPages || totalPages <= 1" @click="goToPage(currentPage + 1)">Next</button>
          <button :disabled="currentPage === totalPages || totalPages <= 1" @click="goToPage(totalPages)">Last</button>
        </div>
      </div>
    </div>

    <!-- ============ ADD/EDIT CLIENT MODAL (Bootstrap) ============ -->
    <div class="modal fade" id="clientModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditMode ? 'Edit Client' : 'Add Client' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form @submit.prevent="saveClient">
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-12">
                  <label class="form-label">Company Name <span style="color: red;">*</span></label>
                  <input v-model="form.company_name" type="text" class="form-control" required style="padding: 4px 12px; border-radius: 5px;" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Contact Person <span style="color: red;">*</span></label>
                  <input v-model="form.contact_person" type="text" class="form-control" required style="padding: 4px 12px; border-radius: 5px;" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Contact Number <span style="color: red;">*</span></label>
                  <input v-model="form.contact_number" type="text" class="form-control" required style="padding: 4px 12px; border-radius: 5px;" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Email <span style="color: red;">*</span></label>
                  <input v-model="form.email" type="email" class="form-control" required style="padding: 4px 12px; border-radius: 5px;" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Status <span style="color: red;">*</span></label>
                  <select v-model="form.status" class="form-select" required style="padding: 4px 12px; border-radius: 5px;">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Country <span style="color: red;">*</span></label>
                  <select v-model="form.country" class="form-select" required @change="onCountryChange" style="padding: 4px 12px; border-radius: 5px;">
                    <option value="">Select Country</option>
                    <option v-for="c in countryList" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">State <span style="color: red;">*</span></label>
                  <select v-model="form.state" class="form-select" required style="padding: 4px 12px; border-radius: 5px;">
                    <option value="">Select State</option>
                    <option v-for="s in formStates" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">City <span style="color: red;">*</span></label>
                  <input v-model="form.city" type="text" class="form-control" required style="padding: 4px 12px; border-radius: 5px;" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Zip Code <span style="color: red;">*</span></label>
                  <input v-model="form.zip_code" type="text" class="form-control" required style="padding: 4px 12px; border-radius: 5px;" />
                </div>
                <div class="col-md-12">
                  <label class="form-label">Address Line 1 <span style="color: red;">*</span></label>
                  <input v-model="form.address_line_1" type="text" class="form-control" required style="padding: 4px 12px; border-radius: 5px;" />
                </div>
                <div class="col-md-12">
                  <label class="form-label">Address Line 2 <span style="color: gray;">(Optional)</span></label>
                  <input v-model="form.address_line_2" type="text" class="form-control" style="padding: 4px 12px; border-radius: 5px;" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" style="color: #212121;">Cancel</button>
              <button type="submit" class="btn btn-success" :disabled="isSaving" style="background-color: #3367d6;">
                {{ isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Client') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- ============ DELETE CONFIRMATION MODAL ============ -->
    <div class="modal fade" id="deleteClientModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header">
            <h5 class="modal-title">Delete Record</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            You are about to delete this item. Are you sure?
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" style="color: #222121;">Cancel</button>
            <button type="button" class="btn btn-danger" :disabled="isDeleting" @click="confirmDelete" style="background-color: #cd7140;">
              {{ isDeleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ CHANGE STATUS MODAL ============ -->
    <div v-if="modal.status" class="web-process-modal" style="display: flex;">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="closeStatusModal">&times;</span>
        <h3 class="mb-2">Change Client Status</h3>
        <div class="mb-3">
          <strong>Client:</strong> {{ statusChangeClientName }}
        </div>
        <div class="mb-3">
          <label class="form-label">Change Status</label>
          <select v-model="statusChangeValue" class="form-select">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div class="mt-3 d-flex justify-content-end gap-2">
          <button class="btn btn-secondary btn-sm" @click="closeStatusModal">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="updateStatus" :disabled="isUpdatingStatus">Update</button>
        </div>
      </div>
    </div>

    <!-- ============ RESULT / STATUS MODAL ============ -->
    <div v-if="modal.result" class="web-process-modal" style="display: flex;">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="closeResult">&times;</span>
        <h3>{{ modal.resultTitle }}</h3>
        <div style="font-size: 15px;" v-html="modal.resultMsg"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.client-card {
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

.detail-row {
  border-top: 1px solid #eee;
  padding-top: 12px;
  font-size: 14px;
}

.toggle-icon {
  cursor: pointer;
  color: #0d6efd;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

tbody {
  display: block;
  border: 0.5px solid #ddd7d7;
  padding: 0;
  border-radius: 2px;
}

tbody, td, tfoot, th, thead, tr {
  border-color: #f3f3f3;
  border-style: solid;
}

tr th { font-weight: 600; }
</style>
