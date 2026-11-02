/**
 * LeadSort Pro - Frontend Client Application
 * Communicates with Python Flask REST API backend
 */

// Application State
let rawUploadedRows = [];
let processedRecords = [];
let isProcessing = false;
let shouldCancel = false;
let activeFilter = 'all';

// DOM Selectors
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfoBox = document.getElementById('fileInfoBox');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const fileSizeDisplay = document.getElementById('fileSizeDisplay');
const removeFileBtn = document.getElementById('removeFileBtn');
const startProcessBtn = document.getElementById('startProcessBtn');
const cancelProcessBtn = document.getElementById('cancelProcessBtn');
const resetDataBtn = document.getElementById('resetDataBtn');
const exportXlsxBtn = document.getElementById('exportXlsxBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const tableSearchInput = document.getElementById('tableSearchInput');
const resultsTableBody = document.getElementById('resultsTableBody');
const liveLogs = document.getElementById('liveLogs');
const progressBar = document.getElementById('progressBar');
const progressPercentText = document.getElementById('progressPercentText');
const progressStepText = document.getElementById('progressStepText');
const pipelineStatusBadge = document.getElementById('pipelineStatusBadge');

// KPI Badges
const totalRecordsCount = document.getElementById('totalRecordsCount');
const highInterestCount = document.getElementById('highInterestCount');
const interestedCount = document.getElementById('interestedCount');
const notInterestedCount = document.getElementById('notInterestedCount');
const filterAllCount = document.getElementById('filterAllCount');
const filterHighCount = document.getElementById('filterHighCount');
const filterMedCount = document.getElementById('filterMedCount');
const filterLowCount = document.getElementById('filterLowCount');
const footerInfoText = document.getElementById('footerInfoText');

// Toast Notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  let bg = 'bg-slate-900 border-slate-700 text-slate-200';
  let icon = 'fa-info-circle text-sky-400';
  if (type === 'success') {
    bg = 'bg-emerald-950/90 border-emerald-600/50 text-emerald-200';
    icon = 'fa-check-circle text-emerald-400';
  } else if (type === 'error') {
    bg = 'bg-red-950/90 border-red-700/60 text-red-200';
    icon = 'fa-triangle-exclamation text-red-400';
  } else if (type === 'warning') {
    bg = 'bg-amber-950/90 border-amber-700/60 text-amber-200';
    icon = 'fa-circle-exclamation text-amber-400';
  }

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${bg}`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span class="font-medium">${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Activity Logging
function addLog(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  let color = 'text-slate-300';
  if (type === 'success') color = 'text-emerald-400';
  if (type === 'error') color = 'text-red-400';
  if (type === 'warning') color = 'text-amber-400';
  div.className = color;
  div.innerHTML = `<span class="text-slate-500 font-mono">[${time}]</span> ${msg}`;
  liveLogs.prepend(div);
}

// Check Backend Health on Mount
async function checkBackendHealth() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      addLog(`Connected to Flask Backend API. Engine: ${data.model} (Batch Size: ${data.batch_size})`, 'success');
    }
  } catch (err) {
    addLog(`Backend check: Running in standalone or direct mode.`, 'warning');
  }
}
checkBackendHealth();

// Load Sample Dataset from REST API
loadSampleBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/sample-data');
    if (!res.ok) throw new Error("Failed to load sample dataset from server.");
    const json = await res.json();
    
    rawUploadedRows = json.data || [];
    fileNameDisplay.textContent = json.filename || "sample_multilingual_leads.xlsx";
    fileSizeDisplay.textContent = `Demo Set • ${rawUploadedRows.length} unstructured rows`;
    fileInfoBox.classList.remove('hidden');
    startProcessBtn.disabled = false;
    processedRecords = [];
    
    addLog(`Loaded ${rawUploadedRows.length} sample entries across German, Spanish, French, Hindi, Japanese, Swedish, Arabic & English.`, 'success');
    showToast("Loaded sample dataset with multilingual feedback!", "success");
    updateMetrics();
    renderTable();
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
    addLog("Failed to fetch sample data: " + err.message, "error");
  }
});

// Dropzone & File Input Handlers
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('border-emerald-500', 'bg-emerald-950/20');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-emerald-500', 'bg-emerald-950/20');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-emerald-500', 'bg-emerald-950/20');
  if (e.dataTransfer.files.length) {
    uploadSpreadsheet(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    uploadSpreadsheet(e.target.files[0]);
  }
});

removeFileBtn.addEventListener('click', () => {
  resetAllData();
  showToast("Spreadsheet cleared.", "info");
});

resetDataBtn.addEventListener('click', () => {
  resetAllData();
  showToast("Workspace reset to clean state.", "info");
});

function resetAllData() {
  rawUploadedRows = [];
  processedRecords = [];
  fileInput.value = '';
  fileInfoBox.classList.add('hidden');
  startProcessBtn.disabled = true;
  cancelProcessBtn.disabled = true;
  exportXlsxBtn.disabled = true;
  progressBar.style.width = '0%';
  progressPercentText.textContent = '0%';
  progressStepText.textContent = 'Ready';
  pipelineStatusBadge.textContent = 'Awaiting File';
  pipelineStatusBadge.className = "text-[11px] font-semibold px-3 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-800";
  updateMetrics();
  renderTable();
  addLog("All workspace data cleared from memory.");
}

// Upload spreadsheet to backend REST API
async function uploadSpreadsheet(file) {
  const formData = new FormData();
  formData.append("file", file);

  addLog(`Uploading "${file.name}" to server for parsing...`, 'info');

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Failed to parse spreadsheet file.");
    }

    rawUploadedRows = json.data;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = `${(file.size / 1024).toFixed(1)} KB • ${rawUploadedRows.length} rows`;
    fileInfoBox.classList.remove('hidden');
    startProcessBtn.disabled = false;
    exportXlsxBtn.disabled = true;
    processedRecords = [];

    addLog(`Imported "${file.name}" successfully with ${rawUploadedRows.length} records.`, 'success');
    showToast(`Imported ${rawUploadedRows.length} rows from file.`, "success");
    updateMetrics();
    renderTable();
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
    addLog("Upload error: " + err.message, "error");
  }
}

// Pipeline Processing Trigger
startProcessBtn.addEventListener('click', async () => {
  if (rawUploadedRows.length === 0) {
    showToast("Please upload an XLS/CSV file or load sample data first.", "warning");
    return;
  }

  isProcessing = true;
  shouldCancel = false;
  startProcessBtn.disabled = true;
  cancelProcessBtn.disabled = false;
  exportXlsxBtn.disabled = true;
  pipelineStatusBadge.textContent = "Analyzing Leads...";
  pipelineStatusBadge.className = "text-[11px] font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 pulse-glow";

  processedRecords = [];
  const batchSize = 2;
  const total = rawUploadedRows.length;
  let completed = 0;

  addLog(`Initiating classification & translation pipeline for ${total} records...`, 'info');

  for (let i = 0; i < total; i += batchSize) {
    if (shouldCancel) {
      addLog("Processing stopped by user.", "warning");
      showToast("Processing halted.", "warning");
      break;
    }

    const batch = rawUploadedRows.slice(i, i + batchSize);
    const startIndex = i;
    progressStepText.textContent = `Analyzing records ${i + 1} to ${Math.min(i + batchSize, total)} of ${total}...`;

    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: batch,
          startIndex: startIndex
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Server returned error (${res.status})`);
      }

      processedRecords.push(...json.records);
      completed += batch.length;

      const pct = Math.min(100, Math.round((completed / total) * 100));
      progressBar.style.width = pct + '%';
      progressPercentText.textContent = pct + '%';

      updateMetrics();
      renderTable();

      // Pacing delay to avoid aggressive rate limit spikes
      if (i + batchSize < total && !shouldCancel) {
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (err) {
      console.error("Batch error:", err);
      addLog(`Batch ${Math.floor(i / batchSize) + 1} issue: ${err.message}`, 'error');
    }
  }

  isProcessing = false;
  startProcessBtn.disabled = false;
  cancelProcessBtn.disabled = true;

  // Final priority sorting via Backend API
  try {
    addLog("Sorting records by intent priority (High Interest -> Interested -> Not Interested)...", 'info');
    const sortRes = await fetch("/api/sort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: processedRecords })
    });
    const sortJson = await sortRes.json();
    if (sortRes.ok && sortJson.success) {
      processedRecords = sortJson.sorted_records;
    }
  } catch (sortErr) {
    console.error("Sort error:", sortErr);
  }

  exportXlsxBtn.disabled = processedRecords.length === 0;
  pipelineStatusBadge.textContent = "Complete & Sorted";
  pipelineStatusBadge.className = "text-[11px] font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
  progressStepText.textContent = `Completed all ${processedRecords.length} records`;
  progressBar.style.width = '100%';
  progressPercentText.textContent = '100%';
  addLog(`Task Completed! Classified and prioritized ${processedRecords.length} customer records.`, 'success');
  showToast("Data restructured & sorted: High Interest -> Interested -> Not Interested!", "success");
  
  updateMetrics();
  renderTable();
});

