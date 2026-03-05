<template>
  <div class="container py-4">
    <!-- Header -->
    <div class="dashboard-header d-flex justify-content-between align-items-center mb-3">
      <div>
        <h1 class="section-title">Candidate Pipelines</h1>
      </div>
    </div>

    <!-- Search + controls -->
    <div class="search-container">
      <div class="search-section">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;right:10px;color:orange;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="searchInput" placeholder="Search candidates, job titles..." class="form-control" style="padding:4px 22px !important;border-radius:8px !important;font-size:1rem !important;" />
      </div>
      <button id="resetFiltersBtn" class="btn btn-primary" style="background-color:#4285f4;font-size:14px;padding:5px 7px;"><i class="bi bi-arrow-clockwise"></i> Reset Filters</button>
      <button class="btn btn-primary" id="refreshData" style="background-color:#4285f4;font-size:14px;padding:5px 7px;"><i class="bi bi-arrow-repeat"></i> Reload Data</button>
      <div class="view-toggle">
        <button id="boardViewBtn" class="active" @click="switchView('board')"><i class="bi bi-kanban"></i> Board</button>
        <button id="listViewBtn" @click="switchView('list')"><i class="bi bi-list-ul"></i> List</button>
      </div>
    </div>

    <!-- Status Tabs -->
    <div id="statusTabsContainer" class="status-tabs-container"></div>
    <!-- Status SubTabs -->
    <div id="statusSubtabsContainer"></div>

    <div class="section-card" style="border-radius:6px;border:1px solid #b6e0ed;padding:20px !important;">
      <div id="loader" class="text-center my-4">
        <div class="spinner-border text-warning" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">Fetching candidate applications...</p>
      </div>
      <div id="candidateList" class="candidate-list" style="display:none;"></div>
      <div id="kanbanBoard" class="kanban-board active"></div>
      <div id="paginationControls" class="pagination-controls mt-3"></div>
    </div>
  </div>

  <!-- Result Modal -->
  <div id="resultModal" class="web-process-modal" style="z-index:1500 !important">
    <div class="web-modal-content">
      <span class="web-close-btn" @click="closeModal()">&times;</span>
      <h3>Status</h3>
      <div id="resultMessage">Processing...</div>
    </div>
  </div>

  <!-- Floating View Toggle -->
  <div id="floatingViewToggle" class="floating-view-toggle">
    <button id="floatingBoardViewBtn" class="active" @click="switchView('board'); updateFloatingToggle();"><i class="bi bi-kanban"></i> Board</button>
    <button id="floatingListViewBtn" @click="switchView('list'); updateFloatingToggle();"><i class="bi bi-list-ul"></i> List</button>
  </div>

  <!-- Floating Reset Button -->
  <button id="floatingResetBtn" class="floating-reset-btn" @click="resetFiltersFromFloating()" title="Reset Filters">
    <i class="bi bi-arrow-clockwise"></i>
  </button>

  <!-- Kanban Card Details Modal -->
  <div class="modal fade" id="kanbanCardModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered">
      <div class="modal-content rounded-3 shadow">
        <div class="modal-header">
          <h5 class="modal-title">Candidate Details</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="kanbanCardDetails"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Send Email Modal -->
  <div class="modal fade" id="sendEmailModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content rounded-3 shadow">
        <div class="modal-header">
          <h5 class="modal-title">Send Email to Candidate</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <form id="sendEmailForm">
          <div class="modal-body" style="font-size:14px !important;">
            <div class="row g-3">
              <div class="col-md-12">
                <p style="font-size:16px;font-weight:600;">Job Title: <span id="emailJobTitle"></span></p>
              </div>
              <input type="hidden" id="emailApplicationId" />
              <input type="hidden" id="emailCandidateName" />
              <div class="col-md-6">
                <label class="form-label">Status</label>
                <input type="text" id="emailStatus" class="form-control" disabled />
              </div>
              <div class="col-md-6">
                <label class="form-label">To</label>
                <input type="email" id="emailTo" class="form-control" multiple required />
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
                <label class="form-label">Additional Notes</label>
                <textarea id="emailMessage" rows="6" class="form-control" required></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-success" style="background-color:#3367d6;">Send Email</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Share Details Modal -->
  <div class="modal fade" id="shareModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Share Candidate Details</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" style="font-size:14px !important;">
          <div class="row mb-3">
            <div class="col-md-12">
              <p style="font-size:14px;"><strong>Job Title:</strong> <span id="shareJobTitle"></span></p>
            </div>
          </div>
          <div class="row mb-3">
            <div class="col-md-6">
              <label class="form-label">Select Client <span id="viewShareClientDetailsLink" class="viewClientDetailsLink" style="color:#0066cc;cursor:pointer;font-size:14px;display:none;margin-left:10px;" title="View Selected Client Details"><i class="bi bi-info-circle"></i> View Selected Client Details</span></label>
              <select id="shareClientSelect" class="form-select">
                <option value="">-- Select Client --</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">Client Name</label>
              <input type="text" id="shareClientName" class="form-control" placeholder="Client name" readonly>
            </div>
          </div>
          <div class="row mb-3">
            <div class="col-md-6">
              <label class="form-label">Client Email</label>
              <input type="email" id="toEmail" name="email" class="form-control" placeholder="Enter or select client email">
            </div>
            <div class="col-md-6">
              <label class="form-label">CC Email</label>
              <input type="email" id="ccEmail" name="ccEmail" class="form-control" placeholder="Enter CC email">
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Candidate Pipelines</label>
            <div id="selectedCandidateList"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" id="shareSubmitBtn" class="btn btn-primary">Share</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Interview Schedule Modal -->
  <div class="modal fade" id="interviewModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Schedule Interview</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <form id="interviewForm">
          <div class="modal-body" style="font-size:14px;">
            <div class="row g-3">
              <div class="d-flex justify-content-start align-items-center gap-4 title_name mb-3">
                <span>Candidate Name: <span id="modalCandidateName"></span></span>
                <span>Job Title: <span id="interviewJobTitle"></span></span>
              </div>
            </div>
            <input type="hidden" id="interviewCandidateId" value="" />
            <input type="hidden" id="interviewJobId" value="" />
            <input type="hidden" id="candidateName" value="" />
            <input type="hidden" id="applicationId" value="" />
            <input type="hidden" id="interviewTypeInput" value="Final Interview" />
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Candidate Email</label>
                <input type="email" id="candidateEmail" class="form-control" required />
              </div>
              <div class="col-md-6">
                <label class="form-label">Interviewer Email</label>
                <input type="email" id="interviewerEmail" class="form-control" required />
              </div>
              <div class="col-md-6">
                <label class="form-label">Attendees Email</label>
                <input type="text" id="attendeesEmail" class="form-control" placeholder="Enter email addresses, separated by commas" required />
              </div>
              <div class="col-md-2">
                <label class="form-label">Interview Date</label>
                <input type="date" id="interviewDate" class="form-control" style="padding:6px 5px !important;" required />
              </div>
              <div class="col-md-2">
                <label class="form-label">Start Time</label>
                <div class="d-flex gap-1">
                  <select id="startHour" class="form-select" style="padding:6px 10px 6px 4px !important;" required></select>
                  <select id="startMinute" class="form-select" style="padding:6px 10px 6px 4px !important;" required></select>
                </div>
              </div>
              <div class="col-md-2">
                <label class="form-label">End Time</label>
                <div class="d-flex gap-1">
                  <select id="endHour" class="form-select" style="padding:6px 10px 6px 4px !important;" required></select>
                  <select id="endMinute" class="form-select" style="padding:6px 10px 6px 4px !important;" required></select>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Time Zone</label>
                <select id="timeZone" class="form-select" required></select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Status</label>
                <select id="interviewStatus" class="form-select" required disabled>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Interview Re-Scheduled">Interview Re-Scheduled</option>
                  <option value="L1-Scheduling Required">L1-Scheduling Required</option>
                  <option value="L1-Scheduled">L1-Scheduled</option>
                  <option value="L1-Reschedule">L1-Reschedule</option>
                  <option value="L2-Scheduling Required">L2-Scheduling Required</option>
                  <option value="L2-Scheduled">L2-Scheduled</option>
                  <option value="L2-Reschedule">L2-Reschedule</option>
                </select>
              </div>
              <div class="col-md-12">
                <label class="form-label">Interview Description</label>
                <textarea id="interviewDescription" class="form-control" rows="2" placeholder="Enter interview description..."></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="interviewSubmitBtn">Schedule</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Final Video Analysis Modal -->
  <div class="modal fade" id="analysisModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header" style="padding:5px 15px !important;">
          <h5 class="modal-title">Candidate Interview Analysis Report</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" style="margin-top:-10px;">
          <div id="analysisLoader" class="text-center py-4">
            <div class="spinner-border text-primary" role="status"></div>
            <div class="mt-2 text-muted">Loading analysis...</div>
          </div>
          <div id="analysisContainer" style="display:none;">
            <div class="analysis-top">
              <div class="analysis-left">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span id="aCandidateName" class="mb-0"></span><span>-</span>
                  <span id="aJobTitle" style="color:#0b3576;font-weight:500;"></span>
                </div>
              </div>
              <div class="analysis-right">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;">
                  <div style="font-weight:600;white-space:nowrap;">Overall Score:</div>
                  <div class="score-value"><span id="aOverallScore">--</span><span>/100</span></div>
                </div>
              </div>
            </div>
            <ul class="nav nav-tabs" id="analysisTabs" role="tablist" style="border-bottom:none;">
              <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#pane-summary" type="button" style="margin-left:10px;">Summary</button></li>
              <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pane-video" type="button">Video Analysis</button></li>
              <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pane-skill" type="button">Skill Analysis</button></li>
              <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pane-transcript" type="button">Transcript</button></li>
              <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pane-rec" type="button">Recommendation</button></li>
            </ul>
            <div class="tab-content">
              <div class="tab-pane fade show active" id="pane-summary">
                <div class="tab-card">
                  <div class="row">
                    <div class="col-md-8">
                      <div class="modal-section-title">Executive Summary</div>
                      <div id="summaryExecutive"></div>
                    </div>
                    <div class="col-md-4">
                      <div class="modal-section-title">Quick Stats</div>
                      <div class="metric-row matric-count"><div class="metric-col"><div id="statOverallBar"></div></div></div>
                      <div class="metric-row matric-count"><div class="metric-col"><div id="statVideoBar"></div></div></div>
                      <div class="mt-2 matric-count"><div id="statFaceBar"></div></div>
                      <div class="mt-3">
                        <div class="modal-section-title" style="font-weight:600;">Dominant Emotions</div>
                        <div id="dominantEmotions" class="mt-2 matric-count"></div>
                      </div>
                    </div>
                  </div>
                  <div class="row mt-2">
                    <div class="col-md-6">
                      <div class="modal-section-title">Strengths</div>
                      <div id="summaryStrengths" class="strength-box" style="min-height:220px;"></div>
                    </div>
                    <div class="col-md-6">
                      <div class="modal-section-title">Areas for Improvement</div>
                      <div id="summaryImprovements" class="improve-box" style="min-height:220px;"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="tab-pane fade" id="pane-video">
                <div class="tab-card" style="font-size:14px;">
                  <div class="modal-subSection-title">Emotional Analysis</div>
                  <div class="row">
                    <div class="col-md-4"><h6 class="modal-section-title">Emotion Distribution</h6><div id="videoEmotionDistribution" class="mb-3"></div></div>
                    <div class="col-md-4"><h6 class="modal-section-title">Video Metrics</h6><div id="videoMetrics" class="mb-3" style="padding:5px 16px;line-height:2;"></div></div>
                    <div class="col-md-4 text-center">
                      <h6 class="modal-section-title">Sentiment Score</h6>
                      <div id="videoSentimentScore" class="mb-3"></div>
                      <p>Overall video sentiment score based on facial expressions and emotions</p>
                    </div>
                  </div>
                  <hr>
                  <div class="row mt-2">
                    <div class="col-md-4"><h6 class="modal-section-title">Body Language</h6><div id="videoBodyLanguage" class="pre-box" style="min-height:220px;"></div></div>
                    <div class="col-md-4"><h6 class="modal-section-title">Facial Expressions</h6><div id="videoFacialExpressions" class="pre-box" style="min-height:220px;"></div></div>
                    <div class="col-md-4"><h6 class="modal-section-title">Engagement Level</h6><div id="videoEngagement" class="pre-box" style="min-height:220px;"></div></div>
                  </div>
                </div>
              </div>
              <div class="tab-pane fade" id="pane-skill">
                <div class="tab-card">
                  <div class="modal-subSection-title">Skill Analysis</div>
                  <div class="row">
                    <div class="col-md-6"><h6 class="modal-section-title">Job Relevance</h6><div id="skillJobRelevance" class="pre-box mb-3"></div></div>
                    <div class="col-md-6"><h6 class="modal-section-title">Authenticity Assessment</h6><div id="skillAuthenticity" class="pre-box"></div></div>
                  </div>
                  <div class="row">
                    <div class="col-md-12"><h6 class="modal-section-title">Technical Skills Assessment</h6><div id="skillTechnical" class="pre-box"></div></div>
                  </div>
                </div>
              </div>
              <div class="tab-pane fade" id="pane-transcript">
                <div class="tab-card">
                  <div class="modal-subSection-title">Interview Transcript Analysis</div>
                  <div class="row">
                    <div class="col-md-8"><h6 class="modal-section-title">Key Topics &amp; Keywords</h6><div id="transcriptKeywords" class="mb-3"></div></div>
                    <div class="col-md-4"><h6 class="modal-section-title">Sentiment</h6><div id="transcriptSentiment" class="pre-box mb-3"></div></div>
                  </div>
                  <div class="row">
                    <div class="col-md-6"><h6 class="modal-section-title">Language Proficiency</h6><div id="transcriptLang" class="pre-box mb-3" style="min-height:230px;"></div></div>
                    <div class="col-md-6"><h6 class="modal-section-title">Logical Structure</h6><div id="transcriptLogic" class="pre-box" style="min-height:230px;"></div></div>
                  </div>
                </div>
              </div>
              <div class="tab-pane fade" id="pane-rec">
                <div class="tab-card">
                  <div class="modal-subSection-title">Hiring Recommendation</div>
                  <div class="row">
                    <h6><strong style="color:#3e623e;">Consider:</strong> <span id="recConsiderText"></span></h6>
                    <div id="recScoreBar" class="modal-section-title"></div>
                    <div id="recDescription" style="margin-top:15px;"></div>
                  </div>
                  <div class="row mt-3">
                    <div class="col-md-4"><h6 class="modal-section-title">Strengths</h6><div id="recStrengths" class="strength-box" style="min-height:339px;"></div></div>
                    <div class="col-md-4"><h6 class="modal-section-title">Concerns</h6><div id="recConcerns" class="improve-box" style="min-height:339px;"></div></div>
                    <div class="col-md-4"><h6 class="modal-section-title">Next Steps</h6><div id="recNextSteps" class="rec-box" style="min-height:339px;"></div></div>
                  </div>
                  <div class="row mt-3">
                    <div class="col-md-6"><h6 class="modal-section-title">Interview Improvement Suggestions</h6><div id="recImprovements" class="pre-box" style="min-height:150px"></div></div>
                    <div class="col-md-6"><h6 class="modal-section-title">Candidate Development Plan</h6><div id="recDevPlan" class="pre-box" style="min-height:150px"></div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Career Arc Modal -->
  <div class="modal fade" id="careerArcModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Career Progression Timeline - <span style="margin:5px 0 0 0;font-size:18px;color:#1a66b7;" id="careerArcCandidateName"></span></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div id="careerArcContainer" class="career-arc-container">
            <div class="career-arc-sidebar" id="careerJobsList"></div>
            <div class="career-arc-timeline">
              <canvas id="careerTimelineCanvas"></canvas>
              <div class="career-timeline-details" id="careerTimelineDetails"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Initial Video Analysis Modal -->
  <div class="modal fade" id="initialAnalysisModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header" style="padding:5px 15px !important;">
          <h5 class="modal-title">Candidate Initial Screening Analysis Report</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="initialAnalysisContainer" style="display:none;margin-top:-10px;">
          <div class="d-flex justify-content-between align-items-center" style="margin-bottom:5px !important;margin-left:10px;">
            <div><strong id="iniCandidateName"></strong> - <span id="iniJobTitle" class="text-primary" style="font-weight:700;"></span></div>
            <div><strong></strong> <span id="iniOverallScore">--</span></div>
          </div>
          <ul class="nav nav-tabs" id="iniAnalysisTabs" role="tablist" style="margin-left:10px;border-bottom:none;"></ul>
          <div class="tab-content" id="iniAnalysisTabContent"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Email Type Selection Modal -->
  <div class="modal fade" id="emailTypeSelectionModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content rounded-3 shadow">
        <div class="modal-header">
          <h5 class="modal-title">Select Email Purpose</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" style="font-size:14px;">
          <input type="hidden" id="modalEmailTypeJobTitle" />
          <input type="hidden" id="modalEmailTypeCandidateEmail" />
          <input type="hidden" id="modalEmailTypeCandidateStatus" />
          <input type="hidden" id="modalEmailTypeApplicationId" />
          <input type="hidden" id="modalEmailTypeInterviewId" />
          <input type="hidden" id="modalEmailTypeCandidateName" />
          <p style="font-weight:600;margin-bottom:20px;">Email Purpose:</p>
          <div class="form-check mb-3">
            <input class="form-check-input" type="radio" name="mailType" id="mailTypeStatus" value="status" checked>
            <label class="form-check-label" for="mailTypeStatus" style="cursor:pointer;font-weight:500;">Send Status Mail to the Candidate</label>
          </div>
          <div class="form-check mb-3">
            <input class="form-check-input" type="radio" name="mailType" id="mailTypeInitialScreening" value="initial_screening">
            <label class="form-check-label" for="mailTypeInitialScreening" style="cursor:pointer;font-weight:500;">
              <span id="initialScreeningLabel">Send Initial Screening Mail to the Candidate</span>
              <span id="initialScreeningMessage" style="display:none;color:#666;font-size:12px;margin-left:20px;">Initial Screening Analysis has been done</span>
            </label>
          </div>
          <div class="form-check mb-3">
            <input class="form-check-input" type="radio" name="mailType" id="mailTypeInterviewBot" value="interview_bot">
            <label class="form-check-label" for="mailTypeInterviewBot" style="cursor:pointer;font-weight:500;">
              <span id="interviewBotLabel">Send Interview Voice Bot Email to the Candidate</span>
              <span id="interviewBotMessage" style="display:none;color:#666;font-size:12px;margin-left:20px;">Interview Voice Bot Analysis has been done</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" @click="resetEmailTypeSelection()">Cancel</button>
          <button type="button" class="btn btn-success" id="proceedWithEmailTypeBtn" style="background-color:#3367d6;">Proceed</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Initial Screening Email Modal -->
  <div class="modal fade" id="initialScreeningEmailModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content rounded-3 shadow">
        <div class="modal-header">
          <h5 class="modal-title">Send Initial Screening Email</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <form id="initialScreeningEmailForm">
          <div class="modal-body" style="font-size:14px !important;">
            <div class="row g-3">
              <div class="col-md-12">
                <p style="font-size:16px;font-weight:600;">Job Title: <span id="initialScreeningJobTitle"></span></p>
              </div>
              <input type="hidden" id="initialScreeningApplicationId" />
              <input type="hidden" id="initialScreeningInterviewId" />
              <input type="hidden" id="initialScreeningCandidateName" />
              <div class="col-md-6"><label class="form-label">To</label><input type="email" id="initialScreeningTo" class="form-control" required/></div>
              <div class="col-md-6"><label class="form-label">Cc</label><input type="email" id="initialScreeningCc" class="form-control"/></div>
              <div class="col-md-6"><label class="form-label">Bcc</label><input type="email" id="initialScreeningBcc" class="form-control"/></div>
              <div class="col-md-6"><label class="form-label">Subject</label><input type="text" id="initialScreeningSubject" class="form-control" required /></div>
              <div class="col-md-12"><label class="form-label">Additional Notes</label><textarea id="initialScreeningMessage1" rows="6" class="form-control"></textarea></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-success" style="background-color:#3367d6;">Send Email</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Interview Bot Email Modal -->
  <div class="modal fade" id="interviewBotEmailModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content rounded-3 shadow">
        <div class="modal-header">
          <h5 class="modal-title">Send Interview Voice Bot Email</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <form id="interviewBotEmailForm">
          <div class="modal-body" style="font-size:14px !important;">
            <div class="row g-3">
              <div class="col-md-12">
                <p style="font-size:16px;font-weight:600;">Job Title: <span id="interviewBotJobTitle"></span></p>
              </div>
              <input type="hidden" id="interviewBotApplicationId" />
              <input type="hidden" id="interviewBotInterviewId" />
              <input type="hidden" id="interviewBotCandidateName" />
              <div class="col-md-6"><label class="form-label">To</label><input type="email" id="interviewBotTo" class="form-control" required/></div>
              <div class="col-md-6"><label class="form-label">Cc</label><input type="email" id="interviewBotCc" class="form-control"/></div>
              <div class="col-md-6"><label class="form-label">Bcc</label><input type="email" id="interviewBotBcc" class="form-control"/></div>
              <div class="col-md-6"><label class="form-label">Subject</label><input type="text" id="interviewBotSubject" class="form-control" required /></div>
              <div class="col-md-12"><label class="form-label">Additional Notes</label><textarea id="interviewBotMessage1" rows="6" class="form-control"></textarea></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-success" style="background-color:#3367d6;">Send Email</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Bot Interview Analysis Modal -->
  <div class="modal fade" id="botAnalysisModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header" style="padding:5px 15px !important;">
          <h5 class="modal-title">Candidate Bot Interview Analysis Report</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" style="margin-top:-10px;">
          <div id="botLoader" class="text-center py-4">
            <div class="spinner-border text-primary" role="status"></div>
            <div class="mt-2 text-muted">Loading analysis...</div>
          </div>
          <div id="botAnalysisContainer" style="display:none;">
            <div class="analysis-top">
              <div class="analysis-left">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span id="botCandidateName" class="mb-0" style="font-weight:600;"></span><span>-</span>
                  <span id="botJobTitle" style="color:#0b3576;font-weight:500;"></span>
                </div>
              </div>
              <div class="analysis-right">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;">
                  <div style="font-weight:600;white-space:nowrap;">Overall Rating:</div>
                  <div class="score-value"><span id="botOverallRating">--</span><span>/10</span></div>
                </div>
              </div>
            </div>
            <ul class="nav nav-tabs" id="botTabs" role="tablist" style="border-bottom:none;">
              <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#pane-bot-summary" type="button" style="margin-left:10px;">Summary</button></li>
              <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pane-bot-sentiment" type="button">Sentiment</button></li>
              <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pane-bot-skills" type="button">Skills</button></li>
              <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pane-bot-rec" type="button">Recommendation</button></li>
            </ul>
            <div class="tab-content">
              <div class="tab-pane fade show active" id="pane-bot-summary">
                <div class="tab-card">
                  <div class="row" style="border-bottom:1px solid #e7e7e7;">
                    <div class="modal-section-title">Quick Info</div>
                    <div id="botQuickInfo" style="line-height:2;"></div>
                  </div>
                  <div class="row mt-3">
                    <div class="col-md-6"><div class="modal-section-title">Communication Skills</div><div id="botCommunication" style="line-height:1.8;"></div></div>
                    <div class="col-md-6"><div class="modal-section-title mt-3">Technical Competence</div><div id="botTechnical" style="line-height:1.8;"></div></div>
                  </div>
                  <div class="row mt-3">
                    <div class="col-md-6"><div class="modal-section-title">Strengths</div><div id="botStrengthList" class="strength-box" style="min-height:180px;"></div></div>
                    <div class="col-md-6"><div class="modal-section-title">Areas for Improvement</div><div id="botImproveList" class="improve-box" style="min-height:180px;"></div></div>
                  </div>
                </div>
              </div>
              <div class="tab-pane fade" id="pane-bot-sentiment">
                <div class="tab-card"><div class="modal-section-title">Sentiment Analysis</div><div id="botSentiment" style="line-height:2;"></div></div>
              </div>
              <div class="tab-pane fade" id="pane-bot-skills">
                <div class="tab-card">
                  <div class="row">
                    <div class="col-md-6"><div class="modal-section-title">Communication Skills Details</div><div id="botCommunicationDetails" class="pre-box" style="min-height:200px;font-size:15px;"></div></div>
                    <div class="col-md-6"><div class="modal-section-title">Technical Competence Details</div><div id="botTechnicalDetails" class="pre-box" style="min-height:200px;font-size:15px;"></div></div>
                  </div>
                </div>
              </div>
              <div class="tab-pane fade" id="pane-bot-rec">
                <div class="tab-card"><div class="modal-section-title">Overall Recommendation</div><div id="botRecommendation" style="line-height:1.8;"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirm Modal -->
  <div id="confirmModal" class="web-process-modal" style="z-index:1200 !important;display:none;">
    <div class="web-modal-content">
      <span class="web-close-btn" @click="closeConfirmModal()">&times;</span>
      <h3>Confirm</h3>
      <div id="confirmMessage"></div>
      <div class="mt-3 d-flex justify-content-end gap-2">
        <button class="btn btn-secondary btn-sm" @click="closeConfirmModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" id="confirmYesBtn">Yes</button>
      </div>
    </div>
  </div>

  <!-- Change Candidate Status Modal -->
  <div id="changeStatusModal" class="web-process-modal" style="display:none;z-index:1200;">
    <div class="web-modal-content">
      <span class="web-close-btn" @click="closeChangeStatusModal()">&times;</span>
      <h3 class="mb-2">Change Candidate Status</h3>
      <div class="mb-3">
        <strong>Candidate:</strong>
        <span id="candidateNameDisplay"></span>
        <input type="hidden" id="candidateApplicationId">
        <input type="hidden" id="candidateId">
      </div>
      <div class="row g-3 mb-3">
        <div class="col-12 col-md-6">
          <label class="form-label">Status</label>
          <select id="statusSelect" class="form-select">
            <option value="">-- Select Main Status --</option>
          </select>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label">Sub Status</label>
          <select id="subStatusSelect" class="form-select">
            <option value="">-- Select Sub Status --</option>
          </select>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Comments (Optional)</label>
        <textarea id="statusCommentBox" class="form-control" rows="3" placeholder="Add any comments about this status change..."></textarea>
      </div>
      <div class="mt-3 d-flex justify-content-end gap-2">
        <button class="btn btn-secondary btn-sm" @click="closeChangeStatusModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" id="statusConfirmBtn">Update</button>
      </div>
    </div>
  </div>

  <!-- Feedback Communication Modal -->
  <div id="feedbackCommunicationModal" class="web-process-modal" style="display:none;z-index:1300;position:fixed;inset:0;background-color:rgba(0,0,0,0.3);justify-content:flex-end;align-items:flex-start;">
    <div style="background:white;width:100%;max-width:400px;height:100vh;display:flex;flex-direction:column;border-radius:8px 0 0 8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);margin-top:0;">
      <div style="background:#1976d2;color:white;padding:12px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;">
        <div>
          <div style="font-size:14px;">Feedback for <span id="feedbackCandidateName"></span></div>
          <div style="font-size:12px;">Job Title : <span id="feedbackJobTitle"></span></div>
        </div>
        <span style="cursor:pointer;font-size:35px;line-height:1;" @click="closeFeedbackCommunicationModal()">&times;</span>
      </div>
      <div id="feedbackMessagesContainer" style="flex:1;overflow-y:auto;padding:11px;background:rgb(227,242,253);"></div>
      <div style="padding:12px 16px;border-top:1px solid #ddd;background:white;display:flex;gap:8px;align-items:center;">
        <input type="text" id="feedbackMessageInput" class="form-control form-control-sm" placeholder="Type your message..." style="font-size:13px;" />
        <button id="feedbackSendBtn" class="feedback-send-btn" style="background:none;border:none;color:#1976d2;font-size:20px;cursor:pointer;padding:0;" title="Send message" disabled>
          <i class="bi bi-send-fill"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const AIRTABLE_CONFIG = {
  apiKey: API_KEY, baseId: BASE_ID,
  candidateTable: 'Candidates', interviewTable: 'candidate_interviews',
  feedbackTable: 'candidate_feedback', candidateApplicationsTable: 'candidate_applications',
  statusesTable: 'statuses', jobsTable: 'Job_Descriptions', clientsTable: 'Clients',
};

