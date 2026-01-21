// ========================================
// OFFCANVAS MENU FUNCTIONS (Global)
// ========================================

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

// Close on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeOffcanvas();
    }
});

// Make functions globally available
window.openOffcanvas = openOffcanvas;
window.closeOffcanvas = closeOffcanvas;

// ========================================
// MAIN COMPANIES APPLICATION
// ========================================

// Companies Database JavaScript
(function () {
    'use strict';

    // ========================================
    // RESPONSIVE SCALING
    // ========================================

    (function setViewport() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = 'width=device-width, initial-scale=1.0, minimum-scale=0.5, maximum-scale=3.0, user-scalable=yes';
    })();

    function isTouchDevice() {
        return ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0);
    }

    function applyResponsiveScale() {
        if (isTouchDevice()) {
            return;
        }

        const wrapper = document.querySelector('.scale-wrapper');
        if (!wrapper) return;

        try {
            const baseWidth = 1350;
            const viewportWidth = window.innerWidth;
            const overlay = document.getElementById('companies-overlay-platform');

            if (viewportWidth < baseWidth) {
                const scale = viewportWidth / baseWidth;
                wrapper.style.transform = `scale(${scale})`;
                wrapper.style.height = `${100 / scale}%`;
                wrapper.style.transformOrigin = 'top left';
                wrapper.style.left = '0';
                wrapper.style.margin = '0';

                if (overlay) {
                    overlay.style.overflow = 'hidden';
                    overlay.style.justifyContent = 'flex-start';
                }
            } else {
                wrapper.style.transform = 'scale(1)';
                wrapper.style.height = 'auto';
                wrapper.style.transformOrigin = 'top center';
                wrapper.style.left = 'auto';
                wrapper.style.margin = '0';

                if (overlay) {
                    overlay.style.overflow = 'auto';
                    overlay.style.justifyContent = 'center';
                }
            }
        } catch (error) {
            console.error('Scaling error:', error);
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    const debouncedScale = debounce(applyResponsiveScale, 150);

    if (!isTouchDevice()) {
        window.addEventListener('load', applyResponsiveScale);
        window.addEventListener('resize', debouncedScale);
        applyResponsiveScale();
    }

    // API Configuration
    const API_BASE = '/api';
    const COMPANIES_API_URL = `${API_BASE}/companies`;
    const UPDATE_API_URL = `${API_BASE}/companies-update`;
    const ISSUERS_API_URL = `${API_BASE}/issuers`;
    const PARTNERS_API_URL = `${API_BASE}/partners`;
    const API_KEY = 'investclub-admin-secure-key-2024';

    // State
    let companiesData = [];
    let issuersData = [];
    let partnersData = [];
    let filteredData = [];
    let hasUnsavedChanges = false;
    let editingCompanyId = null;
    let deleteCompanyId = null;
    let currentSort = { field: 'name', direction: 'asc' };

    // Inline editing state
    let currentEditingCell = null;
    let currentEditingCompanyId = null;
    let currentEditingField = null;
    let tempEditValues = [];

    // Multiselect state
    let selectedCapTable = [];
    let selectedRelatedIssuers = [];

    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const dataContent = document.getElementById('dataContent');
    const btnSave = document.getElementById('btnSave');

    // Initialize
    async function init() {
        await Promise.all([
            loadIssuers(),
            loadPartners(),
            loadCompanies()
        ]);
        setupEventListeners();
        renderData();
        renderMobileData();
    }

    // Load issuers data for multiselect
    async function loadIssuers() {
        try {
            const response = await fetch(ISSUERS_API_URL);
            if (response.ok) {
                const data = await response.json();
                issuersData = data.issuers || [];
            }
        } catch (error) {
            console.error('Failed to load issuers:', error);
            issuersData = [];
        }
    }

    // Load partners data for counting
    async function loadPartners() {
        try {
            const response = await fetch(PARTNERS_API_URL);
            if (response.ok) {
                const data = await response.json();
                partnersData = data.partners || [];
            }
        } catch (error) {
            console.error('Failed to load partners:', error);
            partnersData = [];
        }
    }

    // Load companies data
    async function loadCompanies() {
        try {
            const response = await fetch(COMPANIES_API_URL);
            if (response.ok) {
                const data = await response.json();
                companiesData = data.companies || [];
            }
        } catch (error) {
            console.error('Failed to load companies:', error);
            companiesData = [];
        }
        filteredData = [...companiesData];
    }

    // Get partners count for a company
    function getPartnersCount(companyId) {
        return partnersData.filter(p => p.companyId === companyId).length;
    }

    // Get partners for a company
    function getPartnersForCompany(companyId) {
        return partnersData.filter(p => p.companyId === companyId);
    }

    // Get issuer names from IDs
    function getIssuerNames(issuerIds) {
        if (!Array.isArray(issuerIds) || issuerIds.length === 0) return [];
        return issuerIds.map(id => {
            const issuer = issuersData.find(i => i.id === id);
            return issuer ? issuer.company : `Unknown (${id})`;
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search input - Desktop
        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
            searchInput.addEventListener('focus', () => {
                if (searchInput.value.length > 0) {
                    showSearchDropdown();
                }
            });
        }

        // Search input - Mobile
        const mobileSearchInput = document.getElementById('mobile-searchInput');
        if (mobileSearchInput) {
            mobileSearchInput.addEventListener('input', handleMobileSearch);
            mobileSearchInput.addEventListener('focus', () => {
                if (mobileSearchInput.value.length > 0) {
                    showMobileSearchDropdown();
                }
            });
        }

        // Click outside to close dropdowns and cell editing
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.company-search-bar')) {
                hideSearchDropdown();
            }
            if (!e.target.closest('.mobile-search-wrapper')) {
                hideMobileSearchDropdown();
            }
            if (!e.target.closest('.multiselect-container')) {
                hideAllMultiselectDropdowns();
            }
            // Close cell editing when clicking outside
            if (currentEditingCell && !e.target.closest('.editable-cell') && !e.target.closest('.edit-multiselect-dropdown')) {
                cancelCellEdit();
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
                closeCompanyModal();
                closeDeleteModal();
                closePartnersListModal();
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (hasUnsavedChanges) {
                    saveAllChanges();
                }
            }
        });

        // Multiselect inputs
        setupMultiselectListeners();
    }

    // Setup multiselect listeners
    function setupMultiselectListeners() {
        // Cap Table multiselect
        const capTableInput = document.getElementById('capTableInput');
        if (capTableInput) {
            capTableInput.addEventListener('input', () => filterMultiselect('capTable'));
            capTableInput.addEventListener('focus', () => showMultiselectDropdown('capTable'));
        }

        // Related Issuers multiselect
        const relatedIssuersInput = document.getElementById('relatedIssuersInput');
        if (relatedIssuersInput) {
            relatedIssuersInput.addEventListener('input', () => filterMultiselect('relatedIssuers'));
            relatedIssuersInput.addEventListener('focus', () => showMultiselectDropdown('relatedIssuers'));
        }
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

        const matches = companiesData.filter(c =>
            c.name.toUpperCase().includes(query)
        ).slice(0, 10);

        renderSearchDropdown(matches);
        showSearchDropdown();
    }

    // Handle mobile search
    function handleMobileSearch() {
        const mobileSearchInput = document.getElementById('mobile-searchInput');
        const query = mobileSearchInput.value.trim().toUpperCase();

        if (query.length === 0) {
            hideMobileSearchDropdown();
            mobileSearchInput.classList.remove('has-value');
            applyFilters();
            return;
        }

        mobileSearchInput.classList.add('has-value');

        const matches = companiesData.filter(c =>
            c.name.toUpperCase().includes(query)
        ).slice(0, 10);

        renderMobileSearchDropdown(matches);
        showMobileSearchDropdown();
    }

    // Render search dropdown
    function renderSearchDropdown(matches) {
        if (matches.length === 0) {
            searchDropdown.innerHTML = '<div class="dropdown-item" style="color: var(--platform-muted);">No companies found</div>';
            return;
        }

        searchDropdown.innerHTML = matches.map(company => `
            <div class="dropdown-item" onclick="selectCompany('${company.id}')">
                <div class="company-icon">${company.name.charAt(0)}</div>
                <span class="company-name">${company.name}</span>
            </div>
        `).join('');
    }

    // Render mobile search dropdown
    function renderMobileSearchDropdown(matches) {
        const dropdown = document.getElementById('mobile-searchDropdown');
        if (!dropdown) return;

        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item" style="color: var(--platform-muted);">No companies found</div>';
            return;
        }

        dropdown.innerHTML = matches.map(company => `
            <div class="dropdown-item" onclick="selectCompany('${company.id}', true)">
                <div class="company-icon">${company.name.charAt(0)}</div>
                <span class="company-name">${company.name}</span>
            </div>
        `).join('');
    }

    // Select company from search
    window.selectCompany = function (id, isMobile = false) {
        const company = companiesData.find(c => String(c.id) === String(id));
        if (company) {
            if (isMobile) {
                const mobileSearchInput = document.getElementById('mobile-searchInput');
                mobileSearchInput.value = company.name;
                mobileSearchInput.classList.add('has-value');
                hideMobileSearchDropdown();
            } else {
                searchInput.value = company.name;
                searchInput.classList.add('has-value');
                hideSearchDropdown();
            }
            filteredData = [company];
            renderData();
            renderMobileData();
        }
    };

    // Show/hide search dropdowns
    function showSearchDropdown() {
        searchDropdown.classList.add('open');
    }

    function hideSearchDropdown() {
        if (searchDropdown) searchDropdown.classList.remove('open');
    }

    function showMobileSearchDropdown() {
        const dropdown = document.getElementById('mobile-searchDropdown');
        if (dropdown) dropdown.classList.add('open');
    }

    function hideMobileSearchDropdown() {
        const dropdown = document.getElementById('mobile-searchDropdown');
        if (dropdown) dropdown.classList.remove('open');
    }

    // Clear search
    window.clearSearch = function () {
        searchInput.value = '';
        searchInput.classList.remove('has-value');
        hideSearchDropdown();
        applyFilters();
    };

    window.clearMobileSearch = function () {
        const mobileSearchInput = document.getElementById('mobile-searchInput');
        if (mobileSearchInput) {
            mobileSearchInput.value = '';
            mobileSearchInput.classList.remove('has-value');
        }
        hideMobileSearchDropdown();
        applyFilters();
    };

    // Apply filters
    function applyFilters() {
        const searchQuery = searchInput ? searchInput.value.trim().toUpperCase() : '';

        filteredData = companiesData.filter(company => {
            const matchesSearch = !searchQuery || company.name.toUpperCase().includes(searchQuery);
            return matchesSearch;
        });

        sortData();
        renderData();
        renderMobileData();
    }

    // Reset all filters
    window.resetAllFilters = function () {
        if (searchInput) searchInput.value = '';
        searchInput?.classList.remove('has-value');

        const mobileSearchInput = document.getElementById('mobile-searchInput');
        if (mobileSearchInput) {
            mobileSearchInput.value = '';
            mobileSearchInput.classList.remove('has-value');
        }

        filteredData = [...companiesData];
        sortData();
        renderData();
        renderMobileData();
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
            let aVal, bVal;

            if (currentSort.field === 'partnersCount') {
                aVal = getPartnersCount(a.id);
                bVal = getPartnersCount(b.id);
            } else {
                aVal = a[currentSort.field] || '';
                bVal = b[currentSort.field] || '';
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

    // Render data table
    function renderData() {
        if (filteredData.length === 0) {
            dataContent.innerHTML = `
                <div class="empty-state">
                    <h3>No Companies Found</h3>
                    <p>Try adjusting your search or add a new company</p>
                </div>
            `;
            return;
        }

        const rows = filteredData.map(company => {
            const partnersCount = getPartnersCount(company.id);
            const capTableNames = getIssuerNames(company.capTable || []);
            const relatedIssuerNames = getIssuerNames(company.relatedIssuers || []);
            const isModified = company._modified ? ' modified' : '';

            return `
                <div class="data-row${isModified}" data-id="${company.id}">
                    <div class="data-cell col-name editable-cell" onclick="startEditCell(${company.id}, 'name', this)">
                        <div class="company-info">
                            <div class="company-icon">${company.name.charAt(0)}</div>
                            <span class="company-name">${escapeHtml(company.name)}</span>
                        </div>
                    </div>
                    <div class="data-cell col-url editable-cell" onclick="startEditCell(${company.id}, 'url', this)">
                        ${company.url ? `<a href="${company.url}" target="_blank" class="url-link" onclick="event.stopPropagation()">${formatUrl(company.url)}</a>` : '<span class="empty-value">—</span>'}
                    </div>
                    <div class="data-cell col-partners">
                        <span class="partners-count${partnersCount > 0 ? ' has-partners' : ''}" onclick="showPartnersList(${company.id})">${partnersCount}</span>
                    </div>
                    <div class="data-cell col-captable editable-cell" onclick="startEditCell(${company.id}, 'capTable', this)">
                        ${renderRelationChips(capTableNames, 'cap')}
                    </div>
                    <div class="data-cell col-related editable-cell" onclick="startEditCell(${company.id}, 'relatedIssuers', this)">
                        ${renderRelationChips(relatedIssuerNames, 'related')}
                    </div>
                    <div class="data-cell col-action">
                        <button class="btn-delete-row" onclick="openDeleteModal(${company.id})" title="Delete">×</button>
                    </div>
                </div>
            `;
        }).join('');

        dataContent.innerHTML = `<div class="data-table">${rows}</div>`;
    }

    // Start inline cell editing
    window.startEditCell = function(companyId, field, cellElement) {
        // Close any existing edit
        if (currentEditingCell) {
            cancelCellEdit();
        }

        const company = companiesData.find(c => c.id === companyId);
        if (!company) return;

        currentEditingCell = cellElement;
        currentEditingCompanyId = companyId;
        currentEditingField = field;
        cellElement.classList.add('editing');

        if (field === 'name') {
            cellElement.innerHTML = `
                <div class="cell-edit-wrapper">
                    <input type="text" class="cell-edit-input" id="cellEditInput" value="${escapeHtml(company.name)}"
                           onkeydown="handleCellEditKeydown(event)" onblur="saveCellEdit()">
                </div>
            `;
            const input = document.getElementById('cellEditInput');
            input.focus();
            input.select();
        } else if (field === 'url') {
            const urlValue = company.url ? company.url.replace(/^https?:\/\//, '') : '';
            cellElement.innerHTML = `
                <div class="url-input-wrapper">
                    <span class="input-prefix">https://</span>
                    <input type="text" class="cell-edit-input url-input" id="cellEditInput" value="${escapeHtml(urlValue)}"
                           onkeydown="handleCellEditKeydown(event)" onblur="saveCellEdit()">
                </div>
            `;
            const input = document.getElementById('cellEditInput');
            input.focus();
            input.select();
        } else if (field === 'capTable' || field === 'relatedIssuers') {
            tempEditValues = [...(company[field] || [])];
            renderMultiselectEditor(cellElement, field);
        }
    };

    // Render multiselect editor for capTable and relatedIssuers
    function renderMultiselectEditor(cellElement, field) {
        const chips = tempEditValues.map(id => {
            const issuer = issuersData.find(i => i.id === id);
            const name = issuer ? issuer.company : `Unknown (${id})`;
            return `<span class="edit-chip">${escapeHtml(name)}<span class="edit-chip-remove" onclick="removeEditChip(${id}, event)">×</span></span>`;
        }).join('');

        cellElement.innerHTML = `
            <div class="edit-multiselect-container">
                <div class="edit-multiselect-wrapper" onclick="focusMultiselectInput(event)">
                    ${chips}
                    <input type="text" class="edit-multiselect-input" id="cellEditInput" placeholder="Type to search..."
                           oninput="filterEditMultiselect()" onfocus="showEditMultiselectDropdown()" onkeydown="handleMultiselectKeydown(event)">
                </div>
                <div class="edit-multiselect-dropdown" id="editMultiselectDropdown"></div>
            </div>
        `;
        const input = document.getElementById('cellEditInput');
        input.focus();
        filterEditMultiselect();
    }

    window.focusMultiselectInput = function(event) {
        event.stopPropagation();
        const input = document.getElementById('cellEditInput');
        if (input) input.focus();
    };

    window.filterEditMultiselect = function() {
        const input = document.getElementById('cellEditInput');
        const dropdown = document.getElementById('editMultiselectDropdown');
        if (!input || !dropdown) return;

        const query = input.value.trim().toUpperCase();
        const filtered = issuersData.filter(issuer => {
            const matchesQuery = !query || issuer.company.toUpperCase().includes(query);
            const notSelected = !tempEditValues.includes(issuer.id);
            return matchesQuery && notSelected;
        }).slice(0, 8);

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item" style="color: var(--platform-muted);">No issuers found</div>';
        } else {
            dropdown.innerHTML = filtered.map(issuer => `
                <div class="dropdown-item" onclick="addEditChip(${issuer.id}, '${escapeHtml(issuer.company)}', event)">
                    ${escapeHtml(issuer.company)}
                </div>
            `).join('');
        }
        dropdown.classList.add('open');
    };

    window.showEditMultiselectDropdown = function() {
        filterEditMultiselect();
    };

    window.addEditChip = function(id, name, event) {
        event.stopPropagation();
        if (!tempEditValues.includes(id)) {
            tempEditValues.push(id);
            const company = companiesData.find(c => c.id === currentEditingCompanyId);
            if (company) {
                company[currentEditingField] = [...tempEditValues];
                company._modified = true;
                hasUnsavedChanges = true;
                showSaveButton();
            }
            renderMultiselectEditor(currentEditingCell, currentEditingField);
        }
    };

    window.removeEditChip = function(id, event) {
        event.stopPropagation();
        tempEditValues = tempEditValues.filter(i => i !== id);
        const company = companiesData.find(c => c.id === currentEditingCompanyId);
        if (company) {
            company[currentEditingField] = [...tempEditValues];
            company._modified = true;
            hasUnsavedChanges = true;
            showSaveButton();
        }
        renderMultiselectEditor(currentEditingCell, currentEditingField);
    };

    window.handleMultiselectKeydown = function(event) {
        if (event.key === 'Escape') {
            cancelCellEdit();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            cancelCellEdit();
        }
    };

    window.handleCellEditKeydown = function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveCellEdit();
        } else if (event.key === 'Escape') {
            cancelCellEdit();
        }
    };

    window.saveCellEdit = function() {
        if (!currentEditingCell || !currentEditingCompanyId || !currentEditingField) return;

        const input = document.getElementById('cellEditInput');
        if (!input) {
            cancelCellEdit();
            return;
        }

        const company = companiesData.find(c => c.id === currentEditingCompanyId);
        if (!company) {
            cancelCellEdit();
            return;
        }

        let newValue = input.value.trim();

        if (currentEditingField === 'name') {
            if (newValue && newValue !== company.name) {
                company.name = newValue;
                company._modified = true;
                hasUnsavedChanges = true;
                showSaveButton();
            }
        } else if (currentEditingField === 'url') {
            const fullUrl = newValue ? (newValue.startsWith('http') ? newValue : 'https://' + newValue) : '';
            if (fullUrl !== company.url) {
                company.url = fullUrl;
                company._modified = true;
                hasUnsavedChanges = true;
                showSaveButton();
            }
        }

        cancelCellEdit();
        renderData();
    };

    function cancelCellEdit() {
        if (currentEditingCell) {
            currentEditingCell.classList.remove('editing');
        }
        currentEditingCell = null;
        currentEditingCompanyId = null;
        currentEditingField = null;
        tempEditValues = [];

        // Close any open dropdowns
        const dropdown = document.getElementById('editMultiselectDropdown');
        if (dropdown) dropdown.classList.remove('open');

        renderData();
    }

    // Add new company from input row
    window.addNewCompanyFromInput = function() {
        const nameInput = document.getElementById('inputCompanyName');
        const urlInput = document.getElementById('inputUrl');

        const name = nameInput ? nameInput.value.trim() : '';
        const urlValue = urlInput ? urlInput.value.trim() : '';
        const url = urlValue ? (urlValue.startsWith('http') ? urlValue : 'https://' + urlValue) : '';

        if (!name) {
            alert('Please enter a company name');
            if (nameInput) nameInput.focus();
            return;
        }

        // Create new company
        const newId = Math.max(...companiesData.map(c => c.id), 0) + 1;
        const newCompany = {
            id: newId,
            name: name,
            url: url,
            capTable: [],
            relatedIssuers: [],
            createdAt: new Date().toISOString(),
            _modified: true
        };

        companiesData.unshift(newCompany);
        hasUnsavedChanges = true;
        showSaveButton();

        // Clear inputs
        if (nameInput) nameInput.value = '';
        if (urlInput) urlInput.value = '';

        // Refresh display
        applyFilters();

        // Add animation to new row
        setTimeout(() => {
            const newRow = document.querySelector(`.data-row[data-id="${newId}"]`);
            if (newRow) {
                newRow.classList.add('new-row-animation');
            }
        }, 50);
    };

    // Render mobile data
    function renderMobileData() {
        const mobileContent = document.getElementById('mobile-dataContent');
        if (!mobileContent) return;

        if (filteredData.length === 0) {
            mobileContent.innerHTML = `
                <div class="empty-state">
                    <h3>No Companies Found</h3>
                    <p>Try adjusting your search</p>
                </div>
            `;
            return;
        }

        const cards = filteredData.map(company => {
            const partnersCount = getPartnersCount(company.id);
            const capTableNames = getIssuerNames(company.capTable || []);
            const relatedIssuerNames = getIssuerNames(company.relatedIssuers || []);

            return `
                <div class="mobile-card" onclick="openEditModal(${company.id})">
                    <div class="mobile-card-header">
                        <div class="company-icon">${company.name.charAt(0)}</div>
                        <div class="mobile-card-title">
                            <span class="company-name">${company.name}</span>
                            ${company.url ? `<span class="company-url">${formatUrl(company.url)}</span>` : ''}
                        </div>
                        <span class="partners-badge">${partnersCount} partners</span>
                    </div>
                    <div class="mobile-card-body">
                        ${capTableNames.length > 0 ? `
                            <div class="mobile-field">
                                <span class="mobile-label">Cap Table:</span>
                                <span class="mobile-value">${capTableNames.join(', ')}</span>
                            </div>
                        ` : ''}
                        ${relatedIssuerNames.length > 0 ? `
                            <div class="mobile-field">
                                <span class="mobile-label">Related:</span>
                                <span class="mobile-value">${relatedIssuerNames.join(', ')}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        mobileContent.innerHTML = cards;
    }

    // Render relation chips
    function renderRelationChips(names, type) {
        if (names.length === 0) return '<span class="empty-value">—</span>';
        if (names.length <= 2) {
            return names.map(n => `<span class="relation-chip">${n}</span>`).join('');
        }
        return `
            <span class="relation-chip">${names[0]}</span>
            <span class="relation-chip">+${names.length - 1} more</span>
        `;
    }

    // Format URL for display
    function formatUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname.replace('www.', '');
        } catch {
            return url;
        }
    }

    // Multiselect functions
    function showMultiselectDropdown(type) {
        const dropdown = document.getElementById(`${type}Dropdown`);
        if (dropdown) {
            dropdown.classList.add('open');
            filterMultiselect(type);
        }
    }

    function hideAllMultiselectDropdowns() {
        document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.remove('open'));
    }

    function filterMultiselect(type) {
        const input = document.getElementById(`${type}Input`);
        const dropdown = document.getElementById(`${type}Dropdown`);
        const query = input ? input.value.trim().toUpperCase() : '';
        const selected = type === 'capTable' ? selectedCapTable : selectedRelatedIssuers;

        const filtered = issuersData.filter(issuer => {
            const matchesQuery = !query || issuer.company.toUpperCase().includes(query);
            const notSelected = !selected.includes(issuer.id);
            return matchesQuery && notSelected;
        }).slice(0, 10);

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="multiselect-option" style="color: var(--platform-muted);">No issuers found</div>';
            return;
        }

        dropdown.innerHTML = filtered.map(issuer => `
            <div class="multiselect-option" onclick="addToMultiselect('${type}', ${issuer.id}, '${escapeHtml(issuer.company)}')">
                ${issuer.company}
            </div>
        `).join('');
    }

    window.addToMultiselect = function(type, id, name) {
        const selected = type === 'capTable' ? selectedCapTable : selectedRelatedIssuers;
        if (!selected.includes(id)) {
            selected.push(id);
            renderMultiselectChips(type);
            filterMultiselect(type);
        }
        // Clear input
        const input = document.getElementById(`${type}Input`);
        if (input) input.value = '';
    };

    window.removeFromMultiselect = function(type, id) {
        if (type === 'capTable') {
            selectedCapTable = selectedCapTable.filter(i => i !== id);
        } else {
            selectedRelatedIssuers = selectedRelatedIssuers.filter(i => i !== id);
        }
        renderMultiselectChips(type);
        filterMultiselect(type);
    };

    function renderMultiselectChips(type) {
        const container = document.getElementById(`${type}Chips`);
        const selected = type === 'capTable' ? selectedCapTable : selectedRelatedIssuers;

        container.innerHTML = selected.map(id => {
            const issuer = issuersData.find(i => i.id === id);
            const name = issuer ? issuer.company : `Unknown (${id})`;
            return `
                <span class="selected-chip">
                    ${name}
                    <span class="chip-remove" onclick="removeFromMultiselect('${type}', ${id})">×</span>
                </span>
            `;
        }).join('');
    }

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
                    data: companiesData,
                    apiKey: API_KEY
                })
            });

            if (response.ok) {
                // Clear modified flags
                companiesData.forEach(c => delete c._modified);
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

    // Open add company modal
    window.openAddCompanyModal = function () {
        editingCompanyId = null;
        selectedCapTable = [];
        selectedRelatedIssuers = [];

        document.getElementById('modalTitle').textContent = 'Add Company';
        document.getElementById('modalCompanyName').value = '';
        document.getElementById('modalUrl').value = '';

        renderMultiselectChips('capTable');
        renderMultiselectChips('relatedIssuers');

        document.getElementById('companyModal').classList.add('active');
    };

    // Open edit modal
    window.openEditModal = function (id) {
        const company = companiesData.find(c => c.id === id);
        if (!company) return;

        editingCompanyId = id;
        selectedCapTable = [...(company.capTable || [])];
        selectedRelatedIssuers = [...(company.relatedIssuers || [])];

        document.getElementById('modalTitle').textContent = 'Edit Company';
        document.getElementById('modalCompanyName').value = company.name;
        document.getElementById('modalUrl').value = company.url || '';

        renderMultiselectChips('capTable');
        renderMultiselectChips('relatedIssuers');

        document.getElementById('companyModal').classList.add('active');
    };

    // Close company modal
    window.closeCompanyModal = function () {
        document.getElementById('companyModal').classList.remove('active');
        editingCompanyId = null;
        hideAllMultiselectDropdowns();
    };

    // Submit company (add or edit)
    window.submitCompany = function () {
        const name = document.getElementById('modalCompanyName').value.trim();
        const url = document.getElementById('modalUrl').value.trim();

        if (!name) {
            alert('Company name is required');
            return;
        }

        if (editingCompanyId) {
            // Edit existing
            const company = companiesData.find(c => c.id === editingCompanyId);
            if (company) {
                company.name = name;
                company.url = url;
                company.capTable = [...selectedCapTable];
                company.relatedIssuers = [...selectedRelatedIssuers];
                company._modified = true;
                hasUnsavedChanges = true;
            }
        } else {
            // Add new
            const newId = Math.max(...companiesData.map(c => c.id), 0) + 1;
            companiesData.push({
                id: newId,
                name,
                url,
                capTable: [...selectedCapTable],
                relatedIssuers: [...selectedRelatedIssuers],
                createdAt: new Date().toISOString(),
                _modified: true
            });
            hasUnsavedChanges = true;
        }

        showSaveButton();
        closeCompanyModal();
        applyFilters();
    };

    // Show partners list for a company
    window.showPartnersList = function (companyId) {
        const company = companiesData.find(c => c.id === companyId);
        const partners = getPartnersForCompany(companyId);

        if (partners.length === 0) return;

        document.getElementById('partnersListTitle').textContent = `Partners - ${company ? company.name : ''}`;

        const content = partners.map(p => `
            <div class="partner-list-item">
                <span class="partner-name">${p.firstName || ''} ${p.lastName || ''}</span>
                ${p.emails && p.emails.length > 0 ? `<span class="partner-email">${p.emails[0]}</span>` : ''}
            </div>
        `).join('');

        document.getElementById('partnersListContent').innerHTML = content || '<p>No partners found</p>';
        document.getElementById('partnersListModal').classList.add('active');
    };

    // Close partners list modal
    window.closePartnersListModal = function () {
        document.getElementById('partnersListModal').classList.remove('active');
    };

    // Open delete modal
    window.openDeleteModal = function (id) {
        const company = companiesData.find(c => c.id === id);
        if (!company) return;

        deleteCompanyId = id;
        const partnersCount = getPartnersCount(id);

        document.getElementById('deleteCompanyName').textContent = company.name;

        const warningEl = document.getElementById('deleteWarningPartners');
        if (partnersCount > 0) {
            warningEl.textContent = `This company has ${partnersCount} linked partner(s). They will lose this company reference.`;
            warningEl.style.display = 'block';
        } else {
            warningEl.style.display = 'none';
        }

        document.getElementById('deleteModal').classList.add('active');
    };

    // Close delete modal
    window.closeDeleteModal = function () {
        document.getElementById('deleteModal').classList.remove('active');
        deleteCompanyId = null;
    };

    // Confirm delete
    window.confirmDelete = function () {
        if (!deleteCompanyId) return;

        const index = companiesData.findIndex(c => c.id === deleteCompanyId);
        if (index > -1) {
            companiesData.splice(index, 1);
            hasUnsavedChanges = true;
            showSaveButton();
            applyFilters();
        }

        closeDeleteModal();
    };

    // Escape HTML helper
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/'/g, "\\'");
    }

    // Logout function
    window.logout = function () {
        if (typeof clearSession === 'function') {
            clearSession();
        }
        window.location.href = '/login.html';
    };

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Initialize on load
    init();
})();
