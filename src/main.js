import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './assets/main.css';

import Dashboard from './pages/Dashboard.vue';
import CandidatePipelines from './pages/CandidatePipelines.vue';
import Candidates from './pages/Candidates.vue';
import JobDescriptions from './pages/JobDescriptions.vue';
import JDCandidatesMatch from './pages/JDCandidatesMatch.vue';
import Clients from './pages/Clients.vue';
import Reports from './pages/Reports.vue';

const routes = [
  { path: '/', component: Dashboard },
  { path: '/candidate-pipelines', component: CandidatePipelines },
  { path: '/candidates', component: Candidates },
  { path: '/job-descriptions', component: JobDescriptions },
  { path: '/jd-candidates-match', component: JDCandidatesMatch },
  { path: '/clients', component: Clients },
  { path: '/reports', component: Reports },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const app = createApp(App);
app.use(router);
app.mount('#app');