let filteredCandidateApplications = [], candidatesMap = {}, currentPage = 1;
let selectedStatuses = [], selectedType = '', allApplications = [], allInterviews = [];
let loggedInUserEmail = '', loggedInUserName = '';
let allStatuses = [], mainStatuses = [], subStatusMap = {}, allCandidateApplications = [];
let currentView = 'board', selectedMainStatus = null, selectedSubStatus = 'All';
let draggedCandidate = null, fetchCandidateIds = [];
let currentFeedbackCandidateId = null, currentFeedbackCandidateName = null;
let currentFeedbackCandidateEmail = null, currentFeedbackApplicationId = 0;
let allClients = [], clientsMap = {}, allJobs = [], jobsMap = {};
let __autoScrollHandler = null, scrollCheckTimeout;
let currentJobData = {}, currentShareJobClientId = null;
// let activeFilters = { status: [] };

async function fetchAllStatuses() {
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.statusesTable)}?sort[0][field]=seq_order&sort[0][direction]=asc`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` } });
    const data = await response.json();
    allStatuses = data.records.map(r => ({
      id: r.id, status_id: r.fields.status_id, status: r.fields.status,
      entity_type: r.fields.entity_type || '', parent_id: r.fields.parent_id, active: r.fields.active,
    }));
    mainStatuses = allStatuses.filter(s => s.parent_id === 0 && s.entity_type?.trim() === 'SureCafe Parent Statuses');
    subStatusMap = {};
    mainStatuses.forEach(main => { subStatusMap[main.status] = allStatuses.filter(s => s.parent_id === main.status_id); });
    return allStatuses;
  } catch (error) { console.error('Error fetching statuses:', error); return []; }
}

async function fetchCandidateApplications() {
  try {
    let url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.candidateApplicationsTable)}?pageSize=100`;
    let records = [], offset = null;
    do {
      const res = await fetch(url + (offset ? `&offset=${offset}` : ''), { headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` } });
      const data = await res.json();
      records = records.concat(data.records || []);
      offset = data.offset;
    } while (offset);
    allCandidateApplications = dedupeApplications(records);
    filteredCandidateApplications = dedupeApplications(records.slice());
    fetchCandidateIds = [...new Set(records.map(r => r.fields.candidate_id).filter(id => id))];
    return allCandidateApplications;
  } catch (error) { console.error('Error fetching applications:', error); return []; }
}

async function fetchAllClients() {
  try {
    let url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.clientsTable)}?pageSize=100&sort[0][field]=company_name&sort[0][direction]=asc`;
    let records = [], offset = null;
    do {
      const res = await fetch(url + (offset ? `&offset=${offset}` : ''), { headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` } });
      const data = await res.json();
      records = records.concat(data.records || []);
      offset = data.offset;
    } while (offset);
    allClients = records.map(r => ({
      id: r.id, company_name: r.fields.company_name || '', contact_person: r.fields.contact_person || '',
      contact_number: r.fields.contact_number || '', email: r.fields.email || '', status: r.fields.status || '',
      country: r.fields.country || '', state: r.fields.state || '', city: r.fields.city || '',
      zip_code: r.fields.zip_code || '', address_line_1: r.fields.address_line_1 || '', address_line_2: r.fields.address_line_2 || '',
    }));
    clientsMap = {};
    allClients.forEach(client => { clientsMap[client.id] = client; });
    return allClients;
  } catch (error) { console.error('Error fetching clients:', error); return []; }
}

async function fetchAllJobs() {
  try {
    let url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.jobsTable)}?pageSize=100`;
    let records = [], offset = null;
    do {
      const res = await fetch(url + (offset ? `&offset=${offset}` : ''), { headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` } });
      const data = await res.json();
      records = records.concat(data.records || []);
      offset = data.offset;
    } while (offset);
    allJobs = records.map(r => ({
      id: r.id, job_title: r.fields.Job_Title || '',
      client_id: r.fields.Client_id ? (Array.isArray(r.fields.Client_id) ? r.fields.Client_id[0] : r.fields.Client_id) : '',
      status: r.fields.Status || '',
    }));
    jobsMap = {};
    allJobs.forEach(job => { jobsMap[job.id] = job; });
    return allJobs;
  } catch (error) { console.error('Error fetching jobs:', error); return []; }
}

function buildCandidateIdFormula(ids) {
  if (!ids.length) return "''";
  const conditions = ids.map(id => `{candidate_id} = "${id}"`);
  return `OR(${conditions.join(',')})`;
}

async function fetchAllCandidates() {
  const idFormula = buildCandidateIdFormula(fetchCandidateIds);
  const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.candidateTable)}?pageSize=100&sort[0][field]=updated_at&sort[0][direction]=desc&filterByFormula=${encodeURIComponent(idFormula)}`;
  let offset = null, allRecords = [];
  try {
    do {
      const res = await fetch(url + (offset ? `&offset=${offset}` : ''), { headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` } });
      const data = await res.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset;
    } while (offset);
    candidatesMap = {};
    allRecords.forEach(record => { candidatesMap[record.id] = record; });
    return candidatesMap;
  } catch (err) { console.error('Error fetching candidates:', err); return {}; }
}

async function fetchAllInterviewsData() {
  let url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.interviewTable)}?pageSize=100`;
  let offset = null, allRecords = [];
  try {
    do {
      const res = await fetch(url + (offset ? `&offset=${offset}` : ''), { headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` } });
      const data = await res.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset;
    } while (offset);
    return allRecords;
  } catch (err) { console.error('Error fetching interviews:', err); return []; }
}

function populateShareClientDropdown() {
  const dropdown = document.getElementById('shareClientSelect');
  if (!dropdown) return;
  dropdown.innerHTML = '<option value="">-- Select Client --</option>';
  allClients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.contact_person + ' - ' + (client.company_name || 'Unknown');
    dropdown.appendChild(option);
  });
}

function viewShareClientDetailsModal(clientId) {
  if (!clientId || !clientsMap[clientId]) { openModal('❌ Please select a client first.'); return; }
  const client = clientsMap[clientId];
  openModal(`<div style="padding:10px;font-size:14px;">
    <div class="mb-2"><strong>Company Name:</strong> ${client.company_name || 'N/A'}</div>
    <div class="mb-2"><strong>Contact Person:</strong> ${client.contact_person || 'N/A'}</div>
    <div class="mb-2"><strong>Contact Number:</strong> ${client.contact_number || 'N/A'}</div>
    <div class="mb-2"><strong>Email:</strong> ${client.email || 'N/A'}</div>
    <div class="mb-2"><strong>Status:</strong> ${client.status || 'N/A'}</div>
    <div class="mb-2"><strong>City:</strong> ${client.city || 'N/A'}</div>
    <div class="mb-2"><strong>State:</strong> ${client.state || 'N/A'}</div>
    <div class="mb-2"><strong>Country:</strong> ${client.country || 'N/A'}</div>
  </div>`);
}

function renderStatusTabs() {
  const container = document.getElementById('statusTabsContainer');
  if (!container) return;
  container.innerHTML = '';
  const showAllBtn = document.createElement('button');
  showAllBtn.className = `status-tab-main ${selectedMainStatus === 'All' ? 'active' : ''}`;
  showAllBtn.textContent = `All (${allCandidateApplications.length})`;
  showAllBtn.onclick = () => selectMainStatus('All');
  container.appendChild(showAllBtn);
  mainStatuses.forEach(status => {
    const substatuses = subStatusMap[status.status] || [];
    const statusFilters = [status.status, ...substatuses.map(s => s.status)];
    const count = allCandidateApplications.filter(app => statusFilters.includes(app.fields.status)).length;
    const btn = document.createElement('button');
    btn.className = `status-tab-main ${status.status === selectedMainStatus ? 'active' : ''}`;
    btn.textContent = `${status.status} (${count})`;
    btn.onclick = () => selectMainStatus(status.status);
    container.appendChild(btn);
  });
  renderSubStatusTabs();
}

function renderSubStatusTabs() {
  const container = document.getElementById('statusSubtabsContainer');
  if (!container) return;
  container.innerHTML = '';
  const substatuses = selectedMainStatus === 'All' ? [] : subStatusMap[selectedMainStatus] || [];
  if (!substatuses.length) { selectedSubStatus = 'All'; return; }
  const wrapper = document.createElement('div');
  wrapper.className = 'status-subtabs-wrapper';
  const allBtn = document.createElement('button');
  allBtn.className = `status-subtab ${selectedSubStatus === 'All' ? 'active' : ''}`;
  const allCount = allCandidateApplications.filter(app => substatuses.map(s => s.status).includes(app.fields.status)).length;
  allBtn.textContent = `All (${allCount})`;
  allBtn.onclick = () => selectSubStatus('All');
  wrapper.appendChild(allBtn);
  substatuses.forEach(substatus => {
    const btn = document.createElement('button');
    btn.className = `status-subtab ${selectedSubStatus === substatus.status ? 'active' : ''}`;
    const count = allCandidateApplications.filter(app => app.fields.status === substatus.status).length;
    btn.textContent = `${substatus.status} (${count})`;
    btn.onclick = () => selectSubStatus(substatus.status);
    wrapper.appendChild(btn);
  });
  container.appendChild(wrapper);
}

function selectMainStatus(status) {
  selectedMainStatus = status;
  selectedSubStatus = 'All';
  renderStatusTabs();
  filterAndDisplayData();
}

function selectSubStatus(status) {
  selectedSubStatus = status;
  renderSubStatusTabs();
  filterAndDisplayData();
}

function filterAndDisplayData() {
  let filteredApps = filteredCandidateApplications.slice();
  if (selectedMainStatus !== 'All') {
    const substatuses = subStatusMap[selectedMainStatus] || [];
    const statusFilters = [selectedMainStatus, ...substatuses.map(s => s.status)];
    if (selectedSubStatus === 'All' || !selectedSubStatus) {
      filteredApps = filteredApps.filter(app => statusFilters.includes(app.fields.status));
    } else {
      filteredApps = filteredApps.filter(app => app.fields.status === selectedSubStatus);
    }
  }
  if (currentView === 'list') renderCandidates(filteredApps);
  else renderKanbanBoard(filteredApps);
}

function switchView(view) {
  currentView = view;
  document.getElementById('listViewBtn')?.classList.toggle('active', view === 'list');
  document.getElementById('boardViewBtn')?.classList.toggle('active', view === 'board');
  document.getElementById('floatingListViewBtn')?.classList.toggle('active', view === 'list');
  document.getElementById('floatingBoardViewBtn')?.classList.toggle('active', view === 'board');
  const candidateList = document.getElementById('candidateList');
  const kanbanBoard = document.getElementById('kanbanBoard');
  if (candidateList) candidateList.style.display = view === 'list' ? 'block' : 'none';
  if (kanbanBoard) kanbanBoard.classList.toggle('active', view === 'board');
  const paginationControls = document.getElementById('paginationControls');
  if (paginationControls) paginationControls.style.display = view === 'list' ? 'flex' : 'none';
  filterAndDisplayData();
}

function updateFloatingToggle() {
  const floatingListBtn = document.getElementById('floatingListViewBtn');
  const floatingBoardBtn = document.getElementById('floatingBoardViewBtn');
  if (floatingListBtn) floatingListBtn.classList.toggle('active', currentView === 'list');
  if (floatingBoardBtn) floatingBoardBtn.classList.toggle('active', currentView === 'board');
}

function checkAndUpdateFloatingToggleVisibility() {
  const originalViewToggle = document.querySelector('.view-toggle');
  const floatingToggle = document.getElementById('floatingViewToggle');
  if (!originalViewToggle || !floatingToggle) return;
  const rect = originalViewToggle.getBoundingClientRect();
  const isHidden = rect.top > window.innerHeight || rect.bottom < 0 || rect.right < 0 || rect.left > window.innerWidth;
  if (isHidden && !floatingToggle.classList.contains('visible')) floatingToggle.classList.add('visible');
  else if (!isHidden && floatingToggle.classList.contains('visible')) { floatingToggle.classList.remove('visible'); floatingToggle.classList.remove('hide'); }
}

function onScrollForFloatingToggle() {
  if (scrollCheckTimeout) clearTimeout(scrollCheckTimeout);
  scrollCheckTimeout = setTimeout(checkAndUpdateFloatingToggleVisibility, 100);
}

function dedupeApplications(appArray) {
  const seen = new Set();
  const res = [];
  for (const a of (appArray || [])) {
    if (!a || !a.id) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id); res.push(a);
  }
  return res;
}

function startAutoScroll() {
  if (__autoScrollHandler) return;
  __autoScrollHandler = (e) => {
    const jobKanban = e.target.closest('.job-kanban');
    if (jobKanban) {
      const rect = jobKanban.getBoundingClientRect();
      const buffer = 80, scrollAmount = 24;
      if (e.clientX > rect.right - buffer) jobKanban.scrollLeft += scrollAmount;
      else if (e.clientX < rect.left + buffer) jobKanban.scrollLeft -= scrollAmount;
    }
    const vBuffer = 60;
    if (e.clientY < vBuffer) window.scrollBy({ top: -20 });
    else if (e.clientY > (window.innerHeight - vBuffer)) window.scrollBy({ top: 20 });
  };
  document.addEventListener('dragover', __autoScrollHandler);
}

function stopAutoScroll() {
  if (!__autoScrollHandler) return;
  document.removeEventListener('dragover', __autoScrollHandler);
  __autoScrollHandler = null;
}

function renderKanbanBoard(applications) {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  board.innerHTML = '';
  const groupedByJob = applications.reduce((acc, app) => {
    const jobId = app.fields.job_id || 'NoJob';
    const jobTitle = app.fields.job_title || 'No Job Title';
    if (!acc[jobId]) acc[jobId] = { title: jobTitle, applications: [], _idSet: new Set() };
    if (!acc[jobId]._idSet.has(app.id)) { acc[jobId]._idSet.add(app.id); acc[jobId].applications.push(app); }
    return acc;
  }, {});
  const jobIds = Object.keys(groupedByJob).sort((a, b) => (groupedByJob[a].title || '').localeCompare(groupedByJob[b].title || ''));
  jobIds.forEach(jobId => {
    const jobInfo = groupedByJob[jobId];
    const jobRow = document.createElement('div');
    jobRow.className = 'job-row';
    const header = document.createElement('div');
    header.className = 'd-flex align-items-center justify-content-between';
    header.innerHTML = `<div style="display:flex;align-items:center;gap:12px;">
      <h5 style="margin:0;"><i class="bi bi-award"> </i> ${jobInfo.title}</h5>
      <small class="text-muted candidateCount">${jobInfo.applications.length} candidate${jobInfo.applications.length > 1 ? 's' : ''}</small>
      <span class="btn btn-sm btn-outline-success send-ids-btn" data-id="${jobId}" role="button" tabindex="0" style="color:#4e544e;" title="Share Details">↗️ Share Details</span>
    </div>`;
    header.querySelector('.send-ids-btn').addEventListener('click', () => {
      const candidatesData = jobInfo.applications.map(app => {
        const c = candidatesMap[app.fields.candidate_id];
        return { id: app.id, candidate_id: app.fields.candidate_id, name: c?.fields?.['Candidate Name'] || app.fields.candidate_name || 'Unnamed', status: app.fields.status || 'Leads', email: c?.fields?.gmail || app.fields.candidate_email || '' };
      });
      openShareModal(jobInfo.title, jobId, candidatesData);
    });
    jobRow.appendChild(header);
    const jobKanban = document.createElement('div');
    jobKanban.className = 'job-kanban';
    mainStatuses.forEach(mainStatus => {
      const column = document.createElement('div');
      column.className = 'kanban-column';
      column.setAttribute('data-status', mainStatus.status);
      column.ondragover = (e) => e.preventDefault();
      column.ondrop = (e) => handleCardDrop(e, mainStatus.status);
      const title = document.createElement('div');
      title.className = 'kanban-column-title';
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'kanban-cards';
      const substatuses = subStatusMap[mainStatus.status] || [];
      const statusFilters = [mainStatus.status, ...substatuses.map(s => s.status)];
      const appsForStatus = jobInfo.applications.filter(app => statusFilters.includes(app.fields.status));
      title.textContent = `${mainStatus.status} (${appsForStatus.length})`;
      column.appendChild(title);
      appsForStatus.forEach(app => cardsContainer.appendChild(createKanbanCard(app)));
      column.appendChild(cardsContainer);
      jobKanban.appendChild(column);
    });
    jobRow.appendChild(jobKanban);
    board.appendChild(jobRow);
  });
}

