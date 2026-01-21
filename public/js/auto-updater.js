// Auto-Updater Frontend Logic
// Orchestrates the processing of issuers via backend APIs

const API_KEY = 'investclub-admin-secure-key-2024';
const API_BASE = '/api/auto-update';

// State
let state = {
    running: false,
    paused: false,
    mode: 'initial',
    queue: [],
    currentIndex: 0,
    startTime: null,
    logs: [],
    results: []
};

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statsPanel = document.getElementById('statsPanel');
const progressContainer = document.getElementById('progressContainer');
const currentPanel = document.getElementById('currentPanel');
const btnStart = document.getElementById('btnStart');
const btnPause = document.getElementById('btnPause');
const btnStop = document.getElementById('btnStop');
const btnBuild = document.getElementById('btnBuild');
const logContainer = document.getElementById('logContainer');
const resultsContainer = document.getElementById('resultsContainer');

// Offcanvas Functions
function openOffcanvas() {
    const offcanvas = document.getElementById('offcanvasMenu');
    const overlay = document.getElementById('siteOverlay');
    if (offcanvas && overlay) {
        offcanvas.classList.add('active');
        overlay.classList.add('active');
        document.body.classList.add('offcanvas-open');
    }
}

function closeOffcanvas() {
    const offcanvas = document.getElementById('offcanvasMenu');
    const overlay = document.getElementById('siteOverlay');
    if (offcanvas && overlay) {
        offcanvas.classList.remove('active');
        overlay.classList.remove('active');
        document.body.classList.remove('offcanvas-open');
    }
}

