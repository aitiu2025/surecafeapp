<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { fetchAllRecords, TABLES } from '@/services/airtableService.js';

const router = useRouter();

// ─── State ────────────────────────────────────────────────────────────────────
const isLoading   = ref(true);
const isRefreshing = ref(false);

// Pipeline metrics
const pipelineCards = ref([]);   // [{ status, count, week, color }]

// Candidate metrics
const candMetrics = ref({ Active: 0, Selected: 0, 'In-Active': 0 });
const candWeek    = ref({ Active: 0, Selected: 0, 'In-Active': 0 });

// Job metrics
const jobMetrics = ref({ Open: 0, Closed: 0, 'On-Hold': 0 });
const jobWeek    = ref({ Open: 0, Closed: 0, 'On-Hold': 0 });

// Chart instances
let selPie = null, selBar = null;
let cPie = null,   cBar = null;
let jPie = null,   jBar = null;

// ─── Constants ────────────────────────────────────────────────────────────────
const FIXED_PIPELINE_STATUSES = [
  'Selected', 'Applicants', 'Screening Process', 'SureCafe Evaluation',
  'SureCafe Review', 'Interview Stage', 'ShortListed', 'Onboarded', 'Rejected',
];

const PIPELINE_COLORS = {
  'Selected':             '#8ff2ef',
  'Applicants':           '#ffa6b9',
  'Screening Process':    '#fcb48b',
  'SureCafe Evaluation':  '#94cff7',
  'SureCafe Review':      '#f7a6f5',
  'Interview Stage':      '#41755b',
  'ShortListed':          '#91fa9d',
  'Onboarded':            '#feffcc',
  'Rejected':             '#c46c6e',
};

const normalize = s => (Array.isArray(s) ? s.join(' ') : (s || '')).toString().trim().toLowerCase();

const inLast7Days = dateStr => {
  if (!dateStr) return false;
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  return diff <= 7 && diff >= 0;
};

// ─── Data Fetching ────────────────────────────────────────────────────────────
let allStatuses          = [];
let pipelineParentMap    = {};   // parentStatus -> [childStatuses]
let statusToParentMap    = {};   // any status string -> parent status string

async function loadStatuses() {
  const records = await fetchAllRecords(TABLES.STATUSES, [], {
    sort: [{ field: 'seq_order', direction: 'asc' }],
  });
  allStatuses = records.map(r => ({
    id:          r.id,
    status_id:   r.fields.status_id,
    status:      r.fields.status,
    entity_type: (r.fields.entity_type || '').trim(),
    parent_id:   r.fields.parent_id,
    seq_order:   r.fields.seq_order || 0,
  }));

  // Build pipeline parent-child map (SureCafe Parent Statuses)
  const pipelineParents = allStatuses.filter(s => s.parent_id === 0 && s.entity_type === 'SureCafe Parent Statuses');
  pipelineParentMap = {};
  statusToParentMap = {};

  pipelineParents.forEach(parent => {
    const children = allStatuses.filter(s => s.parent_id === parent.status_id);
    pipelineParentMap[parent.status] = children;
    statusToParentMap[parent.status] = parent.status;
    children.forEach(child => { statusToParentMap[child.status] = parent.status; });
  });
}

async function loadAllData() {
  const [apps, cands, jobs] = await Promise.all([
    fetchAllRecords(TABLES.CANDIDATE_APPLICATIONS, ['status', 'application_date', 'updated_at']),
    fetchAllRecords(TABLES.CANDIDATES, ['CandidateStatus', 'Date', 'updated_at']),
    fetchAllRecords(TABLES.JOB_DESCRIPTIONS, ['Status', 'Date', 'updated_at']),
  ]);

  processPipeline(apps);
  processCandidates(cands);
  processJobs(jobs);
}

// ─── Processing ───────────────────────────────────────────────────────────────
function processPipeline(apps) {
  const countMap = {};
  const weekMap  = {};

  for (const rec of apps) {
    const statusStr  = rec.fields.status || '';
    const parentStatus = statusToParentMap[statusStr];
    if (!parentStatus) continue;
    countMap[parentStatus] = (countMap[parentStatus] || 0) + 1;
    if (inLast7Days(rec.fields.updated_at || rec.fields.application_date)) {
      weekMap[parentStatus] = (weekMap[parentStatus] || 0) + 1;
    }
  }

  // Build card list using fixed order, only show statuses with data
  pipelineCards.value = FIXED_PIPELINE_STATUSES
    .filter(s => countMap[s] > 0)
    .map(s => ({
      status: s,
      count:  countMap[s] || 0,
      week:   weekMap[s]  || 0,
      color:  PIPELINE_COLORS[s],
    }));
}