function createKanbanCard(app) {
  const appFields = app.fields || {};
  const candidateId = appFields.candidate_id;
  const candidateDetails = candidatesMap[candidateId] || {};
  const f = candidateDetails.fields || {};
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.setAttribute('data-application-id', app.id);
  card.draggable = true;
  const candidateName = appFields.candidate_name || f['Candidate Name'] || 'Unnamed';
  const email = appFields.candidate_email || f['gmail'] || '';
  const status = appFields.status || 'Unknown';
  const jobTitle = appFields.job_title || 'No Job';
  const jobId = appFields.job_id || '';
  const currentRole = appFields.candidate_role || f['Current Role'] || '-';
  const experience = appFields.candidate_exp || f['Total Experience'] || '-';
  const appId = app.id;
  const application_Id = appFields.application_id;
  const checkedStatus = checkScreeningData(candidateId, jobId, application_Id, 0);
  const interview_id = checkedStatus?.interview_id ?? 0;
  const interviewRecordForBot = allInterviews.find(rec => rec.id === interview_id);
  const botFeedback = interviewRecordForBot?.fields?.interview_bot_feedback;
  let botAnalysisBtn = botFeedback ? `<span class="btn btn-secondary btn-sm btn-icon-css" style="background:#e4b1f9;border:1px solid #8156d3;color:#3a2222;" title="Bot Interview Analysis" onclick="event.stopPropagation(); openBotAnalysisModal('${interview_id}')"><i class="bi bi-robot"></i></span>` : '';
  const { initialBtn, interviewBtn } = generateAnalysisActionButtons(candidateId, jobId, application_Id, interview_id, 'board');
  const hasInitial = checkedStatus && checkedStatus.hasInitial;
  const hasFinal = checkedStatus && checkedStatus.hasFinal;
  const initialAnalysisBtn = initialBtn || (hasInitial ? `<span class="btn btn-primary btn-sm btn-icon-css" title="Initial Video Analysis" onclick="event.stopPropagation(); checkScreeningData('${candidateId}','${jobId}',${application_Id},1)"><i class="bi bi-graph-up-arrow"></i></span>` : '');
  const interviewAnalysisBtn = interviewBtn || (hasFinal ? `<span class="btn btn-info btn-sm btn-icon-css" title="Interview Video Analysis" onclick="event.stopPropagation(); checkScreeningData('${candidateId}','${jobId}',${application_Id},2)"><i class="bi bi-bar-chart-line"></i></span>` : '');
  let scheduleInterviewBtn = '';
  const l1L2Statuses = ['L1-Scheduling Required','L1-Scheduled','L1-Reschedule','L2-Scheduling Required','L2-Scheduled','L2-Reschedule'];
  const isL1L2Status = l1L2Statuses.includes(status);
  const existingFinal = allInterviews.find(rec => rec.fields && rec.fields.candidate_id === candidateId && rec.fields.job_id === jobId && Number(rec.fields.application_id) === Number(application_Id) && rec.fields.interviewType === 'Final Interview');
  const sn = (candidateName || '').replace(/'/g, "\\'");
  if (isL1L2Status) {
    scheduleInterviewBtn = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn}',${application_Id},false,null,'${status}')"><i class="bi bi-calendar-event"></i></span>`;
  } else if (status === 'Evaluation Scheduled') {
    if (!existingFinal) scheduleInterviewBtn = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn}',${application_Id},false)"><i class="bi bi-calendar-event"></i></span>`;
    else if (!existingFinal.fields.date && !existingFinal.fields.interview_link) scheduleInterviewBtn = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn}',${application_Id},true)"><i class="bi bi-calendar-event"></i></span>`;
  } else if (status === 'Reschedule Required') {
    if (!existingFinal) scheduleInterviewBtn = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn}',${application_Id},false)"><i class="bi bi-calendar-event"></i></span>`;
    else if (!existingFinal.fields.date && !existingFinal.fields.interview_link) scheduleInterviewBtn = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn}',${application_Id},true)"><i class="bi bi-calendar-event"></i></span>`;
    else scheduleInterviewBtn = `<span class="btn btn-success btn-sm btn-icon-css" title="Reschedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn}',${application_Id},true,'Next Round Interview')"><i class="bi bi-calendar-check"></i></span>`;
  }
  const deSelectBtn = status === 'Leads' ? `<span class="btn btn-danger btn-sm btn-icon-css btn-action-deselect" title="Deselect Candidate"><i class="bi bi-x-lg" onclick="event.stopPropagation(); deSelectCandidate('${appId}')"></i></span>` : '';
  const changeStatusBtn = `<span class="btn btn-secondary btn-sm btn-icon-css" title="Change Status" onclick="event.stopPropagation(); changeApplicationStatus('${appId}','${status}','${sn}',this)"><i class="bi bi-arrow-left-right"></i></span>`;
  const careerArcBtn = `<span class="btn btn-info btn-sm btn-icon-css" style="background:#efa4a4;border:1px solid #d36b6b;" title="View Career Arc" onclick="event.stopPropagation(); showCareerArcModal('${candidateId}','${sn}')"><i class="bi bi-graph-up"></i></span>`;
  card.innerHTML = `
    <div style="margin-bottom:8px;">
      <div style="font-weight:600;font-size:14px;color:#1976d2;margin-bottom:4px;">${candidateName}</div>
      <div style="font-size:12px;color:#666;font-weight:500;">
        <div><strong>Role:</strong> ${currentRole}</div>
        <div><strong>Exp:</strong> ${experience}</div>
        <div><strong>Status:</strong> ${status}</div>
      </div>
    </div>
    <div style="border-top:1px solid #eee;padding-top:8px;">
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${initialAnalysisBtn}${interviewAnalysisBtn}${botAnalysisBtn}${scheduleInterviewBtn}
        <span class="btn btn-primary btn-sm btn-icon-css btn-action-email" title="Send Email">
          <i class="bi bi-envelope-fill" onclick="event.stopPropagation(); openSendEmailModal('${jobTitle}','${email}','${status}','${appId}','${interview_id}','${sn}')"></i>
        </span>
        <span class="btn btn-primary btn-sm btn-icon-css btn-action-feedback" style="position:relative;" title="Candidate Communication">
          <i class="bi bi-chat-dots-fill" onclick="event.stopPropagation(); openFeedbackCommunicationModal('${candidateId}','${sn}','${email}','${jobTitle}',${application_Id})"></i>
        </span>
        ${changeStatusBtn}${careerArcBtn}${deSelectBtn}
      </div>
    </div>`;
  card.addEventListener('click', (e) => {
    if (e.target.closest('button, i, a, .btn, .feedback-chat-container')) return;
    showKanbanCardModal(appId);
  });
  card.ondragstart = (e) => { draggedCandidate = { app, candidateId, fromStatus: status }; card.classList.add('dragging'); startAutoScroll(); };
  card.ondragend = () => { card.classList.remove('dragging'); stopAutoScroll(); };
  return card;
}

function showKanbanCardModal(appId) {
  const app = appId ? allCandidateApplications.find(a => a.id === appId) : null;
  if (!app) return;
  const appFields = app.fields || {};
  const candidateId = appFields.candidate_id;
  const candidateDetails = candidatesMap[candidateId] || {};
  const f = candidateDetails.fields || {};
  const candidateName = appFields.candidate_name || f['Candidate Name'] || '-';
  const email = appFields.candidate_email || f['gmail'] || '-';
  const phone = f['Phone Number'] || f['Phone'] || '-';
  const currentRole = appFields.candidate_role || f['Current Role'] || '-';
  const experience = appFields.candidate_exp || f['Total Experience'] || '-';
  const company = f['Current Company'] || '-';
  const jobTitle = appFields.job_title || '-';
  const appStatus = appFields.status || '-';
  const appDate = appFields.application_date ? formatDate(appFields.application_date) : '-';
  const appType = appFields.application_type || '-';
  const comment = appFields.comment || '-';
  const commentBy = appFields.comment_by || '-';
  const detailsHtml = `<div style="font-size:13px;max-height:100%;">
    <div class="card" style="border:1px solid #d1d1d1;border-radius:6px;padding:10px 5px;">
      <div class="row">
        <div class="col-md-6"><h6 style="color:#1153b5;font-weight:600;margin-bottom:10px;">Candidate Information</h6>
          <table class="table table-sm mb-0"><tbody style="border:none;">
            <tr><th width="40%">Name</th><td>${candidateName}</td></tr>
            <tr><th>Email</th><td>${email}</td></tr>
            <tr><th>Phone</th><td>${phone}</td></tr>
            <tr><th>Current Role</th><td>${currentRole}</td></tr>
            <tr><th>Experience</th><td>${experience}</td></tr>
            <tr><th>Company</th><td>${company}</td></tr>
          </tbody></table>
        </div>
        <div class="col-md-6"><h6 style="color:#1153b5;font-weight:600;margin-bottom:10px;">Application Details</h6>
          <table class="table table-sm mb-0"><tbody style="border:none;">
            <tr><th>Job Title</th><td>${jobTitle}</td></tr>
            <tr><th>Status</th><td>${appStatus}</td></tr>
            <tr><th>Application Type</th><td>${appType}</td></tr>
            <tr><th>Application ID | Date</th><td>${appFields.application_id || '-'} | ${appDate}</td></tr>
            <tr><th>Comment</th><td>${comment}</td></tr>
            <tr><th>Comment By</th><td>${commentBy}</td></tr>
          </tbody></table>
        </div>
      </div>
    </div>
    <h6 style="color:#1153b5;font-weight:600;margin-bottom:10px;margin-top:10px;">Candidate Profile</h6>
    <table class="table table-sm mb-0">
      <tr><th width="20%">Professional Summary</th><td>${f['Professional Summary'] || '-'}</td></tr>
      <tr><th>Key Skills</th><td>${(f['Key Skills'] || []).map(s => `<span class="tag">${s}</span>`).join(' ') || '-'}</td></tr>
      <tr><th>Programming Languages</th><td>${(f['Programming Languages'] || []).map(p => `<span class="tag">${p}</span>`).join(' ') || '-'}</td></tr>
      <tr><th>Frameworks &amp; Libraries</th><td>${(f['Frameworks and Libraries'] || []).map(fr => `<span class="tag">${fr}</span>`).join(' ') || '-'}</td></tr>
      <tr><th>Databases</th><td>${(f['Databases'] || []).map(db => `<span class="tag">${db}</span>`).join(' ') || '-'}</td></tr>
      <tr><th>Certifications</th><td>${(f['Certifications'] || []).map(c => `<span class="tag">${c}</span>`).join(' ') || '-'}</td></tr>
      <tr><th>Tools &amp; Platforms</th><td>${(f['Tools and Platforms'] || []).map(t => `<span class="tag">${t}</span>`).join(' ') || '-'}</td></tr>
    </table>
  </div>`;
  const detailsEl = document.getElementById('kanbanCardDetails');
  if (detailsEl) detailsEl.innerHTML = detailsHtml;
  const modal = new bootstrap.Modal(document.getElementById('kanbanCardModal'));
  modal.show();
}

async function handleCardDrop(e, targetStatus) {
  e.preventDefault();
  if (!draggedCandidate) return;
  const { app, candidateId, fromStatus } = draggedCandidate;
  if (fromStatus !== 'Leads' && targetStatus === 'Leads') { openModal('❌ Cannot move back to Leads status'); draggedCandidate = null; return; }
  try {
    const substatuses = subStatusMap[targetStatus] || [];
    const newStatus = (substatuses.length > 0) ? substatuses[0].status : targetStatus;
    if (app.fields.status === newStatus) { draggedCandidate = null; return; }
    const oldStatus = app.fields.status;
    const oldStatusId = app.fields.status_id;
    const applicationId = app.fields.application_id;
    let statusId = null;
    const statusObj = allStatuses.find(s => s.status === newStatus);
    if (statusObj) statusId = statusObj.status_id;
    app.fields.status = newStatus;
    app.fields.status_id = statusId;
    allCandidateApplications = dedupeApplications(allCandidateApplications);
    filteredCandidateApplications = dedupeApplications(filteredCandidateApplications);
    renderStatusTabs(); filterAndDisplayData();
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.candidateApplicationsTable)}/${app.id}`;
    const res = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { status: newStatus, status_id: statusId } }) });
    if (!res.ok) { app.fields.status = oldStatus; app.fields.status_id = oldStatusId; renderStatusTabs(); filterAndDisplayData(); }
    else {
      const candidateRecord = candidatesMap[candidateId] || {};
      const candidateName = app.fields.candidate_name || candidateRecord.fields?.['Candidate Name'] || 'Unknown';
      const candidateEmail = app.fields.candidate_email || candidateRecord.fields?.gmail || '';
      await saveFeedbackRecord(candidateId, candidateName, candidateEmail, `The status has been updated from ${oldStatus} to ${newStatus}`, 'status_change', applicationId);
    }
  } catch (error) { console.error('Error:', error); }
  draggedCandidate = null;
}

async function refreshData() {
  document.getElementById('loader').style.display = 'block';
  document.getElementById('candidateList').style.display = 'none';
  document.getElementById('kanbanBoard').classList.remove('active');
  try {
    allApplications = await fetchCandidateApplications();
    allCandidateApplications = allApplications;
    filteredCandidateApplications = allApplications.slice();
    await fetchAllCandidates();
    await fetchAllStatuses();
    allInterviews = await fetchAllInterviewsData();
    if (mainStatuses.length > 0) {
      selectedMainStatus = 'All';
      selectedSubStatus = 'All';
      renderStatusTabs();
      filterAndDisplayData();
    } else {
      if (currentView === 'list') renderCandidates(allCandidateApplications);
      else renderKanbanBoard(allCandidateApplications);
    }
    console.log('✅ Data refreshed successfully');
    await fetchAllClients();
    await fetchAllJobs();
  } catch (error) {
    console.error('Error refreshing data:', error);
    console.log('❌ Error refreshing data');
  } finally {
    document.getElementById('loader').style.display = 'none';
    if (currentView === 'list') document.getElementById('candidateList').style.display = 'block';
    else document.getElementById('kanbanBoard').classList.add('active');
  }
}

function renderCandidates(applications) {
  const loader = document.getElementById('loader');
  const container = document.getElementById('candidateList');
  loader.style.display = 'none';
  container.style.display = 'block';
  container.innerHTML = '';
  if (!applications || !applications.length) {
    container.innerHTML = `<p class="text-muted">No candidates found.</p>`;
    renderPaginationControls(0, 1);
    return;
  }
  const grouped = applications.reduce((acc, app) => {
    const jobId = app.fields.job_id || 'NoID';
    const jobTitle = app.fields.job_title || 'No Job Title';
    if (!acc[jobId]) acc[jobId] = { title: jobTitle, applications: [] };
    acc[jobId].applications.push(app);
    return acc;
  }, {});
  const jobIds = Object.keys(grouped).sort((a, b) => {
    const titleA = grouped[a].title.toLowerCase();
    const titleB = grouped[b].title.toLowerCase();
    return titleA.localeCompare(titleB);
  });
  const jobPageSize = 10;
  let totalPages = Math.ceil(jobIds.length / jobPageSize);
  if (!currentPage || currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * jobPageSize;
  const paginatedJobs = jobIds.slice(start, start + jobPageSize);
  paginatedJobs.forEach(jobId => {
    const jobInfo = grouped[jobId];
    const jobSection = document.createElement('div');
    jobSection.className = 'job-section';
    jobSection.setAttribute('data-job', jobId);
    const header = document.createElement('div');
    header.className = 'job-group-header d-flex align-items-center justify-content-between';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <h4 style="margin:0;"><i class="bi bi-award"> </i> ${jobInfo.title}</h4>
        <small class="text-muted candidateCount">${jobInfo.applications.length} candidate${jobInfo.applications.length>1?'s':''}</small>
        <span class="btn btn-sm btn-outline-success send-ids-btn" data-id="${jobId}" role="button" tabindex="0" style="color:#4e544e;" title="Share Details">↗️ Share Details</span>
      </div>
      <div>
        <button type="button" class="btn btn-sm btn-outline-primary job-collapse-btn" data-job="${jobId}">Hide ▲</button>
      </div>
    `;
    header.querySelector('.send-ids-btn').addEventListener('click', () => {
      const candidatesData = jobInfo.applications.map(app => {
        const c = candidatesMap[app.fields.candidate_id];
        return {
          id: app.id,
          candidate_id: app.fields.candidate_id,
          name: c?.fields?.['Candidate Name'] || app.fields.candidate_name || 'Unnamed',
          status: app.fields.status || 'Leads',
          email: c?.fields?.gmail || app.fields.candidate_email || ''
        };
      });
      openShareModal(jobInfo.title, jobId, candidatesData);
    });
    jobSection.appendChild(header);
    const candidatesWrapper = document.createElement('div');
    candidatesWrapper.className = 'job-candidate-list';
    jobInfo.applications.forEach(app => {
      const candidateRecord = candidatesMap[app.fields.candidate_id];
      const f = candidateRecord?.fields || {};
      const appFields = app.fields || {};
      const card = document.createElement('div');
      card.className = 'candidate-card';
      card.setAttribute('data-id', app.id);
      const candidateName = f['Candidate Name'] || appFields.candidate_name || 'Unnamed';
      const candidateId = app.fields.candidate_id;
      const email = f['gmail'] || appFields.candidate_email || '';
      const jobTitle = appFields.job_title || jobInfo.title;
      const appStatus = appFields.status || 'NA';
      const candidateExp = appFields.candidate_exp || f['Total Experience'] || '-';
      const candidateRole = appFields.candidate_role || f['Current Role'] || '-';
      const application_Id = appFields.application_id;
      const checkedStatus = checkScreeningData(candidateId, jobId, application_Id, 0);
      const hasInitial = checkedStatus && checkedStatus.hasInitial;
      const hasFinal = checkedStatus && checkedStatus.hasFinal;
      const interview_id = checkedStatus?.interview_id ?? 0;
      const interviewRecordForBot = allInterviews.find(rec => rec.id === interview_id);
      const botFeedback = interviewRecordForBot?.fields?.interview_bot_feedback;
      let botAnalysisBtn = '';
      if (botFeedback) {
        botAnalysisBtn = `<span class="btn btn-secondary btn-sm btn-icon-css" style="background:#b79ced;border:1px solid #8156d3;" title="Bot Interview Analysis" onclick="event.stopPropagation(); openBotAnalysisModal('${interview_id}')"><i class="bi bi-robot"></i></span>`;
      }
      const deSelectBtn = `<span class="btn btn-danger btn-sm btn-icon-css btn-action-deselect"><i class="bi bi-x-lg deselect-icon" style="cursor:pointer;" onclick="event.stopPropagation(); deSelectCandidate('${app.id}')" title="Deselect Candidate"></i></span>`;
      const changeStatusBtn = `<span class="btn btn-secondary btn-sm btn-icon-css" title="Change Status" style="cursor:pointer;"><i class="bi bi-arrow-left-right" style="cursor:pointer;" onclick="event.stopPropagation(); changeApplicationStatus('${app.id}','${appStatus}','${candidateName}',this)" title="Change Status"></i></span>`;
      let scheduleInterviewButton = '';
      const l1L2Statuses = ['L1-Scheduling Required','L1-Scheduled','L1-Reschedule','L2-Scheduling Required','L2-Scheduled','L2-Reschedule'];
      const isL1L2Status = l1L2Statuses.includes(appStatus);
      const existingFinal = allInterviews.find(rec =>
        rec.fields &&
        rec.fields.candidate_id === candidateId && rec.fields.job_id === jobId &&
        Number(rec.fields.application_id) === Number(application_Id) && rec.fields.interviewType === 'Final Interview'
      );
      const sn2 = (candidateName||'').replace(/'/g, "\\'");
      if (isL1L2Status) {
        scheduleInterviewButton = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn2}',${application_Id},false,null,'${appStatus}')"><i class="bi bi-calendar-event"></i></span>`;
      } else if (appStatus === 'Evaluation Scheduled') {
        if (!existingFinal) {
          scheduleInterviewButton = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn2}',${application_Id},false)"><i class="bi bi-calendar-event"></i></span>`;
        } else if ((!existingFinal.fields.date && !existingFinal.fields.interview_link)||(existingFinal.fields.date===null && existingFinal.fields.interview_link===null)||(existingFinal.fields.date==='' && existingFinal.fields.interview_link==='')) {
          scheduleInterviewButton = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn2}',${application_Id},true)"><i class="bi bi-calendar-event"></i></span>`;
        }
      } else if (appStatus === 'Reschedule Required') {
        if (!existingFinal) {
          scheduleInterviewButton = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn2}',${application_Id},false)"><i class="bi bi-calendar-event"></i></span>`;
        } else if (existingFinal && ((!existingFinal.fields.date && !existingFinal.fields.interview_link)||(existingFinal.fields.date===null && existingFinal.fields.interview_link===null)||(existingFinal.fields.date==='' && existingFinal.fields.interview_link===''))) {
          scheduleInterviewButton = `<span class="btn btn-success btn-sm btn-icon-css" title="Schedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn2}',${application_Id},true)"><i class="bi bi-calendar-event"></i></span>`;
        } else {
          scheduleInterviewButton = `<span class="btn btn-success btn-sm btn-icon-css" title="Reschedule Interview" onclick="event.stopPropagation(); showInterviewModal('${candidateId}','${jobId}','${email}','${jobTitle}','${sn2}',${application_Id},true,'Next Round Interview')"><i class="bi bi-calendar-check"></i></span>`;
        }
      }
      const { initialBtn: initialAnalysisActionBtn, interviewBtn: interviewAnalysisActionBtn } = generateAnalysisActionButtons(candidateId, jobId, application_Id, interview_id, 'list');
      const initialAnalysis = `<span class="btn btn-primary btn-sm btn-icon-css" title="Initial Video Analysis" onclick="event.stopPropagation(); checkScreeningData('${candidateId}','${jobId}',${application_Id},1)"><i class="bi bi-graph-up-arrow"></i></span>`;
      const interviewAnalysis = `<span class="btn btn-info btn-sm btn-icon-css" title="Interview Video Analysis" onclick="event.stopPropagation(); checkScreeningData('${candidateId}','${jobId}',${application_Id},2)"><i class="bi bi-bar-chart-line"></i></span>`;
      const initialAnalysisBtn = initialAnalysisActionBtn || (hasInitial ? initialAnalysis : '');
      const interviewAnalysisBtn = interviewAnalysisActionBtn || (hasFinal ? interviewAnalysis : '');
      const jt2 = (jobTitle||'').replace(/'/g, "\\'");
      const em2 = (email||'').replace(/'/g, "\\'");
      const st2 = (appStatus||'').replace(/'/g, "\\'");
      card.innerHTML = `
        <div class="row w-100 align-items-center row-details candidate-row" style="cursor:pointer;">
          <div class="col-md-2" style="font-weight:600;"><span class="mb-0 candidate_name">${candidateName}</span></div>
          <div class="col-md-2">
            <span class="badge-status changeStatus" id="status-btn-${app.id}" title="Change Application Status" onclick="event.stopPropagation(); changeApplicationStatus('${app.id}','${appStatus}','${candidateName}',this)">${appStatus}</span>
          </div>
          <div class="col-md-2"><span class="text-muted" style="font-weight:500;">${candidateExp}</span></div>
          <div class="col-md-2"><span class="text-muted" style="font-weight:500;">${candidateRole}</span></div>
          <div class="col-md-4 d-flex gap-2 justify-content-end items-width">
            ${initialAnalysisBtn}${interviewAnalysisBtn}${botAnalysisBtn}${scheduleInterviewButton}
            ${appStatus === 'Leads' ? deSelectBtn : ''}
            <span class="btn btn-primary btn-sm btn-icon-css btn-action-email">
              <i class="bi bi-envelope-fill email-icon" style="cursor:pointer;" onclick="event.stopPropagation(); openSendEmailModal('${jt2}','${em2}','${st2}','${app.id}','${interview_id}','${sn2}')" title="Send Email"></i>
            </span>
            <span class="btn btn-primary btn-sm btn-icon-css btn-action-feedback" style="position:relative;" title="Candidate Communication Details">
              <i class="bi bi-chat-dots-fill feedback-icon" style="cursor:pointer;" onclick="event.stopPropagation(); openFeedbackCommunicationModal('${candidateId}','${sn2}','${em2}','${jt2}',${application_Id})"></i>
            </span>
            ${changeStatusBtn}
            <span class="btn btn-info btn-sm btn-icon-css" style="background:#efa4a4;border:1px solid #d36b6b;" title="View Career Arc" onclick="event.stopPropagation(); showCareerArcModal('${candidateId}','${sn2}')"><i class="bi bi-graph-up"></i></span>
            <span class="toggle-icon" style="cursor:pointer;">▼</span>
          </div>
        </div>
        <div class="detail-row collapse">
          <table class="table table-sm mb-0"><tbody>
            <tr><th>Application ID</th><td>${appFields.application_id || '-'}</td></tr>
            <tr><th>Application Date</th><td>${formatDate(appFields.application_date) || '-'}</td></tr>
            <tr><th>Application Type</th><td>${appFields.application_type || '-'}</td></tr>
            <tr><th>Email | Phone</th><td>${f['gmail'] ? f['gmail'] : '-'} | ${f['Phone Number'] || f['Phone'] || '-'}</td></tr>
            ${f['Formatted url'] ? `<tr><th>Processed Document</th><td><a href="${f['Formatted url']}" target="_blank">View Formatted Resume</a></td></tr>` : '<tr><th>Processed Document</th><td>N/A</td></tr>'}
            ${f['Source File ID'] ? `<tr><th>Original Document</th><td><a href="https://drive.google.com/file/d/${f['Source File ID']}/view" target="_blank">View Original Resume</a></td></tr>` : '<tr><th>Original Document</th><td>N/A</td></tr>'}
            <tr><th style="width:16.5%">Professional Summary</th><td>${f['Professional Summary'] || '-'}</td></tr>
            <tr><th>Current Company</th><td>${f['Current Company'] || '-'}</td></tr>
            <tr><th>Comment</th><td>${appFields.comment || '-'}</td></tr>
            <tr><th>Comment By</th><td>${appFields.comment_by || '-'}</td></tr>
            <tr><th>Key Skills</th><td>${(f['Key Skills'] || []).map(s => `<span class="tag">${s}</span>`).join(' ')}</td></tr>
            <tr><th>Methodologies</th><td>${(f['Methodologies'] || []).map(m => `<span class="tag">${m}</span>`).join(' ')}</td></tr>
            <tr><th>Frameworks &amp; Libraries</th><td>${(f['Frameworks and Libraries'] || []).map(fr => `<span class="tag">${fr}</span>`).join(' ')}</td></tr>
            <tr><th>Databases</th><td>${(f['Databases'] || []).map(db => `<span class="tag">${db}</span>`).join(' ')}</td></tr>
            <tr><th>Certifications</th><td>${(f['Certifications'] || []).map(c => `<span class="tag">${c}</span>`).join(' ')}</td></tr>
            <tr><th>Programming Languages</th><td>${(f['Programming Languages'] || []).map(p => `<span class="tag">${p}</span>`).join(' ')}</td></tr>
            <tr><th>Tools &amp; Platforms</th><td>${(f['Tools and Platforms'] || []).map(t => `<span class="tag">${t}</span>`).join(' ')}</td></tr>
            <tr><th>Created At | Updated At</th><td>${formatDate(f['Date'])} | ${formatDate(appFields.updated_at)}</td></tr>
          </tbody></table>
        </div>
      `;
      const row = card.querySelector('.candidate-row');
      const details = card.querySelector('.detail-row');
      const toggleIcon = card.querySelector('.toggle-icon');
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, i, a, .btn, .changeStatus, .feedback-chat-container')) return;
        document.querySelectorAll('.feedback-chat-container.active').forEach(chat => { chat.classList.remove('active'); });
        document.querySelectorAll('.candidate-card.highlight').forEach(h => { h.classList.remove('highlight'); });
        document.querySelectorAll('.detail-row:not(.collapse)').forEach(otherDetail => {
          if (otherDetail !== details) {
            otherDetail.classList.add('collapse');
            const otherToggle = otherDetail.previousElementSibling.querySelector('.toggle-icon');
            if (otherToggle) otherToggle.textContent = '▼';
          }
        });
        details.classList.toggle('collapse');
        toggleIcon.textContent = details.classList.contains('collapse') ? '▼' : '▲';
        if (!details.classList.contains('collapse')) {
          card.classList.add('highlight');
          setTimeout(() => { card.classList.remove('highlight'); }, 5000);
          setTimeout(() => {
            const cardRect = card.getBoundingClientRect();
            if (cardRect.bottom > window.innerHeight || cardRect.top < 0) {
              card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 100);
        }
      });
      toggleIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        details.classList.toggle('collapse');
        toggleIcon.textContent = details.classList.contains('collapse') ? '▼' : '▲';
      });
      candidatesWrapper.appendChild(card);
    });
    jobSection.appendChild(candidatesWrapper);
    container.appendChild(jobSection);
  });
  container.querySelectorAll('.job-collapse-btn').forEach(btn => {
    const handler = () => {
      const jobSection = btn.closest('.job-section');
      const wrap = jobSection.querySelector('.job-candidate-list');
      if (!wrap) return;
      wrap.classList.toggle('hidden');
      btn.textContent = wrap.classList.contains('hidden') ? 'Show ▼' : 'Hide ▲';
    };
    btn.addEventListener('click', handler);
  });
  renderPaginationControls(jobIds.length, totalPages);
}

