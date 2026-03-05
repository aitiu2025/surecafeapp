<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import bcrypt from 'bcryptjs';
import { fetchAllRecords, createRecord, updateRecord, deleteRecord, TABLES } from '@/services/airtableService.js';

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const PAGE_SIZE = 10;
const ROLES = ['admin', 'recruiter', 'manager', 'user'];

// ─── State ────────────────────────────────────────────────────────────────────
const allUsers    = ref([]);
const isLoading   = ref(true);
const searchTerm  = ref('');
const currentPage = ref(1);

// Form
const isEditMode = ref(false);
const isSaving   = ref(false);
const formError  = ref('');
const form = reactive({
  recordId: '', first_name: '', last_name: '', email: '',
  password: '', role: 'user', is_active: true,
});

// Profile pic
const picFile       = ref(null);      // File object
const picPreview    = ref('');        // preview URL
const existingPic   = ref('');        // current pic URL (edit mode)
const picInputRef   = ref(null);
const removingPic   = ref(false);     // clearing existing pic

// Delete
const deleteTarget = reactive({ recordId: '', name: '' });
const isDeleting   = ref(false);

// Toast
const toast = reactive({ show: false, msg: '', type: 'success' });

let bsFormModal   = null;
let bsDeleteModal = null;

// ─── Computed ─────────────────────────────────────────────────────────────────
const filteredUsers = computed(() => {
  const q = searchTerm.value.toLowerCase();
  if (!q) return allUsers.value;
  return allUsers.value.filter(u =>
    [u.first_name, u.last_name, u.email, u.role].some(v => (v || '').toLowerCase().includes(q))
  );
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / PAGE_SIZE)));
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return filteredUsers.value.slice(start, start + PAGE_SIZE);
});
const pageButtons = computed(() => {
  const cur = currentPage.value, total = totalPages.value, pages = [];
  for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
  return pages;
});

// ─── Load data ────────────────────────────────────────────────────────────────
async function loadUsers() {
  isLoading.value = true;
  try {
    const records = await fetchAllRecords(TABLES.USERS, [], {
      sort: [{ field: 'created_at', direction: 'desc' }],
    });
    allUsers.value = records.map(r => ({
      record_id:   r.id,
      first_name:  r.fields.first_name  || '',
      last_name:   r.fields.last_name   || '',
      email:       r.fields.email       || '',
      role:        r.fields.role        || 'user',
      is_active:   !!r.fields.is_active,
      last_login:  r.fields.last_login  || '',
      created_at:  r.fields.created_at  || '',
      profile_pic: r.fields.profile_pic?.[0]?.thumbnails?.small?.url
                   || r.fields.profile_pic?.[0]?.url || '',
    }));
  } catch (e) {
    showToast('Failed to load users: ' + e.message, 'error');
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  await loadUsers();
  const el1 = document.getElementById('userFormModal');
  const el2 = document.getElementById('userDeleteModal');
  if (el1 && window.bootstrap) bsFormModal   = new window.bootstrap.Modal(el1);
  if (el2 && window.bootstrap) bsDeleteModal = new window.bootstrap.Modal(el2);
});

// ─── Profile pic handling ─────────────────────────────────────────────────────
function onPicChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image must be under 2 MB.', 'error');
    e.target.value = '';
    return;
  }
  picFile.value    = file;
  picPreview.value = URL.createObjectURL(file);
}

function clearPicSelection() {
  picFile.value    = null;
  picPreview.value = '';
  if (picInputRef.value) picInputRef.value.value = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadPic(recordId, file) {
  const base64 = await fileToBase64(file);
  const url     = `https://content.airtable.com/v0/${BASE_ID}/${recordId}/profile_pic/uploadAttachment`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentType: file.type,
      filename:    file.name,
      file:        base64,
    }),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

// ─── Add / Edit ───────────────────────────────────────────────────────────────
function openAdd() {
  isEditMode.value = false;
  formError.value  = '';
  picFile.value    = null;
  picPreview.value = '';
  existingPic.value = '';
  Object.assign(form, { recordId: '', first_name: '', last_name: '', email: '', password: '', role: 'user', is_active: true });
  bsFormModal?.show();
}