function processCandidates(cands) {
  const mapped = { Active: 0, Selected: 0, 'In-Active': 0 };
  const week   = { Active: 0, Selected: 0, 'In-Active': 0 };

  for (const rec of cands) {
    const s = normalize(rec.fields.CandidateStatus);
    let group = null;
    if (['active', 'available'].includes(s))           group = 'Active';
    else if (['shortlisted', 'selected'].includes(s))  group = 'Selected';
    else if (['in-active'].includes(s))                group = 'In-Active';
    if (!group) continue;
    mapped[group]++;
    if (inLast7Days(rec.fields.updated_at || rec.fields.Date)) week[group]++;
  }

  candMetrics.value = mapped;
  candWeek.value    = week;
}

function processJobs(jobs) {
  const mapped = { Open: 0, Closed: 0, 'On-Hold': 0 };
  const week   = { Open: 0, Closed: 0, 'On-Hold': 0 };

  for (const rec of jobs) {
    const s = normalize(rec.fields.Status);
    let group = null;
    if (['active', 'matched', 'open'].includes(s))  group = 'Open';
    else if (['closed', 'expired'].includes(s))     group = 'Closed';
    else if (['hold'].includes(s))                  group = 'On-Hold';
    if (!group) continue;
    mapped[group]++;
    if (inLast7Days(rec.fields.updated_at || rec.fields.Date)) week[group]++;
  }

  jobMetrics.value = mapped;
  jobWeek.value    = week;
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function destroyCharts() {
  [selPie, selBar, cPie, cBar, jPie, jBar].forEach(c => { if (c) c.destroy(); });
  selPie = selBar = cPie = cBar = jPie = jBar = null;
}

function renderCharts() {
  destroyCharts();
  const ChartJS        = window.Chart;
  const ChartDataLabels = window.ChartDataLabels;
  if (!ChartJS) return;

  // --- Pipeline charts ---
  const plLabels = pipelineCards.value.map(c => c.status);
  const plData   = pipelineCards.value.map(c => c.count);
  const plColors = pipelineCards.value.map(c => c.color);

  if (plLabels.length > 0) {
    const pieCtx = document.getElementById('selectedPie');
    const barCtx = document.getElementById('selectedBar');
    if (pieCtx) {
      selPie = new ChartJS(pieCtx.getContext('2d'), {
        type: 'pie',
        data: {
          labels: plLabels,
          datasets: [{ data: plData, backgroundColor: plColors, borderWidth: 2, borderColor: '#fff' }],
        },
        plugins: [ChartDataLabels],
        options: buildPieOptions(plData),
      });
    }
    if (barCtx) {
      selBar = new ChartJS(barCtx.getContext('2d'), {
        type: 'bar',
        data: {
          labels: plLabels,
          datasets: [{ label: 'Count', data: plData, backgroundColor: plColors, barThickness: 50, maxBarThickness: 60,
            datalabels: { anchor: 'end', align: 'top', formatter: v => v, color: '#000' } }],
        },
        plugins: [ChartDataLabels],
        options: buildBarOptions(plData),
      });
    }
  }

  // --- Candidate charts ---
  const cLabels = ['Active', 'Selected', 'In-Active'];
  const cData   = cLabels.map(l => candMetrics.value[l] || 0);
  const cColors = ['#36A2EB', '#FF6384', '#4BC0C0'];

  const cPieCtx = document.getElementById('candidatesPie');
  const cBarCtx = document.getElementById('candidatesBar');
  if (cPieCtx) {
    cPie = new ChartJS(cPieCtx.getContext('2d'), {
      type: 'pie',
      data: { labels: cLabels, datasets: [{ data: cData, backgroundColor: cColors, borderWidth: 2, borderColor: '#fff' }] },
      plugins: [ChartDataLabels],
      options: buildPieOptions(cData),
    });
  }
  if (cBarCtx) {
    cBar = new ChartJS(cBarCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: cLabels,
        datasets: [{ label: 'Count', data: cData, backgroundColor: cColors, barThickness: 50, maxBarThickness: 60,
          datalabels: { anchor: 'end', align: 'top', formatter: v => v, color: '#000' } }],
      },
      plugins: [ChartDataLabels],
      options: buildBarOptions(cData),
    });
  }

  // --- Job charts ---
  const jLabels = ['Open', 'Closed', 'On-Hold'];
  const jData   = jLabels.map(l => jobMetrics.value[l] || 0);
  const jColors = ['#94cff7', '#ffa6b9', '#73fafa'];

  const jPieCtx = document.getElementById('jobsPie');
  const jBarCtx = document.getElementById('jobsBar');
  if (jPieCtx) {
    jPie = new ChartJS(jPieCtx.getContext('2d'), {
      type: 'pie',
      data: { labels: jLabels, datasets: [{ data: jData, backgroundColor: jColors, borderWidth: 2, borderColor: '#fff' }] },
      plugins: [ChartDataLabels],
      options: buildPieOptions(jData),
    });
  }
  if (jBarCtx) {
    jBar = new ChartJS(jBarCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: jLabels,
        datasets: [{ label: 'Count', data: jData, backgroundColor: jColors, barThickness: 50, maxBarThickness: 60,
          datalabels: { anchor: 'end', align: 'top', formatter: v => v, color: '#000' } }],
      },
      plugins: [ChartDataLabels],
      options: buildBarOptions(jData),
    });
  }
}