function renderPaginationControls(totalJobs, totalPages) {
  const paginationContainer = document.getElementById('paginationControls');
  if (!paginationContainer) return;
  paginationContainer.innerHTML = '';
  if (currentView !== 'list') { paginationContainer.style.display = 'none'; return; }
  if (!totalPages || totalPages <= 1) { paginationContainer.style.display = 'none'; return; }
  paginationContainer.style.display = 'flex';
  const firstBtn = document.createElement('button');
  firstBtn.textContent = 'First';
  firstBtn.disabled = currentPage === 1;
  firstBtn.addEventListener('click', () => { if (currentPage === 1) return; currentPage = 1; renderCandidates(filteredCandidateApplications); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  paginationContainer.appendChild(firstBtn);
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Prev';
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderCandidates(filteredCandidateApplications); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  paginationContainer.appendChild(prevBtn);
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.className = 'active';
    btn.addEventListener('click', () => { if (i === currentPage) return; currentPage = i; renderCandidates(filteredCandidateApplications); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    paginationContainer.appendChild(btn);
  }
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderCandidates(filteredCandidateApplications); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  paginationContainer.appendChild(nextBtn);
  const lastBtn = document.createElement('button');
  lastBtn.textContent = 'Last';
  lastBtn.disabled = currentPage === totalPages;
  lastBtn.addEventListener('click', () => { if (currentPage === totalPages) return; currentPage = totalPages; renderCandidates(filteredCandidateApplications); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  paginationContainer.appendChild(lastBtn);
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true };
  return date.toLocaleString('en-US', options);
}

const FILTER_FIELDS = { status: 'CandidateStatus' };
const SEARCHABLE_FIELDS = ['Candidate Name','Current Role','Current Company','Total Experience','CandidateStatus','Key Skills','Programming Languages','Frameworks and Libraries','Methodologies','Tools and Platforms','Databases','Certifications','job_title'];
let activeFilters = { status: [] };

function openModal(message) {
  document.getElementById('resultMessage').innerHTML = message;
  const existingBtnContainer = document.querySelector('.result-modal-buttons');
  if (existingBtnContainer) existingBtnContainer.remove();
  document.getElementById('resultModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('resultModal').style.display = 'none';
  const existingBtnContainer = document.querySelector('.result-modal-buttons');
  if (existingBtnContainer) existingBtnContainer.remove();
}

function toSearchText(val) {
  if (Array.isArray(val)) return val.join(' ');
  if (val === undefined || val === null) return '';
  return String(val);
}

function applyFilters() {
  const term = document.getElementById('searchInput').value.trim().toLowerCase();
  currentPage = 1;
  if (term.length > 0) {
    filteredCandidateApplications = allCandidateApplications.filter(app => {
      const appFields = app.fields || {};
      const candidateRecord = candidatesMap[appFields.candidate_id];
      const f = candidateRecord?.fields || {};
      const searchableContent = [
        appFields.candidate_name || f['Candidate Name'] || '',
        appFields.candidate_role || f['Current Role'] || '',
        f['Current Company'] || '',
        appFields.candidate_exp || f['Total Experience'] || '',
        appFields.job_title || '',
        f['Key Skills']?.join(' ') || '',
        f['Programming Languages']?.join(' ') || ''
      ].join(' ').toLowerCase();
      return searchableContent.includes(term);
    });
  } else {
    filteredCandidateApplications = allCandidateApplications.slice();
  }
  filterAndDisplayData();
}

async function openConfirmModal(message, applicationId) {
  document.getElementById('confirmMessage').innerHTML = message;
  document.getElementById('confirmModal').style.display = 'flex';
  const yesBtn = document.getElementById('confirmYesBtn');
  yesBtn.replaceWith(yesBtn.cloneNode(true));
  const newYesBtn = document.getElementById('confirmYesBtn');
  newYesBtn.onclick = async function() {
    closeConfirmModal();
    openModal("<div class='spinner-border processSpin' role='status'><span class='sr-only'></span> </div> Processing... Please wait.");
    try {
      const appToDelete = allCandidateApplications.find(a => a.id === applicationId);
      const candidateNameForFeedback = appToDelete?.fields?.candidate_name || 'Unknown';
      const candidateEmailForFeedback = appToDelete?.fields?.candidate_email || '';
      const jobTitleForFeedback = appToDelete?.fields?.job_title || '';
      const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.candidateApplicationsTable)}/${applicationId}`;
      const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` } });
      if (!res.ok) throw new Error(`Record deletion failed: ${res.status}`);
      const msg = `Candidate deselected from ${jobTitleForFeedback}`;
      await saveFeedbackRecord(appToDelete?.fields?.candidate_id, candidateNameForFeedback, candidateEmailForFeedback, msg, 'deselected', appToDelete?.fields?.application_id || 0);
      openModal('✅ Candidate deselected successfully!');
      await refreshData();
    } catch (error) {
      console.error('❌ Failed:', error);
      openModal('❌ Something went wrong! Please try again.');
    }
  };
}

function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
}

function deSelectCandidate(applicationId) {
  openConfirmModal('Are you sure you want to deselect this candidate?', applicationId);
}

function changeApplicationStatus(applicationId, currentStatus, candidateName, statusElement) {
  const app = allCandidateApplications.find(a => a.id === applicationId);
  if (!app) return;
  document.getElementById('candidateNameDisplay').textContent = candidateName;
  document.getElementById('candidateApplicationId').value = applicationId;
  document.getElementById('candidateId').value = app.fields.candidate_id;
  const statusSelect = document.getElementById('statusSelect');
  const subStatusSelect = document.getElementById('subStatusSelect');
  statusSelect.innerHTML = '<option value="">-- Select Main Status --</option>';
  mainStatuses.forEach(status => {
    statusSelect.innerHTML += `<option value="${status.status}">${status.status}</option>`;
  });
  const currentMainStatus = mainStatuses.find(s => s.status === currentStatus ||
    subStatusMap[s.status]?.some(sub => sub.status === currentStatus));
  if (currentMainStatus) {
    statusSelect.value = currentMainStatus.status;
    updateSubStatusDropdown(currentMainStatus.status, currentStatus);
  }
  statusSelect.addEventListener('change', () => {
    const selectedMain = statusSelect.value;
    if (selectedMain) updateSubStatusDropdown(selectedMain, '');
    else subStatusSelect.innerHTML = '<option value="">-- Select Sub Status --</option>';
  });
  document.getElementById('statusConfirmBtn').onclick = async () => {
    const mainStatus = statusSelect.value;
    const subStatus = subStatusSelect.value;
    let finalStatus = subStatus;
    const comment = document.getElementById('statusCommentBox').value.trim();
    if (mainStatus === 'Leads') { openModal('❌ Cannot move back to Leads status'); return; }
    else if (mainStatus === 'Rejected') { finalStatus = mainStatus; }
    else if (!finalStatus) { openModal('❌ Please select a status'); return; }
    openModal("<div class='spinner-border processSpin' role='status'><span class='sr-only'></span> </div> Processing... Please wait.");
    try {
      let statusId = null;
      const statusObj = allStatuses.find(s => s.status === finalStatus);
      if (statusObj) statusId = statusObj.status_id;
      const candidateEmail = app.fields.candidate_email;
      const updateFields = { status: finalStatus, status_id: statusId, comment: comment || app.fields.comment || '', comment_by: loggedInUserEmail };
      const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.candidateApplicationsTable)}/${applicationId}`;
      const res = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: updateFields }) });
      if (res.ok) {
        app.fields.status = finalStatus;
        if (statusId) app.fields.status_id = statusId;
        app.fields.comment = updateFields.comment;
        app.fields.comment_by = loggedInUserEmail;
        const appId = app.fields.application_id;
        let statusChangeMessage = `The status has been updated from ${currentStatus} to ${finalStatus}`;
        if (comment && comment.trim()) statusChangeMessage += `\nComments: ${comment}`;
        await saveFeedbackRecord(app.fields.candidate_id, candidateName, candidateEmail, statusChangeMessage, 'status_change', appId);
        allCandidateApplications = dedupeApplications(allCandidateApplications);
        filteredCandidateApplications = dedupeApplications(filteredCandidateApplications);
        closeChangeStatusModal();
        openModal(`✅ Status updated to ${finalStatus}`);
        renderStatusTabs();
        filterAndDisplayData();
      } else {
        openModal('❌ Failed to update status');
      }
    } catch (error) {
      console.error('Error:', error);
      openModal('❌ Error updating status');
    }
  };
  document.getElementById('changeStatusModal').style.display = 'flex';
}

function updateSubStatusDropdown(mainStatus, selectedSubStatus) {
  const subStatusSelect = document.getElementById('subStatusSelect');
  const substatuses = subStatusMap[mainStatus] || [];
  subStatusSelect.innerHTML = '<option value="">-- Select Sub Status --</option>';
  substatuses.forEach(substatus => {
    subStatusSelect.innerHTML += `<option value="${substatus.status}">${substatus.status}</option>`;
  });
  if (selectedSubStatus) subStatusSelect.value = selectedSubStatus;
}

function closeChangeStatusModal() {
  document.getElementById('changeStatusModal').style.display = 'none';
  document.getElementById('statusCommentBox').value = '';
}

async function saveFeedbackRecord(candidateId, candidateName, candidateEmail, feedbackMessage, feedbackType = 'status_change', applicationId = 0) {
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.feedbackTable)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { candidate_id: candidateId, candidate_name: candidateName, candidate_email: candidateEmail, feed_giver_email: loggedInUserEmail, feed_giver_name: loggedInUserName, feed_message: feedbackMessage, feedback_type: feedbackType, application_id: applicationId } })
    });
    if (!response.ok) throw new Error('Failed to save feedback');
    return true;
  } catch (error) {
    console.error('Error saving feedback:', error);
    return false;
  }
}

function openFeedbackCommunicationModal(candidateId, candidateName, candidateEmail = 'NA', jobTtitle = 'Unknown', application_Id = 0) {
  currentFeedbackCandidateId = candidateId;
  currentFeedbackCandidateName = candidateName;
  currentFeedbackCandidateEmail = candidateEmail;
  currentFeedbackApplicationId = application_Id;
  document.getElementById('feedbackCandidateName').textContent = candidateName;
  document.getElementById('feedbackJobTitle').textContent = jobTtitle;
  document.getElementById('feedbackMessageInput').value = '';
  document.getElementById('feedbackCommunicationModal').style.display = 'flex';
  loadFeedbackMessages();
  document.getElementById('feedbackMessageInput').focus();
}

function closeFeedbackCommunicationModal() {
  document.getElementById('feedbackCommunicationModal').style.display = 'none';
  currentFeedbackCandidateId = null;
  currentFeedbackCandidateName = null;
  currentFeedbackCandidateEmail = null;
  currentFeedbackApplicationId = 0;
}

async function loadFeedbackMessages() {
  if (!currentFeedbackCandidateId) return;
  const container = document.getElementById('feedbackMessagesContainer');
  container.innerHTML = '<div style="text-align:center;padding:10px;color:#999;">Loading messages...</div>';
  try {
    const formula = `{application_id}=${currentFeedbackApplicationId}`;
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.feedbackTable)}?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=feedback_date&sort[0][direction]=asc`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` } });
    const data = await response.json();
    const records = data.records || [];
    renderFeedbackMessages(records, container);
    container.scrollTop = container.scrollHeight;
  } catch (error) {
    console.error('Error loading feedback messages:', error);
    container.innerHTML = '<div style="text-align:center;padding:10px;color:red;">Failed to load messages</div>';
  }
}

function renderFeedbackMessages(records, container) {
  container.innerHTML = '';
  if (records.length === 0) { container.innerHTML = '<div style="text-align:center;padding:10px;color:#999;">No messages yet</div>'; return; }
  records.forEach(record => {
    const fields = record.fields;
    const isSelf = fields.feed_giver_email === loggedInUserEmail;
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `margin-bottom:6px;padding:5px;border-radius:6px;${isSelf ? 'background:white;margin-left:20px;' : 'background:white;margin-right:20px;'}`;
    const timestamp = fields.feedback_date
      ? new Date(fields.feedback_date).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      : 'Unknown';
    const formattedMessage = (fields.feed_message || '').replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:${isSelf ? '#1976d2' : '#FF6F21'};margin-bottom:2px;">${isSelf ? 'You' : (fields.feed_giver_name || fields.feed_giver_email)}</div>
      <div style="font-size:12px;color:#2c2b2b;line-height:1;">${formattedMessage}</div>
      <div style="font-size:10px;color:#4f7daf;text-align:right;">${timestamp}</div>
    `;
    container.appendChild(messageDiv);
  });
}

async function sendFeedbackMessageFromModal() {
  const message = document.getElementById('feedbackMessageInput').value.trim();
  const btn = document.getElementById('feedbackSendBtn');
  if (!message || !currentFeedbackCandidateId) return;
  btn.disabled = true;
  try {
    const success = await saveFeedbackRecord(currentFeedbackCandidateId, currentFeedbackCandidateName, currentFeedbackCandidateEmail, message, 'General', currentFeedbackApplicationId);
    if (success) {
      document.getElementById('feedbackMessageInput').value = '';
      updateFeedbackSendButtonState();
      const container = document.getElementById('feedbackMessagesContainer');
      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = 'margin-bottom:6px;padding:5px;border-radius:6px;background:white;margin-left:20px;';
      const timestamp = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      messageDiv.innerHTML = `<div style="font-size:12px;font-weight:600;color:#1976d2;margin-bottom:2px;">You</div><div style="font-size:12px;color:#2c2b2b;line-height:1;">${message}</div><div style="font-size:10px;color:#4f7daf;text-align:right;">${timestamp}</div>`;
      container.appendChild(messageDiv);
      container.scrollTop = container.scrollHeight;
    }
  } finally {
    btn.disabled = false;
  }
}

function handleFeedbackInputKeypress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const btn = document.getElementById('feedbackSendBtn');
    if (!btn.disabled) sendFeedbackMessageFromModal();
  }
}

function updateFeedbackSendButtonState() {
  const input = document.getElementById('feedbackMessageInput');
  const btn = document.getElementById('feedbackSendBtn');
  const hasText = input.value.trim().length > 0;
  btn.disabled = !hasText;
}

function openShareModal(jobTitle, jobId, candidates) {
  currentJobData = { jobTitle, jobId, candidates };
  currentShareJobClientId = null;
  document.getElementById('shareJobTitle').textContent = jobTitle || 'Unknown Job';
  document.getElementById('toEmail').value = '';
  document.getElementById('ccEmail').value = '';
  document.getElementById('shareClientName').value = '';
  document.getElementById('shareClientSelect').value = '';
  document.getElementById('viewShareClientDetailsLink').style.display = 'none';
  populateShareClientDropdown();
  const job = jobsMap[jobId];
  if (job && job.client_id && clientsMap[job.client_id]) {
    const client = clientsMap[job.client_id];
    currentShareJobClientId = job.client_id;
    document.getElementById('shareClientSelect').value = job.client_id;
    document.getElementById('toEmail').value = client.email || '';
    document.getElementById('shareClientName').value = client.company_name || '';
    document.getElementById('viewShareClientDetailsLink').style.display = 'inline';
  }
  document.getElementById('shareClientSelect').addEventListener('change', function() {
    const selectedClientId = this.value;
    const detailsLink = document.getElementById('viewShareClientDetailsLink');
    if (selectedClientId && clientsMap[selectedClientId]) {
      const client = clientsMap[selectedClientId];
      currentShareJobClientId = selectedClientId;
      document.getElementById('toEmail').value = client.email || '';
      document.getElementById('shareClientName').value = client.company_name || '';
      detailsLink.style.display = 'inline';
    } else {
      document.getElementById('toEmail').value = '';
      document.getElementById('shareClientName').value = '';
      detailsLink.style.display = 'none';
    }
  });
  const listDiv = document.getElementById('selectedCandidateList');
  listDiv.innerHTML = '';
  const headerRow = document.createElement('div');
  headerRow.className = 'd-flex fw-bold mb-2 align-items-center';
  headerRow.style.gap = '10px';
  headerRow.innerHTML = `<div style="width:5%;"><input type="checkbox" id="selectAllCandidates" checked></div><div style="flex:1;width:35%">Candidate Name</div><div style="width:30%">Status</div><div style="flex:1;width:30%">Email</div>`;
  listDiv.appendChild(headerRow);
  const masterCheckbox = document.getElementById('selectAllCandidates');
  masterCheckbox.addEventListener('change', () => {
    listDiv.querySelectorAll('.candidate-checkbox').forEach(cb => cb.checked = masterCheckbox.checked);
  });
  candidates.forEach(c => {
    const candName = c.name || 'Unnamed';
    const candId = c.candidate_id;
    const status = c.status || '-';
    const emailRaw = c.email || '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = emailRegex.test(emailRaw) ? `<a href="mailto:${emailRaw}">${emailRaw}</a>` : '-';
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center mb-1';
    row.style.gap = '10px';
    row.innerHTML = `<div style="width:5%;"><input type="checkbox" class="candidate-checkbox" value="${candId}" checked></div><div style="flex:1;width:35%">${candName}</div><div style="width:30%"><span class="status-badge">${status}</span></div><div style="flex:1;width:30%">${email}</div>`;
    listDiv.appendChild(row);
  });
  const candidateCheckboxes = listDiv.querySelectorAll('.candidate-checkbox');
  candidateCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      masterCheckbox.checked = Array.from(candidateCheckboxes).every(c => c.checked);
    });
  });
  const modal = new bootstrap.Modal(document.getElementById('shareModal'));
  modal.show();
}

function openSendEmailModal(jobTitle, candidateEmail, candidateStatus, applicationId = 0, interviewId = 0, candidateName = 'NA') {
  document.getElementById('modalEmailTypeJobTitle').value = jobTitle;
  document.getElementById('modalEmailTypeCandidateEmail').value = candidateEmail;
  document.getElementById('modalEmailTypeCandidateStatus').value = candidateStatus;
  document.getElementById('modalEmailTypeApplicationId').value = applicationId || '';
  document.getElementById('modalEmailTypeInterviewId').value = interviewId || '';
  document.getElementById('modalEmailTypeCandidateName').value = candidateName || 'NA';
  checkAndUpdateEmailTypeOptions(applicationId, interviewId);
  const emailTypeModal = new bootstrap.Modal(document.getElementById('emailTypeSelectionModal'));
  emailTypeModal.show();
}

function checkAndUpdateEmailTypeOptions(applicationId, interviewId) {
  const mailTypeInitialScreening = document.getElementById('mailTypeInitialScreening');
  const mailTypeInterviewBot = document.getElementById('mailTypeInterviewBot');
  const initialScreeningMessage = document.getElementById('initialScreeningMessage');
  const interviewBotMessage = document.getElementById('interviewBotMessage');
  const initialScreeningLabel = document.getElementById('initialScreeningLabel');
  const interviewBotLabel = document.getElementById('interviewBotLabel');
  const app = applicationId ? allCandidateApplications.find(a => a.id === applicationId) : null;
  if (!app) {
    if (mailTypeInitialScreening) mailTypeInitialScreening.disabled = false;
    if (mailTypeInterviewBot) mailTypeInterviewBot.disabled = false;
    if (initialScreeningMessage) initialScreeningMessage.style.display = 'none';
    if (interviewBotMessage) interviewBotMessage.style.display = 'none';
    if (initialScreeningLabel) initialScreeningLabel.style.display = 'block';
    if (interviewBotLabel) interviewBotLabel.style.display = 'block';
    return;
  }
  const candidateId = app.fields.candidate_id;
  const jobId = app.fields.job_id;
  const applicationIdField = app.fields.application_id || applicationId;
  let interviewRecord = null;
  if (interviewId && interviewId !== '0') {
    interviewRecord = allInterviews.find(rec => rec.id === interviewId);
  } else {
    interviewRecord = allInterviews.find(rec => rec.fields && rec.fields.candidate_id === candidateId && rec.fields.job_id === jobId && rec.fields.application_id === applicationIdField);
  }
  if (!interviewRecord) {
    if (mailTypeInitialScreening) mailTypeInitialScreening.disabled = false;
    if (mailTypeInterviewBot) mailTypeInterviewBot.disabled = false;
    if (initialScreeningMessage) initialScreeningMessage.style.display = 'none';
    if (interviewBotMessage) interviewBotMessage.style.display = 'none';
    if (initialScreeningLabel) initialScreeningLabel.style.display = 'block';
    if (interviewBotLabel) interviewBotLabel.style.display = 'block';
    return;
  }
  const hasInitialScreening = !!interviewRecord.fields.initialScreeningData;
  if (hasInitialScreening) {
    if (mailTypeInitialScreening) mailTypeInitialScreening.disabled = true;
    if (initialScreeningLabel) initialScreeningLabel.style.display = 'none';
    if (initialScreeningMessage) initialScreeningMessage.style.display = 'block';
  } else {
    if (mailTypeInitialScreening) mailTypeInitialScreening.disabled = false;
    if (initialScreeningLabel) initialScreeningLabel.style.display = 'block';
    if (initialScreeningMessage) initialScreeningMessage.style.display = 'none';
  }
  const hasInterviewBot = !!interviewRecord.fields.interview_bot_feedback;
  if (hasInterviewBot) {
    if (mailTypeInterviewBot) mailTypeInterviewBot.disabled = true;
    if (interviewBotLabel) interviewBotLabel.style.display = 'none';
    if (interviewBotMessage) interviewBotMessage.style.display = 'block';
  } else {
    if (mailTypeInterviewBot) mailTypeInterviewBot.disabled = false;
    if (interviewBotLabel) interviewBotLabel.style.display = 'block';
    if (interviewBotMessage) interviewBotMessage.style.display = 'none';
  }
}

