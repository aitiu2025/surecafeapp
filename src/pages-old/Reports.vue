<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { fetchAllRecords, TABLES } from '@/services/airtableService.js';

// ─── State ───────────────────────────────────────────────────────────────────
const activeTab = ref('pipelines');

// Raw data
const allApplications = ref([]);
const allCandidates   = ref([]);
const allJobs         = ref([]);
const allClients      = ref([]);
const allStatuses     = ref([]);

// Derived helpers
let clientsMap   = {};
let jobClientMap = {};
let mainStatuses = [];
let subStatusMap = {};

const loading = ref(false);

// ─── Pipeline tab ─────────────────────────────────────────────────────────────
const pipelineSearch       = ref('');
const pipelineDateFilter   = ref('all');
const pipelineFromDate     = ref('');
const pipelineToDate       = ref('');
const pipelineStatusSel    = ref([]);
const pipelineJobSel       = ref([]);
const pipelineClientSel    = ref([]);
const pipelineStatusSearch = ref('');
const pipelineJobSearch    = ref('');
const pipelineClientSearch = ref('');
const openFilterKey        = ref(null);
const pipelineCurrentPage  = ref(1);
const ITEMS_PER_PAGE = 10;

// ─── Candidates tab ───────────────────────────────────────────────────────────
const candidateSearch       = ref('');
const candidateDateFilter   = ref('all');
const candidateFromDate     = ref('');
const candidateToDate       = ref('');
const candidateStatusSel    = ref([]);
const candidateStatusSearch = ref('');
const candidateCurrentPage  = ref(1);

// ─── Jobs tab ─────────────────────────────────────────────────────────────────
const jobSearch       = ref('');
const jobDateFilter   = ref('all');
const jobFromDate     = ref('');
const jobToDate       = ref('');
const jobStatusSel    = ref([]);
const jobEmpSel       = ref([]);
const jobStatusSearch = ref('');
const jobEmpSearch    = ref('');
const jobCurrentPage  = ref(1);

// ─── Send Report modal ────────────────────────────────────────────────────────
const REPORT_WEBHOOK_URL  = 'https://hook.us1.make.com/u7oykej4pbh01z5p6zpz04iitewfvpvq';
const sendReportVisible   = ref(false);
const reportClientSel     = ref('');
const reportToEmail       = ref('');
const reportCCEmail       = ref('');
const reportSubject       = ref('');
const reportMessage       = ref('');
const reportResultMsg     = ref('');
const reportResultVisible = ref(false);
const sendingReport       = ref(false);

// ─── Chart instances ──────────────────────────────────────────────────────────
let pipelineMetricsChart        = null;
let clientMetricsChart          = null;
let monthlyMetricsChart         = null;
let candidateStatusMetricsChart = null;
let monthlyCandidateChart       = null;
let jobStatusMetricsChart       = null;
let monthlyJobsChart            = null;

const CHART_COLORS = ['#FF6F21','#3F51B5','#009688','#FF9800','#9C27B0','#00BCD4','#E91E63','#795548'];

// ─── Utility ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', { year:'numeric', month:'2-digit', day:'2-digit', hour:'numeric', minute:'2-digit', hour12:true });
}

function passesDateFilter(dateStr, filterVal, fromDate, toDate) {
  if (filterVal === 'all') return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (filterVal === 'today') {
    return d.toDateString() === now.toDateString();
  } else if (filterVal === 'week') {
    const week = new Date(); week.setDate(week.getDate() - 7);
    return d >= week;
  } else if (filterVal === 'month') {
    const month = new Date(); month.setDate(month.getDate() - 30);
    return d >= month;
  } else if (filterVal === 'custom') {
    const from = fromDate ? new Date(fromDate) : null;
    const to   = toDate   ? new Date(toDate)   : null;
    if (from && d < from) return false;
    if (to   && d > to  ) return false;
    return true;
  }
  return true;
}

function getMonthlyData(data, dateField) {
  const monthlyData = {};
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = d.toLocaleString('default', { month:'short', year:'2-digit' });
    monthlyData[key] = 0;
  }
  data.forEach(item => {
    const iso = item[dateField];
    if (!iso) return;
    const key = new Date(iso).toLocaleString('default', { month:'short', year:'2-digit' });
    if (Object.prototype.hasOwnProperty.call(monthlyData, key)) monthlyData[key]++;
  });
  return monthlyData;
}

