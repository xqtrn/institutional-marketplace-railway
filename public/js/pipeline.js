// Pipeline Kanban Board - Deal Management
// Professional CRM-style pipeline like HubSpot/Salesforce

(function() {
    'use strict';

    // Configuration
    const API_URL = '/api/pipeline';
    const API_KEY = 'investclub-admin-secure-key-2024';
    const LOGOS_URL = '/api/logos.json';

    // Pipeline Stages
    const STAGES = [
        { id: 'new_lead', name: 'New Lead', color: '#3b82f6' },
        { id: 'qualifying', name: 'Qualifying', color: '#06b6d4' },
        { id: 'proposal', name: 'Proposal', color: '#f59e0b' },
        { id: 'negotiation', name: 'Negotiation', color: '#f97316' },
        { id: 'due_diligence', name: 'Due Diligence', color: '#8b5cf6' },
        { id: 'closing', name: 'Closing', color: '#10b981' },
        { id: 'won', name: 'Won', color: '#059669' },
        { id: 'lost', name: 'Lost', color: '#ef4444' }
    ];

    // State
    let state = {
        deals: [],
        logos: {},
        draggedDeal: null,
        loading: true
    };

    // Initialize
    async function init() {
        try {
            await Promise.all([
                loadDeals(),
                loadLogos()
            ]);
            renderBoard();
            setupDragAndDrop();
            setupEventListeners();
            updateStats();
        } catch (error) {
            console.error('Initialization error:', error);
            showToast('Failed to load pipeline', 'error');
        }
    }

    // Load deals from API
    async function loadDeals() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to fetch deals');
            state.deals = await response.json();
            state.loading = false;
        } catch (error) {
            console.error('Error loading deals:', error);
            state.deals = [];
            state.loading = false;
        }
    }

    // Load company logos
    async function loadLogos() {
        try {
            const response = await fetch(LOGOS_URL);
            if (response.ok) {
                state.logos = await response.json();
            }
        } catch (error) {
            console.log('Logos not available');
        }
    }

    // Max cards to show per column initially
    const MAX_CARDS_PER_COLUMN = 25;
    const expandedColumns = {};

    // Render the entire board
    function renderBoard() {
        STAGES.forEach(stage => {
            const column = document.querySelector(`[data-stage="${stage.id}"]`);
            if (!column) return;

            const cardsContainer = column.querySelector('.column-cards');
            const stageDeals = state.deals.filter(d => d.stage === stage.id);

            // Update count and value
            const count = stageDeals.length;
            const value = stageDeals.reduce((sum, d) => sum + (parseFloat(d.volume) || 0), 0);

            column.querySelector('[data-count]').textContent = count;
            column.querySelector('[data-value]').textContent = formatCurrency(value) || '$0';

            // Render cards
            if (stageDeals.length === 0) {
                cardsContainer.innerHTML = `
                    <div class="column-empty">
                        <div class="column-empty-icon">📋</div>
                        <div class="column-empty-text">No deals</div>
                    </div>
                `;
            } else {
                const isExpanded = expandedColumns[stage.id];
                const visibleDeals = isExpanded ? stageDeals : stageDeals.slice(0, MAX_CARDS_PER_COLUMN);
                const hiddenCount = stageDeals.length - MAX_CARDS_PER_COLUMN;

                let html = visibleDeals.map(deal => renderDealCard(deal)).join('');

                if (hiddenCount > 0 && !isExpanded) {
                    html += `
                        <button class="show-more-btn" onclick="expandColumn('${stage.id}')">
                            Show ${hiddenCount} more deals
                        </button>
                    `;
                } else if (isExpanded && stageDeals.length > MAX_CARDS_PER_COLUMN) {
                    html += `
                        <button class="show-more-btn" onclick="collapseColumn('${stage.id}')">
                            Show less
                        </button>
                    `;
                }

                cardsContainer.innerHTML = html;
            }
        });
    }

    // Column expand/collapse
    window.expandColumn = function(stageId) {
        expandedColumns[stageId] = true;
        renderBoard();
    };

    window.collapseColumn = function(stageId) {
        expandedColumns[stageId] = false;
        renderBoard();
    };

    // Render a single deal card
    function renderDealCard(deal) {
        try {
            const logo = findLogo(deal.company);
            const initials = getInitials(deal.partner);
            const timeAgo = getTimeAgo(deal.updatedAt);
            const probability = deal.probability || 20;
            const probabilityClass = probability >= 70 ? 'high' : (probability >= 40 ? 'medium' : 'low');
            const dealType = deal.dealType || 'buy';
            const companyName = deal.company || 'Unknown Company';
            const volumeDisplay = formatCurrency(deal.volume);

            return `
                <div class="deal-card"
                     data-deal-id="${deal.id}"
                     draggable="true"
                     onclick="openDealPanel('${deal.id}')">
                    <div class="deal-card-header">
                        ${logo ?
                            `<img src="${logo}" class="deal-company-logo" alt="${companyName}" onerror="this.style.display='none'">` :
                            `<div class="deal-company-logo" style="display:flex;align-items:center;justify-content:center;font-weight:600;color:#64748b;">${companyName.charAt(0)}</div>`
                        }
                        <div class="deal-company-info">
                            <div class="deal-company-name">${escapeHtml(companyName)}</div>
                            <span class="deal-type-badge ${dealType}">${dealType.toUpperCase()}</span>
                            ${volumeDisplay ? `<span style="margin-left:8px;font-size:13px;font-weight:600;color:#1e293b;">${volumeDisplay}</span>` : ''}
                        </div>
                    </div>
                    <div class="deal-details">
                        ${deal.price ? `
                        <div class="deal-detail-row">
                            <span class="deal-detail-label">Price</span>
                            <span class="deal-detail-value">$${formatNumber(deal.price)}/share</span>
                        </div>` : ''}
                        ${deal.valuation ? `
                        <div class="deal-detail-row">
                            <span class="deal-detail-label">Valuation</span>
                            <span class="deal-detail-value">${formatValuation(deal.valuation)}</span>
                        </div>` : ''}
                        <div class="deal-detail-row">
                            <span class="deal-detail-label">Structure</span>
                            <span class="deal-detail-value">${deal.structure || 'Direct Trade'}</span>
                        </div>
                    </div>
                    <div class="deal-footer">
                        <div class="deal-partner">
                            <div class="deal-partner-avatar">${initials}</div>
                            <span>${escapeHtml(deal.partner || 'Unknown')}</span>
                        </div>
                        <div class="deal-activity">
                            <span class="deal-time">🕐 ${timeAgo}</span>
                        </div>
                    </div>
                    <div class="deal-probability">
                        <div class="probability-bar">
                            <div class="probability-fill ${probabilityClass}" style="width: ${probability}%"></div>
                        </div>
                        <div class="probability-label">${probability}% probability</div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering deal card:', error, deal);
            return `<div class="deal-card" style="padding:12px;color:#ef4444;">Error loading deal</div>`;
        }
    }

    // Setup drag and drop
    function setupDragAndDrop() {
        const columns = document.querySelectorAll('.pipeline-column');

        // Column events
        columns.forEach(column => {
            column.addEventListener('dragover', handleDragOver);
            column.addEventListener('drop', handleDrop);
            column.addEventListener('dragenter', handleDragEnter);
            column.addEventListener('dragleave', handleDragLeave);
        });

        // Card events (delegated)
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('dragend', handleDragEnd);
    }

    function handleDragStart(e) {
        if (!e.target.classList.contains('deal-card')) return;

        state.draggedDeal = e.target.dataset.dealId;
        e.target.classList.add('dragging');

        // Set drag data
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', state.draggedDeal);

        // Highlight drop zones
        document.querySelectorAll('.pipeline-column').forEach(col => {
            col.classList.add('drop-target');
        });
    }

    function handleDragEnd(e) {
        if (!e.target.classList.contains('deal-card')) return;

        e.target.classList.remove('dragging');
        state.draggedDeal = null;

        // Remove highlights
        document.querySelectorAll('.pipeline-column').forEach(col => {
            col.classList.remove('drop-target', 'drag-over');
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        const column = e.target.closest('.pipeline-column');
        if (column) {
            column.classList.add('drag-over');
        }
    }

    function handleDragLeave(e) {
        const column = e.target.closest('.pipeline-column');
        if (column && !column.contains(e.relatedTarget)) {
            column.classList.remove('drag-over');
        }
    }

    async function handleDrop(e) {
        e.preventDefault();

        const column = e.target.closest('.pipeline-column');
        if (!column) return;

        const dealId = e.dataTransfer.getData('text/plain');
        const newStage = column.dataset.stage;

        // Find the deal
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal || deal.stage === newStage) return;

        const oldStage = deal.stage;

        // Optimistic update
        deal.stage = newStage;
        deal.updatedAt = new Date().toISOString();
        renderBoard();
        updateStats();

        // Update via API
        try {
            const response = await fetch(`${API_URL}/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify({
                    stage: newStage
                })
            });

            if (!response.ok) throw new Error('Failed to update deal');

            const result = await response.json();
            showToast(`Moved to ${getStageLabel(newStage)}`, 'success');
        } catch (error) {
            console.error('Error updating deal:', error);
            // Revert
            deal.stage = oldStage;
            renderBoard();
            showToast('Failed to update deal', 'error');
        }
    }

    // Event listeners
    function setupEventListeners() {
        // Deal type selector in modal
        document.querySelectorAll('.deal-type-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.deal-type-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                this.querySelector('input').checked = true;
            });
        });
    }

    // Update stats
    function updateStats() {
        const totalDeals = state.deals.length;
        const pipelineValue = state.deals
            .filter(d => !['won', 'lost'].includes(d.stage))
            .reduce((sum, d) => sum + (d.volume || 0), 0);

        const wonDeals = state.deals.filter(d => d.stage === 'won').length;
        const closedDeals = state.deals.filter(d => ['won', 'lost'].includes(d.stage)).length;
        const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;

        document.getElementById('statTotalDeals').textContent = totalDeals;
        document.getElementById('statPipelineValue').textContent = formatCurrency(pipelineValue);
        document.getElementById('statWinRate').textContent = winRate + '%';
    }

    // Modal functions
    window.openAddDealModal = function() {
        document.getElementById('addDealModal').classList.add('active');
        document.getElementById('inputCompany').focus();
    };

    window.closeAddDealModal = function() {
        document.getElementById('addDealModal').classList.remove('active');
        clearForm();
    };

    function clearForm() {
        document.getElementById('inputCompany').value = '';
        document.getElementById('inputVolume').value = '';
        document.getElementById('inputPrice').value = '';
        document.getElementById('inputValuation').value = '';
        document.getElementById('inputProbability').value = '20';
        document.getElementById('inputStructure').value = 'Direct Trade';
        document.getElementById('inputShareClass').value = 'Common';
        document.getElementById('inputPartner').value = '';
        document.getElementById('inputPartnerEmail').value = '';
        document.getElementById('inputNotes').value = '';
    }

    window.saveDeal = async function() {
        const company = document.getElementById('inputCompany').value.trim();
        const partner = document.getElementById('inputPartner').value.trim();

        if (!company) {
            showToast('Company is required', 'error');
            return;
        }
        if (!partner) {
            showToast('Partner name is required', 'error');
            return;
        }

        const dealType = document.querySelector('input[name="dealType"]:checked').value;

        const dealData = {
            company,
            dealType,
            volume: parseFloat(document.getElementById('inputVolume').value) || null,
            price: parseFloat(document.getElementById('inputPrice').value) || null,
            valuation: parseFloat(document.getElementById('inputValuation').value) * 1e9 || null,
            probability: parseInt(document.getElementById('inputProbability').value) || 20,
            structure: document.getElementById('inputStructure').value,
            shareClass: document.getElementById('inputShareClass').value,
            partner,
            partnerEmail: document.getElementById('inputPartnerEmail').value.trim(),
            notes: document.getElementById('inputNotes').value.trim(),
            stage: 'new_lead',
            source: 'manual'
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify(dealData)
            });

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    showToast('Deal already exists', 'error');
                } else {
                    throw new Error(result.error || 'Failed to create deal');
                }
                return;
            }

            state.deals.push(result.deal);
            renderBoard();
            updateStats();
            closeAddDealModal();
            showToast('Deal added successfully', 'success');
        } catch (error) {
            console.error('Error creating deal:', error);
            showToast('Failed to create deal', 'error');
        }
    };

    // Deal panel
    window.openDealPanel = async function(dealId) {
        const deal = state.deals.find(d => d.id === dealId);
        if (!deal) return;

        document.getElementById('panelCompanyName').textContent = deal.company;
        document.getElementById('dealPanelOverlay').classList.add('active');
        document.getElementById('dealPanel').classList.add('active');

        // Fetch deal with history
        try {
            const response = await fetch(`${API_URL}/${dealId}`);
            const data = await response.json();

            renderDealPanel(data.deal, data.history || []);
        } catch (error) {
            renderDealPanel(deal, []);
        }
    };

    window.closeDealPanel = function() {
        document.getElementById('dealPanelOverlay').classList.remove('active');
        document.getElementById('dealPanel').classList.remove('active');
    };

    function renderDealPanel(deal, history) {
        const stageInfo = STAGES.find(s => s.id === deal.stage);

        const html = `
            <div style="margin-bottom: 24px;">
                <span class="deal-type-badge ${deal.dealType}" style="font-size: 13px; padding: 4px 12px;">
                    ${deal.dealType.toUpperCase()} ORDER
                </span>
                <div style="display: inline-block; margin-left: 12px; padding: 4px 12px; background: ${stageInfo?.color}20; color: ${stageInfo?.color}; border-radius: 4px; font-size: 12px; font-weight: 600;">
                    ${stageInfo?.name || deal.stage}
                </div>
            </div>

            <div style="display: grid; gap: 16px; margin-bottom: 24px;">
                <div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Volume</div>
                    <div style="font-size: 18px; font-weight: 600; color: #1e293b;">${deal.volume ? formatCurrency(deal.volume) : 'Not specified'}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Price/Share</div>
                        <div style="font-size: 16px; font-weight: 500;">${deal.price ? '$' + formatNumber(deal.price) : 'Request'}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Valuation</div>
                        <div style="font-size: 16px; font-weight: 500;">${deal.valuation ? formatValuation(deal.valuation) : 'Request'}</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Structure</div>
                        <div style="font-size: 14px;">${deal.structure || 'Direct Trade'}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Share Class</div>
                        <div style="font-size: 14px;">${deal.shareClass || 'Common'}</div>
                    </div>
                </div>
            </div>

            <div style="padding: 16px; background: #f8fafc; border-radius: 8px; margin-bottom: 24px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Partner</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="deal-partner-avatar">${getInitials(deal.partner)}</div>
                    <div>
                        <div style="font-weight: 500; color: #1e293b;">${escapeHtml(deal.partner || 'Unknown')}</div>
                        ${deal.partnerEmail ? `<div style="font-size: 13px; color: #64748b;">${escapeHtml(deal.partnerEmail)}</div>` : ''}
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Probability</div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="probability-bar" style="flex: 1; height: 8px;">
                        <div class="probability-fill ${deal.probability >= 70 ? 'high' : (deal.probability >= 40 ? 'medium' : 'low')}" style="width: ${deal.probability || 20}%"></div>
                    </div>
                    <span style="font-weight: 600; color: #1e293b;">${deal.probability || 20}%</span>
                </div>
            </div>

            ${deal.notes ? `
            <div style="margin-bottom: 24px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Notes</div>
                <div style="font-size: 14px; color: #475569; line-height: 1.5;">${escapeHtml(deal.notes)}</div>
            </div>
            ` : ''}

            <div style="margin-bottom: 16px;">
                <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 12px;">Activity History</div>
                <div class="history-timeline">
                    ${history.length === 0 ? '<div style="color: #94a3b8; font-size: 13px;">No activity yet</div>' :
                      history.map(h => renderHistoryItem(h)).join('')}
                </div>
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">
                <div style="font-size: 11px; color: #94a3b8;">
                    Created: ${formatDate(deal.createdAt)}<br>
                    Last updated: ${formatDate(deal.updatedAt)}<br>
                    Source: ${deal.source === 'mailai' ? 'MailAI (auto)' : 'Manual'}
                </div>
            </div>
        `;

        document.getElementById('panelBody').innerHTML = html;
    }

    function renderHistoryItem(entry) {
        let icon = '📝';
        let text = '';

        if (entry.action === 'created') {
            icon = '✨';
            text = 'Deal created';
        } else if (entry.action === 'stage_change') {
            icon = '🔄';
            const fromLabel = getStageLabel(entry.fromStage);
            const toLabel = getStageLabel(entry.toStage);
            text = `Moved from <strong>${fromLabel}</strong> to <strong>${toLabel}</strong>`;
        } else if (entry.action === 'updated') {
            text = `Updated ${entry.field}`;
        }

        return `
            <div class="history-item">
                <div class="history-icon">${icon}</div>
                <div class="history-content">
                    <div class="history-text">${text}</div>
                    <div class="history-time">${formatDate(entry.timestamp)} ${entry.trigger === 'auto_sync' ? '(auto)' : ''}</div>
                </div>
            </div>
        `;
    }

    // Helper functions
    function findLogo(company) {
        if (!company || !state.logos) return null;
        const normalized = company.toLowerCase().replace(/\s+/g, '');
        for (const [key, url] of Object.entries(state.logos)) {
            if (key.toLowerCase().replace(/\s+/g, '') === normalized) {
                return url;
            }
        }
        return null;
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function getTimeAgo(dateStr) {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return formatDate(dateStr);
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatCurrency(value) {
        if (!value || value === 'Request' || value === 'null') return null;
        // Handle string values like "$5M" or "Request"
        if (typeof value === 'string') {
            if (value.startsWith('$')) return value;
            if (value === 'Request') return null;
            value = parseFloat(value);
        }
        if (isNaN(value) || value === 0) return null;
        if (value >= 1e9) return '$' + (value / 1e9).toFixed(1) + 'B';
        if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
        if (value >= 1e3) return '$' + (value / 1e3).toFixed(0) + 'K';
        return '$' + value.toLocaleString();
    }

    function formatNumber(value) {
        if (!value) return '0';
        return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    function formatValuation(value) {
        if (!value) return 'Request';
        if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
        if (value >= 1e9) return '$' + (value / 1e9).toFixed(0) + 'B';
        if (value >= 1e6) return '$' + (value / 1e6).toFixed(0) + 'M';
        return '$' + value.toLocaleString();
    }

    function getStageLabel(stageId) {
        const stage = STAGES.find(s => s.id === stageId);
        return stage ? stage.name : stageId;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Offcanvas functions
    window.openOffcanvas = function() {
        document.getElementById('offcanvasMenu').classList.add('active');
        document.getElementById('siteOverlay').classList.add('active');
    };

    window.closeOffcanvas = function() {
        document.getElementById('offcanvasMenu').classList.remove('active');
        document.getElementById('siteOverlay').classList.remove('active');
    };

    // Initialize on load
    document.addEventListener('DOMContentLoaded', init);
})();