cancelProcessBtn.addEventListener('click', () => {
  shouldCancel = true;
  cancelProcessBtn.disabled = true;
  addLog("Cancellation requested. Halting after current batch...", "warning");
});

function updateMetrics() {
  const total = processedRecords.length || rawUploadedRows.length;
  totalRecordsCount.textContent = total;

  const high = processedRecords.filter(r => r.interest_category === "High Interest").length;
  const med = processedRecords.filter(r => r.interest_category === "Interested").length;
  const low = processedRecords.filter(r => r.interest_category === "Not Interested").length;

  highInterestCount.textContent = high;
  interestedCount.textContent = med;
  notInterestedCount.textContent = low;

  filterAllCount.textContent = processedRecords.length;
  filterHighCount.textContent = high;
  filterMedCount.textContent = med;
  filterLowCount.textContent = low;
}

function renderTable() {
  const searchTerm = tableSearchInput.value.toLowerCase().trim();
  const dataset = processedRecords.length > 0 ? processedRecords : [];

  if (dataset.length === 0 && rawUploadedRows.length > 0) {
    resultsTableBody.innerHTML = rawUploadedRows.slice(0, 10).map((row, idx) => `
      <tr class="hover:bg-slate-900/50 transition-colors opacity-75">
        <td class="py-3 px-4 text-center font-mono text-slate-500">${idx + 1}</td>
        <td class="py-3 px-4 font-semibold text-slate-300">${escapeHtml(extractField(row, ['name', 'cust', 'company']) || 'Raw Row #' + (idx + 1))}</td>
        <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">${escapeHtml(extractField(row, ['contact', 'email', 'phone']) || 'Unstructured')}</td>
        <td class="py-3 px-4 text-slate-300 max-w-xs truncate" title="${escapeHtml(extractFeedback(row))}">${escapeHtml(extractFeedback(row))}</td>
        <td class="py-3 px-4 text-slate-500 italic">Click "Classify & Sort Leads" to analyze</td>
        <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 text-[10px] border border-slate-800">Pending</span></td>
        <td class="py-3 px-4 text-center font-mono text-slate-500">-</td>
        <td class="py-3 px-4 text-slate-500">Unprocessed</td>
      </tr>
    `).join('');

    footerInfoText.textContent = `Showing raw preview of ${Math.min(10, rawUploadedRows.length)} of ${rawUploadedRows.length} uploaded records.`;
    return;
  }

  if (dataset.length === 0) {
    resultsTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-16 text-slate-500">
          <div class="flex flex-col items-center justify-center gap-2">
            <i class="fa-solid fa-table-list text-3xl text-slate-700"></i>
            <span class="font-medium">No records loaded yet. Upload your spreadsheet or click "Load Sample Dataset" above.</span>
          </div>
        </td>
      </tr>
    `;
    footerInfoText.textContent = `Showing 0 of 0 entries`;
    return;
  }

  const filtered = dataset.filter(item => {
    if (activeFilter !== 'all' && item.interest_category !== activeFilter) {
      return false;
    }
    if (searchTerm) {
      const combined = `${item.customer_name} ${item.company_name} ${item.contact_info} ${item.original_feedback} ${item.english_translation} ${item.primary_reason}`.toLowerCase();
      return combined.includes(searchTerm);
    }
    return true;
  });

  if (filtered.length === 0) {
    resultsTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-12 text-slate-500">
          No matching records found for filter "${escapeHtml(activeFilter)}" and query "${escapeHtml(searchTerm)}".
        </td>
      </tr>
    `;
    footerInfoText.textContent = `Showing 0 of ${dataset.length} entries`;
    return;
  }

  resultsTableBody.innerHTML = filtered.map((item, idx) => {
    let badgeStyle = "bg-slate-900 text-slate-400 border-slate-800";
    let scoreColor = "text-slate-400";
    let icon = "fa-circle-xmark text-slate-500";

    if (item.interest_category === "High Interest") {
      badgeStyle = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      scoreColor = "text-emerald-400 font-bold";
      icon = "fa-fire text-emerald-400";
    } else if (item.interest_category === "Interested") {
      badgeStyle = "bg-sky-500/15 text-sky-400 border-sky-500/30";
      scoreColor = "text-sky-400 font-semibold";
      icon = "fa-thumbs-up text-sky-400";
    }

    return `
      <tr class="hover:bg-slate-900/60 transition-colors cursor-pointer group" onclick="openDetailModal(${item.id})">
        <td class="py-3 px-4 text-center font-mono font-bold ${item.interest_category === 'High Interest' ? 'text-emerald-400' : 'text-slate-400'}">
          #${item.rank || idx + 1}
        </td>
        <td class="py-3 px-4">
          <div class="font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">${escapeHtml(item.customer_name)}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml(item.company_name)}</div>
        </td>
        <td class="py-3 px-4 text-slate-300 font-mono text-[11px]">
          ${escapeHtml(item.contact_info)}
        </td>
        <td class="py-3 px-4 max-w-xs">
          <div class="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
            <i class="fa-solid fa-language text-indigo-400"></i>
            <span>${escapeHtml(item.detected_language)}</span>
          </div>
          <p class="text-slate-300 line-clamp-2 text-[11px]" title="${escapeHtml(item.original_feedback)}">
            "${escapeHtml(item.original_feedback)}"
          </p>
        </td>
        <td class="py-3 px-4 max-w-sm">
          <p class="text-slate-200 text-xs font-medium line-clamp-2 bg-slate-950/70 p-2 rounded-xl border border-slate-800" title="${escapeHtml(item.english_translation)}">
            <i class="fa-solid fa-quote-left text-[10px] text-emerald-400 mr-1"></i>${escapeHtml(item.english_translation)}
          </p>
        </td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeStyle}">
            <i class="fa-solid ${icon} text-[11px]"></i>
            ${item.interest_category}
          </span>
        </td>
        <td class="py-3 px-4 text-center font-mono text-sm ${scoreColor}">
          ${item.intent_score} <span class="text-[10px] text-slate-600">/100</span>
        </td>
        <td class="py-3 px-4 text-slate-400 text-xs max-w-xs">
          <p class="truncate" title="${escapeHtml(item.primary_reason)}">${escapeHtml(item.primary_reason)}</p>
        </td>
      </tr>
    `;
  }).join('');

  footerInfoText.textContent = `Showing ${filtered.length} of ${dataset.length} total classified records`;
}

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(b => {
      b.className = 'filter-tab px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 transition-all';
    });
    btn.className = 'filter-tab px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white transition-all';
    activeFilter = btn.getAttribute('data-filter');
    renderTable();
  });
});