function visiblePageNums(current, total) {
  let start = Math.max(1, current - 2);
  let end   = Math.min(total, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// ─── Filter options (with search) ────────────────────────────────────────────
const pipelineStatusOptions = computed(() => {
  const set = new Set(allApplications.value.map(a => a.status).filter(Boolean));
  const q = pipelineStatusSearch.value.toLowerCase();
  return [...set].sort().filter(v => !q || v.toLowerCase().includes(q));
});
const pipelineJobOptions = computed(() => {
  const set = new Set(allApplications.value.map(a => a.job_title).filter(Boolean));
  const q = pipelineJobSearch.value.toLowerCase();
  return [...set].sort().filter(v => !q || v.toLowerCase().includes(q));
});
const pipelineClientOptions = computed(() => {
  const set = new Set(allApplications.value.map(a => a.client_name).filter(Boolean));
  const q = pipelineClientSearch.value.toLowerCase();
  return [...set].sort().filter(v => !q || v.toLowerCase().includes(q));
});
const candidateStatusOptions = computed(() => {
  const set = new Set(allCandidates.value.map(c => c.status).filter(Boolean));
  const q = candidateStatusSearch.value.toLowerCase();
  return [...set].sort().filter(v => !q || v.toLowerCase().includes(q));
});
const jobStatusOptions = computed(() => {
  const set = new Set(allJobs.value.map(j => j.status).filter(Boolean));
  const q = jobStatusSearch.value.toLowerCase();
  return [...set].sort().filter(v => !q || v.toLowerCase().includes(q));
});
const jobEmploymentOptions = computed(() => {
  const set = new Set(allJobs.value.map(j => j.employment_type).filter(Boolean));
  const q = jobEmpSearch.value.toLowerCase();
  return [...set].sort().filter(v => !q || v.toLowerCase().includes(q));
});

// ─── Filtered data ────────────────────────────────────────────────────────────
const filteredApplications = computed(() => {
  let data = allApplications.value;
  const q = pipelineSearch.value.toLowerCase();
  if (q) data = data.filter(a =>
    [a.candidate_name, a.job_title, a.status, a.candidate_email, a.candidate_role, a.experience, a.client_name]
      .some(v => (v||'').toLowerCase().includes(q))
  );
  data = data.filter(a => passesDateFilter(a.created_at, pipelineDateFilter.value, pipelineFromDate.value, pipelineToDate.value));
  if (pipelineStatusSel.value.length) data = data.filter(a => pipelineStatusSel.value.includes(a.status));
  if (pipelineJobSel.value.length)    data = data.filter(a => pipelineJobSel.value.includes(a.job_title));
  if (pipelineClientSel.value.length) data = data.filter(a => pipelineClientSel.value.includes(a.client_name));
  return data;
});

const filteredCandidates = computed(() => {
  let data = allCandidates.value;
  const q = candidateSearch.value.toLowerCase();
  if (q) data = data.filter(c =>
    [c.name, c.status, c.email, c.role, c.experience, c.phone, c.company, c.location]
      .some(v => (v||'').toLowerCase().includes(q))
  );
  data = data.filter(c => passesDateFilter(c.dateAdded, candidateDateFilter.value, candidateFromDate.value, candidateToDate.value));
  if (candidateStatusSel.value.length) data = data.filter(c => candidateStatusSel.value.includes(c.status));
  return data;
});

const filteredJobs = computed(() => {
  let data = allJobs.value;
  const q = jobSearch.value.toLowerCase();
  if (q) data = data.filter(j =>
    [j.title, j.status, j.location, j.employment_type, j.experience_level, j.department]
      .some(v => (v||'').toLowerCase().includes(q))
  );
  data = data.filter(j => passesDateFilter(j.dateAdded, jobDateFilter.value, jobFromDate.value, jobToDate.value));
  if (jobStatusSel.value.length) data = data.filter(j => jobStatusSel.value.includes(j.status));
  if (jobEmpSel.value.length)    data = data.filter(j => jobEmpSel.value.includes(j.employment_type));
  return data;
});

// ─── Paginated slices ─────────────────────────────────────────────────────────
const pipelinePages = computed(() => Math.max(1, Math.ceil(filteredApplications.value.length / ITEMS_PER_PAGE)));
const candidatePages= computed(() => Math.max(1, Math.ceil(filteredCandidates.value.length / ITEMS_PER_PAGE)));
const jobPages      = computed(() => Math.max(1, Math.ceil(filteredJobs.value.length / ITEMS_PER_PAGE)));

const pipelineRows  = computed(() => filteredApplications.value.slice((pipelineCurrentPage.value-1)*ITEMS_PER_PAGE, pipelineCurrentPage.value*ITEMS_PER_PAGE));
const candidateRows = computed(() => filteredCandidates.value.slice((candidateCurrentPage.value-1)*ITEMS_PER_PAGE, candidateCurrentPage.value*ITEMS_PER_PAGE));
const jobRows       = computed(() => filteredJobs.value.slice((jobCurrentPage.value-1)*ITEMS_PER_PAGE, jobCurrentPage.value*ITEMS_PER_PAGE));

// ─── Watchers — re-render charts when filtered data changes ──────────────────
watch(filteredApplications, () => {
  pipelineCurrentPage.value = 1;
  if (activeTab.value === 'pipelines') {
    nextTick(() => { renderPipelineMetrics(); renderClientMetrics(); renderMonthlyMetrics(); });
  }
});
watch(filteredCandidates, () => {
  candidateCurrentPage.value = 1;
  if (activeTab.value === 'candidates') {
    nextTick(() => { renderCandidateStatusChart(); renderMonthlyCandidateMetrics(); });
  }
});
watch(filteredJobs, () => {
  jobCurrentPage.value = 1;
  if (activeTab.value === 'jobs') {
    nextTick(() => { renderJobStatusChart(); renderMonthlyJobsMetrics(); });
  }
});

// ─── Fetch all data ───────────────────────────────────────────────────────────
async function loadAllData() {
  loading.value = true;
  try {
    const [clients, jobs, applications, candidates] = await Promise.all([
      fetchAllRecords(TABLES.CLIENTS),
      fetchAllRecords(TABLES.JOB_DESCRIPTIONS, [], { sort:[{field:'updated_at', direction:'desc'}] }),
      fetchAllRecords(TABLES.CANDIDATE_APPLICATIONS, [], { sort:[{field:'application_date', direction:'desc'}] }),
      fetchAllRecords(TABLES.CANDIDATES, [], {
        sort:[{field:'updated_at', direction:'desc'}],
        filterByFormula: 'NOT({Candidate Name}="")'
      }),
    ]);

    // Fetch statuses — non-critical
    let statuses = [];
    try {
      statuses = await fetchAllRecords(TABLES.STATUSES, [], { sort:[{field:'seq_order', direction:'asc'}] });
    } catch(e) {
      console.warn('Could not load statuses:', e.message);
    }

    // Build clients map
    clientsMap = {};
    allClients.value = clients.map(r => {
      const c = { id:r.id, company_name:r.fields.company_name||'', email:r.fields.email||'', contact_person:r.fields.contact_person||'' };
      clientsMap[r.id] = c;
      return c;
    });

    // Build job->client map
    jobClientMap = {};
    allJobs.value = jobs.map(r => {
      const clientId = Array.isArray(r.fields.Client_id) ? r.fields.Client_id[0] : (r.fields.Client_id || '');
      jobClientMap[r.id] = clientId;
      return {
        id: r.id,
        title: r.fields.Job_Title || '',
        status: r.fields.Status || '',
        location: r.fields.Location || '',
        employment_type: r.fields.Employment_Type || '',
        experience_level: r.fields.Experience_Level || '',
        department: r.fields.Department || '',
        priority: r.fields.Priority || '',
        experience_years: r.fields.Experience_Years || '',
        salary_range: r.fields.Salary_Range || '',
        dateAdded: r.fields.Date || '',
      };
    });

    // Build applications
    allApplications.value = applications.map(r => {
      const f = r.fields;
      const jobId = Array.isArray(f.job_id) ? f.job_id[0] : (f.job_id || '');
      const clientId = jobClientMap[jobId] || '';
      const client = clientsMap[clientId] || {};
      return {
        id: r.id,
        candidate_name: f.candidate_name || '',
        candidate_email: f.candidate_email || '',
        job_title: f.job_title || '',
        status: f.status || '',
        client_name: client.company_name || '',
        experience: f.candidate_exp || '',
        candidate_role: f.candidate_role || '',
        created_at: f.application_date || f.created_at || '',
      };
    });

    // Build candidates
    allCandidates.value = candidates.map(r => {
      const f = r.fields;
      return {
        id: r.id,
        name: f['Candidate Name'] || '',
        status: f['CandidateStatus'] || '',
        email: f['gmail'] || '',
        role: f['Current Role'] || '',
        experience: f['Total Experience'] || '',
        phone: f['Phone Number'] || f['Phone'] || '',
        company: f['Current Company'] || '',
        location: f['Location'] || '',
        dateAdded: f['Date'] || f['updated_at'] || '',
      };
    });

    // Build statuses hierarchy
    allStatuses.value = statuses.map(r => ({
      id: r.id,
      status_id: r.fields.status_id,
      status: r.fields.status,
      entity_type: r.fields.entity_type || '',
      parent_id: r.fields.parent_id || 0,
    }));
    mainStatuses = allStatuses.value.filter(s => s.parent_id === 0 && s.entity_type?.trim() === 'SureCafe Parent Statuses');
    subStatusMap = {};
    mainStatuses.forEach(m => {
      subStatusMap[m.status] = allStatuses.value.filter(s => s.parent_id === m.status_id);
    });

    await nextTick();
    setTimeout(() => {
      renderAllCharts();
      if (activeTab.value === 'pipelines') renderPipelineTbody();
      else if (activeTab.value === 'candidates') renderCandidateTbody();
      else if (activeTab.value === 'jobs') renderJobTbody();
    }, 100);
  } catch(e) {
    console.error('Reports load error:', e);
  } finally {
    loading.value = false;
  }
}

// ─── Chart rendering ──────────────────────────────────────────────────────────
function destroyChart(chart) { if(chart) { try { chart.destroy(); } catch(_){} } }

function renderAllCharts() {
  if (activeTab.value === 'pipelines') {
    renderPipelineMetrics(); renderClientMetrics(); renderMonthlyMetrics();
  } else if (activeTab.value === 'candidates') {
    renderCandidateStatusChart(); renderMonthlyCandidateMetrics();
  } else if (activeTab.value === 'jobs') {
    renderJobStatusChart(); renderMonthlyJobsMetrics();
  }
}

function doughnutChart(canvasId, labels, values, existingChart) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  destroyChart(existingChart);
  const total = values.reduce((a,b) => a+b, 0);
  return new window.Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets:[{ data: values, backgroundColor: CHART_COLORS.slice(0, labels.length), borderColor:'#fff', borderWidth:2 }] },
    plugins: [window.ChartDataLabels],
    options: {
      responsive:true, maintainAspectRatio:true, layout:{ padding:25 },
      plugins: {
        legend:{ display:false },
        datalabels:{
          display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
          formatter: v => total > 0 ? ((v/total)*100).toFixed(1)+'%' : '0%',
          color:'#000', font:{ size:12, weight:'bold' }, anchor:'end', align:'end', offset:5, clamp:true, clip:false
        },
        tooltip:{ callbacks:{ label: ctx => `${ctx.label}: ${ctx.parsed} (${total>0?((ctx.parsed/total)*100).toFixed(1):0}%)` } }
      }
    }
  });
}