function openEdit(u) {
  isEditMode.value  = true;
  formError.value   = '';
  picFile.value     = null;
  picPreview.value  = '';
  existingPic.value = u.profile_pic || '';
  Object.assign(form, {
    recordId:   u.record_id,
    first_name: u.first_name,
    last_name:  u.last_name,
    email:      u.email,
    role:       u.role,
    is_active:  u.is_active,
    password:   '',
  });
  bsFormModal?.show();
}

async function saveUser() {
  formError.value = '';
  if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
    formError.value = 'First name, last name and email are required.'; return;
  }
  if (!isEditMode.value && !form.password) {
    formError.value = 'Password is required for new users.'; return;
  }
  if (form.password && form.password.length < 8) {
    formError.value = 'Password must be at least 8 characters.'; return;
  }

  const emailLower = form.email.trim().toLowerCase();
  const duplicate  = allUsers.value.find(u => u.email.toLowerCase() === emailLower && u.record_id !== form.recordId);
  if (duplicate) { formError.value = 'This email is already registered.'; return; }

  isSaving.value = true;
  try {
    const fields = {
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      email:      emailLower,
      role:       form.role,
      is_active:  form.is_active
    };
    if (form.password) fields.password_hash = await bcrypt.hash(form.password, 10);

    let targetRecordId = form.recordId;

    if (isEditMode.value) {
      // If new pic is being uploaded, clear existing first
      if (picFile.value && existingPic.value) {
        removingPic.value = true;
        showToast('Removing existing profile picture…', 'success');
        await updateRecord(TABLES.USERS, targetRecordId, { profile_pic: [] });
        removingPic.value = false;
      }
      await updateRecord(TABLES.USERS, targetRecordId, fields);
    } else {
      fields.created_at = new Date().toISOString();
      const created = await createRecord(TABLES.USERS, fields);
      targetRecordId = created.id;
    }

    // Upload new profile pic if selected
    if (picFile.value) {
      await uploadPic(targetRecordId, picFile.value);
    }

    bsFormModal?.hide();
    showToast(isEditMode.value ? 'User updated successfully.' : 'User created successfully.');
    await loadUsers();
  } catch (e) {
    formError.value = 'Save failed: ' + e.message;
  } finally {
    isSaving.value   = false;
    removingPic.value = false;
  }
}