function resetEmailTypeSelection() {
  document.getElementById('mailTypeStatus').checked = true;
  document.getElementById('mailTypeInitialScreening').checked = false;
  document.getElementById('mailTypeInterviewBot').checked = false;
}

function openStatusEmailModal(jobTitle, candidateEmail, candidateStatus, applicationId = 0, candidateName = 'NA') {
  document.getElementById('emailJobTitle').textContent = jobTitle;
  document.getElementById('emailTo').value = candidateEmail;
  document.getElementById('emailCc').value = '';
  document.getElementById('emailBcc').value = '';
  document.getElementById('emailStatus').value = candidateStatus;
  document.getElementById('emailSubject').value = `Opportunity: ${jobTitle}`;
  document.getElementById('emailCandidateName').value = candidateName || 'NA';
  document.getElementById('emailMessage').value = '';
  document.getElementById('emailApplicationId').value = applicationId || '';
  const sendEmailModal = new bootstrap.Modal(document.getElementById('sendEmailModal'));
  sendEmailModal.show();
}

function openInitialScreeningEmailModal(jobTitle, candidateEmail, candidateStatus, applicationId = 0, interviewId = 0, candidateName = 'NA') {
  document.getElementById('initialScreeningJobTitle').textContent = jobTitle;
  document.getElementById('initialScreeningTo').value = candidateEmail;
  document.getElementById('initialScreeningCc').value = '';
  document.getElementById('initialScreeningBcc').value = '';
  document.getElementById('initialScreeningSubject').value = `Initial Screening - ${jobTitle}`;
  document.getElementById('initialScreeningMessage1').value = '';
  document.getElementById('initialScreeningApplicationId').value = applicationId || '';
  document.getElementById('initialScreeningInterviewId').value = interviewId || '';
  document.getElementById('initialScreeningCandidateName').value = candidateName || 'NA';
  const modal = new bootstrap.Modal(document.getElementById('initialScreeningEmailModal'));
  modal.show();
}

function openInterviewBotEmailModal(jobTitle, candidateEmail, candidateStatus, applicationId = 0, interviewId = 0, candidateName = 'NA') {
  document.getElementById('interviewBotJobTitle').textContent = jobTitle;
  document.getElementById('interviewBotTo').value = candidateEmail;
  document.getElementById('interviewBotCc').value = '';
  document.getElementById('interviewBotBcc').value = '';
  document.getElementById('interviewBotSubject').value = `Voice Bot Interview Scheduling - ${jobTitle}`;
  document.getElementById('interviewBotMessage1').value = '';
  document.getElementById('interviewBotApplicationId').value = applicationId || '';
  document.getElementById('interviewBotInterviewId').value = interviewId || '';
  document.getElementById('interviewBotCandidateName').value = candidateName || 'NA';
  const modal = new bootstrap.Modal(document.getElementById('interviewBotEmailModal'));
  modal.show();
}

async function createInterviewRecord(candidateId, jobId, jobTitle, applicationId, candidateEmail, candidateName = '') {
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.interviewTable)}`;
    const fields = {
      candidate_id: candidateId,
      job_id: jobId,
      jobTitle: jobTitle,
      application_id: applicationId,
      candidateEmail: candidateEmail,
      candidateName: candidateName,
      interviewType: "Final Interview"
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields, typecast: true })
    });
    if (!res.ok) throw new Error(`POST failed: ${res.status}`);
    const data = await res.json();
    console.log('✅ Interview record created:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Error creating interview record:', error);
    throw error;
  }
}

async function updateInterviewRecord(id, fields) {
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.interviewTable)}/${id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields, typecast: true })
    });
    if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('❌ Error updating interview record:', error);
    throw error;
  }
}

function generateAnalysisActionButtons(candidateId, jobId, applicationId, interviewId = 0, viewType = 'board') {
  try {
    let initialBtn = '';
    let interviewBtn = '';
    let interviewRecord = null;
    if (interviewId && interviewId !== '0') {
      interviewRecord = allInterviews.find(rec => rec.id === interviewId);
    } else {
      interviewRecord = allInterviews.find(rec =>
        rec.fields &&
        rec.fields.candidate_id === candidateId &&
        rec.fields.job_id === jobId &&
        rec.fields.application_id === applicationId
      );
    }
    if (interviewRecord) {
      const initialScreeningData = interviewRecord.fields.initialScreeningData;
      const initialAnalysisTriggered = interviewRecord.fields.initialAnalysisTriggered;
      const analysisTriggered = interviewRecord.fields.analysisTriggered;
      const initialScreeningVideosData = interviewRecord.fields.initial_screening_videos_data;
      const finalScreeningData = interviewRecord.fields.finalScreeningData;
      const videoAvailable = interviewRecord.fields.video_available;
      if (initialScreeningVideosData && String(initialScreeningVideosData).trim() !== "") {
        if (initialAnalysisTriggered === "Yes" && (!initialScreeningData || String(initialScreeningData).trim() === "")) {
          initialBtn = `<span class="btn btn-sm btn-warning btn-icon-css" style="cursor: default;border: 1px solid #9d9d2d;" title="Analysis In Progress"><i class="bi bi-hourglass-split"></i></span>`;
        } else if (initialAnalysisTriggered !== "Yes") {
          initialBtn = `<span class="btn btn-sm btn-warning btn-icon-css initial-analysis-btn" id='initialAnalysisBtn-${interviewRecord.id}' data-interview-id="${interviewRecord.id}" data-title="${interviewRecord.fields.jobTitle || ''}" data-init-video-data='${JSON.stringify(initialScreeningVideosData).replace(/'/g, "&apos;")}' style="cursor: pointer;border: 1px solid #9d9d2d;" title="Do Initial Analysis"><i class="bi bi-play-circle"></i></span>`;
        }
      } else if (initialScreeningData && String(initialScreeningData).trim() !== "") {
        initialBtn = `<span class="btn btn-info btn-sm btn-icon-css" title="Initial Analysis" onclick="event.stopPropagation(); checkScreeningData('${candidateId}', '${jobId}', ${applicationId}, 1)" style="cursor: pointer;"><i class="bi bi-graph-up"></i></span>`;
      }
      if (videoAvailable === "Yes") {
        if (finalScreeningData && String(finalScreeningData).trim() !== "") {
          interviewBtn = `<span class="btn btn-info btn-sm btn-icon-css" title="Interview Analysis" onclick="event.stopPropagation(); checkScreeningData('${candidateId}', '${jobId}', ${applicationId}, 2)" style="cursor: pointer;border: 1px solid #418db9;"><i class="bi bi-bar-chart"></i></span>`;
        } else if (analysisTriggered === "Yes" && (!finalScreeningData || String(finalScreeningData).trim() === "")) {
          interviewBtn = `<span class="btn btn-sm btn-danger btn-icon-css" style="cursor: default;border: 1px solid #8d3636;" title="Interview Analysis In Progress"><i class="bi bi-hourglass-split"></i></span>`;
        } else if (analysisTriggered !== "Yes") {
          interviewBtn = `<span class="btn btn-sm btn-danger btn-icon-css" title="Do Interview Analysis" onclick="event.stopPropagation(); checkRefImageAndProcessVideo('${interviewRecord.id}', '${(interviewRecord.fields.jobTitle || '').replace(/'/g, "\\'")}', 2, '${interviewRecord.fields.candidate_id || ''}', '${interviewRecord.fields.candidateName || ''}')" style="cursor: pointer;border: 1px solid #8d3636;"><i class="bi bi-play-circle"></i></span>`;
        }
      }
    }
    return { initialBtn, interviewBtn };
  } catch (error) {
    console.error('Error generating analysis buttons:', error);
    return { initialBtn: '', interviewBtn: '' };
  }
}

async function checkRefImageAndProcessVideo(interviewId, interviewTitle, type, candidateId, candidateName) {
  try {
    const interviewRecord = allInterviews.find(rec => rec.id === interviewId);
    if (!interviewRecord) { openModal("❌ Interview record not found."); return; }
    const refImageUploaded = interviewRecord.fields.ref_ImageUploaded;
    const refImageFileData = interviewRecord.fields.ref_ImageFileData;
    if (refImageUploaded !== "Yes" || !refImageFileData) {
      showRefImageConfirmModal(interviewId, interviewTitle, candidateId, candidateName, type);
      return;
    }
    await processVideo(interviewId, interviewTitle, type);
  } catch (error) {
    console.error('Error checking reference image:', error);
    openModal("❌ Error checking reference image status.");
  }
}

function showRefImageConfirmModal(interviewId, interviewTitle, candidateId, candidateName, analysisType) {
  const interviewRecord = allInterviews.find(rec => rec.id === interviewId);
  const jobTitle = interviewRecord?.fields?.jobTitle || interviewTitle || 'Position';
  const candidateEmail = interviewRecord?.fields?.candidateEmail || '';
  const reference_url = `https://surecafe.ai/project_surecafe_ai/index.html?interview_id=${encodeURIComponent(interviewId)}&name=${encodeURIComponent(candidateName)}&job_title=${encodeURIComponent(jobTitle)}`;
  const confirmData = { candidateEmail, candidateName, jobTitle, reference_url, interviewId, analysisType };
  const message = `
    <div style="text-align: left; line-height: 1.6;">
      <p><strong>Reference Image Not Uploaded</strong></p>
      <p>Candidate <strong>${candidateName}</strong> hasn't uploaded the reference image yet.</p>
      <p>This image is required for accurate interview analysis.</p>
      <p style="margin-top: 15px;"><strong>Would you like to resend the reference image URL to the candidate?</strong></p>
    </div>
  `;
  const modalContainer = document.getElementById("resultModal");
  const messageDiv = document.getElementById("resultMessage");
  messageDiv.innerHTML = message;
  const existingBtnContainer = document.querySelector(".result-modal-buttons");
  if (existingBtnContainer) existingBtnContainer.remove();
  const btnContainer = document.createElement("div");
  btnContainer.className = "result-modal-buttons";
  btnContainer.style.cssText = "display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;";
  const noBtn = document.createElement("button");
  noBtn.textContent = "No, Skip";
  noBtn.className = "btn btn-secondary btn-sm";
  noBtn.onclick = () => { closeModal(); };
  const yesBtn = document.createElement("button");
  yesBtn.textContent = "Yes, Send Reference URL";
  yesBtn.className = "btn btn-primary btn-sm";
  yesBtn.onclick = async () => {
    const btnBox = document.querySelector(".result-modal-buttons");
    if (btnBox) btnBox.style.display = "none";
    await sendReferenceImageEmail(confirmData);
    await saveFeedbackRecord(candidateId, candidateName, candidateEmail, 'Reference image url has been sent.', 'email', interviewRecord?.fields?.application_id || 0);
  };
  btnContainer.appendChild(noBtn);
  btnContainer.appendChild(yesBtn);
  messageDiv.parentNode.insertBefore(btnContainer, messageDiv.nextSibling);
  modalContainer.style.display = "flex";
}