function barChart(canvasId, labels, values, existingChart, tooltipLabel) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  destroyChart(existingChart);
  return new window.Chart(ctx, {
    type: 'bar',
    data: { labels, datasets:[{ label:tooltipLabel, data:values, backgroundColor: CHART_COLORS.slice(0, labels.length), borderColor: CHART_COLORS.slice(0, labels.length), borderWidth:1, barThickness:30, maxBarThickness:35 }] },
    plugins: [window.ChartDataLabels],
    options: {
      responsive:true, maintainAspectRatio:true, layout:{ padding:{ top:20 } },
      plugins: {
        legend:{ display:false },
        datalabels:{ display:true, formatter: v => v, color:'#000', font:{ size:11, weight:'bold' }, anchor:'end', align:'top', offset:5 },
        tooltip:{ callbacks:{ label: ctx => `${tooltipLabel}: ${ctx.parsed.y}` } }
      },
      scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } }
    }
  });
}

function renderLegend(containerId, labels, values) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = labels.map((lbl, i) => `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${CHART_COLORS[i % CHART_COLORS.length]};"></span>
      <span style="font-weight:500;">${lbl} (${values[i]})</span>
    </div>`).join('');
}

function renderPipelineMetrics() {
  const metrics = {};
  mainStatuses.forEach(m => {
    const subs = (subStatusMap[m.status]||[]).map(s=>s.status);
    const all  = [m.status, ...subs];
    metrics[m.status] = filteredApplications.value.filter(a => all.includes(a.status)).length;
  });
  const labels = Object.keys(metrics); const values = Object.values(metrics);
  renderLegend('pipelineLegendContainer', labels, values);
  pipelineMetricsChart = doughnutChart('pipelineMetricsChart', labels, values, pipelineMetricsChart);
}
function renderClientMetrics() {
  const metrics = {};
  filteredApplications.value.forEach(a => { const k = a.client_name||'Unknown'; metrics[k]=(metrics[k]||0)+1; });
  const sorted = Object.entries(metrics).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels = sorted.map(([k])=>k.length>15?k.substring(0,15)+'...':k);
  const values = sorted.map(([,v])=>v);
  const ctx = document.getElementById('clientMetricsChart');
  if (!ctx) return;
  destroyChart(clientMetricsChart);
  clientMetricsChart = new window.Chart(ctx, {
    type: 'bar',
    data: { labels, datasets:[{ label:'Applications', data:values, backgroundColor:'#3F51B5', borderColor:'#3F51B5', borderWidth:1, barThickness:30, maxBarThickness:35 }] },
    plugins: [window.ChartDataLabels],
    options: {
      responsive:true, maintainAspectRatio:true, layout:{ padding:{ top:20 } },
      plugins: {
        legend:{ display:false },
        datalabels:{ display:true, formatter: v => v, color:'#000', font:{ size:11, weight:'bold' }, anchor:'end', align:'top', offset:5 },
        tooltip:{ callbacks:{ label: ctx => `Applications: ${ctx.parsed.y}` } }
      },
      scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } }
    }
  });
}
function renderMonthlyMetrics() {
  const md = getMonthlyData(filteredApplications.value, 'created_at');
  monthlyMetricsChart = barChart('monthlyMetricsChart', Object.keys(md), Object.values(md), monthlyMetricsChart, 'Candidates');
}
function renderCandidateStatusChart() {
  const metrics = {};
  filteredCandidates.value.forEach(c => { const k = c.status||'Unknown'; metrics[k]=(metrics[k]||0)+1; });
  const labels = Object.keys(metrics); const values = Object.values(metrics);
  renderLegend('candidateStatusLegendContainer', labels, values);
  candidateStatusMetricsChart = doughnutChart('candidateStatusMetricsChart', labels, values, candidateStatusMetricsChart);
}
function renderMonthlyCandidateMetrics() {
  const md = getMonthlyData(filteredCandidates.value, 'dateAdded');
  monthlyCandidateChart = barChart('monthlyCandidateMetricsChart', Object.keys(md), Object.values(md), monthlyCandidateChart, 'Candidates');
}
function renderJobStatusChart() {
  const metrics = {};
  filteredJobs.value.forEach(j => { const k = j.status||'Unknown'; metrics[k]=(metrics[k]||0)+1; });
  const labels = Object.keys(metrics); const values = Object.values(metrics);
  renderLegend('jobStatusLegendContainer', labels, values);
  jobStatusMetricsChart = doughnutChart('jobStatusMetricsChart', labels, values, jobStatusMetricsChart);
}
function renderMonthlyJobsMetrics() {
  const md = getMonthlyData(filteredJobs.value, 'dateAdded');
  monthlyJobsChart = barChart('monthlyJobsMetricsChart', Object.keys(md), Object.values(md), monthlyJobsChart, 'Jobs');
}