function buildPieOptions(data) {
  const total = data.reduce((a, b) => a + b, 0) || 1;
  return {
    layout: { padding: 25 },
    plugins: {
      datalabels: {
        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
        formatter: (value) => `${((value / total) * 100).toFixed(1)}%`,
        color: '#000', font: { size: 12 }, anchor: 'end', align: 'end', offset: 0, clamp: true, clip: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
          },
        },
      },
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { size: 13 } } },
    },
  };
}

function buildBarOptions(data) {
  const max = Math.max(...data, 0);
  return {
    layout: { padding: { top: 20 } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw}` } },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Count' }, suggestedMax: max + 2 },
      x: { title: { display: true, text: 'Status' } },
    },
  };
}

// ─── Load & Refresh ───────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    if (allStatuses.length === 0) await loadStatuses();
    await loadAllData();
    // Let Vue re-render, then draw charts
    setTimeout(renderCharts, 100);
  } catch (err) {
    console.error('Dashboard load error:', err);
  } finally {
    isLoading.value    = false;
    isRefreshing.value = false;
  }
}

async function refreshData() {
  isRefreshing.value = true;
  allStatuses = [];
  await loadDashboard();
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function showDetails(type) {
  let collectedStatuses = [];
  let path = '';

  switch (type) {
    case 'Active':
      collectedStatuses = ['active', 'available'];
      path = '/candidates';
      break;
    case 'Candidate Selected':
      collectedStatuses = ['selected', 'shortlisted'];
      path = '/candidates';
      break;
    case 'In-Active':
      collectedStatuses = ['in-active'];
      path = '/candidates';
      break;
    case 'Open':
      collectedStatuses = ['active', 'matched', 'open'];
      path = '/job-descriptions';
      break;
    case 'Closed':
      collectedStatuses = ['closed', 'expired'];
      path = '/job-descriptions';
      break;
    case 'On-Hold':
      collectedStatuses = ['hold'];
      path = '/job-descriptions';
      break;
    default:
      // Pipeline parent status — stored exactly as the parent status name from Airtable
      collectedStatuses = [type];
      path = '/candidate-pipelines';
      break;
  }

  localStorage.setItem('selectedStatuses', JSON.stringify(collectedStatuses));
  localStorage.setItem('selectedType', type);
  router.push(path);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => { loadDashboard(); });
onBeforeUnmount(() => { destroyCharts(); });
</script>

<template>
  <div class="container-fluid py-2" style="max-width: 1400px; margin: 0 auto;">
    <!-- Dashboard Header -->
    <div class="dashboard-head mb-3">
      <div class="dashboard-header d-flex justify-content-between align-items-center">
        <h4>Dashboard</h4>
        <button class="refresh-btn" :class="{ loading: isRefreshing }" @click="refreshData" :disabled="isRefreshing">
          <span class="refresh-icon">🔄</span>
          <span class="refresh-text">{{ isRefreshing ? 'Loading Data...' : 'Refresh Data' }}</span>
        </button>
      </div>
    </div>

    <!-- Page Loader overlay -->
    <div v-if="isLoading" id="pageLoader">
      <div class="spinner"></div>
      <span class="loader-text">Loading...</span>
    </div>

    <!-- ───────── PIPELINE METRICS ───────── -->
    <div class="section-box" id="selectedCandidatesBox">
      <div class="section-header">
        <h4>Candidates in Pipeline Metrics</h4>
      </div>

      <div v-if="!isLoading && pipelineCards.length === 0" class="text-muted text-center py-3">
        No pipeline data available.
      </div>

      <div class="row g-2 mb-3">
        <div
          v-for="card in pipelineCards"
          :key="card.status"
          class="col-md-3"
        >
          <div class="card-mini" @click="showDetails(card.status)">
            <span class="label">{{ card.status }}</span>
            <span class="count">{{ card.count }}</span>
            <div class="this-week">
              <span class="new-status">New</span>
              <span class="count-status">{{ card.week }} this week</span>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-md-6"><canvas id="selectedPie" style="max-height:300px;"></canvas></div>
        <div class="col-md-6"><canvas id="selectedBar" style="max-height:300px;"></canvas></div>
      </div>
    </div>

    <!-- ───────── CANDIDATE METRICS ───────── -->
    <div class="section-box" id="candidatesBox" style="display:none">
      <div class="section-header">
        <h4>Candidate Metrics</h4>
      </div>
      <div class="row g-2 mb-3">
        <div class="col-md-4">
          <div class="card-mini" @click="showDetails('Active')">
            <span class="label">Active Candidates</span>
            <span class="count">{{ candMetrics.Active }}</span>
            <div class="this-week">
              <span class="new-status">New</span>
              <span class="count-status">{{ candWeek.Active }} this week</span>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card-mini" @click="showDetails('Candidate Selected')">
            <span class="label">Selected Candidates</span>
            <span class="count">{{ candMetrics.Selected }}</span>
            <div class="this-week">
              <span class="new-status">New</span>
              <span class="count-status">{{ candWeek.Selected }} this week</span>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card-mini" @click="showDetails('In-Active')">
            <span class="label">In-Active Candidates</span>
            <span class="count">{{ candMetrics['In-Active'] }}</span>
            <div class="this-week">
              <span class="new-status">New</span>
              <span class="count-status">{{ candWeek['In-Active'] }} this week</span>
            </div>
          </div>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-md-6"><canvas id="candidatesPie" style="max-height:300px;"></canvas></div>
        <div class="col-md-6"><canvas id="candidatesBar" style="max-height:300px;"></canvas></div>
      </div>
    </div>

    <!-- ───────── JOB POSITION METRICS ───────── -->
    <div class="section-box" id="jobsBox">
      <div class="section-header">
        <h4>Job Position Metrics</h4>
      </div>
      <div class="row g-2 mb-3">
        <div class="col-md-4">
          <div class="card-mini" @click="showDetails('Open')">
            <span class="label">Open Positions</span>
            <span class="count">{{ jobMetrics.Open }}</span>
            <div class="this-week">
              <span class="new-status">New</span>
              <span class="count-status">{{ jobWeek.Open }} this week</span>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card-mini" @click="showDetails('Closed')">
            <span class="label">Closed Positions</span>
            <span class="count">{{ jobMetrics.Closed }}</span>
            <div class="this-week">
              <span class="new-status">New</span>
              <span class="count-status">{{ jobWeek.Closed }} this week</span>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card-mini" @click="showDetails('On-Hold')">
            <span class="label">On Hold Positions</span>
            <span class="count">{{ jobMetrics['On-Hold'] }}</span>
            <div class="this-week">
              <span class="new-status">New</span>
              <span class="count-status">{{ jobWeek['On-Hold'] }} this week</span>
            </div>
          </div>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-md-6"><canvas id="jobsPie" style="max-height:300px;"></canvas></div>
        <div class="col-md-6"><canvas id="jobsBar" style="max-height:300px;"></canvas></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-box {
  background: white;
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  padding: 20px;
  margin-bottom: 24px;
  border: solid 1px #e6e1e1;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h4 {
  color: #3476dc;
  font-weight: 700;
  margin: 0;
  font-size: 20px;
}

.card-mini {
  background: #e6f1ff;
  border: 1px solid #b2cff5;
  border-radius: 10px;
  padding: 10px 20px;
  cursor: pointer;
  transition: all .2s ease;
}

.card-mini:hover {
  background: #f1f7ff;
  transform: translateY(-2px);
}

.card-mini .count {
  font-weight: 700;
  color: #0b74c9;
  margin-right: 5px;
  font-size: 32px;
  float: right;
}

.card-mini .label {
  color: #ff7a34;
  font-weight: 700;
  font-size: 16px;
}

.this-week {
  font-size: 14px;
  color: #194693;
  margin-top: 4px;
}

.new-status {
  border-radius: 5px;
  padding: 1px 5px 2px 5px;
  font-size: 11px;
  color: white;
  background: #c75dc7 !important;
  font-weight: 600;
}

.count-status {
  margin-left: 5px;
  font-weight: 500;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #ff7a34;
  margin-bottom: 20px;
}

.dashboard-header h4 {
  color: #ff7a34;
  font-weight: 700;
  margin: 0;
  font-size: 22px;
}

.refresh-btn {
  background: linear-gradient(0deg, #1683c8 50%, #9cd9fb 100%);
  border: none;
  color: #fff;
  padding: 5px 12px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(255,111,33,0.3);
}

.refresh-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0,116,200,0.4);
}

.refresh-btn.loading {
  opacity: 0.8;
  pointer-events: none;
}

.refresh-btn.loading .refresh-icon {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

#pageLoader {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #c5c5c5;
  border-top: 5px solid #e36d2f;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.loader-text {
  font-size: 16px;
  color: #d9d8d7;
  font-weight: 600;
}
</style>