async function sendReferenceImageEmail(confirmData) {
  try {
    openModal("<div class='spinner-border processSpin' role='status'><span class='sr-only'></span> </div> Sending reference image URL to candidate... Please wait.");
    const htmlBody = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>body{font-family:'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#333;background-color:#f9f9f9;}.container{max-width:600px;margin:0 auto;background:#fff;padding:40px;border-radius:8px;}.header{margin-bottom:30px;border-bottom:3px solid #1a73e8;padding-bottom:15px;}.header h1{color:#1a73e8;font-size:24px;margin:0;}.action-box{background-color:#e8f4fd;border-left:4px solid #1a73e8;padding:20px;margin:25px 0;border-radius:4px;}.cta-button{display:inline-block;background-color:#1a73e8;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:4px;font-weight:bold;margin-top:15px;}.footer{margin-top:30px;padding-top:20px;border-top:1px solid #ddd;color:#666;font-size:12px;}.highlight{color:#1a73e8;font-weight:bold;}</style></head><body><div class="container"><div class="header"><h1>Reference Image Upload Required</h1></div><div class="content"><p>Dear <strong>${confirmData.candidateName}</strong>,</p><p>Thank you for your interest in the position of <span class="highlight">${confirmData.jobTitle}</span> at SureCafe.</p><div class="action-box"><p><strong>Your next step:</strong></p><p>Please click the button below to upload your reference image.</p><a href="${confirmData.reference_url}" style="color:#ffffff !important;" class="cta-button" target="_blank">Upload Reference Image</a></div><p>Once you've uploaded your reference image, we can proceed with the next phase of the interview process.</p></div><div class="footer"><p>Best regards,</p><p><strong>The SureCafe Team</strong></p></div></div></body></html>`;
    const emailPayload = {
      to: confirmData.candidateEmail,
      cc: 'ai@tiuconsulting.com',
      bcc: '',
      subject: `Reference Image Upload Required - ${confirmData.jobTitle}`,
      body: htmlBody,
      isHtml: true
    };
    const res = await fetch('https://surecafe.app.n8n.cloud/webhook/c79a7ebb-1c69-4aa8-9198-e58f0e6ec475', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload)
    });
    if (!res.ok) throw new Error(`Failed to send email: ${res.status}`);
    console.log('✅ Reference image URL sent successfully');
    openModal('✅ Reference image URL has been sent to the candidate. Please ask them to upload the image and try again.');
    setTimeout(() => { closeModal(); }, 5000);
  } catch (err) {
    console.error('❌ Error sending reference image email:', err);
    openModal('❌ Failed to send reference image URL. Please try again.');
  }
}

async function processVideo(interviewId, interviewTitle, type = 1, additionalData = null) {
  try {
    openModal("<div class='spinner-border processSpin' role='status'><span class='sr-only'></span> </div> Starting " + (type === 1 ? "initial" : "final") + " video analysis... Please wait.");
    if (type === 1 || type === 2) {
      const config = {
        webhookUrl: type === 1
          ? "https://surecafe.app.n8n.cloud/webhook/30b97746-5887-49f4-b6d3-604bb8a5e007"
          : "https://surecafe.app.n8n.cloud/webhook/b5cbdda9-d73c-4bd9-af28-1277573b4e3c",
        updateField: type === 1 ? "initialAnalysisTriggered" : "analysisTriggered",
        label: type === 1 ? "Initial" : "Final"
      };
      let videoPayload = {
        interview_id: interviewId,
        interview_title: interviewTitle,
        type: type === 1 ? "initial screening video analysis" : "final screening video analysis"
      };
      if (type === 1 && additionalData) {
        const parsedData = safeParseJSON(additionalData);
        videoPayload = { ...videoPayload, ...parsedData };
      }
      fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoPayload),
      });
      await updateInterviewRecord(interviewId, { [config.updateField]: "Yes" });
      allInterviews = await fetchAllInterviewsData();
      const btnId = type === 1 ? `initialAnalysisBtn-${interviewId}` : `analysisBtn-${interviewId}`;
      const analysisBtn = document.getElementById(btnId);
      if (analysisBtn) { analysisBtn.disabled = true; analysisBtn.style.cursor = "default"; }
      if (currentView === 'board') {
        renderKanbanBoard(getCurrentFilteredApplications());
      } else {
        renderCandidates(getCurrentFilteredApplications());
      }
      openModal(`✅ The ${config.label.toLowerCase()} video analysis process has been started. Results will be available soon.`);
    } else {
      openModal("❌ Unknown operation type.");
    }
  } catch (error) {
    console.error('Error in processVideo:', error);
    openModal(`❌ Something went wrong while starting the video analysis. Please try again.`);
  }
}

function getCurrentFilteredApplications() {
  let filtered = allCandidateApplications;
  if (Object.keys(activeFilters.status || {}).length > 0) {
    const selectedStatuses = Object.keys(activeFilters.status || {});
    filtered = filtered.filter(app => selectedStatuses.includes(app.fields.status));
  }
  return filtered;
}

async function shareCandidateDetails(payloadData) {
  const webhookUrl = 'https://surecafe.app.n8n.cloud/webhook/f574b199-cfd5-49e6-aad5-62e62467dc49';
  openModal("<div class='spinner-border processSpin' role='status'><span class='sr-only'></span> </div> Processing... Please wait.");
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadData),
    });
    if (!response.ok) throw new Error(`Error triggering n8n workflow: ${response.status}`);
    await response.text();
    bootstrap.Modal.getInstance(document.getElementById("shareModal")).hide();
    openModal('✅ Email sent successfully!');
    setTimeout(() => { closeModal(); }, 5000);
  } catch (error) {
    console.error('Error triggering n8n workflow to share the Candidate Details:', error);
    openModal('❌ Failed to send email.');
  }
}

function safeParseJSON(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}

function showInterviewModal(candidateId, jobId, candidateEmail, jobTitle, candidateName, applicationId, isFinalExisting = false, forceInterviewType = null, l1L2Status = null) {
  document.getElementById("interviewForm").reset();
  document.getElementById("interviewJobTitle").textContent = "";
  document.getElementById("modalCandidateName").textContent = "";
  document.getElementById("candidateEmail").value = "";
  document.getElementById("interviewerEmail").value = "";
  document.getElementById("attendeesEmail").value = "";
  document.getElementById("interviewDescription").value = "";
  document.getElementById("applicationId").value = "";
  populateTimeDropdowns();
  populateTimezones();
  document.getElementById("interviewJobTitle").textContent = jobTitle || "No Job Title";
  document.getElementById("modalCandidateName").textContent = ` ${candidateName}` || "";
  document.getElementById("candidateEmail").value = candidateEmail || "";
  document.getElementById("candidateName").value = candidateName || "";
  document.getElementById("interviewCandidateId").value = candidateId || "";
  document.getElementById("interviewJobId").value = jobId || "";
  document.getElementById("applicationId").value = applicationId || "";
  let interviewTypeDefault = 'Final Interview';
  let buttonLabel = 'Schedule Interview';
  let interviewStatus = 'Interview Scheduled';
  if (l1L2Status) {
    interviewTypeDefault = l1L2Status;
    interviewStatus = l1L2Status;
    buttonLabel = 'Schedule Interview';
  } else if (forceInterviewType) {
    interviewTypeDefault = forceInterviewType;
    buttonLabel = 'Reschedule Interview';
    interviewStatus = 'Interview Re-Scheduled';
  } else if (isFinalExisting) {
    interviewTypeDefault = 'Final Interview';
    buttonLabel = 'Schedule Interview';
    interviewStatus = 'Interview Scheduled';
  } else {
    interviewTypeDefault = 'Final Interview';
    buttonLabel = 'Schedule Interview';
    interviewStatus = 'Interview Scheduled';
  }
  document.getElementById('interviewTypeInput').value = interviewTypeDefault;
  document.getElementById('interviewSubmitBtn').textContent = buttonLabel;
  document.getElementById('interviewStatus').value = interviewStatus;
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("interviewDate");
  dateInput.min = today;
  dateInput.value = today;
  const modal = new bootstrap.Modal(document.getElementById("interviewModal"));
  modal.show();
}

function populateTimeDropdowns() {
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
  ["startHour", "endHour"].forEach(id => {
    const select = document.getElementById(id);
    if (select) select.innerHTML = hours.map(h => `<option value="${h}">${h}</option>`).join("");
  });
  ["startMinute", "endMinute"].forEach(id => {
    const select = document.getElementById(id);
    if (select) select.innerHTML = minutes.map(m => `<option value="${m}">${m}</option>`).join("");
  });
}

function populateTimezones() {
  const timeZoneSelect = document.getElementById("timeZone");
  if (!timeZoneSelect) return;
  timeZoneSelect.innerHTML = "";
  let zones = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch (err) {
    zones = ["Asia/Kolkata","America/New_York","America/Chicago","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Dubai","Asia/Tokyo","Australia/Sydney"];
  }
  if (!zones.includes("Asia/Kolkata")) zones.unshift("Asia/Kolkata");
  zones.forEach(zone => {
    const option = document.createElement("option");
    option.value = zone;
    option.textContent = zone;
    timeZoneSelect.appendChild(option);
  });
  timeZoneSelect.value = "Asia/Kolkata";
}

function checkScreeningData(candidateId, jobId, applicationId, type = 0) {
  const record = allInterviews.find(
    rec => rec.fields &&
    rec.fields.candidate_id === candidateId &&
    rec.fields.job_id === jobId &&
    rec.fields.application_id === applicationId &&
    rec.fields.interviewType &&
    rec.fields.interviewType.trim().toLowerCase() === "final interview"
  );
  if (!record) return null;
  const hasInitial = !!record.fields.initialScreeningData;
  const hasFinal = !!record.fields.finalScreeningData;
  const finalInterview = !!record.fields.interviewType && record.fields.interviewType === "Final Interview";
  const interview_id = record.id;
  if (type === 0) {
    return { hasInitial, hasFinal, finalInterview, interview_id };
  } else if (type === 1) {
    const found = {
      recordId: record.id,
      candidateName: record.fields.candidateName || "-",
      jobTitle: record.fields.jobTitle || "-",
      candidateEmail: record.fields.candidateEmail || "-",
      status: record.fields.status || "-",
      hasInitial,
      initialScreeningData: record.fields.initialScreeningData,
    };
    showInitialAnalysisModal(found);
  } else if (type === 2) {
    const found = {
      recordId: record.id,
      candidateName: record.fields.candidateName || "-",
      jobTitle: record.fields.jobTitle || "-",
      candidateEmail: record.fields.candidateEmail || "-",
      status: record.fields.status || "-",
      hasFinal,
      finalScreeningData: record.fields.finalScreeningData,
    };
    showAnalysisModal(found);
  } else {
    return false;
  }
}

function showAnalysisModal(found) {
  let modalEl = document.getElementById('analysisModal');
  const modal = new bootstrap.Modal(modalEl);
  const loader = document.getElementById('analysisLoader');
  const container = document.getElementById('analysisContainer');
  loader.style.display = 'none';
  container.style.display = 'block';
  const parseSafe = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (e) { console.warn('JSON parse failed', e); return null; }
  };
  const finalObj = parseSafe(found.finalScreeningData || found.fields?.finalScreeningData);
  document.getElementById('aCandidateName').innerText = found.candidateName || found.fields?.candidateName || '-';
  document.getElementById('aJobTitle').innerText = found.jobTitle || found.fields?.jobTitle || '-';
  const pct = (n) => (n===null||n===undefined||isNaN(n)) ? 0 : Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const barHtml = (label, value, color = 'primary') => {
    let v = Math.max(0, Math.min(100, value));
    const barWidth = v > 0 && v < 0.1 ? 0.1 : v;
    return `<div style="display: flex; justify-content: space-between; align-items: center;"><span>${label}</span><span>${v.toFixed(1)}/100</span></div>
        <div class="progress" style="height:10px; background:#ebeef6;"><div class="progress-bar bg-${color}" role="progressbar" style="width:${barWidth}%; min-width:0.1px;"></div></div>`;
  };
  const summary = finalObj?.Interview_Analysis?.Candidate_Analysis?.Summary || {};
  const stats = summary?.Quick_Stats || {};
  let overallRaw = stats?.Overall_Score;
  let overallScore = 0;
  if (overallRaw !== undefined && overallRaw !== null) {
    overallScore = Number(overallRaw);
    if (overallScore <= 10) overallScore = Math.round(overallScore * 10);
    overallScore = Math.round(overallScore);
  }
  document.getElementById('aOverallScore').innerText = overallScore;
  const videoSent = pct(stats?.Video_Sentiment || 0);
  const faceTime = pct(stats?.Face_Time || 0);
  document.getElementById('statOverallBar').innerHTML = barHtml('Overall Score', overallScore, 'info');
  document.getElementById('statVideoBar').innerHTML = barHtml('Video Sentiment', videoSent, 'warning');
  document.getElementById('statFaceBar').innerHTML = barHtml('Face Time', faceTime, 'success');
  document.getElementById('summaryExecutive').innerHTML = `<div style="white-space:pre-wrap;">${(summary?.Executive_Summary) ? summary.Executive_Summary : 'No executive summary available.'}</div>`;
  const strengthsEl = document.getElementById('summaryStrengths');
  strengthsEl.innerHTML = (summary?.Strengths && summary.Strengths.length) ? `${summary.Strengths.map(s=>`<li>${s}</li>`).join('')}` : '<div class="small-muted">No strengths available.</div>';
  const improvementsEl = document.getElementById('summaryImprovements');
  improvementsEl.innerHTML = (summary?.Areas_for_Improvement && summary.Areas_for_Improvement.length) ? `${summary.Areas_for_Improvement.map(s=>`<li>${s}</li>`).join('')}` : '<div class="small-muted">No improvement areas available.</div>';
  const videoAnalysis = finalObj?.Interview_Analysis?.Candidate_Analysis?.Video_Analysis || {};
  let dist = {};
  if (videoAnalysis?.Emotional_Analysis?.Emotion_Distribution) dist = videoAnalysis.Emotional_Analysis.Emotion_Distribution;
  else if (videoAnalysis?.Emotional_Analysis) dist = videoAnalysis.Emotional_Analysis.Emotion_Distribution || videoAnalysis.Emotional_Analysis;
  else dist = {};
  const colorMap = {CALM:'info',HAPPY:'success',CONFUSED:'warning',SURPRISED:'warning',ANGRY:'danger',FEAR:'secondary',SAD:'primary',DISGUSTED:'danger',NEUTRAL:'secondary'};
  const emotionContainer = document.getElementById('videoEmotionDistribution');
  emotionContainer.innerHTML = '';
  if (dist && Object.keys(dist).length) {
    Object.entries(dist).forEach(([k,v])=>{
      const color = colorMap[k] || 'secondary';
      const p = document.createElement('div');
      p.innerHTML = `${barHtml(k, Number(v), color)}`;
      emotionContainer.appendChild(p);
    });
  } else {
    emotionContainer.innerHTML = '<div class="small-muted">No emotion distribution available.</div>';
  }
  const emoContainer = document.getElementById('dominantEmotions');
  emoContainer.innerHTML = '';
  let domEmotions = stats?.Dominant_Emotions || [];
  let normalized = [];
  try {
    if (Array.isArray(domEmotions)) {
      if (Array.isArray(domEmotions[0])) {
        normalized = domEmotions.map(([name, value]) => ({ name, value: parseFloat(value) }));
      } else if (typeof domEmotions[0] === 'object' && domEmotions[0] !== null) {
        normalized = domEmotions.flatMap(obj => Object.entries(obj).map(([name, value]) => ({ name, value: parseFloat(value) })));
      }
    } else if (typeof domEmotions === 'object' && domEmotions !== null) {
      normalized = Object.entries(domEmotions).map(([name, value]) => {
        if (Array.isArray(value)) return { name: value[0] || name, value: parseFloat(value[1]) || 0 };
        else return { name, value: parseFloat(value) || 0 };
      });
    }
  } catch (err) { console.warn("Error normalizing emotions:", err); }
  if (!normalized.length) {
    const possibleEmos = ["CALM","HAPPY","CONFUSED","SAD","FEAR","DISGUSTED","ANGRY","SURPRISED"];
    possibleEmos.forEach(e => {
      if (stats[e] && Array.isArray(stats[e])) normalized.push({ name: stats[e][0], value: parseFloat(stats[e][1]) });
    });
  }
  if (normalized.length) {
    normalized.forEach(({ name, value }) => {
      const el = document.createElement('div');
      el.className = 'dominant-badge';
      el.innerHTML = `<div style="font-weight:600;">${name}</div><div style="font-weight:700">${isNaN(value) ? value : value.toFixed(2)}%</div>`;
      emoContainer.appendChild(el);
    });
  } else {
    emoContainer.innerHTML = '<div class="small-muted">No dominant emotions.</div>';
  }
  const vm = videoAnalysis?.Emotional_Analysis?.Video_Metrics || videoAnalysis?.Video_Metrics || videoAnalysis;
  const vmContainer = document.getElementById('videoMetrics');
  vmContainer.innerHTML = '';
  if (vm && Object.keys(vm).length) {
    const metrics = [
      ['Total Frames', vm.Total_Frames || vm.total_frames_analyzed || vm.total_frames || vm.TotalFrames],
      ['Matched Candidate Frames', vm.Matched_Candidate_Frames || vm.MatchedCandidateFrames],
      ['Face Time %', vm.Face_Time_Percentage || vm.Face_Time]
    ];
    vmContainer.innerHTML = `${metrics.map(m=>`<li><strong>${m[0]}:</strong> ${m[1] ?? '-'}</li>`).join('')}`;
  } else {
    vmContainer.innerHTML = '<div class="small-muted">No video metrics available.</div>';
  }
  document.getElementById('videoSentimentScore').innerHTML = `<div style="font-size:28px;font-weight:700">${videoAnalysis?.Sentiment_Score ?? '-'}</div>`;
  document.getElementById('videoBodyLanguage').innerText = videoAnalysis?.Body_Language || videoAnalysis?.Description || 'No body language description available.';
  document.getElementById('videoFacialExpressions').innerText = videoAnalysis?.Facial_Expressions || 'No facial expressions available.';
  document.getElementById('videoEngagement').innerText = videoAnalysis?.Engagement_Level || 'No engagement data available.';
  const t = finalObj?.Interview_Analysis?.Candidate_Analysis?.Interview_Transcript_Analysis || {};
  const kw = t?.Key_Topics_and_Keywords || [];
  const kwContainer = document.getElementById('transcriptKeywords');
  kwContainer.innerHTML = '';
  if (Array.isArray(kw) && kw.length) {
    kwContainer.innerHTML = kw.map(k=>`<span class="badge-keyword">${k}</span>`).join('');
  } else {
    kwContainer.innerHTML = '<div class="small-muted">No keywords available.</div>';
  }
  const sentimentData = t?.Sentiment_Analysis || {};
  const transcriptContainer = document.getElementById('transcriptSentiment');
  if (Object.keys(sentimentData).length) {
    transcriptContainer.innerHTML = `<div><div class="senti-analysis" style="border-bottom:1px solid #c9c6c6;"><strong>Overall Sentiment</strong><span>${sentimentData.Overall_Sentiment || '-'}</span></div><div class="senti-analysis"><strong>Audio Sentiment Score</strong><span>${sentimentData.Audio_Sentiment_Score || '-'}</span></div><div class="senti-analysis"><strong>Confidence</strong><span>${sentimentData.Confidence || '-'}</span></div><div class="senti-analysis"><strong>Enthusiasm</strong><span>${sentimentData.Enthusiasm || '-'}</span></div><div class="senti-analysis"><strong>Hesitation</strong><span>${sentimentData.Hesitation || '-'}</span></div></div>`;
  } else {
    transcriptContainer.innerHTML = '<div class="small-muted">No sentiment data.</div>';
  }
  const langData = t?.Language_Proficiency || {};
  const transcriptLang = document.getElementById('transcriptLang');
  if (Object.keys(langData).length) {
    transcriptLang.innerHTML = `<div><div class="senti-analysis" style="border-bottom:1px solid #c9c6c6;"><strong>Overall Rating</strong><span>${langData.Overall_Rating || '-'}</span></div><div class="senti-analysis"><strong>Fluency</strong><span>${langData.Fluency || '-'}</span></div><div class="senti-analysis"><strong>Vocabulary</strong><span>${langData.Vocabulary || '-'}</span></div><div class="senti-analysis"><strong>Grammar</strong><span>${langData.Grammar || '-'}</span></div><div class="senti-analysis"><strong>Sentence Structure</strong><span>${langData.Sentence_Structure || '-'}</span></div></div>`;
  } else {
    transcriptLang.innerHTML = '<div class="small-muted">No language data.</div>';
  }
  const logicData = t?.Logical_Structure || {};
  const transcriptLogic = document.getElementById('transcriptLogic');
  if (Object.keys(logicData).length) {
    transcriptLogic.innerHTML = `<div><div class="senti-analysis" style="border-bottom:1px solid #c9c6c6;"><strong>Overall Rating</strong><span>${logicData.Overall_Rating || '-'}</span></div><div class="senti-analysis"><strong>Introduction</strong><span>${logicData.Introduction || '-'}</span></div><div class="senti-analysis"><strong>Skill Description</strong><span>${logicData.Skill_Description || '-'}</span></div><div class="senti-analysis"><strong>Experience Explanation</strong><span>${logicData.Experience_Explanation || '-'}</span></div><div class="senti-analysis"><strong>Reasoning</strong><span>${logicData.Reasoning || '-'}</span></div><div class="senti-analysis"><strong>Technical Explanation</strong><span>${logicData.Technical_Explanation || '-'}</span></div></div>`;
  } else {
    transcriptLogic.innerHTML = '<div class="small-muted">No logical structure data.</div>';
  }
  const s = finalObj?.Interview_Analysis?.Candidate_Analysis?.Skills_Analysis || {};
  const jobRel = s?.Job_Relevance || {};
  const skillJobRelevance = document.getElementById('skillJobRelevance');
  if (Object.keys(jobRel).length) {
    skillJobRelevance.innerHTML = `<div><div class="senti-analysis" style="border-bottom:1px solid #c9c6c6;"><strong>Overall Rating</strong><span>${jobRel.Overall_Rating || '-'}</span></div><div class="senti-analysis"><strong>Technical Skills</strong><span>${jobRel.Technical_Skills || '-'}</span></div><div class="senti-analysis"><strong>Soft Skills</strong><span>${jobRel.Soft_Skills || '-'}</span></div><div class="senti-analysis"><strong>Company Knowledge</strong><span>${jobRel.Company_Knowledge || '-'}</span></div><div class="senti-analysis"><strong>Career Goals</strong><span>${jobRel.Career_Goals || '-'}</span></div></div>`;
  } else {
    skillJobRelevance.innerHTML = '<div class="small-muted">No job relevance data.</div>';
  }
  const authData = s?.Authenticity_Assessment || {};
  const skillAuthenticity = document.getElementById('skillAuthenticity');
  if (Object.keys(authData).length) {
    skillAuthenticity.innerHTML = `<div><div class="senti-analysis" style="border-bottom:1px solid #c9c6c6;"><strong>Deception Risk</strong><span>${authData.Deception_Risk || '-'}</span></div><div class="senti-analysis"><strong>Overstatement Of Skills</strong><span>${authData.Overstatement_Of_Skills || '-'}</span></div><div class="senti-analysis"><strong>Vagueness</strong><span>${authData.Vagueness || '-'}</span></div><div class="senti-analysis"><strong>Contradictions</strong><span>${authData.Contradictions || '-'}</span></div></div>`;
  } else {
    skillAuthenticity.innerHTML = '<div class="small-muted">No authenticity data.</div>';
  }
  const techData = s?.Technical_Skills_Assessment || {};
  const skillTechnical = document.getElementById('skillTechnical');
  if (Object.keys(techData).length) {
    let progLangs = Array.isArray(techData.Programming_Languages) ? techData.Programming_Languages.map(l => `<span class="badge-keyword" style="margin-bottom: 5px;">${l}</span>`).join(' ') : '-';
    let techConcepts = Array.isArray(techData.Technologies_and_Concepts) ? techData.Technologies_and_Concepts.map(t => `<span class="badge-keyword" style="margin-bottom: 5px;">${t}</span>`).join(' ') : '-';
    skillTechnical.innerHTML = `<div><div style="border-bottom:1px solid #c9c6c6;padding:5px 0px 10px 0px;"><strong>Programming Languages : </strong><span>${progLangs}</span></div><div style="flex-direction: column; align-items: flex-start;margin-top: 10px;"><strong style="margin-bottom: 6px;">Technologies and Concepts : </strong><span>${techConcepts}</span></div></div>`;
  } else {
    skillTechnical.innerHTML = '<div class="small-muted">No technical skill data.</div>';
  }
  const r = finalObj?.Interview_Analysis?.Candidate_Analysis?.Recommendations || {};
  document.getElementById('recDescription').innerText = r?.Hiring_Recommendation?.description || 'No hiring recommendation description.';
  document.getElementById('recStrengths').innerHTML = (r?.Strengths && r.Strengths.length) ? `${r.Strengths.map(x=>`<li>${x}</li>`).join('')}` : '<div class="small-muted">No strengths listed.</div>';
  document.getElementById('recConcerns').innerHTML = (r?.Concerns && r.Concerns.length) ? `${r.Concerns.map(x=>`<li>${x}</li>`).join('')}` : '<div class="small-muted">No concerns listed.</div>';
  document.getElementById('recNextSteps').innerHTML = (r?.Next_Steps && r.Next_Steps.length) ? `${r.Next_Steps.map(x=>`<li>${x}</li>`).join('')}` : '<div class="small-muted">No next steps listed.</div>';
  document.getElementById('recImprovements').innerText = (r?.Interview_Improvement_Suggestions) ? r.Interview_Improvement_Suggestions.join('\n') : 'No suggestions.';
  document.getElementById('recDevPlan').innerText = (r?.Candidate_Development_Plan) ? r.Candidate_Development_Plan.join('\n') : 'No development plan.';
  document.getElementById('recConsiderText').innerText = r?.Hiring_Recommendation?.Consider ? (r.Hiring_Recommendation.Consider + '/100') : '-';
  const recConsiderValue = Number(r?.Hiring_Recommendation?.Consider || 0);
  document.getElementById('recScoreBar').innerHTML = barHtml('Hiring Score', recConsiderValue, 'success');
  modal.show();
}

function showInitialAnalysisModal(found) {
  let modalEl = document.getElementById('initialAnalysisModal');
  const modal = new bootstrap.Modal(modalEl);
  const container = document.getElementById('initialAnalysisContainer');
  container.style.display = 'block';
  const parseSafe = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); }
    catch (e) { console.warn('JSON parse failed', e); return null; }
  };
  const initObj = parseSafe(found.initialScreeningData || found.fields?.initialScreeningData);
  document.getElementById('iniCandidateName').innerText = found.candidateName || found.fields?.candidateName || '-';
  document.getElementById('iniJobTitle').innerText = found.jobTitle || found.fields?.jobTitle || '-';
  document.getElementById('iniOverallScore').innerText = '--';
  const tabsEl = document.getElementById('iniAnalysisTabs');
  const tabContentEl = document.getElementById('iniAnalysisTabContent');
  tabsEl.innerHTML = '';
  tabContentEl.innerHTML = '';
  if (!initObj || Object.keys(initObj).length === 0) {
    tabContentEl.innerHTML = '<div class="text-muted text-center initial-container">No analysis data available.</div>';
    modal.show();
    return;
  }
  const barHtml = (label, value, color = 'primary') => {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    const barWidth = v > 0 && v < 0.1 ? 0.1 : v;
    return `<div style="display:flex;justify-content:space-between;align-items:center;"><span>${label}</span><span>${v.toFixed(1)}%</span></div><div class="progress" style="height:10px;background:#ebeef6;"><div class="progress-bar bg-${color}" role="progressbar" style="width:${barWidth}%;"></div></div>`;
  };
  const colorMap = { CALM:'info', HAPPY:'success', CONFUSED:'warning', SURPRISED:'warning', ANGRY:'danger', FEAR:'secondary', SAD:'primary', DISGUSTED:'danger', NEUTRAL:'secondary' };
  const sentimentColorMap = { POSITIVE:'success', NEGATIVE:'danger', NEUTRAL:'primary', MIXED:'secondary' };
  let idx = 0;
  Object.entries(initObj).forEach(([fileName, details]) => {
    const iVideo = details.video_analysis || {};
    const iAudio = details.audio_analysis || {};
    const question = details.question || 'Question not available';
    const activeClass = idx === 0 ? 'active' : '';
    const showClass = idx === 0 ? 'show active' : '';
    let emotionBars = '';
    if (iVideo.aggregated_emotions && Object.keys(iVideo.aggregated_emotions).length) {
      emotionBars = Object.entries(iVideo.aggregated_emotions).map(([emo, val]) => barHtml(emo, val, colorMap[emo.toUpperCase()] || 'secondary')).join('');
    } else {
      emotionBars = `<div class="text-muted small">No emotion data available.</div>`;
    }
    let sentimentBars = '';
    if (iAudio.sentiment_score && Object.keys(iAudio.sentiment_score).length) {
      sentimentBars = Object.entries(iAudio.sentiment_score).map(([emo, val]) => barHtml(emo, val, sentimentColorMap[emo.toUpperCase()] || 'secondary')).join('');
    } else {
      sentimentBars = `<div class="text-muted small">No sentiment data available.</div>`;
    }
    tabsEl.innerHTML += `<li class="nav-item" role="presentation"><button class="nav-link ${activeClass}" id="tab-${idx}" data-bs-toggle="tab" data-bs-target="#pane-${idx}" type="button">Question-${idx + 1}</button></li>`;
    tabContentEl.innerHTML += `<div class="tab-pane fade ${showClass}" id="pane-${idx}" style="font-weight:400;font-size:14px;"><div class="initial-container"><div><span class="modal-section-title">Question :  </span><span style="font-weight: 500;">${question}</span></div><hr style="margin: 8px 0;"><div class="row mb-3"><div class="col-md-6"><h6 class="mb-2 modal-subSection-title">🎥 Video Analysis</h6><div>Aggregated Video Score:<strong> ${iVideo.aggregated_video_score ?? '-'}</strong> | Total Frames Analyzed:<strong> ${iVideo.total_frames_analyzed ?? '-'}</strong></div><hr style="margin: 5px 0"><h6 class="mb-2 modal-section-title">Aggregated Emotions</h6><div>${emotionBars}</div></div><div class="col-md-6"><h6 class="mb-2 modal-subSection-title">🎧 Audio Analysis</h6><div>Sentiment:<strong> ${iAudio.sentiment ?? '-'}</strong> | Audio Score:<strong> ${iAudio.aggregated_audio_score ?? '-'}</strong></div><hr style="margin: 5px 0"><h6 class="mb-2 modal-section-title">Sentiment Scores</h6><div>${sentimentBars}</div></div></div><div class="row"><div class="col-md-12"><h6 class="mb-2 modal-section-title">Transcription</h6><div class="border rounded p-2 bg-light" style="max-height:100px; overflow-y:auto; text-align:left;">${iAudio.transcription ?? '-'}</div></div></div></div></div>`;
    idx++;
  });
  modal.show();
}

function openBotAnalysisModal(interview_id) {
  const modal = new bootstrap.Modal(document.getElementById("botAnalysisModal"));
  modal.show();
  document.getElementById("botLoader").style.display = "block";
  document.getElementById("botAnalysisContainer").style.display = "none";
  const interviewRecord = allInterviews.find(rec => rec.id === interview_id);
  const botFeedback = interviewRecord?.fields?.interview_bot_feedback;
  if (!botFeedback) {
    document.getElementById("botLoader").innerHTML = `<p class="text-danger">No Bot feedback available.</p>`;
    return;
  }
  const data = typeof botFeedback === "string" ? JSON.parse(botFeedback) : botFeedback;
  document.getElementById("botCandidateName").innerText = interviewRecord.fields.candidateName ?? "";
  document.getElementById("botJobTitle").innerText = interviewRecord.fields.jobTitle ?? "";
  document.getElementById("botOverallRating").innerText = data.overall_recommendation?.rating ?? "--";
  const commSkills = data.communication_skills;
  document.getElementById("botCommunication").innerHTML = `
    <div><strong>Clarity : </strong>${commSkills.clarity}</div>
    <div><strong>Articulation : </strong>${commSkills.articulation}</div>
    <div><strong>Professionalism : </strong>${commSkills.professionalism}</div>
    <div>${commSkills.notes ? `<strong>Note : </strong><span style="color: #666;">${commSkills.notes}</span>` : ''}</div>
  `;
  const techComp = data.technical_competence;
  document.getElementById("botTechnical").innerHTML = `
    <div><strong>Rating:</strong> ${techComp.rating}</div>
    <div>${techComp.notes ? `<strong>Note : </strong><span style="color: #666;">${techComp.notes}</span>` : ''}</div>
  `;
  document.getElementById("botQuickInfo").innerHTML = `<div><strong>Overall Tone:</strong> ${data.sentiment_analysis.overall_tone}  |  <strong>Confidence:</strong> ${data.sentiment_analysis.confidence_level}  |  <strong>Enthusiasm:</strong> ${data.sentiment_analysis.enthusiasm}</div>`;
  document.getElementById("botSentiment").innerHTML = `
    <div><strong>Overall Tone:</strong> ${data.sentiment_analysis.overall_tone}</div>
    <div><strong>Confidence Level:</strong> ${data.sentiment_analysis.confidence_level}</div>
    <div><strong>Enthusiasm:</strong> ${data.sentiment_analysis.enthusiasm}</div>
  `;
  document.getElementById("botCommunicationDetails").innerHTML = `
    <div><strong>Clarity:</strong> ${commSkills.clarity}</div>
    <div><strong>Articulation:</strong> ${commSkills.articulation}</div>
    <div><strong>Professionalism:</strong> ${commSkills.professionalism}</div>
    <div><strong>Notes:</strong> ${commSkills.notes || 'N/A'}</div>`;
  document.getElementById("botTechnicalDetails").innerHTML = `<div><strong>Rating:</strong> ${techComp.rating}</div><div><strong>Notes:</strong> ${techComp.notes || 'N/A'}</div>`;
  document.getElementById("botStrengthList").innerHTML = data.strengths.map(s => `<li>${s}</li>`).join("");
  document.getElementById("botImproveList").innerHTML = data.areas_for_improvement.map(s => `<li>${s}</li>`).join("");
  document.getElementById("botRecommendation").innerHTML = `<div><strong>Rating:</strong> ${data.overall_recommendation.rating}/10</div><div><strong>Decision:</strong> <span style="color: #1c7c2d;font-weight: 600;">${data.overall_recommendation.decision}</span></div><div><strong>Reasoning:</strong> ${data.overall_recommendation.reasoning}</div>`;
  document.getElementById("botLoader").style.display = "none";
  document.getElementById("botAnalysisContainer").style.display = "block";
}

function resetFiltersFromFloating() {
  activeFilters = { status: [] };
  selectedMainStatus = 'All'; selectedSubStatus = 'All';
  const si = document.getElementById('searchInput'); if (si) si.value = '';
  filteredCandidateApplications = allCandidateApplications.slice();
  if (mainStatuses.length > 0) { renderStatusTabs(); }
  applyFilters();
}

function updateFloatingResetBtn() {
  const btn = document.getElementById('floatingResetBtn');
  if (!btn) return;
  const resetBtn = document.getElementById('resetFiltersBtn');
  if (!resetBtn) { btn.style.display = 'flex'; return; }
  const rect = resetBtn.getBoundingClientRect();
  btn.style.display = (rect.bottom < 0 || rect.top > window.innerHeight) ? 'flex' : 'none';
}


function parseCareerData(experienceData) {
  if (!experienceData) return [];
  try {
    return typeof experienceData === 'string' ? JSON.parse(experienceData) : Array.isArray(experienceData) ? experienceData : [];
  } catch (e) {
    console.error('Error parsing career data:', e);
    return [];
  }
}

function showCareerArcModal(candidateId, candidateName) {
  const candidate = candidatesMap[candidateId];
  if (!candidate) { openModal('❌ Candidate not found.'); return; }
  const jobs = parseCareerData(candidate.fields['Experience Details']);
  if (!jobs.length) { openModal('❌ No career data available for this candidate.'); return; }
  const nameEl = document.getElementById('careerArcCandidateName');
  if (nameEl) nameEl.textContent = `${candidateName} • ${jobs.length} positions`;
  renderCareerJobsList(jobs);
  window.currentCareerJobs = jobs;
  window.selectedCareerJobIndex = 0;
  new window.bootstrap.Modal(document.getElementById('careerArcModal')).show();
  setTimeout(() => renderCareerArcCanvas(jobs), 300);
}

function renderCareerJobsList(jobs) {
  const jobsList = document.getElementById('careerJobsList');
  if (!jobsList) return;
  jobsList.innerHTML = '';
  jobs.forEach((job, index) => {
    const jobItem = document.createElement('div');
    jobItem.className = 'career-job-item' + (index === 0 ? ' active' : '');
    jobItem.setAttribute('data-job-index', index);
    jobItem.innerHTML = `<span class="career-job-title">${job.jobTitle || 'Position'}</span><span class="career-job-company">${job.company || 'Company'}</span><span class="career-job-duration">${job.duration || 'N/A'}</span>`;
    jobItem.addEventListener('click', () => {
      document.querySelectorAll('.career-job-item').forEach(item => item.classList.remove('active'));
      jobItem.classList.add('active');
      window.selectedCareerJobIndex = index;
      updateCareerTimelineDetails(jobs[index]);
      renderCareerArcCanvas(jobs);
    });
    jobsList.appendChild(jobItem);
  });
  updateCareerTimelineDetails(jobs[0]);
}

function updateCareerTimelineDetails(job) {
  const detailsDiv = document.getElementById('careerTimelineDetails');
  if (!detailsDiv || !job) return;
  let html = `<h6>${job.jobTitle || 'Position'}</h6>`;
  const infoParts = [];
  if (job.company) infoParts.push(job.company);
  if (job.duration) infoParts.push(job.duration);
  if (job.location) infoParts.push(job.location);
  if (infoParts.length > 0) html += `<span style="font-size:13px;color:#555;margin-top:0px !important;">${infoParts.join(' | ')}</span>`;
  if (job.responsibilities && job.responsibilities.length > 0) {
    html += `<p><strong>Responsibilities:</strong></p>`;
    job.responsibilities.forEach(resp => { html += `<li>${resp}</li>`; });
  }
  detailsDiv.innerHTML = html;
  detailsDiv.classList.add('show');
}

function renderCareerArcCanvas(jobs) {
  const canvas = document.getElementById('careerTimelineCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  const displayWidth = canvas.clientWidth || 600;
  const displayHeight = canvas.clientHeight || 400;
  if (canvas.width !== displayWidth * DPR || canvas.height !== displayHeight * DPR) {
    canvas.width = displayWidth * DPR;
    canvas.height = displayHeight * DPR;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(DPR, DPR);
  const pad = 70, startX = pad, startY = displayHeight - pad, endX = displayWidth - pad, endY = pad;
  const ctrlX = displayWidth / 2, ctrlY = pad + 30;
  // Background arc
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(100,200,255,0.15)';
  ctx.beginPath(); ctx.moveTo(startX, startY); ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY); ctx.stroke();
  // Gradient arc
  const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
  gradient.addColorStop(0, '#9C27B0'); gradient.addColorStop(0.25, '#2196F3');
  gradient.addColorStop(0.5, '#00BCD4'); gradient.addColorStop(0.75, '#4CAF50'); gradient.addColorStop(1, '#FF9800');
  ctx.strokeStyle = gradient; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(startX, startY); ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY); ctx.stroke();
  // Year-based node positioning
  const years = jobs.map(j => { const d = (j.duration || '').match(/\d{4}/g); return { start: d ? parseInt(d[0]) : 2020, end: d && d[1] ? parseInt(d[1]) : 2025 }; });
  const minYear = Math.min(...years.map(y => y.start));
  const maxYear = Math.max(...years.map(y => y.end));
  const span = Math.max(1, maxYear - minYear);
  const nodeColors = ['#DCB209','#4ECDC4','#45B7D1','#FFA07A','#98D8C8','#6C5CE7','#A29BFE','#74B9FF','#81ECEC','#FFD93D','#6BCB77','#FF6B9D','#C44569','#F8B500','#2C3E50'];
  const darkenColor = (color) => { const num = parseInt(color.replace('#',''), 16), amt = 40; const R = (num >> 16) & 0xff, G = (num >> 8) & 0xff, B = num & 0xff; return '#' + (0x1000000 + (Math.max(0, R - amt) * 0x10000) + (Math.max(0, G - amt) * 0x100) + Math.max(0, B - amt)).toString(16).slice(1); };
  const nodePositions = [];
  jobs.forEach((job, idx) => {
    const year = years[idx];
    const mid = (year.start + year.end) / 2;
    const t = (mid - minYear) / span;
    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * endY;
    nodePositions.push({ x, y });
    const nodeColor = nodeColors[idx % nodeColors.length];
    const darkNodeColor = darkenColor(nodeColor);
    const isSelected = idx === window.selectedCareerJobIndex;
    // Shadow
    ctx.beginPath(); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.arc(x + 3, y + 3, 13, 0, Math.PI * 2); ctx.fill();
    // Node
    ctx.beginPath(); ctx.fillStyle = isSelected ? '#FF6F21' : nodeColor; ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    // White border
    ctx.beginPath(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
    // Inner white circle
    ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    // Labels — alternate above/below
    const isAboveArc = idx % 2 === 0;
    let labelOffsetY = isAboveArc ? -50 : 50;
    if (y + labelOffsetY - 25 < 10) labelOffsetY = 50;
    if (y + labelOffsetY + 40 > displayHeight - 10) labelOffsetY = -50;
    const labelBaseY = y + labelOffsetY;
    ctx.font = 'bold 12px Arial'; ctx.fillStyle = isSelected ? '#FF6F21' : darkNodeColor; ctx.textAlign = 'center';
    ctx.fillText(job.jobTitle || 'Job', x, labelBaseY - 4);
    ctx.font = '10px Arial'; ctx.fillStyle = '#444444'; ctx.textAlign = 'center';
    ctx.fillText(job.company || 'Company', x, labelBaseY + 12);
    ctx.font = '9px Arial'; ctx.fillStyle = '#666666'; ctx.textAlign = 'center';
    ctx.fillText(year.start + ' - ' + year.end, x, labelBaseY + 26);
  });
  canvas._careerPts = nodePositions;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function handleCanvasClick(event) {
  const canvas = document.getElementById('careerTimelineCanvas');
  if (!canvas || !canvas._careerPts) return;
  const rect = canvas.getBoundingClientRect();
  const DPR = window.devicePixelRatio || 1;
  const clickX = (event.clientX - rect.left) * (canvas.width / rect.width) / DPR;
  const clickY = (event.clientY - rect.top) * (canvas.height / rect.height) / DPR;
  const jobs = window.currentCareerJobs;
  if (!jobs) return;
  canvas._careerPts.forEach((pt, idx) => {
    const distance = Math.sqrt(Math.pow(clickX - pt.x, 2) + Math.pow(clickY - pt.y, 2));
    if (distance < 15) {
      window.selectedCareerJobIndex = idx;
      document.querySelectorAll('.career-job-item').forEach((item, i) => item.classList.toggle('active', i === idx));
      updateCareerTimelineDetails(jobs[idx]);
      renderCareerArcCanvas(jobs);
    }
  });
}

onMounted(async () => {
  loggedInUserEmail = (window.logged_in_user && window.logged_in_user.softr_user_email) || 'rbanothe@tiuconsulting.com';
  loggedInUserName = (window.logged_in_user && window.logged_in_user.softr_user_full_name) || 'Raj Banothe';

  const applicationsPromise = fetchCandidateApplications();
  const statusesPromise = fetchAllStatuses();
  const interviewPromise = fetchAllInterviewsData();

  selectedStatuses = JSON.parse(localStorage.getItem('selectedStatuses') || 'null') || [];
  selectedType = localStorage.getItem('selectedType') || '';

  allApplications = await applicationsPromise;
  allCandidateApplications = allApplications;
  filteredCandidateApplications = allApplications.slice();
  await statusesPromise;
  allInterviews = await interviewPromise;
  await fetchAllCandidates();

  if (mainStatuses.length > 0) {
    selectedMainStatus = (selectedType && selectedStatuses.length > 0) ? selectedStatuses[0] : 'All';
    renderStatusTabs();
    filterAndDisplayData();
  } else {
    if (currentView === 'list') renderCandidates(allCandidateApplications);
    else renderKanbanBoard(allCandidateApplications);
  }

  const loader = document.getElementById('loader');
  if (loader) setTimeout(() => { loader.style.display = 'none'; }, 100);
  localStorage.removeItem('selectedStatuses');
  localStorage.removeItem('selectedType');

  // Expose functions for inline onclick handlers in dynamic HTML
  window.__setDraggedCandidate = (data) => { draggedCandidate = data; };
  window.__goPage = (page) => { currentPage = page; renderCandidates(filteredCandidateApplications); };
  window.stopAutoScroll = stopAutoScroll;
  window.startAutoScroll = startAutoScroll;
  window.handleCardDrop = handleCardDrop;
  window.showKanbanCardModal = showKanbanCardModal;
  window.selectMainStatus = selectMainStatus;
  window.selectSubStatus = selectSubStatus;
  window.switchView = switchView;
  window.updateFloatingToggle = updateFloatingToggle;
  window.changeApplicationStatus = changeApplicationStatus;
  window.openSendEmailModal = openSendEmailModal;
  window.showInterviewModal = showInterviewModal;
  window.openFeedbackCommunicationModal = openFeedbackCommunicationModal;
  window.checkScreeningData = checkScreeningData;
  window.showCareerArcModal = showCareerArcModal;
  window.openBotAnalysisModal = openBotAnalysisModal;
  window.openShareModal = openShareModal;
  window.deSelectCandidate = deSelectCandidate;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.closeConfirmModal = closeConfirmModal;
  window.closeChangeStatusModal = closeChangeStatusModal;
  window.closeFeedbackCommunicationModal = closeFeedbackCommunicationModal;
  window.checkRefImageAndProcessVideo = checkRefImageAndProcessVideo;
  window.viewShareClientDetailsModal = viewShareClientDetailsModal;
  window.processVideo = processVideo;
  window.resetFiltersFromFloating = resetFiltersFromFloating;
  window.handleFeedbackInputKeypress = handleFeedbackInputKeypress;
  window.updateFeedbackSendButtonState = updateFeedbackSendButtonState;
  window.sendFeedbackMessageFromModal = sendFeedbackMessageFromModal;


  // Event listeners
  document.getElementById('searchInput')?.addEventListener('input', applyFilters);
  document.getElementById('refreshData')?.addEventListener('click', refreshData);
  document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
    activeFilters = { status: [] }; selectedMainStatus = 'All'; selectedSubStatus = 'All';
    const si = document.getElementById('searchInput'); if (si) si.value = '';
    filteredCandidateApplications = allCandidateApplications.slice();
    renderStatusTabs(); applyFilters();
  });

  document.getElementById('proceedWithEmailTypeBtn')?.addEventListener('click', () => {
    const selectedType = document.querySelector('input[name="mailType"]:checked')?.value;
    const jobTitle = document.getElementById('modalEmailTypeJobTitle').value;
    const candidateEmail = document.getElementById('modalEmailTypeCandidateEmail').value;
    const candidateStatus = document.getElementById('modalEmailTypeCandidateStatus').value;
    const applicationId = document.getElementById('modalEmailTypeApplicationId').value;
    const interviewId = document.getElementById('modalEmailTypeInterviewId').value;
    const candidateName = document.getElementById('modalEmailTypeCandidateName').value || 'NA';
    // Close the email type selection modal first
    const emailTypeModal = window.bootstrap.Modal.getInstance(document.getElementById('emailTypeSelectionModal'));
    if (emailTypeModal) emailTypeModal.hide();
    if (selectedType === 'status') {
      openStatusEmailModal(jobTitle, candidateEmail, candidateStatus, applicationId, candidateName);
    } else if (selectedType === 'initial_screening') {
      openInitialScreeningEmailModal(jobTitle, candidateEmail, candidateStatus, applicationId, interviewId, candidateName);
    } else if (selectedType === 'interview_bot') {
      openInterviewBotEmailModal(jobTitle, candidateEmail, candidateStatus, applicationId, interviewId, candidateName);
    }
  });

  document.getElementById('emailTypeSelectionModal')?.addEventListener('hide.bs.modal', resetEmailTypeSelection);

  document.getElementById('sendEmailForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const get = (id) => document.getElementById(id)?.value || '';
    const getTxt = (id) => document.getElementById(id)?.textContent || '';
    const appId = get('emailApplicationId'), candName = get('emailCandidateName');
    const to = get('emailTo'), cc = get('emailCc'), bcc = get('emailBcc');
    const subject = get('emailSubject'), message = document.getElementById('emailMessage')?.value || '';
    const status = get('emailStatus'), jobTitle = getTxt('emailJobTitle');
    window.bootstrap.Modal.getInstance(document.getElementById('sendEmailModal'))?.hide();
    openModal('<div class="text-center"><div class="spinner-border text-primary"></div><div class="mt-2">Sending email...</div></div>');
    try {
      const resp = await fetch('https://surecafe.app.n8n.cloud/webhook/c79a7ebb-1c69-4aa8-9198-e58f0e6ec475', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, candName, to, cc, bcc, subject, message, status, jobTitle, senderEmail: loggedInUserEmail, senderName: loggedInUserName })
      });
      closeModal();
      openModal(resp.ok ? '<div class="text-success"><i class="bi bi-check-circle"></i> Email sent successfully!</div>' : '<div class="text-danger">Failed to send email.</div>');
      setTimeout(closeModal, 2500);
    } catch (err) { closeModal(); openModal(`<div class="text-danger">Error: ${err.message}</div>`); setTimeout(closeModal, 2500); }
  });

  document.getElementById('initialScreeningEmailForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const get = (id) => document.getElementById(id)?.value || '';
    const getTxt = (id) => document.getElementById(id)?.textContent || '';
    const appId = get('initialScreeningApplicationId'), ivId = get('initialScreeningInterviewId'), candName = get('initialScreeningCandidateName');
    const to = get('initialScreeningTo'), cc = get('initialScreeningCc'), bcc = get('initialScreeningBcc');
    const subject = get('initialScreeningSubject'), message = get('initialScreeningMessage1'), jobTitle = getTxt('initialScreeningJobTitle');
    window.bootstrap.Modal.getInstance(document.getElementById('initialScreeningEmailModal'))?.hide();
    openModal('<div class="text-center"><div class="spinner-border text-primary"></div><div class="mt-2">Sending email...</div></div>');
    try {
      const resp = await fetch('https://surecafe.app.n8n.cloud/webhook/45d1f5da-84a2-4f3f-a5a9-a08bedee73c9', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, ivId, candName, to, cc, bcc, subject, message, jobTitle, senderEmail: loggedInUserEmail, senderName: loggedInUserName })
      });
      closeModal();
      openModal(resp.ok ? '<div class="text-success"><i class="bi bi-check-circle"></i> Email sent successfully!</div>' : '<div class="text-danger">Failed to send email.</div>');
      setTimeout(closeModal, 2500);
    } catch (err) { closeModal(); openModal(`<div class="text-danger">Error: ${err.message}</div>`); setTimeout(closeModal, 2500); }
  });

  document.getElementById('interviewBotEmailForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const get = (id) => document.getElementById(id)?.value || '';
    const getTxt = (id) => document.getElementById(id)?.textContent || '';
    const appId = get('interviewBotApplicationId'), ivId = get('interviewBotInterviewId'), candName = get('interviewBotCandidateName');
    const to = get('interviewBotTo'), cc = get('interviewBotCc'), bcc = get('interviewBotBcc');
    const subject = get('interviewBotSubject'), message = get('interviewBotMessage1'), jobTitle = getTxt('interviewBotJobTitle');
    window.bootstrap.Modal.getInstance(document.getElementById('interviewBotEmailModal'))?.hide();
    openModal('<div class="text-center"><div class="spinner-border text-primary"></div><div class="mt-2">Sending email...</div></div>');
    try {
      const resp = await fetch('https://surecafe.app.n8n.cloud/webhook/1df4e0b6-2f25-4465-963c-2adc0a76ffd6', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, ivId, candName, to, cc, bcc, subject, message, jobTitle, senderEmail: loggedInUserEmail, senderName: loggedInUserName })
      });
      closeModal();
      openModal(resp.ok ? '<div class="text-success"><i class="bi bi-check-circle"></i> Email sent successfully!</div>' : '<div class="text-danger">Failed to send email.</div>');
      setTimeout(closeModal, 2500);
    } catch (err) { closeModal(); openModal(`<div class="text-danger">Error: ${err.message}</div>`); setTimeout(closeModal, 2500); }
  });

  document.getElementById('interviewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const get = (id) => document.getElementById(id)?.value || '';
    const getTxt = (id) => document.getElementById(id)?.textContent || '';
    const jobTitle = getTxt('interviewJobTitle');
    const candidateEmail = get('candidateEmail').trim();
    const interviewerEmail = get('interviewerEmail').trim();
    const date = get('interviewDate');
    const startHour = get('startHour'), startMinute = get('startMinute');
    const endHour = get('endHour'), endMinute = get('endMinute');
    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;
    const timeZone = get('timeZone');
    const status = get('interviewStatus');
    const candidate_id = get('interviewCandidateId');
    const job_id = get('interviewJobId');
    const application_id = Number(get('applicationId'));
    const candidateName = get('candidateName') || "Candidate";
    const description = get('interviewDescription') || jobTitle;
    const attendeesEmail = get('attendeesEmail') || null;
    const interviewType = get('interviewTypeInput') || "Final Interview";
    if ((startHour === "00" && startMinute === "00") || (endHour === "00" && endMinute === "00")) {
      openModal("⚠️ Please select valid start and end times");
      return;
    }
    openModal("<div class='spinner-border processSpin' role='status'><span class='sr-only'></span> </div> Scheduling interview... Please wait.");
    try {
      const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.interviewTable)}`;
      const l1L2Statuses = ["L1-Scheduling Required","L1-Scheduled","L1-Reschedule","L2-Scheduling Required","L2-Scheduled","L2-Reschedule"];
      const isL1L2Status = l1L2Statuses.includes(status);
      let interviewId = null;
      let isNewRecord = true;
      if (!isL1L2Status && interviewType === "Final Interview") {
        const existingFinal = allInterviews.find(rec =>
          rec.fields &&
          rec.fields.candidate_id === candidate_id &&
          rec.fields.job_id === job_id &&
          rec.fields.application_id === application_id &&
          rec.fields.interviewType === 'Final Interview'
        );
        if (existingFinal) {
          const hasDate = existingFinal.fields.date && String(existingFinal.fields.date).trim() !== "";
          const hasLink = existingFinal.fields.interview_link && String(existingFinal.fields.interview_link).trim() !== "";
          if (!hasDate && !hasLink) {
            interviewId = existingFinal.id; isNewRecord = false;
          } else if (hasDate && hasLink) {
            isNewRecord = true;
          } else {
            interviewId = existingFinal.id; isNewRecord = false;
          }
        }
      } else if (!isL1L2Status && (interviewType === "Rescheduled Interview" || interviewType === "Next Round Interview")) {
        isNewRecord = true;
      }
      const timeToSec = (t) => { const [h, m] = t.split(":").map(Number); return h * 3600 + m * 60; };
      const interviewData = {
        candidate_id, job_id, jobTitle, application_id, candidateEmail, candidateName,
        date, startTime: timeToSec(startTime), endTime: timeToSec(endTime),
        timeZone, status, Description: description, interviewType
      };
      let response;
      if (isNewRecord) {
        response = await fetch(airtableUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ fields: interviewData }),
        });
      } else {
        response = await fetch(`${airtableUrl}/${interviewId}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ fields: interviewData }),
        });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(`Failed to ${isNewRecord ? 'create' : 'update'} interview: ${response.status}`);
      interviewId = data.id;
      const subject = `${jobTitle}-${interviewId}`;
      const reference_url = `https://surecafe.ai/project_surecafe_ai/index.html?interview_id=${interviewId}&name=${encodeURIComponent(candidateName)}&job_title=${encodeURIComponent(jobTitle)}`;
      const payload = { interviewId, jobTitle, candidate_id, candidateName, job_id, candidateEmail, interviewerEmail, attendeesEmail, date, startTime, endTime, timeZone, status, subject, description, reference_url, application_id };
      await fetch('https://surecafe.app.n8n.cloud/webhook/84f4bc81-ae11-46a3-962b-04b3cd628f02', {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      openModal("✅ Interview scheduled successfully!");
      bootstrap.Modal.getInstance(document.getElementById("interviewModal")).hide();
      try {
        let msg = `Interview scheduled on: ${date}\nTime: ${startTime} to ${endTime}\nTimezone: ${timeZone}`;
        if (description && description.trim()) msg += `\nNote: ${description}`;
        await saveFeedbackRecord(candidate_id, candidateName, candidateEmail, msg, 'interview_scheduled', application_id);
      } catch (err) { console.error('Error saving interview feedback:', err); }
      allInterviews = await fetchAllInterviewsData();
      filterAndDisplayData();
    } catch (error) {
      console.error("Error scheduling interview:", error);
      openModal("❌ Failed to schedule interview.");
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.initial-analysis-btn');
    if (btn) {
      const interviewId = btn.dataset.interviewId;
      const interviewTitle = btn.dataset.title;
      const initVideoData = btn.dataset.initVideoData;
      if (interviewId && initVideoData) {
        processVideo(interviewId, interviewTitle, 1, initVideoData);
      }
    }
  });

  document.getElementById('shareSubmitBtn')?.addEventListener('click', () => {
    const toEmail = document.getElementById('toEmail')?.value?.trim() || '';
    const ccEmail = document.getElementById('ccEmail')?.value?.trim() || '';
    const selectedIds = Array.from(document.querySelectorAll('.candidate-checkbox:checked')).map(cb => cb.value);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!toEmail) { openModal('❌ Please enter a client email.'); return; }
    if (!emailRegex.test(toEmail)) { openModal('❌ Please enter a valid client email.'); return; }
    if (ccEmail && !emailRegex.test(ccEmail)) { openModal('❌ Please enter a valid CC email.'); return; }
    if (selectedIds.length === 0) { openModal('❌ Please select at least one candidate.'); return; }
    const payData = {
      jobTitle: currentJobData?.jobTitle,
      jobId: currentJobData?.jobId,
      candidateIds: selectedIds,
      toEmail,
      ccEmail
    };
    shareCandidateDetails(payData);
  });

  document.getElementById('shareClientSelect')?.addEventListener('change', (e) => {
    const clientId = e.target.value;
    const client = clientsMap[clientId] || {};
    const nameInput = document.getElementById('shareClientName'); if (nameInput) nameInput.value = client.Name || '';
    const emailInput = document.getElementById('toEmail'); if (emailInput) emailInput.value = client.Email || '';
    const viewLink = document.getElementById('viewShareClientDetailsLink');
    if (viewLink) { viewLink.style.display = clientId ? 'inline' : 'none'; viewLink.onclick = () => viewShareClientDetailsModal(clientId); }
  });

  document.getElementById('feedbackMessageInput')?.addEventListener('input', updateFeedbackSendButtonState);
  document.getElementById('feedbackMessageInput')?.addEventListener('keypress', handleFeedbackInputKeypress);
  document.getElementById('feedbackSendBtn')?.addEventListener('click', sendFeedbackMessageFromModal);
  document.getElementById('careerTimelineCanvas')?.addEventListener('click', handleCanvasClick);

  window.addEventListener('scroll', onScrollForFloatingToggle);
  window.addEventListener('resize', checkAndUpdateFloatingToggleVisibility);
  window.addEventListener('scroll', updateFloatingResetBtn, { passive: true });
  window.addEventListener('resize', updateFloatingResetBtn, { passive: true });

  checkAndUpdateFloatingToggleVisibility();
  updateFloatingResetBtn();
  updateFloatingToggle();

  await fetchAllClients();
  await fetchAllJobs();
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollForFloatingToggle);
  window.removeEventListener('resize', checkAndUpdateFloatingToggleVisibility);
  window.removeEventListener('scroll', updateFloatingResetBtn);
  window.removeEventListener('resize', updateFloatingResetBtn);
  stopAutoScroll();
});
</script>