// ─── Table body rendering (innerHTML approach — matches Reports.html exactly) ─
function renderPipelineTbody() {
  nextTick(() => {
    const tbody = document.getElementById('pipelineTbody');
    if (!tbody) return;
    const rows = pipelineRows.value;
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📭</div><p>No applications found matching your filters</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(app => `<tr>
      <td style="font-weight:600;color:#313030;font-size:14px;">${app.candidate_name || '-'}</td>
      <td>${app.job_title || '-'}</td>
      <td>${app.status || '-'}</td>
      <td>${app.candidate_email || '-'}</td>
      <td>${app.candidate_role || '-'}</td>
      <td>${app.experience || '-'}</td>
      <td>${app.client_name || '-'}</td>
      <td>${formatDate(app.created_at) || '-'}</td>
    </tr>`).join('');
  });
}
function renderCandidateTbody() {
  nextTick(() => {
    const tbody = document.getElementById('candidateTbody');
    if (!tbody) return;
    const rows = candidateRows.value;
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📭</div><p>No candidates found matching your filters</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(c => `<tr>
      <td style="font-weight:600;color:#313030;font-size:14px;">${c.name || '-'}</td>
      <td>${c.status || '-'}</td>
      <td>${c.email || '-'}</td>
      <td>${c.role || '-'}</td>
      <td>${c.experience || '-'}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.company || '-'}</td>
      <td>${c.location || '-'}</td>
      <td>${formatDate(c.dateAdded) || '-'}</td>
    </tr>`).join('');
  });
}
function renderJobTbody() {
  nextTick(() => {
    const tbody = document.getElementById('jobTbody');
    if (!tbody) return;
    const rows = jobRows.value;
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">📭</div><p>No jobs found matching your filters</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(j => `<tr>
      <td style="font-weight:600;color:#313030;font-size:14px;">${j.title || '-'}</td>
      <td>${j.status || '-'}</td>
      <td>${j.location || '-'}</td>
      <td>${j.employment_type || '-'}</td>
      <td>${j.experience_level || '-'}</td>
      <td>${j.department || '-'}</td>
      <td>${j.priority || '-'}</td>
      <td>${j.experience_years || '-'}</td>
      <td>${j.salary_range || '-'}</td>
      <td>${formatDate(j.dateAdded) || '-'}</td>
    </tr>`).join('');
  });
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  // Destroy current tab's charts before switching so v-if removes stale canvases cleanly
  if (activeTab.value === 'pipelines') {
    destroyChart(pipelineMetricsChart); pipelineMetricsChart = null;
    destroyChart(clientMetricsChart);   clientMetricsChart = null;
    destroyChart(monthlyMetricsChart);  monthlyMetricsChart = null;
  } else if (activeTab.value === 'candidates') {
    destroyChart(candidateStatusMetricsChart); candidateStatusMetricsChart = null;
    destroyChart(monthlyCandidateChart);       monthlyCandidateChart = null;
  } else if (activeTab.value === 'jobs') {
    destroyChart(jobStatusMetricsChart); jobStatusMetricsChart = null;
    destroyChart(monthlyJobsChart);      monthlyJobsChart = null;
  }
  activeTab.value = tab;
  openFilterKey.value = null;
  nextTick(() => setTimeout(() => {
    renderAllCharts();
    if (tab === 'pipelines') renderPipelineTbody();
    else if (tab === 'candidates') renderCandidateTbody();
    else if (tab === 'jobs') renderJobTbody();
  }, 100));
}

// Watches: re-render tbody when filtered rows change
watch(pipelineRows, () => { if (activeTab.value === 'pipelines') renderPipelineTbody(); });
watch(candidateRows, () => { if (activeTab.value === 'candidates') renderCandidateTbody(); });
watch(jobRows, () => { if (activeTab.value === 'jobs') renderJobTbody(); });

// ─── Filter helpers ───────────────────────────────────────────────────────────
function toggleFilter(key) { openFilterKey.value = openFilterKey.value === key ? null : key; }
function closeAllFilters() { openFilterKey.value = null; }

function clearPipelineFilters() {
  pipelineSearch.value=''; pipelineDateFilter.value='all';
  pipelineFromDate.value=''; pipelineToDate.value='';
  pipelineStatusSel.value=[]; pipelineJobSel.value=[]; pipelineClientSel.value=[];
  pipelineStatusSearch.value=''; pipelineJobSearch.value=''; pipelineClientSearch.value='';
  pipelineCurrentPage.value=1; openFilterKey.value=null;
}
function clearCandidateFilters() {
  candidateSearch.value=''; candidateDateFilter.value='all';
  candidateFromDate.value=''; candidateToDate.value='';
  candidateStatusSel.value=[]; candidateStatusSearch.value='';
  candidateCurrentPage.value=1; openFilterKey.value=null;
}
function clearJobFilters() {
  jobSearch.value=''; jobDateFilter.value='all';
  jobFromDate.value=''; jobToDate.value='';
  jobStatusSel.value=[]; jobEmpSel.value=[];
  jobStatusSearch.value=''; jobEmpSearch.value='';
  jobCurrentPage.value=1; openFilterKey.value=null;
}

// ─── Send Report ──────────────────────────────────────────────────────────────
function openSendReportModal() {
  reportClientSel.value=''; reportToEmail.value=''; reportCCEmail.value='';
  reportSubject.value=''; reportMessage.value='';
  sendReportVisible.value = true;
}
function closeSendReportModal() { sendReportVisible.value = false; }

function onReportClientChange() {
  if (reportClientSel.value === 'other') {
    reportToEmail.value = '';
  } else {
    const client = allClients.value.find(c => c.id === reportClientSel.value);
    reportToEmail.value = client ? (client.email || '') : '';
  }
}

async function sendReportEmail() {
  if (!reportClientSel.value) {
    reportResultMsg.value = '❌ Please select a client or choose Other.';
    reportResultVisible.value = true; return;
  }
  if (!reportToEmail.value) {
    reportResultMsg.value = '❌ Please enter a recipient email address.';
    reportResultVisible.value = true; return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportToEmail.value)) {
    reportResultMsg.value = '❌ Please enter a valid email address.';
    reportResultVisible.value = true; return;
  }

  let reportData = [];
  if (activeTab.value === 'pipelines') {
    reportData = filteredApplications.value.map(a => ({
      'Candidate Name': a.candidate_name, 'Job Title': a.job_title, 'Status': a.status,
      'Email': a.candidate_email, 'Role': a.candidate_role, 'Experience': a.experience,
      'Client': a.client_name, 'Created At': formatDate(a.created_at)
    }));
  } else if (activeTab.value === 'candidates') {
    reportData = filteredCandidates.value.map(c => ({
      'Name': c.name, 'Status': c.status, 'Email': c.email, 'Role': c.role,
      'Total Experience': c.experience, 'Phone': c.phone,
      'Current Company': c.company, 'Location': c.location, 'Created At': formatDate(c.dateAdded)
    }));
  } else if (activeTab.value === 'jobs') {
    reportData = filteredJobs.value.map(j => ({
      'Job Title': j.title, 'Status': j.status, 'Location': j.location,
      'Employment Type': j.employment_type, 'Experience Level': j.experience_level,
      'Department': j.department, 'Priority': j.priority,
      'Experience Years': j.experience_years, 'Salary Range': j.salary_range,
      'Created At': formatDate(j.dateAdded)
    }));
  }

  const payload = {
    recipient_email: reportToEmail.value,
    cc_email: reportCCEmail.value || '',
    subject: reportSubject.value || 'Recruitment Report',
    message: reportMessage.value || '',
    report_type: activeTab.value,
    report_data: reportData,
    generated_at: new Date().toISOString()
  };

  try {
    sendingReport.value = true;
    reportResultMsg.value = '📤 Sending report... Please wait.';
    reportResultVisible.value = true;
    const res = await fetch(REPORT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      reportResultMsg.value = '✅ Report sent successfully to: ' + reportToEmail.value;
      closeSendReportModal();
    } else {
      reportResultMsg.value = '❌ Failed to send report. Please try again.';
    }
  } catch (err) {
    reportResultMsg.value = '❌ Error sending report: ' + err.message;
  } finally {
    sendingReport.value = false;
  }
}

// ─── CSV Download ─────────────────────────────────────────────────────────────
function downloadCSV(rows, headers, filename) {
  const escape = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
  const csvContent = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h]||'')).join(','))].join('\n');
  const blob = new Blob([csvContent], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
function downloadPipelineCSV() {
  downloadCSV(filteredApplications.value.map(a=>({
    'Candidate Name':a.candidate_name, 'Job Title':a.job_title, 'Status':a.status,
    'Email':a.candidate_email, 'Candidate Role':a.candidate_role, 'Experience':a.experience,
    'Client':a.client_name, 'Created At':formatDate(a.created_at),
  })), ['Candidate Name','Job Title','Status','Email','Candidate Role','Experience','Client','Created At'], 'pipeline_report.csv');
}
function downloadCandidatesCSV() {
  downloadCSV(filteredCandidates.value.map(c=>({
    'Candidate Name':c.name, 'Status':c.status, 'Email':c.email, 'Role':c.role,
    'Total Experience':c.experience, 'Phone':c.phone,
    'Current Company':c.company, 'Location':c.location, 'Created At':formatDate(c.dateAdded),
  })), ['Candidate Name','Status','Email','Role','Total Experience','Phone','Current Company','Location','Created At'], 'candidates_report.csv');
}
function downloadJobsCSV() {
  downloadCSV(filteredJobs.value.map(j=>({
    'Job Title':j.title, 'Status':j.status, 'Location':j.location,
    'Employment Type':j.employment_type, 'Experience Level':j.experience_level,
    'Department':j.department, 'Priority':j.priority,
    'Experience Years':j.experience_years, 'Salary Range':j.salary_range, 'Created At':formatDate(j.dateAdded),
  })), ['Job Title','Status','Location','Employment Type','Experience Level','Department','Priority','Experience Years','Salary Range','Created At'], 'jobs_report.csv');
}

// ─── Click-outside handler ────────────────────────────────────────────────────
function onDocClick(e) {
  if (!e.target.closest('.filter-dropdown')) closeAllFilters();
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  document.addEventListener('click', onDocClick);
  loadAllData();
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  [pipelineMetricsChart, clientMetricsChart, monthlyMetricsChart,
   candidateStatusMetricsChart, monthlyCandidateChart, jobStatusMetricsChart, monthlyJobsChart]
    .forEach(destroyChart);
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="dashboard-header" style="margin-bottom:16px;">
      <h1 class="section-title">Reports</h1>
      <p style="font-size:15px;color:#6B7280;margin:0;">Track and analyze your recruitment data</p>
    </div>

    <!-- Global loader -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-warning" role="status"></div>
      <p class="mt-2 text-muted">Loading reports data...</p>
    </div>

    <template v-else>
      <!-- Tab Navigation -->
      <div class="tab-buttons">
        <button class="tab-btn" :class="{active: activeTab==='pipelines'}" @click="switchTab('pipelines')">
          <i class="bi bi-kanban"></i> Candidate Pipelines
        </button>
        <button class="tab-btn" :class="{active: activeTab==='candidates'}" @click="switchTab('candidates')">
          <i class="bi bi-person-fill"></i> All Candidates
        </button>
        <button class="tab-btn" :class="{active: activeTab==='jobs'}" @click="switchTab('jobs')">
          <i class="bi bi-briefcase-fill"></i> All Jobs
        </button>
      </div>

      <!-- =================== PIPELINES TAB =================== -->
      <div v-if="activeTab==='pipelines'">
        <div class="search-container">
          <div class="search-section">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;right:10px;color:orange;">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input v-model="pipelineSearch" type="text" class="form-control" placeholder="Search applications..." style="padding:5px 7px;" />
          </div>
          <button class="btn-action" @click="clearPipelineFilters"><i class="bi bi-arrow-repeat"></i> Reset Filters</button>
          <button class="btn-action" @click="loadAllData"><i class="bi bi-arrow-clockwise"></i> Reload Data</button>
        </div>

        <div class="filter-row">
          <div class="filter-group">
            <select v-model="pipelineDateFilter">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div v-if="pipelineDateFilter==='custom'" class="filter-group">
            <label>From Date</label>
            <input v-model="pipelineFromDate" type="date" />
          </div>
          <div v-if="pipelineDateFilter==='custom'" class="filter-group">
            <label>To Date</label>
            <input v-model="pipelineToDate" type="date" />
          </div>

          <div class="filter-dropdown" :class="{active: openFilterKey==='pStatus'}">
            <button class="filter-btn" :class="{'has-selection': pipelineStatusSel.length}" @click.stop="toggleFilter('pStatus')">
              Status {{ pipelineStatusSel.length ? `(${pipelineStatusSel.length})` : '' }} <i class="bi bi-chevron-down ms-1" style="font-size:11px;"></i>
            </button>
            <div class="filter-menu" v-show="openFilterKey==='pStatus'">
              <input v-model="pipelineStatusSearch" type="text" class="form-control filter-search" placeholder="Search..." @click.stop />
              <label v-for="opt in pipelineStatusOptions" :key="opt">
                <input type="checkbox" :value="opt" v-model="pipelineStatusSel" @click.stop /> {{ opt }}
              </label>
            </div>
          </div>

          <div class="filter-dropdown" :class="{active: openFilterKey==='pJob'}">
            <button class="filter-btn" :class="{'has-selection': pipelineJobSel.length}" @click.stop="toggleFilter('pJob')">
              Jobs {{ pipelineJobSel.length ? `(${pipelineJobSel.length})` : '' }} <i class="bi bi-chevron-down ms-1" style="font-size:11px;"></i>
            </button>
            <div class="filter-menu" v-show="openFilterKey==='pJob'">
              <input v-model="pipelineJobSearch" type="text" class="form-control filter-search" placeholder="Search..." @click.stop />
              <label v-for="opt in pipelineJobOptions" :key="opt">
                <input type="checkbox" :value="opt" v-model="pipelineJobSel" @click.stop /> {{ opt }}
              </label>
            </div>
          </div>

          <div class="filter-dropdown" :class="{active: openFilterKey==='pClient'}">
            <button class="filter-btn" :class="{'has-selection': pipelineClientSel.length}" @click.stop="toggleFilter('pClient')">
              Client {{ pipelineClientSel.length ? `(${pipelineClientSel.length})` : '' }} <i class="bi bi-chevron-down ms-1" style="font-size:11px;"></i>
            </button>
            <div class="filter-menu" v-show="openFilterKey==='pClient'">
              <input v-model="pipelineClientSearch" type="text" class="form-control filter-search" placeholder="Search..." @click.stop />
              <label v-for="opt in pipelineClientOptions" :key="opt">
                <input type="checkbox" :value="opt" v-model="pipelineClientSel" @click.stop /> {{ opt }}
              </label>
            </div>
          </div>

          <div class="table-actions-btns">
            <button class="btn-export" @click="downloadPipelineCSV">
              <i class="bi bi-download"></i> Download Report(CSV)
            </button>
            <button class="btn-export primary" @click="openSendReportModal" style="display: none;">
              <i class="bi bi-envelope"></i> Send Report
            </button>
          </div>
        </div>

        <!-- Charts -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:24px;margin-top:24px;">
          <div class="section-card" style="padding:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1976d2;margin-bottom:15px;">Candidates in Pipeline Metrics</h3>
            <div style="display:flex;align-items:center;justify-content:center;height:220px;">
              <canvas id="pipelineMetricsChart" style="max-width:100%;max-height:220px;"></canvas>
            </div>
            <div id="pipelineLegendContainer" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;font-size:13px;"></div>
          </div>
          <div class="section-card" style="padding:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1976d2;margin-bottom:15px;">Application for Client Metrics</h3>
            <div style="display:flex;align-items:center;justify-content:center;height:280px;">
              <canvas id="clientMetricsChart" style="max-width:100%;max-height:280px;"></canvas>
            </div>
          </div>
          <div class="section-card" style="padding:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1976d2;margin-bottom:15px;">Monthly Pipeline Metrics</h3>
            <div style="display:flex;align-items:center;justify-content:center;height:280px;">
              <canvas id="monthlyMetricsChart" style="max-width:100%;max-height:280px;"></canvas>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="section-card" style="border-radius:6px;border:1px solid #b6e0ed;padding:10px 20px;">
          <div class="table-header">
            <div class="table-title">Candidate Pipelines Data</div>
          </div>
          <div class="table-wrapper">
            <table class="rpt-tbl">
              <colgroup>
                <col style="width:13%"><col style="width:14%"><col style="width:13%">
                <col style="width:15%"><col style="width:16%"><col style="width:7%">
                <col style="width:14%"><col style="width:8%">
              </colgroup>
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Job Title</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Candidate Role</th>
                  <th>Experience</th>
                  <th>Client</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody id="pipelineTbody"></tbody>
            </table>
          </div>
          <div class="pagination-info">
            Total: <span>{{ allApplications.length }}</span> applications | Showing: <span>{{ filteredApplications.length }}</span>
            <div v-if="pipelinePages>1" class="pagination-controls">
              <button @click="pipelineCurrentPage--" :disabled="pipelineCurrentPage===1">← Previous</button>
              <button v-for="p in visiblePageNums(pipelineCurrentPage, pipelinePages)" :key="p"
                :class="{active:pipelineCurrentPage===p}" @click="pipelineCurrentPage=p">{{ p }}</button>
              <button @click="pipelineCurrentPage++" :disabled="pipelineCurrentPage===pipelinePages">Next →</button>
              <span class="pagination-info-text">Page {{ pipelineCurrentPage }} of {{ pipelinePages }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- =================== CANDIDATES TAB =================== -->
      <div v-if="activeTab==='candidates'">
        <div class="search-container">
          <div class="search-section">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;right:10px;color:orange;">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input v-model="candidateSearch" type="text" class="form-control" placeholder="Search candidates..." style="padding:5px 7px;" />
          </div>
          <button class="btn-action" @click="clearCandidateFilters"><i class="bi bi-arrow-repeat"></i> Reset Filters</button>
          <button class="btn-action" @click="loadAllData"><i class="bi bi-arrow-clockwise"></i> Reload Data</button>
        </div>

        <div class="filter-row">
          <div class="filter-group">
            <select v-model="candidateDateFilter">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div v-if="candidateDateFilter==='custom'" class="filter-group">
            <label>From Date</label>
            <input v-model="candidateFromDate" type="date" />
          </div>
          <div v-if="candidateDateFilter==='custom'" class="filter-group">
            <label>To Date</label>
            <input v-model="candidateToDate" type="date" />
          </div>

          <div class="filter-dropdown" :class="{active: openFilterKey==='cStatus'}">
            <button class="filter-btn" :class="{'has-selection': candidateStatusSel.length}" @click.stop="toggleFilter('cStatus')">
              Status {{ candidateStatusSel.length ? `(${candidateStatusSel.length})` : '' }} <i class="bi bi-chevron-down ms-1" style="font-size:11px;"></i>
            </button>
            <div class="filter-menu" v-show="openFilterKey==='cStatus'">
              <input v-model="candidateStatusSearch" type="text" class="form-control filter-search" placeholder="Search..." @click.stop />
              <label v-for="opt in candidateStatusOptions" :key="opt">
                <input type="checkbox" :value="opt" v-model="candidateStatusSel" @click.stop /> {{ opt }}
              </label>
            </div>
          </div>

          <div class="table-actions-btns">
            <button class="btn-export" @click="downloadCandidatesCSV">
              <i class="bi bi-download"></i> Download Report(CSV)
            </button>
            <button class="btn-export primary" @click="openSendReportModal">
              <i class="bi bi-envelope"></i> Send Report
            </button>
          </div>
        </div>

        <!-- Charts -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;margin-top:24px;">
          <div class="section-card" style="padding:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1976d2;margin-bottom:15px;">Candidates Status Metrics</h3>
            <div style="display:flex;align-items:center;justify-content:center;height:220px;">
              <canvas id="candidateStatusMetricsChart" style="max-width:100%;max-height:220px;"></canvas>
            </div>
            <div id="candidateStatusLegendContainer" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;font-size:13px;"></div>
          </div>
          <div class="section-card" style="padding:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1976d2;margin-bottom:15px;">Monthly Candidate Metrics</h3>
            <div style="display:flex;align-items:center;justify-content:center;height:280px;">
              <canvas id="monthlyCandidateMetricsChart" style="max-width:100%;max-height:280px;"></canvas>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="section-card" style="border-radius:6px;border:1px solid #b6e0ed;padding:10px 20px;">
          <div class="table-header">
            <div class="table-title">Candidates Data</div>
          </div>
          <div class="table-wrapper">
            <table class="rpt-tbl">
              <colgroup>
                <col style="width:14%"><col style="width:10%"><col style="width:13%">
                <col style="width:12%"><col style="width:10%"><col style="width:10%">
                <col style="width:12%"><col style="width:10%"><col style="width:9%">
              </colgroup>
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Total Experience</th>
                  <th>Phone</th>
                  <th>Current Company</th>
                  <th>Location</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody id="candidateTbody"></tbody>
            </table>
          </div>
          <div class="pagination-info">
            Total: <span>{{ allCandidates.length }}</span> candidates | Showing: <span>{{ filteredCandidates.length }}</span>
            <div v-if="candidatePages>1" class="pagination-controls">
              <button @click="candidateCurrentPage--" :disabled="candidateCurrentPage===1">← Previous</button>
              <button v-for="p in visiblePageNums(candidateCurrentPage, candidatePages)" :key="p"
                :class="{active:candidateCurrentPage===p}" @click="candidateCurrentPage=p">{{ p }}</button>
              <button @click="candidateCurrentPage++" :disabled="candidateCurrentPage===candidatePages">Next →</button>
              <span class="pagination-info-text">Page {{ candidateCurrentPage }} of {{ candidatePages }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- =================== JOBS TAB =================== -->
      <div v-if="activeTab==='jobs'">
        <div class="search-container">
          <div class="search-section">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;right:10px;color:orange;">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input v-model="jobSearch" type="text" class="form-control" placeholder="Search jobs..." style="padding:5px 7px;" />
          </div>
          <button class="btn-action" @click="clearJobFilters"><i class="bi bi-arrow-clockwise"></i> Reset Filters</button>
          <button class="btn-action" @click="loadAllData"><i class="bi bi-arrow-repeat"></i> Reload Data</button>
        </div>

        <div class="filter-row">
          <div class="filter-group">
            <select v-model="jobDateFilter">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div v-if="jobDateFilter==='custom'" class="filter-group">
            <label>From Date</label>
            <input v-model="jobFromDate" type="date" />
          </div>
          <div v-if="jobDateFilter==='custom'" class="filter-group">
            <label>To Date</label>
            <input v-model="jobToDate" type="date" />
          </div>

          <div class="filter-dropdown" :class="{active: openFilterKey==='jStatus'}">
            <button class="filter-btn" :class="{'has-selection': jobStatusSel.length}" @click.stop="toggleFilter('jStatus')">
              Job Status {{ jobStatusSel.length ? `(${jobStatusSel.length})` : '' }} <i class="bi bi-chevron-down ms-1" style="font-size:11px;"></i>
            </button>
            <div class="filter-menu" v-show="openFilterKey==='jStatus'">
              <input v-model="jobStatusSearch" type="text" class="form-control filter-search" placeholder="Search..." @click.stop />
              <label v-for="opt in jobStatusOptions" :key="opt">
                <input type="checkbox" :value="opt" v-model="jobStatusSel" @click.stop /> {{ opt }}
              </label>
            </div>
          </div>

          <div class="filter-dropdown" :class="{active: openFilterKey==='jEmp'}">
            <button class="filter-btn" :class="{'has-selection': jobEmpSel.length}" @click.stop="toggleFilter('jEmp')">
              Employment Type {{ jobEmpSel.length ? `(${jobEmpSel.length})` : '' }} <i class="bi bi-chevron-down ms-1" style="font-size:11px;"></i>
            </button>
            <div class="filter-menu" v-show="openFilterKey==='jEmp'">
              <input v-model="jobEmpSearch" type="text" class="form-control filter-search" placeholder="Search..." @click.stop />
              <label v-for="opt in jobEmploymentOptions" :key="opt">
                <input type="checkbox" :value="opt" v-model="jobEmpSel" @click.stop /> {{ opt }}
              </label>
            </div>
          </div>

          <div class="table-actions-btns">
            <button class="btn-export" @click="downloadJobsCSV">
              <i class="bi bi-download"></i> Download Report(CSV)
            </button>
            <button class="btn-export primary" @click="openSendReportModal">
              <i class="bi bi-envelope"></i> Send Report
            </button>
          </div>
        </div>

        <!-- Charts -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;margin-top:24px;">
          <div class="section-card" style="padding:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1976d2;margin-bottom:15px;">Jobs Status Metrics</h3>
            <div style="display:flex;align-items:center;justify-content:center;height:220px;">
              <canvas id="jobStatusMetricsChart" style="max-width:100%;max-height:220px;"></canvas>
            </div>
            <div id="jobStatusLegendContainer" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;font-size:13px;"></div>
          </div>
          <div class="section-card" style="padding:20px;">
            <h3 style="font-size:16px;font-weight:600;color:#1976d2;margin-bottom:15px;">Monthly Jobs Metrics</h3>
            <div style="display:flex;align-items:center;justify-content:center;height:280px;">
              <canvas id="monthlyJobsMetricsChart" style="max-width:100%;max-height:280px;"></canvas>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="section-card" style="border-radius:6px;border:1px solid #b6e0ed;padding:10px 20px;">
          <div class="table-header">
            <div class="table-title">Jobs Data</div>
          </div>
          <div class="table-wrapper">
            <table class="rpt-tbl">
              <colgroup>
                <col style="width:14%"><col style="width:9%"><col style="width:10%">
                <col style="width:12%"><col style="width:12%"><col style="width:10%">
                <col style="width:8%"><col style="width:10%"><col style="width:10%"><col style="width:5%">
              </colgroup>
              <thead>
                <tr>
                  <th>Job Title</th><th>Status</th><th>Location</th>
                  <th>Employment Type</th><th>Experience Level</th><th>Department</th>
                  <th>Priority</th><th>Experience Years</th><th>Salary Range</th><th>Created At</th>
                </tr>
              </thead>
              <tbody id="jobTbody"></tbody>
            </table>
          </div>
          <div class="pagination-info">
            Total: <span>{{ allJobs.length }}</span> jobs | Showing: <span>{{ filteredJobs.length }}</span>
            <div v-if="jobPages>1" class="pagination-controls">
              <button @click="jobCurrentPage--" :disabled="jobCurrentPage===1">← Previous</button>
              <button v-for="p in visiblePageNums(jobCurrentPage, jobPages)" :key="p"
                :class="{active:jobCurrentPage===p}" @click="jobCurrentPage=p">{{ p }}</button>
              <button @click="jobCurrentPage++" :disabled="jobCurrentPage===jobPages">Next →</button>
              <span class="pagination-info-text">Page {{ jobCurrentPage }} of {{ jobPages }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- =================== SEND REPORT MODAL =================== -->
    <div v-if="sendReportVisible" class="web-process-modal" @click.self="closeSendReportModal">
      <div class="web-modal-content" style="max-width:600px;width:95%;">
        <span class="web-close-btn" @click="closeSendReportModal">&times;</span>
        <h3>Send Report</h3>

        <div style="margin-bottom:15px;">
          <label style="display:block;margin-bottom:5px;font-weight:500;">Select Client</label>
          <select v-model="reportClientSel" class="form-control" style="padding:8px;border-radius:6px;border:1px solid #d1d5db;width:100%;font-size:14px;" @change="onReportClientChange">
            <option value="">-- Select Client --</option>
            <option value="other">Other</option>
            <option v-for="c in allClients" :key="c.id" :value="c.id">{{ c.company_name }}</option>
          </select>
        </div>

        <!-- Other: manual email entry -->
        <div v-if="reportClientSel === 'other'" style="margin-bottom:15px;">
          <label style="display:block;margin-bottom:5px;font-weight:500;">Client Email</label>
          <input v-model="reportToEmail" type="email" class="form-control" placeholder="Enter client email" style="padding:8px;border-radius:6px;border:1px solid #d1d5db;width:100%;margin-bottom:12px;font-size:14px;" />
          <label style="display:block;margin-bottom:5px;font-weight:500;">CC Email</label>
          <input v-model="reportCCEmail" type="email" class="form-control" placeholder="Enter CC email" style="padding:8px;border-radius:6px;border:1px solid #d1d5db;width:100%;font-size:14px;" />
        </div>

        <!-- Existing client: auto-filled email + CC -->
        <div v-else-if="reportClientSel" style="margin-bottom:15px;">
          <label style="display:block;margin-bottom:5px;font-weight:500;">Recipient Email</label>
          <input v-model="reportToEmail" type="email" class="form-control" placeholder="Client email" style="padding:8px;border-radius:6px;border:1px solid #d1d5db;width:100%;margin-bottom:12px;font-size:14px;" />
          <label style="display:block;margin-bottom:5px;font-weight:500;">CC Email</label>
          <input v-model="reportCCEmail" type="email" class="form-control" placeholder="Enter comma separated CC email" style="padding:8px;border-radius:6px;border:1px solid #d1d5db;width:100%;font-size:14px;" />
        </div>

        <div style="margin-bottom:15px;">
          <label style="display:block;margin-bottom:5px;font-weight:500;">Subject</label>
          <input v-model="reportSubject" type="text" class="form-control" placeholder="Report subject" style="padding:8px;border-radius:6px;border:1px solid #d1d5db;width:100%;font-size:14px;" />
        </div>
        <div style="margin-bottom:15px;">
          <label style="display:block;margin-bottom:5px;font-weight:500;">Message (Optional)</label>
          <textarea v-model="reportMessage" class="form-control" rows="4" placeholder="Add a message..." style="padding:8px;border-radius:6px;border:1px solid #d1d5db;width:100%;font-size:14px;"></textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" @click="closeSendReportModal">Cancel</button>
          <button class="btn btn-primary" @click="sendReportEmail" :disabled="sendingReport"
            style="background-color:#3367d6;border-color:#3367d6;">
            {{ sendingReport ? 'Sending...' : 'Send Report' }}
          </button>
        </div>
      </div>
    </div>

    <!-- =================== RESULT MODAL =================== -->
    <div v-if="reportResultVisible" class="web-process-modal" @click.self="reportResultVisible=false">
      <div class="web-modal-content">
        <span class="web-close-btn" @click="reportResultVisible=false">&times;</span>
        <h3>Status</h3>
        <div style="font-size:14px;line-height:1.6;" v-html="reportResultMsg"></div>
        <div style="text-align:right;margin-top:15px;">
          <button class="btn btn-primary" @click="reportResultVisible=false">OK</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Tabs ─── */
.tab-buttons { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #E5E7EB; }
.tab-btn { padding: 10px 20px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 500; color: #999; border-bottom: 3px solid transparent; transition: all 0.3s ease; margin-bottom: -2px; }
.tab-btn:hover { color: #555; }
.tab-btn.active { color: #1976d2; border-bottom-color: #1976d2; font-weight: 600; }

/* ─── Search & Buttons ─── */
.search-container { display: flex; align-items: center; gap: 12px; width: 100%; margin-bottom: 10px; }
.search-section { position: relative; display: flex; align-items: center; flex: 1; }
.search-section input { width: 100%; padding-right: 30px; padding-left: 23px !important; border-radius: 8px !important; border: 1px solid #d1d5db; }
.btn-action { background-color: #4285f4; color: white; border: none; padding: 7px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.btn-action:hover { background-color: #3367d6; }

/* ─── Filter Row ─── */
.filter-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 10px; }
.filter-group { flex: 0 1 auto; min-width: 140px; }
.filter-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #555; }
.filter-group select, .filter-group input[type="date"] { width: 100%; padding: 5px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; }
.filter-group select:hover, .filter-group input:hover { border-color: #90caf9; background: #f8fbff; }
.table-actions-btns { display: flex; gap: 8px; margin-left: auto; align-items: flex-end; }

/* ─── Export Buttons ─── */
.btn-export { padding: 6px 12px; border-radius: 6px; border: 1px solid #d7d7d7; background: white; color: #333; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 5px; font-weight: 600; }
.btn-export:hover { background: #f0f0f0; }
.btn-export.primary { background: #4285f4; color: white; border-color: #4285f4; }
.btn-export.primary:hover { background: #3367d6; }

/* ─── Filter Dropdowns ─── */
.filter-dropdown { position: relative; }
.filter-btn { padding: 5px 14px; border: 1px solid #d1d5db; background: #fff; border-radius: 8px; cursor: pointer; min-width: 150px; text-align: left; font-size: 14px; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.1); white-space: nowrap; }
.filter-btn:hover { border-color: #90caf9; background: #f8fbff; transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
.filter-btn.has-selection { background-color: #e3f2fd; border-color: #90caf9; font-weight: 600; }
.filter-menu { position: absolute; top: 110%; left: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 220px; max-height: 280px; overflow-y: auto; z-index: 1000; padding: 10px; }
.filter-menu label { display: flex; align-items: center; padding: 6px 8px; font-size: 13px; cursor: pointer; color: #374151; font-weight: 400; border-radius: 6px; transition: background 0.2s; }
.filter-menu label:hover { background: #f3f4f6; }
.filter-menu input[type="checkbox"] { margin-right: 8px; width: 16px; height: 16px; cursor: pointer; }
.filter-search { border: 1px solid #e5e7eb !important; border-radius: 6px !important; font-size: 13px !important; margin-bottom: 8px !important; padding: 4px 8px !important; width: 100% !important; }

/* ─── Table ─── */
.table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.table-title { font-size: 18px; font-weight: 600; color: #1976d2; }
.table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }

/* ─── Empty state ─── */
.empty-state { text-align: center; padding: 60px 20px; color: #999; }
.empty-state-icon { font-size: 48px; margin-bottom: 15px; opacity: 0.5; }

/* ─── Pagination ─── */
.pagination-info { font-size: 12px; color: #666; margin-top: 10px; }
.pagination-info-text { font-size: 13px; color: #666; margin: 0 10px; }
.pagination-controls { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 10px; margin-bottom: 10px; }
.pagination-controls button { padding: 6px 12px; border: 1px solid #d1d5db; background: white; color: #333; cursor: pointer; border-radius: 6px; font-size: 13px; transition: all 0.3s ease; }
.pagination-controls button:hover { background: #f0f0f0; border-color: #90caf9; }
.pagination-controls button.active { background: #1976d2; color: white; border-color: #1976d2; }
.pagination-controls button:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── Send Report Modal ─── */
.web-process-modal { display: flex; position: fixed; inset: 0; z-index: 1500; background-color: rgba(0,0,0,0.5); justify-content: center; align-items: center; }
.web-modal-content { background-color: white; padding: 20px; border-radius: 10px; max-width: 500px; width: 90%; box-shadow: 0 5px 20px rgba(0,0,0,0.3); position: relative; max-height: 90vh; overflow-y: auto; }
.web-close-btn { float: right; font-size: 22px; font-weight: bold; cursor: pointer; position: absolute; right: 7px; top: 1px; color: #555; }
.web-modal-content h3 { margin-top: -5px; color: #1976d2; font-weight: 500; border-bottom: 1px solid #1976d2; padding-bottom: 5px; font-size: 16px; margin-bottom: 20px; }
</style>
