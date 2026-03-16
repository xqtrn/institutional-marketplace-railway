(function() {
    'use strict';

    const API = '/api/newsletters';
    let currentCampaignId = null;
    let subscribersPage = 1;
    let searchTimeout = null;

    // ========================================
    // INIT
    // ========================================
    async function init() {
        await loadCampaigns();
        loadSubscriberCounts();
    }

    // ========================================
    // AUTH HELPERS
    // ========================================
    function getAuthHeaders() {
        const session = getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (session ? session.email : '')
        };
    }

    // ========================================
    // TABS
    // ========================================
    window.switchTab = function(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');

        if (tab === 'campaigns') loadCampaigns();
        if (tab === 'subscribers') { loadSubscribers(); loadSubscriberCounts(); }
        if (tab === 'compose') updatePreview();
    };

    // ========================================
    // CAMPAIGNS
    // ========================================
    window.loadCampaigns = async function() {
        try {
            const status = document.getElementById('campaignStatusFilter').value;
            const url = status ? `${API}/campaigns?status=${status}` : `${API}/campaigns`;

            const resp = await fetch(url, { headers: getAuthHeaders() });
            const data = await resp.json();

            const campaigns = data.campaigns || [];
            const tbody = document.getElementById('campaignsBody');
            const empty = document.getElementById('campaignsEmpty');
            const table = document.getElementById('campaignsTable');

            if (campaigns.length === 0) {
                table.style.display = 'none';
                empty.style.display = 'block';
                return;
            }

            table.style.display = '';
            empty.style.display = 'none';

            tbody.innerHTML = campaigns.map(c => {
                const openRate = c.total_sent > 0 ? ((c.total_opened / c.total_sent) * 100).toFixed(1) : '0.0';
                const clickRate = c.total_sent > 0 ? ((c.total_clicked / c.total_sent) * 100).toFixed(1) : '0.0';
                const date = c.sent_at ? new Date(c.sent_at).toLocaleDateString() : new Date(c.created_at).toLocaleDateString();

                return `<tr>
                    <td class="subject-cell" onclick="editCampaign(${c.id})">${escapeHtml(c.subject)}</td>
                    <td><span class="badge badge-${c.status}">${c.status}</span></td>
                    <td>${c.total_recipients.toLocaleString()}</td>
                    <td>${c.total_sent.toLocaleString()}</td>
                    <td>${openRate}%</td>
                    <td>${clickRate}%</td>
                    <td>${date}</td>
                    <td class="actions-cell">
                        ${c.status === 'draft' ? `<button class="action-btn" onclick="editCampaign(${c.id})" title="Edit">&#9998;</button>` : ''}
                        <button class="action-btn" onclick="showStats(${c.id})" title="Stats">&#128202;</button>
                        <button class="action-btn" onclick="duplicateCampaign(${c.id})" title="Duplicate">&#128203;</button>
                        ${c.status !== 'sending' ? `<button class="action-btn" onclick="deleteCampaign(${c.id})" title="Delete" style="color:var(--platform-danger)">&#128465;</button>` : ''}
                    </td>
                </tr>`;
            }).join('');
        } catch (err) {
            showToast('Failed to load campaigns: ' + err.message, 'error');
        }
    };

    window.filterCampaigns = function() {
        const search = document.getElementById('campaignSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#campaignsBody tr');
        rows.forEach(row => {
            const subject = row.cells[0].textContent.toLowerCase();
            row.style.display = subject.includes(search) ? '' : 'none';
        });
    };

    // ========================================
    // COMPOSE
    // ========================================
    window.resetCompose = function() {
        currentCampaignId = null;
        document.getElementById('composeSubject').value = '';
        document.getElementById('composePreview').value = '';
        document.getElementById('composeHtml').value = '';
        document.getElementById('composeFromName').value = 'Silicon Valley Investclub';
        document.getElementById('composeFromEmail').value = 'siliconvalleyinvestclub@mail.siliconvalleyinvestclub.com';
        document.getElementById('composeTitle').textContent = 'New Campaign';
        document.getElementById('composeStatus').textContent = 'Draft';
        document.getElementById('composeStatus').className = 'badge badge-draft';
        updatePreview();
    };

    window.editCampaign = async function(id) {
        try {
            const resp = await fetch(`${API}/campaigns/${id}`, { headers: getAuthHeaders() });
            const data = await resp.json();
            const c = data.campaign;

            currentCampaignId = c.id;
            document.getElementById('composeSubject').value = c.subject || '';
            document.getElementById('composePreview').value = c.preview_text || '';
            document.getElementById('composeHtml').value = c.html_content || '';
            document.getElementById('composeFromName').value = c.from_name || 'Silicon Valley Investclub';
            document.getElementById('composeFromEmail').value = c.from_email || '';
            document.getElementById('composeTitle').textContent = c.subject || 'Edit Campaign';
            document.getElementById('composeStatus').textContent = c.status;
            document.getElementById('composeStatus').className = `badge badge-${c.status}`;

            switchTab('compose');
            updatePreview();
        } catch (err) {
            showToast('Failed to load campaign: ' + err.message, 'error');
        }
    };

    window.updatePreview = function() {
        const html = document.getElementById('composeHtml').value;
        const frame = document.getElementById('previewFrame');
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open();
        doc.write(html || '<div style="padding:40px;text-align:center;color:#999;font-family:sans-serif;">Paste HTML content to see preview</div>');
        doc.close();
    };

    // Auto-update preview on content change (debounced)
    document.getElementById('composeHtml').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(updatePreview, 500);
    });

    window.saveDraft = async function() {
        const subject = document.getElementById('composeSubject').value.trim();
        const preview_text = document.getElementById('composePreview').value.trim();
        const html_content = document.getElementById('composeHtml').value;
        const from_name = document.getElementById('composeFromName').value.trim();
        const from_email = document.getElementById('composeFromEmail').value.trim();

        if (!subject) {
            showToast('Subject is required', 'error');
            return;
        }

        try {
            const body = { subject, preview_text, html_content, from_name, from_email };

            if (currentCampaignId) {
                // Update existing
                const resp = await fetch(`${API}/campaigns/${currentCampaignId}`, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(body)
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error);
                showToast('Campaign updated');
            } else {
                // Create new
                const resp = await fetch(`${API}/campaigns`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(body)
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error);
                currentCampaignId = data.campaign.id;
                document.getElementById('composeTitle').textContent = subject;
                showToast('Campaign saved as draft');
            }
        } catch (err) {
            showToast('Save failed: ' + err.message, 'error');
        }
    };

    window.sendTestEmail = async function() {
        if (!currentCampaignId) {
            await saveDraft();
            if (!currentCampaignId) return;
        }

        const email = prompt('Enter test email address:');
        if (!email) return;

        try {
            const resp = await fetch(`${API}/campaigns/${currentCampaignId}/test`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            showToast(`Test email sent to ${email}`);
        } catch (err) {
            showToast('Test send failed: ' + err.message, 'error');
        }
    };

    window.sendCampaign = async function() {
        if (!currentCampaignId) {
            await saveDraft();
            if (!currentCampaignId) return;
        }

        // Get subscriber count
        try {
            const resp = await fetch(`${API}/subscribers/count`, { headers: getAuthHeaders() });
            const counts = await resp.json();

            document.getElementById('confirmSubject').textContent = document.getElementById('composeSubject').value;
            document.getElementById('confirmFrom').textContent = document.getElementById('composeFromEmail').value;
            document.getElementById('confirmRecipients').textContent = counts.active || 0;

            document.getElementById('sendConfirmModal').classList.add('active');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    };

    window.confirmSend = async function() {
        closeModal('sendConfirmModal');

        try {
            // Save latest content first
            await saveDraft();

            const resp = await fetch(`${API}/campaigns/${currentCampaignId}/send`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);

            showToast(`Sending started to ${data.total} recipients`);
            document.getElementById('composeStatus').textContent = 'sending';
            document.getElementById('composeStatus').className = 'badge badge-sending';

            // Poll for progress
            pollSendProgress(currentCampaignId);
        } catch (err) {
            showToast('Send failed: ' + err.message, 'error');
        }
    };

    async function pollSendProgress(id) {
        const interval = setInterval(async () => {
            try {
                const resp = await fetch(`${API}/campaigns/${id}`, { headers: getAuthHeaders() });
                const data = await resp.json();
                const c = data.campaign;

                if (c.status === 'sent' || c.status === 'failed') {
                    clearInterval(interval);
                    document.getElementById('composeStatus').textContent = c.status;
                    document.getElementById('composeStatus').className = `badge badge-${c.status}`;
                    showToast(c.status === 'sent'
                        ? `Campaign sent: ${c.total_sent} delivered, ${c.total_failed} failed`
                        : 'Campaign failed');
                }
            } catch (e) {
                clearInterval(interval);
            }
        }, 3000);
    }

    window.duplicateCampaign = async function(id) {
        try {
            const resp = await fetch(`${API}/campaigns/${id}`, { headers: getAuthHeaders() });
            const data = await resp.json();
            const c = data.campaign;

            const createResp = await fetch(`${API}/campaigns`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    subject: `${c.subject} (copy)`,
                    preview_text: c.preview_text,
                    html_content: c.html_content,
                    from_name: c.from_name,
                    from_email: c.from_email
                })
            });
            const createData = await createResp.json();
            if (!createResp.ok) throw new Error(createData.error);

            showToast('Campaign duplicated');
            loadCampaigns();
        } catch (err) {
            showToast('Duplicate failed: ' + err.message, 'error');
        }
    };

    window.deleteCampaign = async function(id) {
        if (!confirm('Delete this campaign?')) return;

        try {
            const resp = await fetch(`${API}/campaigns/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.error);
            }
            showToast('Campaign deleted');
            loadCampaigns();
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    };

    window.showStats = async function(id) {
        try {
            const resp = await fetch(`${API}/campaigns/${id}`, { headers: getAuthHeaders() });
            const data = await resp.json();
            const c = data.campaign;
            const s = data.stats;

            document.getElementById('statsTitle').textContent = c.subject;

            const total = parseInt(s.total) || 0;
            const sent = parseInt(s.sent) || 0;
            const opened = parseInt(s.opened) || 0;
            const clicked = parseInt(s.clicked) || 0;
            const failed = parseInt(s.failed) || 0;

            const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0';
            const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0';

            document.getElementById('statsGrid').innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${total.toLocaleString()}</div>
                    <div class="stat-label">Recipients</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${sent.toLocaleString()}</div>
                    <div class="stat-label">Delivered</div>
                    <div class="stat-percent">${total > 0 ? ((sent / total) * 100).toFixed(1) : 0}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${opened.toLocaleString()}</div>
                    <div class="stat-label">Opened</div>
                    <div class="stat-percent">${openRate}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${clicked.toLocaleString()}</div>
                    <div class="stat-label">Clicked</div>
                    <div class="stat-percent">${clickRate}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${failed.toLocaleString()}</div>
                    <div class="stat-label">Failed</div>
                    <div class="stat-percent" style="color:var(--platform-danger)">${total > 0 ? ((failed / total) * 100).toFixed(1) : 0}%</div>
                </div>
            `;

            // Show progress if sending
            const progress = document.getElementById('statsProgress');
            if (c.status === 'sending') {
                progress.style.display = 'block';
                const pct = total > 0 ? ((sent + failed) / total) * 100 : 0;
                document.getElementById('statsProgressFill').style.width = pct + '%';
            } else {
                progress.style.display = 'none';
            }

            document.getElementById('statsModal').classList.add('active');
        } catch (err) {
            showToast('Failed to load stats: ' + err.message, 'error');
        }
    };

    // ========================================
    // SUBSCRIBERS
    // ========================================
    window.loadSubscribers = async function(page) {
        subscribersPage = page || 1;
        const status = document.getElementById('subscriberStatusFilter').value;
        const search = document.getElementById('subscriberSearch').value.trim();

        let url = `${API}/subscribers?page=${subscribersPage}&limit=100`;
        if (status) url += `&status=${status}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        try {
            const resp = await fetch(url, { headers: getAuthHeaders() });
            const data = await resp.json();

            const subs = data.subscribers || [];
            const tbody = document.getElementById('subscribersBody');
            const empty = document.getElementById('subscribersEmpty');
            const table = document.getElementById('subscribersTable');

            if (subs.length === 0 && subscribersPage === 1) {
                table.style.display = 'none';
                empty.style.display = 'block';
            } else {
                table.style.display = '';
                empty.style.display = 'none';
            }

            tbody.innerHTML = subs.map(s => {
                const tags = (s.tags || []).map(t => `<span style="background:#e0e7ff;color:#3730a3;padding:1px 6px;border-radius:4px;font-size:11px;">${escapeHtml(t)}</span>`).join(' ');
                const date = new Date(s.created_at).toLocaleDateString();

                return `<tr>
                    <td style="font-weight:500;">${escapeHtml(s.email)}</td>
                    <td>${escapeHtml(s.name || '-')}</td>
                    <td><span class="badge badge-${s.status}">${s.status}</span></td>
                    <td>${s.source}</td>
                    <td>${tags || '-'}</td>
                    <td>${date}</td>
                    <td>
                        <button class="action-btn" onclick="deleteSubscriber(${s.id})" style="color:var(--platform-danger)" title="Delete">&#128465;</button>
                    </td>
                </tr>`;
            }).join('');

            // Pagination
            renderPagination(data.pages, data.page);
        } catch (err) {
            showToast('Failed to load subscribers: ' + err.message, 'error');
        }
    };

    window.loadSubscriberCounts = async function() {
        try {
            const resp = await fetch(`${API}/subscribers/count`, { headers: getAuthHeaders() });
            const counts = await resp.json();

            document.getElementById('subscriberCounts').innerHTML = `
                <div class="count-chip">Total: <span class="count">${parseInt(counts.total || 0).toLocaleString()}</span></div>
                <div class="count-chip">Active: <span class="count" style="color:var(--platform-success)">${parseInt(counts.active || 0).toLocaleString()}</span></div>
                <div class="count-chip">Unsubscribed: <span class="count" style="color:var(--platform-muted)">${parseInt(counts.unsubscribed || 0).toLocaleString()}</span></div>
                <div class="count-chip">Bounced: <span class="count" style="color:var(--platform-danger)">${parseInt(counts.bounced || 0).toLocaleString()}</span></div>
            `;
        } catch (e) {}
    };

    window.searchSubscribers = function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadSubscribers(1), 300);
    };

    function renderPagination(totalPages, currentPage) {
        const container = document.getElementById('subscribersPagination');
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `<button ${currentPage <= 1 ? 'disabled' : ''} onclick="loadSubscribers(${currentPage - 1})">Prev</button>`;

        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="loadSubscribers(${i})">${i}</button>`;
        }

        if (totalPages > 10) {
            html += `<span>... ${totalPages}</span>`;
        }

        html += `<button ${currentPage >= totalPages ? 'disabled' : ''} onclick="loadSubscribers(${currentPage + 1})">Next</button>`;
        container.innerHTML = html;
    }

    window.showAddSubscriberModal = function() {
        document.getElementById('newSubEmail').value = '';
        document.getElementById('newSubName').value = '';
        document.getElementById('addSubscriberModal').classList.add('active');
    };

    window.addSubscriber = async function() {
        const email = document.getElementById('newSubEmail').value.trim();
        const name = document.getElementById('newSubName').value.trim();

        if (!email) {
            showToast('Email is required', 'error');
            return;
        }

        try {
            const resp = await fetch(`${API}/subscribers`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email, name })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);

            closeModal('addSubscriberModal');
            showToast('Subscriber added');
            loadSubscribers();
            loadSubscriberCounts();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    };

    window.showImportCSVModal = function() {
        document.getElementById('csvData').value = '';
        document.getElementById('csvFile').value = '';
        document.getElementById('importCSVModal').classList.add('active');
    };

    window.handleCSVFile = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('csvData').value = e.target.result;
        };
        reader.readAsText(file);
    };

    window.importCSV = async function() {
        const csv = document.getElementById('csvData').value.trim();
        if (!csv) {
            showToast('No CSV data', 'error');
            return;
        }

        try {
            const resp = await fetch(`${API}/subscribers/import-csv`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ csv })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);

            closeModal('importCSVModal');
            showToast(`Imported: ${data.imported}, Skipped: ${data.skipped}`);
            loadSubscribers();
            loadSubscriberCounts();
        } catch (err) {
            showToast('Import failed: ' + err.message, 'error');
        }
    };

    window.importFromBeehiiv = async function() {
        if (!confirm('Import all active subscribers from Beehiiv? This may take a few minutes for large lists.')) return;

        try {
            const resp = await fetch(`${API}/subscribers/import-beehiiv`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);

            showToast('Beehiiv import started in background');

            // Poll subscriber count
            const pollInterval = setInterval(async () => {
                await loadSubscriberCounts();
            }, 5000);

            setTimeout(() => clearInterval(pollInterval), 300000); // stop after 5 min
        } catch (err) {
            showToast('Beehiiv import failed: ' + err.message, 'error');
        }
    };

    window.deleteSubscriber = async function(id) {
        if (!confirm('Delete this subscriber?')) return;

        try {
            const resp = await fetch(`${API}/subscribers/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!resp.ok) throw new Error('Delete failed');

            showToast('Subscriber deleted');
            loadSubscribers(subscribersPage);
            loadSubscriberCounts();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // ========================================
    // UTILS
    // ========================================
    window.closeModal = function(id) {
        document.getElementById(id).classList.remove('active');
    };

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // ========================================
    // INIT
    // ========================================
    init();

})();