<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;background-color:#FAFBFC;min-height:auto;}
.container{max-width:1400px;margin:0 auto;min-height:auto;}
.dashboard-header{text-align:left;margin-bottom:20px;}
.section-title{color:#FF6F21;font-size:22px;font-weight:700;margin-bottom:4px;letter-spacing:-0.02em;}
.section-subtitle{font-size:16px;color:#6B7280;margin:0;}
.section-card{background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #E5E7EB;margin-bottom:24px;transition:all 0.3s ease;padding:10px;overflow:hidden;}
.section-card:hover{box-shadow:var(--shadow-lg);transform:translateY(-2px);}
@media(max-width:768px){.container{padding:16px;}.section-title{font-size:24px;}}
.candidate-card{border:0.5px solid #d7ecf5;border-radius:5px;padding:4px 10px;margin-bottom:10px;background:#f5fcff;}
.candidate-card h5{font-weight:700;margin-bottom:0;}
.badge-status{background:rgb(126 181 212 / 20%);font-size:12px;padding:2px 5px 3px 5px;border-radius:6px;border:0.5px solid #a3c0d3;font-weight:400;line-height:14px;}
.btn-action{background-color:#5d8dde;border:1px solid #2063ae;padding:1px 4px 2px 4px;font-size:12px;}
.btn-action:hover,.btn-action-email:hover,.btn-action-feedback:hover{background-color:#3367d6;}
.btn-action-email{background:#3561a3;}
.btn-icon-css{font-size:12px;padding:1px 5px 2px 5px;}
.btn-action-delete{background-color:#c57a52;border:1px solid #ab4712;padding:0px 4px 1px 4px;font-size:12px;}
.btn-action-deselect{background-color:#c57a52;border:1px solid #ab4712;padding:1px 4px;font-size:12px;}
.btn-action-delete:hover,.btn-action-deselect:hover{background-color:#e65c1a;}
.detail-row{padding-top:12px;}
.tag{display:inline-block;background:#f2f2f2;border-radius:6px;padding:1px 4px;font-size:14px;margin:1px;}
.toggle-icon{cursor:pointer;float:right;color:#7b7c7c;margin-right:-10px;font-size:12px;}
.active{font-weight:bold;color:#184889 !important;border:#86b7fe !important;}
.pagination-controls{display:flex;justify-content:flex-end;gap:6px;margin-top:15px;}
.pagination-controls button{border:none;background:#b9cde1;color:#071d38;padding:4px 12px;border-radius:5px;cursor:pointer;font-size:14px;transition:all 0.2s ease-in-out;font-weight:400;}
.pagination-controls button:hover{background:#3367d6;color:#fff;font-weight:600;}
.pagination-controls button.active{background:#3367d6;color:white !important;font-weight:600;}
.pagination-controls button:disabled{cursor:not-allowed;}
tr th{font-weight:600;}
#resultMessage,#confirmMessage{font-size:14px;}
table{font-size:14px;}
.row-details{font-size:14px;}
.search-section{position:relative;display:flex;align-items:center;width:calc(100% - 200px);flex:1;}
.search-container{display:flex;align-items:center;gap:10px;width:100%;margin-bottom:10px;}
.search-section input{width:100%;padding-right:30px;padding-left:23px;border-radius:10px;}
.search-section input:focus{box-shadow:none;}
.items-width{padding:0px;}
.filter-dropdown{position:relative;}
.filter-btn{padding:5px 12px 5px 12px;border:0.5px solid #ccc;background:#fff;border-radius:7px;cursor:pointer;min-width:140px;text-align:left;font-size:14px;font-weight:400;}
.filter-menu{position:absolute;top:110%;left:0;background:#fff;border:1px solid #ddd;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.15);width:200px;max-height:200px;overflow-y:auto;display:none;z-index:1000;padding:8px;}
.filter-menu input[type="checkbox"]{margin-right:6px;}
.filter-menu label{display:flex;align-items:center;padding:4px 2px;font-size:13px;cursor:pointer;color:black;font-weight:400;}
.filter-dropdown.active .filter-menu{display:block;}
#resetFiltersBtn{margin-left:auto;}
tbody,td,tfoot,th,thead,tr{border-color:#f3f3f3;border-style:solid;}
tbody{display:block;border:0.5px solid #ddd7d7;padding:2px;margin-top:0px;border-radius:2px;}
.hidden{display:none;}
.collapse{display:none;}
textarea.form-control{width:100%;padding:8px;border-radius:4px;border:1px solid #ccc;}
ol,ul{padding:0 !important;}
.job-section{border:1px solid #b6e0ed;border-radius:8px;padding:5px 12px;background:#ffffff;margin-bottom:10px !important;}
.job-group-header h4{font-size:18px;color:#184889;display:inline-block;padding:0px 2px;border-radius:4px;font-weight:500;}
.job-candidate-list{margin-top:8px;}
.job-collapse-btn,.send-ids-btn{border:none;font-weight:500;}
.job-collapse-btn:hover,.send-ids-btn:hover{border:none;font-weight:500;background:none;color:#0d6efd;}
.job-collapse-btn:active,.send-ids-btn:active{background:transparent !important;color:#184889 !important;}
.candidateCount{color:#FF6F21 !important;border:solid 1px #FF6F21;padding:0px 10px 2px 10px;border-radius:16px;background:#fff3ec;font-size:13px !important;font-weight:600;}
.status-badge{color:#03366a !important;border:solid 1px #2981af;padding:0px 5px;border-radius:12px;font-size:12px !important;background:#d8effb !important;}
#selectedCandidateList{max-height:229px;overflow-y:auto;}
.status-tab-wrapper{display:flex;flex-wrap:wrap;align-items:center;gap:10px;}
.status-tab{cursor:pointer;display:flex;align-items:center;gap:6px;padding:0 10px 2px;border-radius:5px;font-weight:600;color:#194693;background:#e6f1ff;transition:all 0.2s ease;font-size:14px;border:1px solid #8caedb;}
.status-tab .checkmark{display:none;}
.status-tab.selected{background-color:#198754;color:#fff;border-color:#198754;}
.status-tab.selected .checkmark{display:inline-block;}
.match-score-badge{background:#e9f6ff;color:#0f4168;border:1px solid #71b2e6;border-radius:6px;text-align:center;font-size:14px;font-weight:500;line-height:1.1;padding:1px 7px 3px 7px;display:inline-block;cursor:pointer;transition:all 0.2s ease-in-out;min-width:75px;}
.match-score-badge span{font-size:12px;}
.match-score-badge:hover,.changeStatus:hover{background:#0073cf !important;color:#fff !important;box-shadow:0 2px 6px rgba(0,0,0,0.15);}
#interviewJobTitle,#modalCandidateName{color:#1153b5;}
.title_name{font-size:14px !important;padding:5px 8px;background:#f5fcff;border-radius:5px;border:0.5px solid #d7ecf5;}
.form-select{font-size:14px !important;padding:5px 30px 5px 10px !important;}
.form-control{font-size:14px !important;padding:5px 10px !important;}
.send-ids-btn{color:#0d6efd !important;}
.badge-status.updated{background-color:#28a745 !important;color:white !important;transition:background-color 0.5s;}
.web-process-modal{display:none;position:fixed;inset:0;z-index:1200;background-color:rgba(0,0,0,0.5);justify-content:center;align-items:center;}
.web-modal-content{background:#fff;padding:20px;border-radius:10px;width:360px;max-width:90%;text-align:left;box-shadow:0 5px 20px rgba(0,0,0,0.3);position:relative;}
.web-close-btn{float:right;font-size:22px;font-weight:bold;cursor:pointer;position:absolute;right:7px;top:1px;}
.web-modal-content h3{margin-top:-5px;color:#1976d2;font-weight:500;border-bottom:solid 1px #1976d2;padding-bottom:5px;font-size:16px;margin-bottom:20px;}
.feedback-chat-container{display:none;position:absolute;right:10px;top:40px;background:white;border-radius:8px;padding:0;width:350px;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:100;border:1px solid #babad6 !important;transition:all 0.3s ease;cursor:default;}
.feedback-chat-container.active{display:block;}
.feedback-chat-container.expanded{width:500px;}
.chat-header{background:#1976d2;color:white;padding:10px 12px;font-weight:600;font-size:14px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;}
.chat-header-actions{display:flex;gap:10px;align-items:center;}
.chat-expand-btn,.chat-close-btn{cursor:pointer;font-size:18px;line-height:1;padding:0 5px;}
.chat-expand-btn:hover,.chat-close-btn:hover{opacity:0.8;}
.chat-messages{max-height:350px;overflow-y:auto;padding:10px;background:#e5ddd5;min-height:250px;}
.feedback-chat-container.expanded .chat-messages{max-height:364px;}
.chat-message{display:flex;margin-bottom:5px;animation:fadeIn 0.3s;}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
.chat-message.self{justify-content:flex-end;}
.message-bubble{max-width:95%;padding:2px 8px;border-radius:8px;word-wrap:break-word;box-shadow:0 1px 2px rgba(0,0,0,0.1);}
.chat-message.self .message-bubble{background:#dcf8c6;border-bottom-right-radius:2px;}
.chat-message.other .message-bubble{background:white;border-bottom-left-radius:2px;}
.message-sender{font-weight:600;font-size:12px;color:#d64004;text-align:left;}
.message-text{font-weight:600;font-size:12px;color:#333;margin-bottom:3px;white-space:pre-wrap;text-align:left;}
.message-time{font-size:9px;color:#667;text-align:right;}
.chat-input-container{display:flex;gap:6px;align-items:center;padding:8px;background:#f0f0f0;border-radius:0 0 8px 8px;position:relative;}
.chat-input-container input{flex:1;padding:8px 40px 8px 12px;border:1px solid #ccc;border-radius:20px;font-size:14px;outline:none;}
.chat-input-container input:focus{border-color:#1976d2;}
.emoji-picker-btn{position:absolute;right:90px;cursor:pointer;font-size:16px;background:transparent;border:none;z-index:10;}
.emoji-picker-btn:hover{transform:scale(1.2);}
.emoji-picker{display:none;position:absolute;bottom:50px;right:8px;background:white;border:1px solid #ccc;border-radius:8px;padding:10px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:1000;max-width:280px;}
.emoji-picker.active{display:block;}
.emoji-category{margin-bottom:8px;}
.emoji-category-title{font-size:11px;color:#666;font-weight:600;margin-bottom:4px;}
.emoji-list{display:flex;flex-wrap:wrap;gap:5px;}
.emoji-item{font-size:15px;cursor:pointer;padding:1px;border-radius:4px;transition:background 0.2s;}
.emoji-item:hover{background:#f0f0f0;transform:scale(1.2);}
.chat-input-container button{padding:8px 16px;background:#25d366;color:white;border:none;border-radius:20px;cursor:pointer;font-size:13px;font-weight:600;}
.chat-input-container button:hover{background:#20bd5a;}
.chat-input-container button:disabled{background:#ccc;cursor:not-allowed;}
.chat-loading{text-align:center;padding:10px;color:#666;font-size:13px;}
.job-section.highlight{border:1px solid #2aad88 !important;animation:highlightPulse 0.5s ease-in-out;}
@keyframes highlightPulse{0%,100%{border-color:#2aad88;}50%{border-color:#80ceb8;}}
.candidate-card{transition:all 0.3s ease;}
.detail-row{transition:max-height 0.5s ease-in-out,opacity 0.5s ease-in-out,padding 0.5s ease-in-out;max-height:0;opacity:0;overflow:hidden;position:relative;padding-top:0;}
.detail-row:not(.collapse){max-height:3000px;opacity:1;padding-top:12px;}
.status-tabs-container{display:flex;flex-wrap:nowrap;gap:7px;margin-bottom:15px;padding:15px 10px;border-bottom:2px solid #e0e0e0;background:white;position:sticky;top:0;z-index:95;overflow-x:auto;box-shadow:0 2px 4px rgba(0,0,0,.05);}
.status-tabs-container::-webkit-scrollbar{height:6px;}
.status-tabs-container::-webkit-scrollbar-track{background:#f1f1f1;border-radius:10px;}
.status-tabs-container::-webkit-scrollbar-thumb{background:#888;border-radius:10px;}
.status-tabs-container::-webkit-scrollbar-thumb:hover{background:#555;}
.status-tab-main{padding:6px 7px;background:#f0f0f0;border:1px solid #ccc;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;transition:all 0.3s ease;white-space:nowrap;flex-shrink:0;}
.status-tab-main.active,.status-tab-main:hover{background:#006db6 !important;color:white !important;border-color:#2561db !important;}
.status-tab-main:nth-child(1){background:#8ddef7;border-color:#61818b;}
.status-tab-main:nth-child(2){background:#cee8ff;border-color:#a3bcd9;}
.status-tab-main:nth-child(3){background:#ddf7df;border-color:#9fd1a2;}
.status-tab-main:nth-child(4){background:#f9d5a7;border-color:#c1957d;}
.status-tab-main:nth-child(5){background:#f5c5c4;border-color:#db9a9a;}
.status-tab-main:nth-child(6){background:#f7d7ff;border-color:#c5a4d9;}
.status-tab-main:nth-child(7){background:#c9ede9;border-color:#97bdb6;}
.status-tab-main:nth-child(8){background:#e4b1f9;border-color:#b974e3;}
.status-tab-main:nth-child(9){background:#87dae3;border-color:#477a7e;}
.status-tab-main:nth-child(10){background:#efa4a4;border-color:#ad6464;}
#statusSubtabsContainer{display:flex;flex-wrap:nowrap;gap:6px;margin-bottom:14px;padding:10px;border-left:2px solid #198754;padding-left:12px;background:white;position:sticky;top:60px;z-index:94;overflow-x:auto;box-shadow:0 1px 3px rgba(0,0,0,.05);}
#statusSubtabsContainer::-webkit-scrollbar{height:6px;}
#statusSubtabsContainer::-webkit-scrollbar-track{background:#f1f1f1;border-radius:10px;}
#statusSubtabsContainer::-webkit-scrollbar-thumb{background:#888;border-radius:10px;}
#statusSubtabsContainer::-webkit-scrollbar-thumb:hover{background:#555;}
.status-subtabs-wrapper{display:flex;gap:6px;flex-wrap:nowrap;padding-left:5px;}
.status-subtab{padding:4px 7px;background:#e8f5e9;border:1px solid #4caf50;border-radius:4px;cursor:pointer;font-size:12px;transition:all 0.2s ease;white-space:nowrap;flex-shrink:0;}
.status-subtab:hover{background:#4caf50;color:white;}
.status-subtab.active{background:#4caf50;color:white !important;}
.view-toggle{display:flex;background:#e9ecef;padding:0px;border-radius:8px;gap:5px;border:1px solid #bbb8b8;}
.view-toggle button{border:none;background:transparent;padding:6px 12px;font-size:14px;border-radius:6px;color:#6c757d;font-weight:600;transition:all 0.2s ease;}
.view-toggle button.active{background:#fff;color:#184889 !important;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
.floating-view-toggle{display:none;position:fixed;bottom:14px;right:71px;background:#e9ecef;border:1px solid #686161;border-radius:8px;padding:0px;gap:5px;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.15);flex-direction:row;align-items:center;animation:slideIn 0.3s ease-out;}
.floating-view-toggle.visible{display:flex;}
.floating-view-toggle button{border:none;background:transparent;padding:6px 12px;font-size:14px;border-radius:6px;color:#6c757d;font-weight:600;transition:all 0.2s ease;cursor:pointer;}
.floating-view-toggle button.active{background:#fff;color:#184889 !important;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
@keyframes slideIn{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes slideOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(20px);}}
.floating-view-toggle.hide{animation:slideOut 0.3s ease-out forwards;}
@media(max-width:1024px){.status-tabs-container{gap:5px;padding:12px 8px;}#statusSubtabsContainer{gap:4px;padding:12px 8px;}.status-tab-main{padding:4px 6px;font-size:12px;}.status-subtab{padding:3px 6px;font-size:11px;}.floating-view-toggle{bottom:14px;right:50px;}}
@media(max-width:768px){.container{padding:16px;}.section-title{font-size:24px;}.status-tabs-container{gap:4px;padding:10px 6px;margin-bottom:10px;}#statusSubtabsContainer{gap:3px;padding:10px 6px;margin-bottom:10px;top:50px;}.status-tab-main{padding:3px 5px;font-size:11px;}.status-subtab{padding:2px 5px;font-size:10px;}.search-container{flex-direction:column;width:100%;gap:8px;}.search-section{width:100%;}.floating-view-toggle{bottom:14px;right:20px;padding:6px;}.floating-view-toggle button{padding:4px 8px;font-size:12px;}}
@media(max-width:480px){.status-tabs-container{gap:3px;padding:8px 4px;}#statusSubtabsContainer{gap:2px;padding:8px 4px;top:45px;}.status-tab-main{padding:2px 4px;font-size:10px;}.status-subtab{padding:2px 4px;font-size:9px;}.floating-view-toggle{bottom:14px;right:40px;padding:4px;}.floating-view-toggle button{padding:3px 6px;font-size:11px;}}
.kanban-board{display:none;gap:10px;padding:2px 0;}
.kanban-board.active{display:block;}
.feedback-send-btn:disabled{color:#ccc;cursor:not-allowed;opacity:0.5;}
.feedback-send-btn:not(:disabled){color:#1976d2;transition:all 0.2s ease;}
.feedback-send-btn:not(:disabled):hover{color:#1565c0;transform:scale(1.1);}
.kanban-column{background:#f5f5f5;border-radius:8px;padding:15px;flex:0 0 270px;width:270px;}
.job-kanban{display:flex;gap:16px;overflow-x:auto;padding-bottom:6px;}
.job-kanban::-webkit-scrollbar{height:8px;}
.job-kanban::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.1);border-radius:8px;}
.job-row{margin-bottom:20px;}
.job-rows-wrapper{display:block;}
.kanban-column-title{font-weight:700;font-size:14px;margin-bottom:10px;padding-bottom:6px;border-bottom:0.5px solid #bebcbc;}
.kanban-cards{display:flex;flex-direction:column;gap:10px;}
.kanban-card{background:white;padding:12px;border-radius:6px;border:1px solid #ddd;cursor:grab;transition:all 0.2s ease;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
.kanban-card:hover{box-shadow:0 4px 8px rgba(0,0,0,0.15);}
.kanban-card.dragging{opacity:0.7;cursor:grabbing;}
.kanban-card-header{font-weight:600;font-size:13px;margin-bottom:6px;color:#1976d2;}
.kanban-card-details{font-size:12px;color:#666;}
.kanban-card-job{margin-top:8px;padding-top:8px;border-top:1px solid #eee;font-size:11px;font-weight:500;color:#888;}
.floating-reset-btn{display:none;position:fixed;bottom:14px;right:15px;width:35px;height:35px;background:#4285f4;border:none;border-radius:50%;cursor:pointer;z-index:998;box-shadow:0 2px 8px rgba(0,0,0,0.15);align-items:center;justify-content:center;transition:all 0.3s ease;}
.floating-reset-btn:hover{background:#357ae8;box-shadow:0 4px 12px rgba(0,0,0,0.2);transform:scale(1.05);}
.floating-reset-btn.visible{display:flex;animation:slideIn 0.3s ease-out;}
.floating-reset-btn.hide{animation:slideOut 0.3s ease-out forwards;}
.floating-reset-btn i{color:white;font-size:18px;}
@media(max-width:1024px){.floating-reset-btn{right:12px;}}
@media(max-width:768px){.floating-reset-btn{right:10px;top:auto;bottom:14px;width:35px;height:35px;}.floating-reset-btn i{font-size:16px;}}
@media(max-width:480px){.floating-reset-btn{right:10px;width:34px;height:34px;}.floating-reset-btn i{font-size:14px;}}
.analysis-top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:5px;}
.analysis-left{flex:1;}
.analysis-right{width:150px;text-align:center;}
.score-value{font-size:20px;font-weight:700;color:#6f2a9f;}
.tab-card{border-radius:12px;padding:5px 18px;background:#fff;border:1px solid rgb(187 176 176);font-weight:normal;color:var(--bs-secondary-color) !important;}
.modal-section-title{font-size:15px;font-weight:600;margin-bottom:5px;color:#1976d2;}
.modal-subSection-title{font-size:15px;font-weight:600;margin-bottom:5px;color:#FF6F21;}
.dominant-badge{display:inline-block;min-width:86px;text-align:left;margin-right:8px;margin-bottom:8px;}
.metric-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.metric-col{flex:1;min-width:160px;}
.small-muted{color:#6b7280;font-size:0.95rem;}
.badge-keyword{background:#e2ebf5;color:#0f172a;border-radius:6px;padding:0px 5px 1px 5px;display:inline-block;font-size:13px;border:1px solid #97b8dd;}
.pre-box{background:#f8fafc;padding:10px;border-radius:12px;max-height:220px;overflow:auto;font-size:0.9rem;border:1px solid #bfbcbc;}
.strength-box{border:1px solid #96d9b6;padding:5px 5px 5px 25px;border-radius:10px;}
.improve-box{border:1px solid #ffc0c0;padding:5px 5px 5px 25px;border-radius:10px;}
.rec-box{border:1px solid #9fd1f3;padding:5px 5px 5px 25px;border-radius:10px;}
.nav-tabs .nav-link{border-radius:8px 8px 0 0;background:#9197b3;color:#fff;margin-right:6px;font-weight:600;font-size:14px;border-bottom:none;padding:5px 15px;}
.nav-tabs .nav-link.active{background:#006db6;color:#fff !important;}
#aCandidateName{margin:0;display:inline;font-size:0.95rem;font-weight:600;}
.matric-count,#summaryExecutive,#summaryStrengths,#summaryImprovements{font-size:14px;}
#videoSentimentScore{width:100px;height:100px;border-radius:50%;display:flex;color:#756c7c;align-items:center;justify-content:center;font-size:24px;font-weight:bold;margin:0 auto;border:4px solid #418344;}
.text-center{text-align:center;}
#transcriptKeywords{max-height:191px;overflow-y:auto;border:1px solid #e5e5e5;padding:8px;border-radius:8px;display:flex;flex-wrap:wrap;gap:5px;}
.senti-analysis{display:flex;justify-content:space-between;padding:6px 0;}
#skillAuthenticity{min-height:191px;}
.initial-container{padding:0px 10px;}
#iniAnalysisTabContent{border-radius:12px;padding:5px;background:#fff;border:1px solid rgb(187 176 176);font-weight:normal;color:var(--bs-secondary-color) !important;}
.career-arc-container{display:flex;height:600px;gap:20px;padding:20px;background:#f9f9f9;border-radius:8px;}
.career-arc-sidebar{flex:0 0 280px;overflow-y:auto;border-left:4px solid #a5bfd9;padding-left:15px;}
.career-arc-timeline{flex:1;position:relative;padding:20px;background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}
.career-job-item{padding:12px 15px;margin-bottom:15px;border-left:3px solid #1976d2;background:#f5f9ff;border-radius:4px;cursor:pointer;transition:all 0.3s ease;font-size:13px;color:#333;}
.career-job-item:hover,.career-job-item.active{background:#e3f2fd;border-left:4px solid #FF6F21 !important;}
.career-job-title{display:block;margin-bottom:4px;font-weight:600;color:#1976d2;}
.career-job-company{display:block;font-size:12px;color:#666;margin-bottom:3px;}
.career-job-duration{display:block;font-size:11px;color:#999;}
#careerTimelineCanvas{width:100%;height:100%;background:white;border-radius:8px;display:block;}
.career-timeline-details{position:absolute;bottom:20px;left:20px;right:20px;padding:5px 10px;background:#f5f9ff;border:1px solid #cbdfed;border-radius:6px;font-size:13px;line-height:1.6;max-height:150px;overflow-y:auto;box-shadow:0 2px 6px rgba(0,0,0,0.1);display:none;width:71%;margin-left:190px;}
.career-timeline-details.show{display:block;}
.career-timeline-details h6{margin-bottom:8px;font-weight:600;color:#1976d2;margin-top:0;}
.career-timeline-details p{margin:5px 0;color:#555;}
.career-timeline-details ul{margin:5px 0 0 20px;padding:0;}
.career-timeline-details li{font-size:12px;margin:3px 0;color:#666;}
@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
.processSpin{width:18px;height:18px;vertical-align:text-bottom;border-width:3px;color:#7fb4f9;}
</style>
