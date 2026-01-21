// Issuers Database JavaScript
(function () {
    'use strict';

    // API Configuration
    const API_BASE = '/api';
    const ISSUERS_API_URL = `${API_BASE}/issuers`;
    const UPDATE_API_URL = `${API_BASE}/issuers-update`;
    const LOGOS_API_URL = `${API_BASE}/logos.json`;
    const PROFILES_API_URL = `${API_BASE}/issuers`;
    const API_KEY = 'investclub-admin-secure-key-2024';

    // State
    let issuersData = [];
    let logosData = {};
    let profilesData = {}; // Loaded profile data from JSON API
    let filteredData = [];
    let hasUnsavedChanges = false;
    let editingIssuerId = null;
    let deleteIssuerId = null;
    let currentSort = { field: 'company', direction: 'asc' };

    // Extended profile data (stored separately for now)
    let currentEditingIssuer = null;

    // Utility function for creating URL-friendly slugs
    function slugify(text) {
        return (text || '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    // Static profile pages mapping (company name -> page URL)
    const PROFILE_PAGES = {
        'ANTHROPIC': 'Anthropic',
        'APPTRONIC': 'Apptronic',
        'ARMIS': 'Armis',
        'BASE POWER': 'Base-Power',
        'BETA TECHNOLOGIES': 'Beta-Technologies',
        'CEREBRAS': 'Cerebras',
        'CEREBRAS SYSTEMS': 'Cerebras',
        'COHERE': 'Cohere',
        'COLOSSAL BIOSCIENCES': 'Colossal-Biosciences',
        'CURSOR': 'Cursor',
        'DATABRICKS': 'Databricks',
        'DEEL': 'Deel',
        'DIVERGENT': 'Divergent-Technologies',
        'DIVERGENT TECHNOLOGIES': 'Divergent-Technologies',
        'EVENUP': 'EvenUp',
        'FIGURE': 'Figure-AI',
        'FIGURE AI': 'Figure-AI',
        'FIREWORKS AI': 'Fireworks-AI',
        'FORTERRA': 'Forterra',
        'GROQ': 'Groq',
        'HARMONIC': 'Harmonic',
        'HARVEY': 'Harvey',
        'HIPPOCRATIC AI': 'Hippocratic-AI',
        'ID.ME': 'ID.me',
        'KALSHI': 'Kalshi',
        'KRAKEN': 'Kraken',
        'LANGCHAIN': 'LangChain',
        'LUMA AI': 'Luma-AI',
        'MERCOR': 'Mercor',
        'METROPOLIS': 'Metropolis',
        'MISTRAL AI': 'Mistral-AI',
        'MONIEPOINT': 'Moniepoint',
        'NAVAN': 'Navan',
        'NETSKOPE': 'Netskope',
        'NURO': 'Nuro',
        'OPENAI': 'OpenAi',
        'OURA': 'Oura',
        'PERPLEXITY': 'Perplexity',
        'POLYMARKET': 'Polymarket',
        'POSTHOG': 'PostHog',
        'PSIQUANTUM': 'PsiQuantum',
        'QUANTUM SYSTEMS': 'Quantum-Systems',
        'RAMP': 'Ramp',
        'REDWOOD MATERIALS': 'Redwood-Materials',
        'REFLEXION AI': 'Reflexion-AI',
        'REPLIT': 'Replit',
        'REVOLUT': 'Revolut',
        'SCRIBE': 'Scribe',
        'SIERRA': 'Sierra',
        'SUPABASE': 'Supabase',
        'SYNTHESIA': 'Synthesia',
        'TIDE': 'Tide',
        'UNIPHORE': 'Uniphore',
        'VANTACA': 'Vantaca',
        'WAYVE': 'Wayve',
        'WHATNOT': 'Whatnot',
        'X-ENERGY': 'X-energy',
        'XAI': 'xAI',
        'ZEROHASH': 'Zerohash'
    };

    // Get profile page URL for a company
    function getProfilePageUrl(companyName) {
        const normalized = (companyName || '').toUpperCase().trim();
        const pageName = PROFILE_PAGES[normalized];
        return pageName ? `/issuers/${pageName}` : null;
    }

    // Extract country from HQ location
    function getCountryFromHQ(hq) {
        if (!hq) return '';
        const hqUpper = hq.toUpperCase();
        if (hqUpper.includes('CA') || hqUpper.includes('CALIFORNIA') || hqUpper.includes('NEW YORK') ||
            hqUpper.includes('TEXAS') || hqUpper.includes('VERMONT') || hqUpper.includes('COLORADO') ||
            hqUpper.includes('WASHINGTON') || hqUpper.includes('MASSACHUSETTS') || hqUpper.includes('USA') ||
            hqUpper.includes('UNITED STATES')) {
            return 'United States';
        }
        if (hqUpper.includes('UK') || hqUpper.includes('UNITED KINGDOM') || hqUpper.includes('LONDON') ||
            hqUpper.includes('ENGLAND')) {
            return 'United Kingdom';
        }
        if (hqUpper.includes('CANADA') || hqUpper.includes('TORONTO') || hqUpper.includes('ONTARIO')) {
            return 'Canada';
        }
        if (hqUpper.includes('FRANCE') || hqUpper.includes('PARIS')) {
            return 'France';
        }
        if (hqUpper.includes('GERMANY') || hqUpper.includes('BERLIN') || hqUpper.includes('MUNICH')) {
            return 'Germany';
        }
        if (hqUpper.includes('ISRAEL') || hqUpper.includes('TEL AVIV')) {
            return 'Israel';
        }
        if (hqUpper.includes('NIGERIA') || hqUpper.includes('LAGOS')) {
            return 'Nigeria';
        }
        return hq;
    }

    // Extract industry from tags
    function getIndustryFromTags(tags) {
        if (!tags || !tags.length) return '';
        const industryKeywords = {
            'AI': ['AI', 'ARTIFICIAL INTELLIGENCE', 'MACHINE LEARNING', 'LLM', 'LARGE LANGUAGE'],
            'Fintech': ['FINTECH', 'PAYMENT', 'BANKING', 'CRYPTO', 'TRADING', 'FINANCIAL'],
            'Healthcare': ['HEALTHCARE', 'HEALTH', 'MEDICAL', 'BIOTECH', 'PHARMA'],
            'Energy': ['ENERGY', 'SOLAR', 'BATTERY', 'POWER', 'ELECTRIC', 'NUCLEAR'],
            'Aerospace': ['AEROSPACE', 'AVIATION', 'EVTOL', 'FLIGHT', 'ROCKET', 'SPACE'],
            'Robotics': ['ROBOTICS', 'ROBOT', 'HUMANOID', 'AUTOMATION'],
            'Security': ['SECURITY', 'CYBER', 'CYBERSECURITY', 'DEFENSE'],
            'SaaS': ['SAAS', 'SOFTWARE', 'PLATFORM', 'ENTERPRISE'],
            'E-commerce': ['ECOMMERCE', 'E-COMMERCE', 'MARKETPLACE', 'RETAIL']
        };

        for (const tag of tags) {
            const tagUpper = tag.toUpperCase();
            for (const [industry, keywords] of Object.entries(industryKeywords)) {
                if (keywords.some(kw => tagUpper.includes(kw))) {
                    return industry;
                }
            }
        }
        return '';
    }

    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const countryFilter = document.getElementById('countryFilter');
    const industryFilter = document.getElementById('industryFilter');
    const dataContent = document.getElementById('dataContent');
    const btnSave = document.getElementById('btnSave');

    // Initialize
    async function init() {
        await loadLogos();
        await loadProfiles(); // Load enriched profile data
        await loadIssuers();
        setupEventListeners();
        renderData();
        populateFilters();
    }

    // Load all profiles from JSON API files
    async function loadProfiles() {
        const letters = '0ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        profilesData = {};

        try {
            const promises = letters.map(async (letter) => {
                try {
                    const response = await fetch(`${PROFILES_API_URL}/${letter}.json`);
                    if (response.ok) {
                        const data = await response.json();
                        Object.assign(profilesData, data);
                    }
                } catch (e) {
                    // Silently ignore missing files
                }
            });
            await Promise.all(promises);
            console.log(`Loaded ${Object.keys(profilesData).length} profiles`);
        } catch (error) {
            console.error('Failed to load profiles:', error);
        }
    }

    // Check if issuer has enriched profile (strict criteria)
    function isEnriched(companyName) {
        const ticker = (companyName || '').toUpperCase().replace(/\s+/g, '-').replace(/[.']/g, '');
        const profile = profilesData[ticker];
        if (!profile) return false;

        // 1. Check Leadership - ALL leaders must have full name AND real photo
        const leadership = profile.leadership || [];
        if (leadership.length < 2) return false;

        for (const leader of leadership) {
            const name = leader.name || '';
            const photo = leader.photo || '';
            const role = leader.role || '';

            // Check for full name (at least 2 words, not generic like "CEO")
            const nameParts = name.split(' ').filter(p => p.length > 0);
            const hasFullName = nameParts.length >= 2 && name !== role;

            // Check for real photo (not placeholder/avatar)
            const hasRealPhoto = photo && !photo.includes('ui-avatars.com') && photo.trim() !== '';

            // If ANY leader is missing full name or real photo, not enriched
            if (!hasFullName || !hasRealPhoto) {
                return false;
            }
        }

        // 2. Check Highlights - need at least 5 with clickable URLs
        const highlights = profile.highlights || [];
        let validHighlights = 0;
        for (const h of highlights) {
            if (typeof h === 'object') {
                const url = h.url || '';
                const text = h.text || '';
                // Must have real URL (not #, not empty) and meaningful text
                if (url && url !== '#' && url.length > 10 && text && text.length > 20) {
                    // Skip generic/template text
                    if (!text.includes('Leading technology company') && !text.includes('Strong market presence')) {
                        validHighlights++;
                    }
                }
            }
        }
        if (validHighlights < 5) return false;

        // 3. Check Funding Rounds - need at least 3 real rounds
        const fundingRounds = profile.funding_rounds || [];
        let validRounds = 0;
        for (const r of fundingRounds) {
            if (typeof r === 'object') {
                const date = r.date || '';
                const amount = r.amount || '';
                // Must have both date and amount
                if (date && amount && amount !== '—' && date !== '—') {
                    validRounds++;
                }
            }
        }
        if (validRounds < 3) return false;

        // All criteria met
        return true;
    }

    // Load logos data
    async function loadLogos() {
        try {
            const response = await fetch(LOGOS_API_URL);
            if (response.ok) {
                logosData = await response.json();
            }
        } catch (error) {
            console.error('Failed to load logos:', error);
            logosData = {};
        }
    }

    // Load issuers data
    async function loadIssuers() {
        try {
            const response = await fetch(ISSUERS_API_URL);
            if (response.ok) {
                const data = await response.json();
                issuersData = data.issuers || [];

                // Enrich issuers with derived country and industry
                issuersData = issuersData.map(issuer => ({
                    ...issuer,
                    country: issuer.country || getCountryFromHQ(issuer.hq),
                    industry: issuer.industry || getIndustryFromTags(issuer.tags)
                }));
            }

            // If no issuers in DB, generate from logos
            if (issuersData.length === 0) {
                console.log('No issuers in DB, generating from logos...');
                issuersData = generateIssuersFromLogos();
                console.log(`Generated ${issuersData.length} issuers from logos`);
            }
        } catch (error) {
            console.error('Failed to load issuers:', error);
            // Generate from logos as fallback
            issuersData = generateIssuersFromLogos();
        }
        filteredData = [...issuersData];
    }

    // Generate initial issuers data from logos
    function generateIssuersFromLogos() {
        const issuers = [];
        let id = 1;

        for (const [name, logoPath] of Object.entries(logosData)) {
            // Skip non-company entries
            if (name.includes('CRUNCHBASE NEWS')) continue;

            issuers.push({
                id: id++,
                company: name,
                logoPath: logoPath,
                lastRoundDate: '',
                lastRoundPrice: '',
                lastRoundValuation: '',
                country: '',
                industry: ''
            });
        }

        return issuers.sort((a, b) => a.company.localeCompare(b.company));
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
            searchInput.addEventListener('focus', () => {
                if (searchInput.value.length > 0) {
                    showSearchDropdown();
                }
            });
        }

        // Filters
        if (countryFilter) {
            countryFilter.addEventListener('change', applyFilters);
        }
        if (industryFilter) {
            industryFilter.addEventListener('change', applyFilters);
        }

        // Click outside to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.company-search-bar')) {
                hideSearchDropdown();
            }
        });

        // Sortable headers
        document.querySelectorAll('.header-cell.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const field = header.dataset.sort;
                handleSort(field);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeIssuerModal();
                closeDeleteModal();
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (hasUnsavedChanges) {
                    saveAllChanges();
                }
            }
        });
    }

    // Handle search
    function handleSearch() {
        const query = searchInput.value.trim().toUpperCase();

        if (query.length === 0) {
            hideSearchDropdown();
            searchInput.classList.remove('has-value');
            applyFilters();
            return;
        }

        searchInput.classList.add('has-value');

        const matches = issuersData.filter(c =>
            c.company.toUpperCase().includes(query)
        ).slice(0, 10);

        renderSearchDropdown(matches);
        showSearchDropdown();
    }

    // Render search dropdown
    function renderSearchDropdown(matches) {
        if (matches.length === 0) {
            searchDropdown.innerHTML = '<div class="dropdown-item" style="color: var(--platform-muted);">No issuers found</div>';
            return;
        }

        searchDropdown.innerHTML = matches.map(issuer => {
            const logoPath = issuer.logoPath || logosData[issuer.company] || '';
            const logoHtml = logoPath
                ? `<img src="${logoPath}" alt="${issuer.company}" onerror="this.parentElement.innerHTML='${issuer.company.charAt(0)}'">`
                : issuer.company.charAt(0);

            return `
                <div class="dropdown-item" onclick="selectIssuer('${issuer.id}')">
                    <div class="company-icon">${logoHtml}</div>
                    <span class="company-name">${issuer.company}</span>
                </div>
            `;
        }).join('');
    }

    // Select issuer from search
    window.selectIssuer = function (id) {
        const issuer = issuersData.find(c => String(c.id) === String(id));
        if (issuer) {
            searchInput.value = issuer.company;
            searchInput.classList.add('has-value');
            hideSearchDropdown();
            filteredData = [issuer];
            renderData();
        }
    };

    // Show/hide search dropdown
    function showSearchDropdown() {
        searchDropdown.classList.add('open');
    }

    function hideSearchDropdown() {
        searchDropdown.classList.remove('open');
    }

    // Clear search
    window.clearSearch = function () {
        searchInput.value = '';
        searchInput.classList.remove('has-value');
        hideSearchDropdown();
        applyFilters();
    };

    // Apply filters
    function applyFilters() {
        const searchQuery = searchInput ? searchInput.value.trim().toUpperCase() : '';
        const country = countryFilter ? countryFilter.value : '';
        const industry = industryFilter ? industryFilter.value : '';

        filteredData = issuersData.filter(issuer => {
            const matchesSearch = !searchQuery || issuer.company.toUpperCase().includes(searchQuery);
            const matchesCountry = !country || issuer.country === country;
            const matchesIndustry = !industry || issuer.industry === industry;
            return matchesSearch && matchesCountry && matchesIndustry;
        });

        sortData();
        renderData();
    }

    // Reset all filters
    window.resetAllFilters = function () {
        if (searchInput) searchInput.value = '';
        if (countryFilter) countryFilter.value = '';
        if (industryFilter) industryFilter.value = '';
        searchInput?.classList.remove('has-value');
        filteredData = [...issuersData];
        sortData();
        renderData();
    };

    // Handle sort
    function handleSort(field) {
        if (currentSort.field === field) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.field = field;
            currentSort.direction = 'asc';
        }

        // Update header UI
        document.querySelectorAll('.header-cell.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.sort === field) {
                header.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });

        sortData();
        renderData();
    }

    // Sort data
    function sortData() {
        filteredData.sort((a, b) => {
            let aVal = a[currentSort.field] || '';
            let bVal = b[currentSort.field] || '';

            // Handle numeric values
            if (currentSort.field === 'lastRoundPrice' || currentSort.field === 'lastRoundValuation') {
                aVal = parseFloat(aVal.replace(/[^0-9.-]/g, '')) || 0;
                bVal = parseFloat(bVal.replace(/[^0-9.-]/g, '')) || 0;
            }

            // Handle dates
            if (currentSort.field === 'lastRoundDate') {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            }

            if (typeof aVal === 'string') {
                aVal = aVal.toUpperCase();
                bVal = bVal.toUpperCase();
            }

            if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Populate filter dropdowns
    function populateFilters() {
        const countries = new Set();
        const industries = new Set();

        issuersData.forEach(issuer => {
            if (issuer.country) countries.add(issuer.country);
            if (issuer.industry) industries.add(issuer.industry);
        });

        if (countryFilter) {
            const sortedCountries = Array.from(countries).sort();
            countryFilter.innerHTML = '<option value="">All Countries</option>' +
                sortedCountries.map(c => `<option value="${c}">${c}</option>`).join('');
        }

        if (industryFilter) {
            const sortedIndustries = Array.from(industries).sort();
            industryFilter.innerHTML = '<option value="">All Industries</option>' +
                sortedIndustries.map(i => `<option value="${i}">${i}</option>`).join('');
        }
    }

    // Render data table
    function renderData() {
        if (filteredData.length === 0) {
            dataContent.innerHTML = `
                <div class="empty-state">
                    <h3>No Issuers Found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }

        const rows = filteredData.map(issuer => {
            const logoPath = issuer.logoPath || logosData[issuer.company] || '';
            const logoHtml = logoPath
                ? `<img src="${logoPath}" alt="${issuer.company}" onerror="this.parentElement.innerHTML='${issuer.company.charAt(0)}'">`
                : issuer.company.charAt(0);

            const isModified = issuer._modified ? ' modified' : '';

            // All issuers now have profile pages
            const profilePageUrl = issuer.slug ? `/issuers/${issuer.slug}` : null;

            // Company name: clickable with link to profile page
            const companyNameHtml = profilePageUrl
                ? `<a href="${profilePageUrl}" class="issuer-link" target="_blank">${issuer.company}</a><span class="profile-badge">Profile</span>`
                : `<span class="issuer-name-nolink">${issuer.company}</span>`;

            // Check enrichment status
            const enriched = isEnriched(issuer.company);
            const statusHtml = enriched
                ? '<span class="status-badge enriched">Enriched</span>'
                : '<span class="status-badge basic">Basic</span>';

            return `
                <div class="data-row${isModified}" data-id="${issuer.id}">
                    <div class="data-cell col-company">
                        <div class="company-info">
                            <div class="company-icon">${logoHtml}</div>
                            ${companyNameHtml}
                        </div>
                    </div>
                    <div class="data-cell col-status">
                        ${statusHtml}
                    </div>
                    <div class="data-cell col-date editable-cell" onclick="editCell(${issuer.id}, 'lastRoundDate')">
                        <span class="date-value${!issuer.lastRoundDate ? ' empty-value' : ''}">${issuer.lastRoundDate || '—'}</span>
                    </div>
                    <div class="data-cell col-price editable-cell" onclick="editCell(${issuer.id}, 'lastRoundPrice')">
                        <span class="price-value${!issuer.lastRoundPrice ? ' empty-value' : ''}">${issuer.lastRoundPrice || '—'}</span>
                    </div>
                    <div class="data-cell col-valuation editable-cell" onclick="editCell(${issuer.id}, 'lastRoundValuation')">
                        <span class="valuation-value${!issuer.lastRoundValuation ? ' empty-value' : ''}">${issuer.lastRoundValuation || '—'}</span>
                    </div>
                    <div class="data-cell col-country editable-cell" onclick="editCell(${issuer.id}, 'country')">
                        <span class="country-value${!issuer.country ? ' empty-value' : ''}">${issuer.country || '—'}</span>
                    </div>
                    <div class="data-cell col-industry editable-cell" onclick="editCell(${issuer.id}, 'industry')">
                        <span class="industry-value${!issuer.industry ? ' empty-value' : ''}">${issuer.industry || '—'}</span>
                    </div>
                    <div class="data-cell col-action">
                        <button class="btn-edit" onclick="openEditModal(${issuer.id})">Edit</button>
                        <button class="btn-delete-row" onclick="openDeleteModal(${issuer.id})" title="Delete">×</button>
                    </div>
                </div>
            `;
        }).join('');

        dataContent.innerHTML = `<div class="data-table">${rows}</div>`;
    }

    // Inline cell editing
    window.editCell = function (id, field) {
        const issuer = issuersData.find(c => c.id === id);
        if (!issuer) return;

        const row = document.querySelector(`.data-row[data-id="${id}"]`);
        if (!row) return;

        // Find the specific cell
        const cellIndex = {
            'lastRoundDate': 1,
            'lastRoundPrice': 2,
            'lastRoundValuation': 3,
            'country': 4,
            'industry': 5
        }[field];

        const cell = row.querySelectorAll('.data-cell')[cellIndex];
        if (!cell || cell.classList.contains('editing')) return;

        cell.classList.add('editing');
        const currentValue = issuer[field] || '';

        let inputType = 'text';
        if (field === 'lastRoundDate') {
            inputType = 'date';
        }

        cell.innerHTML = `
            <input type="${inputType}"
                   class="cell-edit-input"
                   value="${currentValue}"
                   onblur="saveCellEdit(${id}, '${field}', this.value)"
                   onkeydown="handleCellKeydown(event, ${id}, '${field}', this)">
        `;

        const input = cell.querySelector('input');
        input.focus();
        if (inputType === 'text') {
            input.select();
        }
    };

    // Handle cell keydown
    window.handleCellKeydown = function (event, id, field, input) {
        if (event.key === 'Enter') {
            input.blur();
        }
        if (event.key === 'Escape') {
            const issuer = issuersData.find(c => c.id === id);
            input.value = issuer[field] || '';
            input.blur();
        }
    };

    // Save cell edit
    window.saveCellEdit = function (id, field, value) {
        const issuer = issuersData.find(c => c.id === id);
        if (!issuer) return;

        if (issuer[field] !== value) {
            issuer[field] = value;
            issuer._modified = true;
            hasUnsavedChanges = true;
            showSaveButton();
        }

        renderData();
    };

    // Show/hide save button
    function showSaveButton() {
        if (btnSave) {
            btnSave.style.display = hasUnsavedChanges ? 'flex' : 'none';
        }
    }

    // Save all changes
    window.saveAllChanges = async function () {
        try {
            const response = await fetch(UPDATE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: issuersData,
                    apiKey: API_KEY
                })
            });

            if (response.ok) {
                // Clear modified flags
                issuersData.forEach(c => delete c._modified);
                hasUnsavedChanges = false;
                showSaveButton();
                renderData();
                alert('Changes saved successfully!');
            } else {
                const error = await response.json();
                alert('Failed to save: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save changes. Please try again.');
        }
    };

    // Open add issuer modal
    window.openAddIssuerModal = function () {
        editingIssuerId = null;
        currentEditingIssuer = null;
        document.getElementById('modalTitle').textContent = 'Add Issuer';

        // Clear all form fields
        clearForm();

        // Reset to first tab
        switchTab('basic');

        document.getElementById('issuerModal').classList.add('active');
    };

    // Open edit modal
    window.openEditModal = function (id) {
        const issuer = issuersData.find(c => c.id === id);
        if (!issuer) return;

        editingIssuerId = id;
        currentEditingIssuer = issuer;
        document.getElementById('modalTitle').textContent = 'Edit Issuer Profile';

        // Populate all form fields
        populateForm(issuer);

        // Reset to first tab
        switchTab('basic');

        document.getElementById('issuerModal').classList.add('active');
    };

    // Close issuer modal
    window.closeIssuerModal = function () {
        document.getElementById('issuerModal').classList.remove('active');
        editingIssuerId = null;
    };

    // Submit issuer (add or edit)
    window.submitIssuer = function () {
        // Collect all form data
        const formData = collectAllFormData();

        if (!formData.company) {
            alert('Issuer name is required');
            return;
        }

        if (editingIssuerId) {
            // Edit existing
            const issuer = issuersData.find(c => c.id === editingIssuerId);
            if (issuer) {
                // Update all fields from form data
                Object.assign(issuer, formData);
                issuer._modified = true;
                hasUnsavedChanges = true;
            }
        } else {
            // Add new
            const newId = Math.max(...issuersData.map(c => c.id), 0) + 1;
            issuersData.push({
                id: newId,
                ...formData,
                logoPath: formData.logoPath || logosData[formData.company] || '',
                _modified: true
            });
            hasUnsavedChanges = true;
        }

        showSaveButton();
        closeIssuerModal();
        populateFilters();
        applyFilters();
    };

    // Open delete modal
    window.openDeleteModal = function (id) {
        const issuer = issuersData.find(c => c.id === id);
        if (!issuer) return;

        deleteIssuerId = id;
        document.getElementById('deleteIssuerName').textContent = issuer.company;
        document.getElementById('deleteModal').classList.add('active');
    };

    // Close delete modal
    window.closeDeleteModal = function () {
        document.getElementById('deleteModal').classList.remove('active');
        deleteIssuerId = null;
    };

    // Confirm delete
    window.confirmDelete = function () {
        if (!deleteIssuerId) return;

        const index = issuersData.findIndex(c => c.id === deleteIssuerId);
        if (index > -1) {
            issuersData.splice(index, 1);
            hasUnsavedChanges = true;
            showSaveButton();
            applyFilters();
        }

        closeDeleteModal();
    };

    // Offcanvas menu functions
    window.openOffcanvas = function () {
        document.getElementById('offcanvasMenu').classList.add('active');
        document.getElementById('siteOverlay').classList.add('active');
        document.body.classList.add('offcanvas-open');
    };

    window.closeOffcanvas = function () {
        document.getElementById('offcanvasMenu').classList.remove('active');
        document.getElementById('siteOverlay').classList.remove('active');
        document.body.classList.remove('offcanvas-open');
    };

    // Logout function
    window.logout = function () {
        if (typeof clearSession === 'function') {
            clearSession();
        }
        window.location.href = '/login.html';
    };

    // Mobile functions
    window.clearMobileSearch = function () {
        const mobileSearch = document.getElementById('mobile-searchInput');
        if (mobileSearch) {
            mobileSearch.value = '';
            mobileSearch.classList.remove('has-value');
        }
        applyFilters();
    };

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // ============================================
    // TAB SWITCHING
    // ============================================

    window.switchTab = function (tabName) {
        // Remove active from all tabs and content
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Add active to selected
        document.querySelector(`.modal-tab[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById('tab-' + tabName).classList.add('active');
    };

    // ============================================
    // DYNAMIC LISTS - FUNDING ROUNDS
    // ============================================

    window.addFundingRound = function () {
        const container = document.getElementById('fundingRoundsList');
        const idx = container.children.length;
        container.insertAdjacentHTML('beforeend', `
            <div class="funding-round-row" data-idx="${idx}">
                <input type="text" placeholder="Date" data-field="date">
                <input type="text" placeholder="Amount" data-field="amount">
                <input type="text" placeholder="Round" data-field="round">
                <input type="text" placeholder="Valuation" data-field="valuation">
                <input type="text" placeholder="Investors (comma sep)" data-field="investors">
                <button class="btn-remove" onclick="removeFundingRound(${idx})">×</button>
            </div>
        `);
    };

    window.removeFundingRound = function (idx) {
        const row = document.querySelector(`#fundingRoundsList .funding-round-row[data-idx="${idx}"]`);
        if (row) row.remove();
    };

    function renderFundingRounds(rounds) {
        const container = document.getElementById('fundingRoundsList');
        if (!container) return;
        container.innerHTML = (rounds || []).map((round, idx) => `
            <div class="funding-round-row" data-idx="${idx}">
                <input type="text" placeholder="Date" value="${round.date || ''}" data-field="date">
                <input type="text" placeholder="Amount" value="${round.amount || ''}" data-field="amount">
                <input type="text" placeholder="Round" value="${round.round || ''}" data-field="round">
                <input type="text" placeholder="Valuation" value="${round.valuation || ''}" data-field="valuation">
                <input type="text" placeholder="Investors" value="${(round.investors || []).join(', ')}" data-field="investors">
                <button class="btn-remove" onclick="removeFundingRound(${idx})">×</button>
            </div>
        `).join('');
    }

    function collectFundingRounds() {
        const rows = document.querySelectorAll('#fundingRoundsList .funding-round-row');
        return Array.from(rows).map(row => ({
            date: row.querySelector('[data-field="date"]')?.value.trim() || '',
            amount: row.querySelector('[data-field="amount"]')?.value.trim() || '',
            round: row.querySelector('[data-field="round"]')?.value.trim() || '',
            valuation: row.querySelector('[data-field="valuation"]')?.value.trim() || null,
            investors: (row.querySelector('[data-field="investors"]')?.value || '').split(',').map(t => t.trim()).filter(Boolean)
        })).filter(r => r.date || r.amount);
    }

    // ============================================
    // DYNAMIC LISTS - PRODUCTS
    // ============================================

    window.addProduct = function () {
        const container = document.getElementById('productsList');
        const idx = container.children.length;
        container.insertAdjacentHTML('beforeend', `
            <div class="product-row" data-idx="${idx}">
                <input type="text" placeholder="Product Name" data-field="name">
                <input type="text" placeholder="Description" data-field="description">
                <button class="btn-remove" onclick="removeProduct(${idx})">×</button>
            </div>
        `);
    };

    window.removeProduct = function (idx) {
        const row = document.querySelector(`#productsList .product-row[data-idx="${idx}"]`);
        if (row) row.remove();
    };

    function renderProducts(products) {
        const container = document.getElementById('productsList');
        if (!container) return;
        container.innerHTML = (products || []).map((prod, idx) => `
            <div class="product-row" data-idx="${idx}">
                <input type="text" placeholder="Product Name" value="${prod.name || ''}" data-field="name">
                <input type="text" placeholder="Description" value="${prod.description || ''}" data-field="description">
                <button class="btn-remove" onclick="removeProduct(${idx})">×</button>
            </div>
        `).join('');
    }

    function collectProducts() {
        const rows = document.querySelectorAll('#productsList .product-row');
        return Array.from(rows).map(row => ({
            name: row.querySelector('[data-field="name"]')?.value.trim() || '',
            description: row.querySelector('[data-field="description"]')?.value.trim() || ''
        })).filter(p => p.name);
    }

    // ============================================
    // DYNAMIC LISTS - HIGHLIGHTS
    // ============================================

    window.addHighlight = function () {
        const container = document.getElementById('highlightsList');
        const idx = container.children.length;
        container.insertAdjacentHTML('beforeend', `
            <div class="dynamic-list-item" data-idx="${idx}">
                <input type="text" placeholder="Highlight text..." data-field="highlight">
                <button class="btn-remove" onclick="removeHighlight(${idx})">×</button>
            </div>
        `);
    };

    window.removeHighlight = function (idx) {
        const row = document.querySelector(`#highlightsList .dynamic-list-item[data-idx="${idx}"]`);
        if (row) row.remove();
    };

    function renderHighlights(highlights) {
        const container = document.getElementById('highlightsList');
        if (!container) return;
        container.innerHTML = (highlights || []).map((h, idx) => `
            <div class="dynamic-list-item" data-idx="${idx}">
                <input type="text" value="${h}" data-field="highlight">
                <button class="btn-remove" onclick="removeHighlight(${idx})">×</button>
            </div>
        `).join('');
    }

    function collectHighlights() {
        const items = document.querySelectorAll('#highlightsList .dynamic-list-item');
        return Array.from(items).map(item =>
            item.querySelector('[data-field="highlight"]')?.value.trim() || ''
        ).filter(Boolean);
    }

    // ============================================
    // DYNAMIC LISTS - KPIS
    // ============================================

    window.addKpi = function () {
        const container = document.getElementById('kpisList');
        const idx = container.children.length;
        container.insertAdjacentHTML('beforeend', `
            <div class="kpi-row" data-idx="${idx}">
                <input type="text" placeholder="Label (e.g. MAU)" data-field="label">
                <input type="text" placeholder="Value (e.g. 18.9M)" data-field="value">
                <button class="btn-remove" onclick="removeKpi(${idx})">×</button>
            </div>
        `);
    };

    window.removeKpi = function (idx) {
        const row = document.querySelector(`#kpisList .kpi-row[data-idx="${idx}"]`);
        if (row) row.remove();
    };

    function renderKpis(kpis) {
        const container = document.getElementById('kpisList');
        if (!container) return;
        container.innerHTML = (kpis || []).map((kpi, idx) => `
            <div class="kpi-row" data-idx="${idx}">
                <input type="text" placeholder="Label" value="${kpi.label || ''}" data-field="label">
                <input type="text" placeholder="Value" value="${kpi.value || ''}" data-field="value">
                <button class="btn-remove" onclick="removeKpi(${idx})">×</button>
            </div>
        `).join('');
    }

    function collectKpis() {
        const rows = document.querySelectorAll('#kpisList .kpi-row');
        return Array.from(rows).map(row => ({
            label: row.querySelector('[data-field="label"]')?.value.trim() || '',
            value: row.querySelector('[data-field="value"]')?.value.trim() || ''
        })).filter(k => k.label && k.value);
    }

    // ============================================
    // DYNAMIC LISTS - LEADERSHIP
    // ============================================

    window.addLeader = function () {
        const container = document.getElementById('leadershipList');
        const idx = container.children.length;
        container.insertAdjacentHTML('beforeend', `
            <div class="leader-card" data-idx="${idx}">
                <img src="/assets/placeholder-avatar.png" alt="Leader photo">
                <div class="leader-card-info">
                    <input type="text" placeholder="Name" data-field="name">
                    <input type="text" placeholder="Title (e.g. CEO)" data-field="title">
                    <input type="text" placeholder="Photo URL" data-field="photoUrl" onchange="updateLeaderPhoto(${idx}, this.value)">
                </div>
                <button class="btn-remove" onclick="removeLeader(${idx})">×</button>
            </div>
        `);
    };

    window.removeLeader = function (idx) {
        const card = document.querySelector(`#leadershipList .leader-card[data-idx="${idx}"]`);
        if (card) card.remove();
    };

    window.updateLeaderPhoto = function (idx, url) {
        const card = document.querySelector(`#leadershipList .leader-card[data-idx="${idx}"]`);
        if (card && url) {
            card.querySelector('img').src = url;
        }
    };

    function renderLeadership(leaders) {
        const container = document.getElementById('leadershipList');
        if (!container) return;
        container.innerHTML = (leaders || []).map((leader, idx) => `
            <div class="leader-card" data-idx="${idx}">
                <img src="${leader.photoUrl || '/assets/placeholder-avatar.png'}" alt="${leader.name}">
                <div class="leader-card-info">
                    <input type="text" placeholder="Name" value="${leader.name || ''}" data-field="name">
                    <input type="text" placeholder="Title" value="${leader.title || ''}" data-field="title">
                    <input type="text" placeholder="Photo URL" value="${leader.photoUrl || ''}" data-field="photoUrl" onchange="updateLeaderPhoto(${idx}, this.value)">
                </div>
                <button class="btn-remove" onclick="removeLeader(${idx})">×</button>
            </div>
        `).join('');
    }

    function collectLeadership() {
        const cards = document.querySelectorAll('#leadershipList .leader-card');
        return Array.from(cards).map(card => ({
            name: card.querySelector('[data-field="name"]')?.value.trim() || '',
            title: card.querySelector('[data-field="title"]')?.value.trim() || '',
            photoUrl: card.querySelector('[data-field="photoUrl"]')?.value.trim() || null
        })).filter(l => l.name);
    }

    // ============================================
    // LOGO HANDLING
    // ============================================

    // Handle logo file upload preview
    const logoFileInput = document.getElementById('modalLogoFile');
    if (logoFileInput) {
        logoFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    document.getElementById('modalLogoPreview').src = e.target.result;
                    document.getElementById('modalLogoUrl').value = ''; // Clear URL if file uploaded
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle logo URL input
    const logoUrlInput = document.getElementById('modalLogoUrl');
    if (logoUrlInput) {
        logoUrlInput.addEventListener('change', function () {
            const url = this.value.trim();
            if (url) {
                document.getElementById('modalLogoPreview').src = url;
            }
        });
    }

    // ============================================
    // COLLECT ALL FORM DATA
    // ============================================

    function collectAllFormData() {
        return {
            // Basic Info
            company: document.getElementById('modalIssuerName')?.value.trim().toUpperCase() || '',
            legalName: document.getElementById('modalLegalName')?.value.trim() || null,
            logoPath: document.getElementById('modalLogoUrl')?.value.trim() || null,
            tagline: document.getElementById('modalTagline')?.value.trim() || null,
            tags: (document.getElementById('modalTags')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
            ticker: document.getElementById('modalTicker')?.value.trim() || null,
            industry: document.getElementById('modalIndustry')?.value.trim() || null,
            country: document.getElementById('modalCountry')?.value.trim() || null,

            // Company Details
            website: document.getElementById('modalWebsite')?.value.trim() || null,
            founded: parseInt(document.getElementById('modalFounded')?.value) || null,
            hq: document.getElementById('modalHq')?.value.trim() || null,
            headcount: document.getElementById('modalHeadcount')?.value.trim() || null,
            twitter: document.getElementById('modalTwitter')?.value.trim() || null,
            linkedin: document.getElementById('modalLinkedin')?.value.trim() || null,
            github: document.getElementById('modalGithub')?.value.trim() || null,
            videoUrl: document.getElementById('modalVideoUrl')?.value.trim() || null,

            // Funding
            lastRoundValuation: document.getElementById('modalLastRoundValuation')?.value.trim() || null,
            totalFunding: document.getElementById('modalTotalFunding')?.value.trim() || null,
            lastRoundPrice: document.getElementById('modalLastRoundPrice')?.value.trim() || null,
            lastRoundDate: document.getElementById('modalLastRoundDate')?.value || null,
            keyInvestors: (document.getElementById('modalKeyInvestors')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
            fundingRounds: collectFundingRounds(),

            // Content
            description: document.getElementById('modalDescription')?.value.trim() || null,
            products: collectProducts(),
            highlights: collectHighlights(),
            kpis: collectKpis(),

            // Leadership
            leadership: collectLeadership(),

            // Meta
            slug: slugify(document.getElementById('modalIssuerName')?.value.trim() || ''),
            hasProfile: true
        };
    }

    // ============================================
    // POPULATE FORM FROM ISSUER DATA
    // ============================================

    function populateForm(issuer) {
        // Basic Info
        document.getElementById('modalIssuerName').value = issuer.company || '';
        document.getElementById('modalLegalName').value = issuer.legalName || '';
        document.getElementById('modalLogoUrl').value = issuer.logoPath || '';
        document.getElementById('modalLogoPreview').src = issuer.logoPath || logosData[issuer.company] || '/assets/placeholder-logo.png';
        document.getElementById('modalTagline').value = issuer.tagline || '';
        document.getElementById('modalTags').value = (issuer.tags || []).join(', ');
        document.getElementById('modalTicker').value = issuer.ticker || '';
        document.getElementById('modalIndustry').value = issuer.industry || '';
        document.getElementById('modalCountry').value = issuer.country || '';

        // Company Details
        document.getElementById('modalWebsite').value = issuer.website || '';
        document.getElementById('modalFounded').value = issuer.founded || '';
        document.getElementById('modalHq').value = issuer.hq || '';
        document.getElementById('modalHeadcount').value = issuer.headcount || '';
        document.getElementById('modalTwitter').value = issuer.twitter || '';
        document.getElementById('modalLinkedin').value = issuer.linkedin || '';
        document.getElementById('modalGithub').value = issuer.github || '';
        document.getElementById('modalVideoUrl').value = issuer.videoUrl || '';

        // Funding
        document.getElementById('modalLastRoundValuation').value = issuer.lastRoundValuation || '';
        document.getElementById('modalTotalFunding').value = issuer.totalFunding || '';
        document.getElementById('modalLastRoundPrice').value = issuer.lastRoundPrice || '';
        document.getElementById('modalLastRoundDate').value = issuer.lastRoundDate || '';
        document.getElementById('modalKeyInvestors').value = (issuer.keyInvestors || []).join(', ');

        // Content
        document.getElementById('modalDescription').value = issuer.description || '';

        // Render dynamic lists
        renderFundingRounds(issuer.fundingRounds || []);
        renderProducts(issuer.products || []);
        renderHighlights(issuer.highlights || []);
        renderKpis(issuer.kpis || []);
        renderLeadership(issuer.leadership || []);
    }

    // ============================================
    // CLEAR FORM
    // ============================================

    function clearForm() {
        // Basic Info
        document.getElementById('modalIssuerName').value = '';
        document.getElementById('modalLegalName').value = '';
        document.getElementById('modalLogoUrl').value = '';
        document.getElementById('modalLogoPreview').src = '/assets/placeholder-logo.png';
        document.getElementById('modalTagline').value = '';
        document.getElementById('modalTags').value = '';
        document.getElementById('modalTicker').value = '';
        document.getElementById('modalIndustry').value = '';
        document.getElementById('modalCountry').value = '';

        // Company Details
        document.getElementById('modalWebsite').value = '';
        document.getElementById('modalFounded').value = '';
        document.getElementById('modalHq').value = '';
        document.getElementById('modalHeadcount').value = '';
        document.getElementById('modalTwitter').value = '';
        document.getElementById('modalLinkedin').value = '';
        document.getElementById('modalGithub').value = '';
        document.getElementById('modalVideoUrl').value = '';

        // Funding
        document.getElementById('modalLastRoundValuation').value = '';
        document.getElementById('modalTotalFunding').value = '';
        document.getElementById('modalLastRoundPrice').value = '';
        document.getElementById('modalLastRoundDate').value = '';
        document.getElementById('modalKeyInvestors').value = '';

        // Content
        document.getElementById('modalDescription').value = '';

        // Clear dynamic lists
        document.getElementById('fundingRoundsList').innerHTML = '';
        document.getElementById('productsList').innerHTML = '';
        document.getElementById('highlightsList').innerHTML = '';
        document.getElementById('kpisList').innerHTML = '';
        document.getElementById('leadershipList').innerHTML = '';
    }

    // Initialize on load
    init();
})();