tableSearchInput.addEventListener('input', () => {
  renderTable();
});

// Modal inspection
window.openDetailModal = function(id) {
  const record = processedRecords.find(r => r.id === id);
  if (!record) return;

  const modal = document.getElementById('detailsModal');
  const content = document.getElementById('modalContent');

  content.innerHTML = `
    <div class="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
      <div>
        <p class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Customer / Lead</p>
        <p class="font-bold text-white text-sm mt-0.5">${escapeHtml(record.customer_name)}</p>
      </div>
      <div>
        <p class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Organization / Entity</p>
        <p class="font-medium text-slate-200 mt-0.5">${escapeHtml(record.company_name)}</p>
      </div>
      <div>
        <p class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Contact Info</p>
        <p class="font-mono text-slate-300 text-xs mt-0.5">${escapeHtml(record.contact_info)}</p>
      </div>
      <div>
        <p class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Priority Classification</p>
        <p class="font-bold text-sm mt-0.5 ${record.interest_category === 'High Interest' ? 'text-emerald-400' : record.interest_category === 'Interested' ? 'text-sky-400' : 'text-slate-400'}">
          ${record.interest_category} (Score: ${record.intent_score}/100)
        </p>
      </div>
    </div>

    <div class="space-y-1.5">
      <p class="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
        <i class="fa-solid fa-globe text-sky-400"></i> Original Feedback (${escapeHtml(record.detected_language)})
      </p>
      <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 italic">
        "${escapeHtml(record.original_feedback)}"
      </div>
    </div>

    <div class="space-y-1.5">
      <p class="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
        <i class="fa-solid fa-language text-emerald-400"></i> English Translation & Meaning
      </p>
      <div class="p-3 bg-emerald-950/20 rounded-xl border border-emerald-900/30 text-emerald-200 font-medium">
        "${escapeHtml(record.english_translation)}"
      </div>
    </div>

    <div class="space-y-1.5">
      <p class="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
        <i class="fa-solid fa-brain text-indigo-400"></i> Context & Reason
      </p>
      <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
        ${escapeHtml(record.primary_reason)}
      </div>
    </div>

    <div class="space-y-1.5">
      <p class="text-[11px] font-bold text-slate-300">Raw Input Row Data (Unstructured Source):</p>
      <pre class="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto">${escapeHtml(JSON.stringify(record.raw_data, null, 2))}</pre>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

document.getElementById('closeModalBtn').addEventListener('click', () => {
  const modal = document.getElementById('detailsModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
});

// Export Sorted XLS via Python Backend REST API
exportXlsxBtn.addEventListener('click', async () => {
  if (processedRecords.length === 0) {
    showToast("No processed records available to export.", "warning");
    return;
  }

  addLog("Requesting styled Excel file generation from Flask backend...", 'info');
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: processedRecords })
    });

    if (!res.ok) {
      throw new Error(`Server returned error (${res.status}) generating Excel file.`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    const timestamp = new Date().toISOString().slice(0, 10);
    a.download = `Sorted_Customer_Leads_${timestamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);

    addLog(`Successfully generated and downloaded ${a.download}`, 'success');
    showToast(`Excel file "${a.download}" downloaded!`, "success");
  } catch (err) {
    console.error("Export error:", err);
    showToast("Failed to generate Excel file: " + err.message, "error");
    addLog("Export error: " + err.message, "error");
  }
});

// Helper utilities
function extractField(row, keywords) {
  for (const key of Object.keys(row)) {
    const lowerKey = key.toLowerCase();
    if (keywords.some(k => lowerKey.includes(k))) {
      if (row[key] && String(row[key]).trim()) return String(row[key]).trim();
    }
  }
  return null;
}

function extractFeedback(row) {
  for (const key of Object.keys(row)) {
    const lowerKey = key.toLowerCase();
    if (['feedback', 'remark', 'notes', 'comment', 'review', 'message', 'text', 'feetback', 'fitback'].some(k => lowerKey.includes(k))) {
      if (row[key]) return String(row[key]);
    }
  }
  let longest = "";
  for (const val of Object.values(row)) {
    const str = String(val || "");
    if (str.length > longest.length) longest = str;
  }
  return longest || "No text available";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