// API Calls
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}/${endpoint}`, options);
    return response.json();
}

// UI Updates
function updateStatus(status) {
    statusBadge.textContent = status;
    statusBadge.className = 'au-status-badge';

    if (status === 'Running') {
        statusBadge.classList.add('running');
    } else if (status === 'Paused') {
        statusBadge.classList.add('paused');
    } else if (status === 'Error') {
        statusBadge.classList.add('error');
    }
}

function updateStats(stats) {
    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statPending').textContent = stats.pending || 0;
    document.getElementById('statCompleted').textContent = stats.completed || 0;
    document.getElementById('statFailed').textContent = stats.failed || 0;
}

function updateProgress() {
    const total = state.queue.length;
    const completed = state.queue.filter(q => q.status === 'completed' || q.status === 'failed').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('progressText').textContent = `${percent}% (${completed}/${total})`;

    // ETA calculation
    if (state.running && state.startTime && completed > 0) {
        const elapsed = Date.now() - state.startTime;
        const avgTime = elapsed / completed;
        const remaining = total - completed;
        const eta = remaining * avgTime;
        const etaMinutes = Math.round(eta / 60000);
        document.getElementById('progressETA').textContent = `~${etaMinutes} min remaining`;
    } else {
        document.getElementById('progressETA').textContent = '';
    }
}

function updateCurrent(ticker, status) {
    document.getElementById('currentTicker').textContent = ticker || '-';
    document.getElementById('currentStatus').textContent = status || '-';
}

function addLog(level, message, ticker = null) {
    const time = new Date().toLocaleTimeString();
    const entry = { time, level, message, ticker };
    state.logs.unshift(entry);

    // Keep only last 500 logs
    if (state.logs.length > 500) {
        state.logs.length = 500;
    }

    renderLogs();
}

function renderLogs() {
    if (state.logs.length === 0) {
        logContainer.innerHTML = '<div class="au-log-empty">No activity yet. Build a queue to start.</div>';
        return;
    }

    logContainer.innerHTML = state.logs.map(log => `
        <div class="au-log-entry">
            <span class="au-log-time">${log.time}</span>
            <span class="au-log-level ${log.level}">[${log.level.toUpperCase()}]</span>
            ${log.ticker ? `<span class="au-log-ticker">[${log.ticker}]</span>` : ''}
            <span class="au-log-message">${log.message}</span>
        </div>
    `).join('');
}

function addResult(ticker, result) {
    // Remove existing result for this ticker
    state.results = state.results.filter(r => r.ticker !== ticker);

    // Add new result at the beginning
    state.results.unshift({ ticker, ...result, timestamp: new Date().toISOString() });

    renderResults();
}

function renderResults() {
    const filter = document.getElementById('resultFilter').value;

    let filtered = state.results;
    if (filter === 'passed') {
        filtered = state.results.filter(r => r.passed);
    } else if (filter === 'failed') {
        filtered = state.results.filter(r => !r.passed);
    }

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div class="au-results-empty">No validation results yet.</div>';
        return;
    }

    resultsContainer.innerHTML = filtered.map(result => `
        <div class="au-result-card">
            <div class="au-result-header">
                <span class="au-result-ticker">${result.ticker}</span>
                <span class="au-result-score ${result.passed ? 'passed' : 'failed'}">${result.score}%</span>
            </div>
            <div class="au-result-checks">
                ${Object.entries(result.checks || {}).map(([key, check]) => `
                    <span class="au-check-badge ${check.passed ? 'passed' : 'failed'}" title="${check.message}">${key}</span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function filterResults() {
    renderResults();
}

function showButtons(phase) {
    if (phase === 'idle') {
        btnBuild.style.display = 'inline-flex';
        btnStart.style.display = 'inline-flex';
        btnStart.disabled = state.queue.length === 0;
        btnPause.style.display = 'none';
        btnStop.style.display = 'none';
    } else if (phase === 'running') {
        btnBuild.style.display = 'none';
        btnStart.style.display = 'none';
        btnPause.style.display = 'inline-flex';
        btnStop.style.display = 'inline-flex';
    } else if (phase === 'paused') {
        btnBuild.style.display = 'none';
        btnStart.style.display = 'inline-flex';
        btnStart.disabled = false;
        btnPause.style.display = 'none';
        btnStop.style.display = 'inline-flex';
    }
}

// Filter Controls
function updateFilterValue() {
    const filterType = document.getElementById('filterType').value;
    const filterValue = document.getElementById('filterValue');

    if (filterType === 'all') {
        filterValue.style.display = 'none';
        filterValue.value = '';
    } else if (filterType === 'file') {
        filterValue.style.display = 'block';
        filterValue.placeholder = 'Enter file key (A, B, C, etc.)';
    } else if (filterType === 'ticker') {
        filterValue.style.display = 'block';
        filterValue.placeholder = 'Enter ticker (e.g., SPACEX)';
    }
}

// Queue Building
async function buildQueue() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const filterType = document.getElementById('filterType').value;
    const filterValue = document.getElementById('filterValue').value.trim().toUpperCase();

    addLog('info', `Building queue (mode: ${mode}, filter: ${filterType}${filterValue ? '=' + filterValue : ''})`);

    try {
        const result = await apiCall('queue', 'POST', {
            action: 'build',
            mode,
            filter: {
                type: filterType,
                value: filterValue || undefined
            }
        });

        if (result.success) {
            state.queue = result.state.items;
            state.mode = mode;

            statsPanel.style.display = 'grid';
            progressContainer.style.display = 'block';
            currentPanel.style.display = 'block';

            updateStats(result.stats);
            updateProgress();

            addLog('success', `Queue built: ${result.stats.total} companies`);
            showButtons('idle');
        } else {
            addLog('error', `Failed to build queue: ${result.error}`);
        }
    } catch (error) {
        addLog('error', `Error building queue: ${error.message}`);
    }
}

// Processing
async function startProcessing() {
    state.running = true;
    state.paused = false;
    state.startTime = state.startTime || Date.now();

    updateStatus('Running');
    showButtons('running');
    addLog('info', 'Processing started');

    await processQueue();
}

async function pauseProcessing() {
    state.paused = true;
    state.running = false;

    updateStatus('Paused');
    showButtons('paused');
    addLog('warning', 'Processing paused');
}

async function stopProcessing() {
    state.running = false;
    state.paused = false;
    state.startTime = null;

    updateStatus('Idle');
    updateCurrent(null, null);
    showButtons('idle');
    addLog('warning', 'Processing stopped');

    // Clear queue state on server
    await apiCall('queue', 'POST', { action: 'stop' });
}

async function processQueue() {
    while (state.running && !state.paused) {
        // Find next pending item
        const item = state.queue.find(q => q.status === 'pending');

        if (!item) {
            // All done
            state.running = false;
            updateStatus('Completed');
            showButtons('idle');
            addLog('success', 'All companies processed!');
            return;
        }

        // Mark as processing
        item.status = 'processing';
        updateCurrent(item.ticker, 'Calling Anthropic API...');
        addLog('info', `Processing started`, item.ticker);

        try {
            // Step 1: Process with Anthropic
            updateCurrent(item.ticker, 'Researching company data...');
            const processResult = await apiCall('process', 'POST', {
                ticker: item.ticker,
                name: item.name,
                mode: state.mode
            });

            if (!processResult.success) {
                throw new Error(processResult.error || 'Processing failed');
            }

            if (!processResult.hasUpdates) {
                // No updates found (daily mode)
                item.status = 'completed';
                addLog('info', 'No updates found', item.ticker);
                updateStats(getStats());
                updateProgress();
                continue;
            }

            // Step 2: Validate against KPI
            updateCurrent(item.ticker, 'Validating against KPI...');
            const validateResult = await apiCall('validate', 'POST', {
                data: processResult.data
            });

            addResult(item.ticker, validateResult.result);

            if (state.mode === 'initial' && !validateResult.result.passed) {
                // Failed KPI in initial mode
                item.status = 'failed';
                item.lastError = `KPI validation failed (${validateResult.result.score}%)`;
                addLog('error', `KPI validation failed (${validateResult.result.score}%)`, item.ticker);
                updateStats(getStats());
                updateProgress();
                continue;
            }

            // Step 3: Save to GitHub
            updateCurrent(item.ticker, 'Saving to GitHub...');
            const saveResult = await apiCall('save', 'POST', {
                ticker: item.ticker,
                data: processResult.data
            });

            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Save failed');
            }

            // Success!
            item.status = 'completed';
            addLog('success', `Saved to ${saveResult.file}`, item.ticker);

        } catch (error) {
            item.status = 'failed';
            item.lastError = error.message;
            addLog('error', error.message, item.ticker);
        }

        updateStats(getStats());
        updateProgress();

        // Small delay between items
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

function getStats() {
    return {
        total: state.queue.length,
        pending: state.queue.filter(q => q.status === 'pending').length,
        processing: state.queue.filter(q => q.status === 'processing').length,
        completed: state.queue.filter(q => q.status === 'completed').length,
        failed: state.queue.filter(q => q.status === 'failed').length
    };
}

// Settings
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function loadSettings() {
    try {
        const result = await apiCall('config', 'GET');
        if (result.success && result.config) {
            const config = result.config;

            // Populate form
            if (config.kpiCriteria) {
                document.getElementById('kpi_products_min').value = config.kpiCriteria.products?.minCount || 4;
                document.getElementById('kpi_products_words').value = config.kpiCriteria.products?.minDescriptionWords || 30;
                document.getElementById('kpi_highlights_min').value = config.kpiCriteria.highlights?.minCount || 8;
                document.getElementById('kpi_highlights_tier1').value = config.kpiCriteria.highlights?.minTier1Sources || 4;
                document.getElementById('kpi_highlights_blog').value = config.kpiCriteria.highlights?.maxCompanyBlog || 2;
                document.getElementById('kpi_leadership_min').value = config.kpiCriteria.leadership?.minCount || 4;
                document.getElementById('kpi_leadership_photos').checked = config.kpiCriteria.leadership?.requirePhotos !== false;
                document.getElementById('kpi_charts_min').value = config.kpiCriteria.charts?.minCount || 3;
            }

            if (config.settings) {
                document.getElementById('setting_retries').value = config.settings.maxRetries || 3;
                document.getElementById('setting_skip').checked = config.settings.skipOnFailure || false;
            }
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

async function saveSettings() {
    const config = {
        kpiCriteria: {
            products: {
                minCount: parseInt(document.getElementById('kpi_products_min').value),
                minDescriptionWords: parseInt(document.getElementById('kpi_products_words').value)
            },
            highlights: {
                minCount: parseInt(document.getElementById('kpi_highlights_min').value),
                minTier1Sources: parseInt(document.getElementById('kpi_highlights_tier1').value),
                maxCompanyBlog: parseInt(document.getElementById('kpi_highlights_blog').value)
            },
            leadership: {
                minCount: parseInt(document.getElementById('kpi_leadership_min').value),
                requirePhotos: document.getElementById('kpi_leadership_photos').checked
            },
            charts: {
                minCount: parseInt(document.getElementById('kpi_charts_min').value)
            }
        },
        settings: {
            maxRetries: parseInt(document.getElementById('setting_retries').value),
            skipOnFailure: document.getElementById('setting_skip').checked
        }
    };

    try {
        const result = await apiCall('config', 'POST', config);
        if (result.success) {
            addLog('success', 'Settings saved');
            toggleSettings();
        } else {
            addLog('error', `Failed to save settings: ${result.error}`);
        }
    } catch (error) {
        addLog('error', `Error saving settings: ${error.message}`);
    }
}

function resetSettings() {
    document.getElementById('kpi_products_min').value = 4;
    document.getElementById('kpi_products_words').value = 30;
    document.getElementById('kpi_highlights_min').value = 8;
    document.getElementById('kpi_highlights_tier1').value = 4;
    document.getElementById('kpi_highlights_blog').value = 2;
    document.getElementById('kpi_leadership_min').value = 4;
    document.getElementById('kpi_leadership_photos').checked = true;
    document.getElementById('kpi_charts_min').value = 3;
    document.getElementById('setting_retries').value = 3;
    document.getElementById('setting_skip').checked = false;
}

function clearLogs() {
    state.logs = [];
    renderLogs();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateFilterValue();
    renderLogs();
    renderResults();
});