// ─── Toggle active ─────────────────────────────────────────────────────────────
async function toggleActive(u) {
  try {
    await updateRecord(TABLES.USERS, u.record_id, { is_active: !u.is_active });
    u.is_active = !u.is_active;
    showToast(`User ${u.is_active ? 'activated' : 'deactivated'}.`);
  } catch (e) {
    showToast('Failed to update status: ' + e.message, 'error');
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDelete(u) {
  deleteTarget.recordId = u.record_id;
  deleteTarget.name     = `${u.first_name} ${u.last_name}`;
  bsDeleteModal?.show();
}

async function confirmDelete() {
  isDeleting.value = true;
  try {
    await deleteRecord(TABLES.USERS, deleteTarget.recordId);
    bsDeleteModal?.hide();
    showToast('User deleted.');
    await loadUsers();
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  } finally {
    isDeleting.value = false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  toast.msg = msg; toast.type = type; toast.show = true;
  setTimeout(() => { toast.show = false; }, 3500);
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function roleBadgeClass(role) {
  return { admin: 'badge-admin', recruiter: 'badge-recruiter', manager: 'badge-manager', user: 'badge-user' }[role] || 'badge-user';
}
function avatarInitials(u) {
  return ((u.first_name[0] || '') + (u.last_name[0] || '')).toUpperCase();
}
</script>

<template>
  <div>
    <!-- ─── Page header ─── -->
    <div class="page-header">
      <div>
        <h1 class="section-title">Users</h1>
        <p class="section-subtitle">Manage system users &amp; access roles</p>
      </div>
      <button class="btn-add" @click="openAdd">
        <i class="bi bi-person-plus-fill me-2"></i>Add User
      </button>
    </div>

    <!-- ─── Toolbar ─── -->
    <div class="toolbar-card">
      <div class="search-wrap">
        <i class="bi bi-search search-ico"></i>
        <input
          v-model="searchTerm"
          @input="currentPage = 1"
          type="text"
          class="search-inp"
          placeholder="Search by name, email or role…"
        />
      </div>
      <div class="count-pill">{{ filteredUsers.length }} user{{ filteredUsers.length !== 1 ? 's' : '' }}</div>
    </div>

    <!-- ─── Loading ─── -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-warning"></div>
      <p class="mt-2 text-muted">Loading users…</p>
    </div>

    <!-- ─── Table ─── -->
    <div v-else class="table-card">
      <div class="table-wrapper">
      <table class="u-table">
        <colgroup>
          <col style="width:26%">
          <col style="width:22%">
          <col style="width:10%">
          <col style="width:12%">
          <col style="width:13%">
          <col style="width:10%">
          <col style="width:7%">
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Created</th>
            <th style="text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="paginatedUsers.length === 0">
            <td colspan="7" class="empty-row">
              <i class="bi bi-people" style="font-size:2rem;display:block;margin-bottom:8px;"></i>
              No users found.
            </td>
          </tr>
          <tr v-for="u in paginatedUsers" :key="u.record_id">
            <td>
              <div class="user-cell">
                <div class="u-avatar">
                  <img v-if="u.profile_pic" :src="u.profile_pic" alt="" class="u-avatar-img" />
                  <span v-else>{{ avatarInitials(u) }}</span>
                </div>
                <span class="u-name">{{ u.first_name }} {{ u.last_name }}</span>
              </div>
            </td>
            <td class="cell-muted">{{ u.email }}</td>
            <td><span :class="['role-badge', roleBadgeClass(u.role)]">{{ u.role }}</span></td>
            <td>
              <button :class="['status-btn', u.is_active ? 'active' : 'inactive']"
                @click="toggleActive(u)" :title="u.is_active ? 'Click to deactivate' : 'Click to activate'">
                <i :class="['bi', u.is_active ? 'bi-check-circle-fill' : 'bi-x-circle-fill']"></i>
                {{ u.is_active ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td class="cell-muted">{{ formatDate(u.last_login) }}</td>
            <td class="cell-muted">{{ formatDate(u.created_at) }}</td>
            <td class="actions-cell">
              <button class="act-btn edit" @click="openEdit(u)" title="Edit user">
                <i class="bi bi-pencil-fill"></i>
              </button>
              <button class="act-btn del" @click="openDelete(u)" title="Delete user">
                <i class="bi bi-trash3-fill"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div><!-- /table-wrapper -->

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination-controls" style="padding:10px 20px;">
        <button @click="currentPage--" :disabled="currentPage===1">&#8249;</button>
        <button v-for="p in pageButtons" :key="p" @click="currentPage=p" :class="{active:currentPage===p}">{{ p }}</button>
        <button @click="currentPage++" :disabled="currentPage===totalPages">&#8250;</button>
      </div>
    </div>

    <!-- ─── Add / Edit Modal ─── -->
    <div class="modal fade" id="userFormModal" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content modal-modern">
          <div class="modal-header-modern">
            <div class="modal-icon-wrap" :class="isEditMode ? 'edit' : 'add'">
              <i :class="['bi', isEditMode ? 'bi-pencil-square' : 'bi-person-plus-fill']"></i>
            </div>
            <div>
              <h5 class="modal-title-modern">{{ isEditMode ? 'Edit User' : 'Add New User' }}</h5>
              <p class="modal-sub-modern">{{ isEditMode ? 'Update user details and permissions' : 'Create a new system account' }}</p>
            </div>
            <button type="button" class="btn-close ms-auto" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body modal-body-modern">
            <div v-if="formError" class="modal-err">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ formError }}
            </div>

            <!-- Profile picture section -->
            <div class="pic-section">
              <div class="pic-circle-wrap">
                <div class="pic-circle">
                  <img v-if="picPreview || existingPic" :src="picPreview || existingPic" alt="" class="pic-img" />
                  <i v-else class="bi bi-person-fill pic-placeholder"></i>
                </div>
                <!-- Camera overlay -->
                <label class="pic-camera-btn" :title="picPreview || existingPic ? 'Change photo' : 'Upload photo'">
                  <i class="bi bi-camera-fill"></i>
                  <input ref="picInputRef" type="file" accept="image/*" style="display:none;" @change="onPicChange" />
                </label>
                <!-- Remove icon only (appears when new file is selected) -->
                <button v-if="picPreview" type="button" class="pic-remove-icon" @click="clearPicSelection" title="Remove selection">
                  <i class="bi bi-x"></i>
                </button>
              </div>
            
              <p class="pic-hint">JPG, PNG, GIF · Max 2 MB</p>
            </div>

            <hr class="modal-divider" />

            <!-- Form fields -->
            <div class="row g-3">
              <div class="col-6">
                <label class="form-label fw-semibold">First Name <span class="req">*</span></label>
                <input v-model="form.first_name" type="text" class="form-control" placeholder="First name" />
              </div>
              <div class="col-6">
                <label class="form-label fw-semibold">Last Name <span class="req">*</span></label>
                <input v-model="form.last_name" type="text" class="form-control" placeholder="Last name" />
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold">Email <span class="req">*</span></label>
                <input v-model="form.email" type="email" class="form-control" placeholder="email@company.com" />
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold">
                  Password <span class="req" v-if="!isEditMode">*</span>
                  <span v-if="isEditMode" class="label-optional"> — leave blank to keep current</span>
                </label>
                <input v-model="form.password" type="password" class="form-control"
                  :placeholder="isEditMode ? 'Leave blank to keep current password' : 'Min. 8 characters'" />
              </div>
              <div class="col-6">
                <label class="form-label fw-semibold">Role <span class="req">*</span></label>
                <select v-model="form.role" class="form-select">
                  <option v-for="r in ROLES" :key="r" :value="r">{{ r.charAt(0).toUpperCase() + r.slice(1) }}</option>
                </select>
              </div>
              <div class="col-6 d-flex align-items-end pb-1">
                <div class="form-check">
                  <input v-model="form.is_active" class="form-check-input" type="checkbox" id="isActiveCheck" />
                  <label class="form-check-label fw-semibold" for="isActiveCheck">Active account</label>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer-modern">
            <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn-save" @click="saveUser" :disabled="isSaving">
              <span v-if="isSaving">
                <span class="spinner-border spinner-border-sm me-2"></span>
                {{ removingPic ? 'Removing old photo…' : 'Saving…' }}
              </span>
              <span v-else>
                <i class="bi bi-check-lg me-2"></i>
                {{ isEditMode ? 'Save Changes' : 'Create User' }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Delete Confirm Modal ─── -->
    <div class="modal fade" id="userDeleteModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header">
            <h5 class="modal-title">Delete User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            You are about to delete <strong>{{ deleteTarget.name }}</strong>. Are you sure?
            <div style="color:#cf7e7e;font-size:13px;margin-top:6px;">This action cannot be undone.</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" style="background:#cd7140;" @click="confirmDelete" :disabled="isDeleting">
              <span v-if="isDeleting"><span class="spinner-border spinner-border-sm me-2"></span>Deleting…</span>
              <span v-else>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div :class="['sc-toast', toast.type, toast.show ? 'visible' : '']">
      <i :class="['bi', toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill', 'me-2']"></i>
      {{ toast.msg }}
    </div>
  </div>
</template>

<style scoped>
/* ─── Page header ─── */
.page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.btn-add {
  background:linear-gradient(135deg,#1565c0,#42a5f5);
  color:#fff; border:none; border-radius:10px;
  padding:10px 20px; font-size:14px; font-weight:600; cursor:pointer;
  box-shadow:0 3px 12px rgba(25,118,210,0.3);
  transition:opacity 0.2s,transform 0.15s;
}
.btn-add:hover { opacity:0.9; transform:translateY(-1px); }

/* ─── Toolbar ─── */
.toolbar-card {
  display:flex; align-items:center; gap:12px;
  background:#fff; border:1px solid #E5E7EB; border-radius:12px;
  padding:12px 18px; margin-bottom:14px;
  box-shadow:0 1px 6px rgba(0,0,0,0.04);
}
.search-wrap { position:relative; flex:1; }
.search-ico { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; font-size:14px; }
.search-inp {
  width:100%; padding:8px 12px 8px 36px;
  border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px;
  background:#fafcff; outline:none; transition:border-color 0.2s;
}
.search-inp:focus { border-color:#1976d2; box-shadow:0 0 0 3px rgba(25,118,210,0.08); }
.search-inp::placeholder { color:#adb5bd; }
.count-pill {
  background:#f0f5ff; color:#1976d2; border:1px solid #dbeafe;
  border-radius:20px; padding:4px 14px; font-size:13px; font-weight:600; white-space:nowrap;
}

/* ─── Table card ─── */
.table-card {
  background:#fff; border-radius:14px; border:1px solid #E5E7EB;
  box-shadow:0 1px 6px rgba(0,0,0,0.04); overflow:hidden;
}
.table-wrapper { overflow-x:auto; -webkit-overflow-scrolling:touch; }
.u-table { width:100%; border-collapse:collapse; font-size:14px; }
.u-table thead { display:table-header-group; background:#f8f9fa; border-bottom:2px solid #e5e7eb; }
.u-table tbody { display:table-row-group; }
.u-table tr    { display:table-row; }
.u-table th { display:table-cell; padding:13px 16px; text-align:left; font-weight:700; color:#374151; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.u-table td { display:table-cell; padding:13px 16px; border-bottom:1px solid #f3f4f6; vertical-align:middle; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.u-table tbody tr:hover { background:#fafbff; }
.u-table tbody tr:last-child td { border-bottom:none; }

.empty-row { text-align:center; padding:44px; color:#9ca3af; font-size:14px; }

.user-cell { display:flex; align-items:center; gap:10px; }
.u-avatar {
  width:36px; height:36px; border-radius:50%; flex-shrink:0;
  background:linear-gradient(135deg,#1976d2,#42a5f5);
  color:#fff; font-size:13px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
  overflow:hidden;
}
.u-avatar-img { width:100%; height:100%; object-fit:cover; }
.u-name { font-weight:600; color:#1a1a2e; }
.cell-muted { color:#6b7280; font-size:13px; }

.role-badge { padding:3px 11px; border-radius:20px; font-size:12px; font-weight:600; text-transform:capitalize; }
.badge-admin     { background:#ede9fe; color:#6d28d9; }
.badge-recruiter { background:#dbeafe; color:#1d4ed8; }
.badge-manager   { background:#fef3c7; color:#92400e; }
.badge-user      { background:#f3f4f6; color:#374151; }

.status-btn {
  display:inline-flex; align-items:center; gap:5px;
  border:none; border-radius:20px; padding:4px 12px;
  font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s;
}
.status-btn.active   { background:#dcfce7; color:#15803d; }
.status-btn.inactive { background:#fee2e2; color:#dc2626; }
.status-btn:hover { opacity:0.78; }

.actions-cell { text-align:center; }
.act-btn {
  border:none; background:transparent; width:30px; height:30px;
  border-radius:7px; cursor:pointer; font-size:14px;
  display:inline-flex; align-items:center; justify-content:center;
  transition:background 0.2s, transform 0.1s;
}
.act-btn:hover { transform:scale(1.15); }
.act-btn.edit { color:#1976d2; }
.act-btn.edit:hover { background:#e3f2fd; }
.act-btn.del  { color:#dc2626; }
.act-btn.del:hover  { background:#fee2e2; }

/* ─── Modal ─── */
.modal-modern { border-radius:16px; border:none; box-shadow:0 12px 40px rgba(0,0,0,0.15); }
.modal-header-modern {
  display:flex; align-items:center; gap:14px;
  padding:20px 24px; border-bottom:1px solid #f0f0f0;
}
.modal-icon-wrap {
  width:42px; height:42px; border-radius:10px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:18px;
}
.modal-icon-wrap.add { background:#dbeafe; color:#1d4ed8; }
.modal-icon-wrap.edit { background:#fef3c7; color:#92400e; }
.modal-title-modern { font-size:16px; font-weight:700; color:#0d1b2a; margin:0 0 2px; }
.modal-sub-modern { font-size:12px; color:#6b7280; margin:0; }
.modal-body-modern { padding:22px 24px; }
.modal-divider { margin:18px 0; border-color:#f0f0f0; }
.modal-footer-modern {
  display:flex; justify-content:flex-end; gap:10px;
  padding:16px 24px; border-top:1px solid #f0f0f0;
}
.modal-err {
  background:#fff0f0; border-left:4px solid #dc2626; border-radius:8px;
  padding:11px 14px; font-size:13.5px; color:#b91c1c; margin-bottom:16px;
}
.req { color:#dc2626; }
.label-optional { font-weight:500; font-size:11.5px; color:#ed7d06; }
.btn-save {
  background:linear-gradient(135deg,#1565c0,#42a5f5);
  color:#fff; border:none; border-radius:8px; padding:9px 22px;
  font-size:14px; font-weight:600; cursor:pointer;
  box-shadow:0 3px 10px rgba(25,118,210,0.3); transition:opacity 0.2s;
}
.btn-save:disabled { opacity:0.65; cursor:not-allowed; }

/* ─── Profile pic ─── */
.pic-section { text-align:center; margin-bottom:4px; }
.pic-circle-wrap { position:relative; display:inline-block; margin-bottom:8px; }
.pic-circle {
  width:88px; height:88px; border-radius:50%;
  background:linear-gradient(135deg,#1976d2,#42a5f5);
  display:flex; align-items:center; justify-content:center;
  overflow:hidden; border:3px solid #e0eaff;
}
.pic-img { width:100%; height:100%; object-fit:cover; }
.pic-placeholder { font-size:38px; color:rgba(255,255,255,0.85); }

.pic-camera-btn {
  position:absolute; bottom:2px; right:2px;
  width:28px; height:28px; border-radius:50%;
  background:#1976d2; color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:13px; cursor:pointer;
  border:2px solid #fff;
  transition:background 0.18s;
}
.pic-camera-btn:hover { background:#1565c0; }

.pic-remove-icon {
  position:absolute; top:0; right:0;
  width:22px; height:22px; border-radius:50%;
  background:#dc2626; color:#fff;
  border:2px solid #fff;
  display:flex; align-items:center; justify-content:center;
  font-size:13px; cursor:pointer; padding:0;
  transition:background 0.18s;
}
.pic-remove-icon:hover { background:#b91c1c; }

.pic-warning { font-size:12px; color:#92400e; background:#fef3c7; border-radius:6px; padding:5px 10px; display:inline-block; margin:0 0 4px; }
.pic-hint { font-size:11.5px; color:#9ca3af; margin:0; }

/* ─── Delete modal ─── (uses Bootstrap's built-in rounded-3 shadow styles) */

/* ─── Toast ─── */
.sc-toast {
  position:fixed; bottom:24px; right:24px;
  background:#1e293b; color:#fff;
  padding:12px 20px; border-radius:10px;
  font-size:14px; font-weight:500;
  box-shadow:0 4px 20px rgba(0,0,0,0.2);
  opacity:0; transform:translateY(10px);
  transition:all 0.3s ease; pointer-events:none; z-index:9999;
}
.sc-toast.visible { opacity:1; transform:translateY(0); }
.sc-toast.success { border-left:4px solid #16a34a; }
.sc-toast.error   { border-left:4px solid #dc2626; }
</style>
