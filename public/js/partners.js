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
// MAIN PARTNERS APPLICATION
// ========================================

(function() {
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
            const overlay = document.getElementById('partners-overlay-platform');

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

    // ========================================
    // API CONFIGURATION
    // ========================================

    const API_BASE = '/api';
    const PARTNERS_API_URL = `${API_BASE}/partners`;
    const UPDATE_API_URL = `${API_BASE}/partners-update`;
    const COMPANIES_API_URL = `${API_BASE}/companies`;
    const API_KEY = 'investclub-admin-secure-key-2024';

    // ========================================
    // PREDEFINED DATA
    // ========================================

    const SECTORS = [
        'AI/ML', 'FinTech', 'HealthTech', 'EdTech', 'E-commerce', 'SaaS',
        'Cybersecurity', 'Blockchain', 'Gaming', 'CleanTech', 'BioTech',
        'PropTech', 'FoodTech', 'Logistics', 'SpaceTech', 'Consumer',
        'Enterprise', 'Marketplace', 'B2B', 'B2C', 'Hardware', 'Other'
    ];

    const PARTNER_TYPES = ['investor', 'broker', 'advisor', 'other'];
    const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'never'];

    // ========================================
    // APPLICATION STATE
    // ========================================

    let partnersData = [];
    let companiesData = [];
    let filteredData = [];
    let hasUnsavedChanges = false;
    let editingPartnerId = null;
    let deletePartnerId = null;
    let detailPartnerId = null;

    // Sorting
    let sortColumn = 'lastName';
    let sortDirection = 'asc';

    // Filters
    let selectedPartnerTypes = [...PARTNER_TYPES];
    let selectedFrequencies = [...FREQUENCIES];
    let showAllPartners = true;
    let selectedPartner = null;

    // Input row state
    let inputRowState = {
        selectedCompanyId: null,
        selectedType: '',
        selectedFrequency: ''
    };

    // Modal state
    let modalState = {
        emails: [],
        phones: [],
        sectors: [],
        excludedSectors: [],
        companyId: null,
        introducedBy: null
    };

    // Inline editing state
    let currentEditingCell = null;

    // ========================================
    // INITIALIZATION
    // ========================================

    async function init() {
        try {
            loadStateFromURL();
            await Promise.all([
                loadCompanies(),
                loadPartners()
            ]);
            setupEventListeners();
            updateUIFromState();
            applyFilters();
        } catch (error) {
            console.error('Initialization error:', error);
            partnersData = [];
            filteredData = [];
            renderData();
        }
    }

    function loadStateFromURL() {
        const params = new URLSearchParams(window.location.search);

        if (params.get('partner')) {
            selectedPartner = decodeURIComponent(params.get('partner'));
        }

        if (params.get('showAll') !== null) {
            showAllPartners = params.get('showAll') === 'true';
        }

        if (params.get('types')) {
            selectedPartnerTypes = params.get('types').split(',');
        }

        if (params.get('frequencies')) {
            selectedFrequencies = params.get('frequencies').split(',');
        }

        if (params.get('sortColumn')) {
            sortColumn = params.get('sortColumn');
        }

        if (params.get('sortDirection')) {
            sortDirection = params.get('sortDirection');
        }
    }

    function updateURL() {
        const params = new URLSearchParams();

        if (selectedPartner) {
            params.set('partner', selectedPartner);
        }

        params.set('showAll', showAllPartners);

        if (selectedPartnerTypes.length < PARTNER_TYPES.length) {
            params.set('types', selectedPartnerTypes.join(','));
        }

        if (selectedFrequencies.length < FREQUENCIES.length) {
            params.set('frequencies', selectedFrequencies.join(','));
        }

        params.set('sortColumn', sortColumn);
        params.set('sortDirection', sortDirection);

        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }

    function updateUIFromState() {
        // Update search input
        if (selectedPartner) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = selectedPartner;
                searchInput.classList.add('has-value');
            }
        }

        // Update toggle
        const toggle = document.getElementById('filterToggle');
        if (toggle) {
            toggle.classList.toggle('active', showAllPartners);
        }

        // Update type filter checkboxes
        document.querySelectorAll('#typeFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = selectedPartnerTypes.includes(cb.value);
        });

        // Update frequency filter checkboxes
        document.querySelectorAll('#frequencyFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = selectedFrequencies.includes(cb.value);
        });

        // Update filter indicators
        const typeIndicator = document.getElementById('typeActiveIndicator');
        if (typeIndicator) {
            typeIndicator.style.display = selectedPartnerTypes.length < PARTNER_TYPES.length ? 'inline-block' : 'none';
        }

        const freqIndicator = document.getElementById('frequencyActiveIndicator');
        if (freqIndicator) {
            freqIndicator.style.display = selectedFrequencies.length < FREQUENCIES.length ? 'inline-block' : 'none';
        }

        // Update sort indicators
        document.querySelectorAll('.header-cell.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.sort === sortColumn) {
                header.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    }

    // ========================================
    // DATA LOADING
    // ========================================

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
    }

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
        filteredData = [...partnersData];
    }

    // ========================================
    // HELPER FUNCTIONS
    // ========================================

    function getCompanyName(companyId) {
        if (!companyId) return null;
        const company = companiesData.find(c => c.id === companyId);
        return company ? company.name : null;
    }

    function getPartnerName(partnerId) {
        if (!partnerId) return null;
        const partner = partnersData.find(p => p.id === partnerId);
        return partner ? `${partner.firstName || ''} ${partner.lastName || ''}`.trim() : null;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/'/g, "\\'");
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    function setupEventListeners() {
        // Search input
        setupSearchDropdown('searchInput', 'searchDropdown', false);
        setupSearchDropdown('mobile-searchInput', 'mobile-searchDropdown', false);

        // Input row company search
        setupSearchDropdown('inputCompany', 'inputCompanyDropdown', 'inputRow');

        // Modal company search
        setupSearchDropdown('modalCompanySearch', 'modalCompanyDropdown', 'modal');

        // Modal introduced by search
        setupSearchDropdown('modalIntroducedBySearch', 'modalIntroducedByDropdown', 'introducer');

        // Sortable headers
        document.querySelectorAll('.header-cell.sortable').forEach(header => {
            header.addEventListener('click', () => {
                handleSort(header.dataset.sort);
            });
        });

        // Close dropdowns on outside click
        document.addEventListener('click', handleOutsideClick);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeydown);

        // Modal input listeners
        setupModalInputListeners();
    }

    function setupSearchDropdown(inputId, dropdownId, mode) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);

        if (!input || !dropdown) return;

        input.addEventListener('focus', () => {
            renderSearchDropdown(dropdownId, input.value, mode);
            dropdown.classList.add('open');
        });

        input.addEventListener('input', () => {
            const hasValue = input.value.trim().length > 0;
            input.classList.toggle('has-value', hasValue);
            renderSearchDropdown(dropdownId, input.value, mode);
            dropdown.classList.add('open');
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const searchValue = input.value.trim();
                if (mode === 'inputRow' && searchValue) {
                    // For input row, check if there's an exact match
                    const match = companiesData.find(c =>
                        c.name.toUpperCase() === searchValue.toUpperCase()
                    );
                    if (match) {
                        selectInputRowCompany(match.id, match.name);
                    }
                } else if (mode === 'modal' && searchValue) {
                    const match = companiesData.find(c =>
                        c.name.toUpperCase() === searchValue.toUpperCase()
                    );
                    if (match) {
                        selectModalCompany(match.id, match.name);
                    }
                } else if (mode === 'introducer' && searchValue) {
                    const match = partnersData.find(p => {
                        const name = `${p.firstName || ''} ${p.lastName || ''}`.trim().toUpperCase();
                        return name === searchValue.toUpperCase();
                    });
                    if (match) {
                        selectModalIntroducer(match.id, `${match.firstName || ''} ${match.lastName || ''}`.trim());
                    }
                } else if (!mode && searchValue) {
                    selectedPartner = searchValue;
                    applyFilters();
                }
                dropdown.classList.remove('open');
            }
        });
    }

    function renderSearchDropdown(dropdownId, searchValue, mode) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const query = (searchValue || '').trim().toUpperCase();
        let items = [];

        if (mode === 'inputRow' || mode === 'modal') {
            // Company search
            items = companiesData
                .filter(c => !query || c.name.toUpperCase().includes(query))
                .slice(0, 10)
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    display: c.name
                }));
        } else if (mode === 'introducer') {
            // Partner search for introducer
            items = partnersData
                .filter(p => {
                    if (editingPartnerId && p.id === editingPartnerId) return false;
                    const name = `${p.firstName || ''} ${p.lastName || ''}`.trim().toUpperCase();
                    return !query || name.includes(query);
                })
                .slice(0, 10)
                .map(p => ({
                    id: p.id,
                    name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                    display: `${p.firstName || ''} ${p.lastName || ''}`.trim()
                }));
        } else {
            // Main partner search
            items = partnersData
                .filter(p => {
                    const name = `${p.firstName || ''} ${p.lastName || ''}`.trim().toUpperCase();
                    const email = p.emails && p.emails[0] ? p.emails[0].toUpperCase() : '';
                    return !query || name.includes(query) || email.includes(query);
                })
                .slice(0, 10)
                .map(p => ({
                    id: p.id,
                    name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                    display: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                    initials: `${(p.firstName || 'X')[0]}${(p.lastName || 'X')[0]}`.toUpperCase()
                }));
        }

        if (items.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item" style="color: var(--platform-muted);">No results found</div>';
            return;
        }

        dropdown.innerHTML = items.map(item => {
            if (mode === 'inputRow') {
                return `<div class="dropdown-item" onclick="window.selectInputRowCompany(${item.id}, '${escapeHtml(item.name)}')">${item.display}</div>`;
            } else if (mode === 'modal') {
                return `<div class="dropdown-item" onclick="window.selectModalCompany(${item.id}, '${escapeHtml(item.name)}')">${item.display}</div>`;
            } else if (mode === 'introducer') {
                return `<div class="dropdown-item" onclick="window.selectModalIntroducer(${item.id}, '${escapeHtml(item.name)}')">${item.display}</div>`;
            } else {
                const initials = item.initials || 'XX';
                return `
                    <div class="dropdown-item" onclick="window.selectPartnerSearch('${item.id}')">
                        <div class="partner-avatar">${initials}</div>
                        <span>${item.display}</span>
                    </div>
                `;
            }
        }).join('');
    }

    function handleOutsideClick(e) {
        // Close search dropdowns
        if (!e.target.closest('.company-search-bar') && !e.target.closest('.input-company-search')) {
            document.querySelectorAll('.search-dropdown').forEach(d => d.classList.remove('open'));
        }

        // Close mobile search
        if (!e.target.closest('.mobile-search-wrapper')) {
            const mobileDropdown = document.getElementById('mobile-searchDropdown');
            if (mobileDropdown) mobileDropdown.classList.remove('open');
        }

        // Close filter dropdowns
        if (!e.target.closest('.filter-wrapper')) {
            document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));
        }

        // Close structure dropdowns
        if (!e.target.closest('.input-cell-wrapper')) {
            document.querySelectorAll('.structure-dropdown').forEach(d => d.classList.remove('open'));
        }

        // Close multiselect dropdowns
        if (!e.target.closest('.multiselect-container')) {
            document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.remove('open'));
        }

        // Cancel inline editing
        if (currentEditingCell && !e.target.closest('.editable-cell') && !e.target.closest('.cell-edit-input')) {
            cancelCellEdit();
        }
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            closePartnerModal();
            closeDeleteModal();
            closeDetailModal();
            document.querySelectorAll('.search-dropdown, .filter-dropdown, .structure-dropdown, .multiselect-dropdown').forEach(d => {
                d.classList.remove('open');
            });
        }

        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (hasUnsavedChanges) {
                saveAllChanges();
            }
        }
    }

    function setupModalInputListeners() {
        // Email tags input
        const emailsInput = document.getElementById('emailsInput');
        if (emailsInput) {
            emailsInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = emailsInput.value.trim();
                    if (value && !modalState.emails.includes(value)) {
                        modalState.emails.push(value);
                        renderEmailTags();
                        emailsInput.value = '';
                    }
                }
            });
        }

        // Phone tags input
        const phonesInput = document.getElementById('phonesInput');
        if (phonesInput) {
            phonesInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = phonesInput.value.trim();
                    if (value && !modalState.phones.includes(value)) {
                        modalState.phones.push(value);
                        renderPhoneTags();
                        phonesInput.value = '';
                    }
                }
            });
        }

        // Sectors input
        const sectorsInput = document.getElementById('sectorsInput');
        if (sectorsInput) {
            sectorsInput.addEventListener('input', () => {
                renderSectorsDropdown(sectorsInput.value);
            });
            sectorsInput.addEventListener('focus', () => {
                renderSectorsDropdown(sectorsInput.value);
                document.getElementById('sectorsDropdown').classList.add('open');
            });
        }

        // Excluded sectors input
        const excludedSectorsInput = document.getElementById('excludedSectorsInput');
        if (excludedSectorsInput) {
            excludedSectorsInput.addEventListener('input', () => {
                renderExcludedSectorsDropdown(excludedSectorsInput.value);
            });
            excludedSectorsInput.addEventListener('focus', () => {
                renderExcludedSectorsDropdown(excludedSectorsInput.value);
                document.getElementById('excludedSectorsDropdown').classList.add('open');
            });
        }
    }

    // ========================================
    // FILTER FUNCTIONS
    // ========================================

    window.toggleActiveFilter = function() {
        showAllPartners = !showAllPartners;
        const toggle = document.getElementById('filterToggle');
        if (toggle) {
            toggle.classList.toggle('active', showAllPartners);
        }
        applyFilters();
    };

    window.toggleTypeFilter = function(event) {
        event.stopPropagation();
        const dropdown = document.getElementById('typeFilterDropdown');
        const wasOpen = dropdown.classList.contains('open');

        // Close all other dropdowns
        document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));

        if (!wasOpen) {
            dropdown.classList.add('open');
        }
    };

    window.toggleFrequencyFilter = function(event) {
        event.stopPropagation();
        const dropdown = document.getElementById('frequencyFilterDropdown');
        const wasOpen = dropdown.classList.contains('open');

        // Close all other dropdowns
        document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));

        if (!wasOpen) {
            dropdown.classList.add('open');
        }
    };

    window.applyTypeFilter = function() {
        selectedPartnerTypes = Array.from(
            document.querySelectorAll('#typeFilterDropdown input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        const indicator = document.getElementById('typeActiveIndicator');
        if (indicator) {
            indicator.style.display = selectedPartnerTypes.length < PARTNER_TYPES.length ? 'inline-block' : 'none';
        }

        document.getElementById('typeFilterDropdown').classList.remove('open');
        applyFilters();
    };

    window.resetTypeFilter = function() {
        selectedPartnerTypes = [...PARTNER_TYPES];
        document.querySelectorAll('#typeFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });

        const indicator = document.getElementById('typeActiveIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }

        document.getElementById('typeFilterDropdown').classList.remove('open');
        applyFilters();
    };

    window.applyFrequencyFilter = function() {
        selectedFrequencies = Array.from(
            document.querySelectorAll('#frequencyFilterDropdown input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        const indicator = document.getElementById('frequencyActiveIndicator');
        if (indicator) {
            indicator.style.display = selectedFrequencies.length < FREQUENCIES.length ? 'inline-block' : 'none';
        }

        document.getElementById('frequencyFilterDropdown').classList.remove('open');
        applyFilters();
    };

    window.resetFrequencyFilter = function() {
        selectedFrequencies = [...FREQUENCIES];
        document.querySelectorAll('#frequencyFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });

        const indicator = document.getElementById('frequencyActiveIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }

        document.getElementById('frequencyFilterDropdown').classList.remove('open');
        applyFilters();
    };

    function applyFilters() {
        filteredData = partnersData.filter(partner => {
            // Search filter
            if (selectedPartner) {
                const name = `${partner.firstName || ''} ${partner.lastName || ''}`.trim().toUpperCase();
                if (!name.includes(selectedPartner.toUpperCase())) {
                    return false;
                }
            }

            // Type filter
            if (selectedPartnerTypes.length < PARTNER_TYPES.length) {
                if (!partner.partnerType || !selectedPartnerTypes.includes(partner.partnerType)) {
                    return false;
                }
            }

            // Frequency filter
            if (selectedFrequencies.length < FREQUENCIES.length) {
                if (!partner.pushingFrequency || !selectedFrequencies.includes(partner.pushingFrequency)) {
                    return false;
                }
            }

            // Active filter (show only active partners)
            if (!showAllPartners) {
                // Filter based on recent activity (lastCall within 90 days)
                if (partner.lastCall) {
                    const lastCallDate = new Date(partner.lastCall);
                    const ninetyDaysAgo = new Date();
                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                    if (lastCallDate < ninetyDaysAgo) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            return true;
        });

        sortData();
        updateURL();
        renderData();
        renderMobileData();
    }

    // ========================================
    // SORTING
    // ========================================

    function handleSort(field) {
        if (sortColumn === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = field;
            sortDirection = 'asc';
        }

        document.querySelectorAll('.header-cell.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.sort === field) {
                header.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });

        sortData();
        updateURL();
        renderData();
    }

    function sortData() {
        filteredData.sort((a, b) => {
            let aVal, bVal;

            if (sortColumn === 'lastName') {
                aVal = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
                bVal = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
            } else if (sortColumn === 'companyId') {
                aVal = (getCompanyName(a.companyId) || '').toLowerCase();
                bVal = (getCompanyName(b.companyId) || '').toLowerCase();
            } else if (sortColumn === 'lastCall') {
                aVal = a.lastCall ? new Date(a.lastCall).getTime() : 0;
                bVal = b.lastCall ? new Date(b.lastCall).getTime() : 0;
            } else {
                aVal = (a[sortColumn] || '').toString().toLowerCase();
                bVal = (b[sortColumn] || '').toString().toLowerCase();
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // ========================================
    // SEARCH FUNCTIONS
    // ========================================

    window.selectPartnerSearch = function(id) {
        const partner = partnersData.find(p => String(p.id) === String(id));
        if (partner) {
            const name = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = name;
                searchInput.classList.add('has-value');
            }
            selectedPartner = name;
            document.getElementById('searchDropdown').classList.remove('open');
            applyFilters();
        }
    };

    window.clearSearch = function() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.remove('has-value');
        }
        selectedPartner = null;
        document.getElementById('searchDropdown').classList.remove('open');
        applyFilters();
    };

    window.clearMobileSearch = function() {
        const input = document.getElementById('mobile-searchInput');
        if (input) {
            input.value = '';
            input.classList.remove('has-value');
        }
        selectedPartner = null;
        document.getElementById('mobile-searchDropdown').classList.remove('open');
        applyFilters();
    };

    window.resetAllFilters = function() {
        selectedPartner = null;
        selectedPartnerTypes = [...PARTNER_TYPES];
        selectedFrequencies = [...FREQUENCIES];
        showAllPartners = true;

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.remove('has-value');
        }

        const mobileSearch = document.getElementById('mobile-searchInput');
        if (mobileSearch) {
            mobileSearch.value = '';
            mobileSearch.classList.remove('has-value');
        }

        updateUIFromState();
        applyFilters();
    };

    // ========================================
    // INPUT ROW FUNCTIONS
    // ========================================

    window.selectInputRowCompany = function(id, name) {
        inputRowState.selectedCompanyId = id;
        document.getElementById('inputCompanyId').value = id;
        document.getElementById('inputCompany').value = name;
        document.getElementById('inputCompanyDropdown').classList.remove('open');
    };

    window.toggleInputTypeDropdown = function() {
        const dropdown = document.getElementById('inputTypeDropdown');
        dropdown.classList.toggle('open');
    };

    window.selectInputType = function(type) {
        inputRowState.selectedType = type;
        document.getElementById('inputType').value = type;

        const selector = document.getElementById('inputTypeSelector');
        const placeholder = selector.querySelector('.structure-placeholder');
        placeholder.textContent = type.charAt(0).toUpperCase() + type.slice(1);

        document.getElementById('inputTypeDropdown').classList.remove('open');
    };

    window.toggleInputFrequencyDropdown = function() {
        const dropdown = document.getElementById('inputFrequencyDropdown');
        dropdown.classList.toggle('open');
    };

    window.selectInputFrequency = function(frequency) {
        inputRowState.selectedFrequency = frequency;
        document.getElementById('inputFrequency').value = frequency;

        const selector = document.getElementById('inputFrequencySelector');
        const placeholder = selector.querySelector('.structure-placeholder');

        const labels = {
            daily: 'Daily',
            weekly: 'Weekly',
            biweekly: 'Bi-weekly',
            monthly: 'Monthly',
            quarterly: 'Quarterly',
            never: 'Never'
        };
        placeholder.textContent = labels[frequency] || frequency;

        document.getElementById('inputFrequencyDropdown').classList.remove('open');
    };

    window.addPartnerFromInputRow = function() {
        const firstName = document.getElementById('inputFirstName').value.trim();
        const lastName = document.getElementById('inputLastName').value.trim();
        const email = document.getElementById('inputEmail').value.trim();
        const phone = document.getElementById('inputPhone').value.trim();
        const lastCall = document.getElementById('inputLastCall').value;

        if (!firstName && !lastName) {
            alert('Please enter at least a first name or last name');
            return;
        }

        const newId = Math.max(...partnersData.map(p => p.id || 0), 0) + 1;
        const newPartner = {
            id: newId,
            firstName,
            lastName,
            emails: email ? [email] : [],
            phones: phone ? [phone] : [],
            partnerType: inputRowState.selectedType || null,
            companyId: inputRowState.selectedCompanyId || null,
            pushingFrequency: inputRowState.selectedFrequency || null,
            lastCall: lastCall || null,
            createdAt: new Date().toISOString(),
            _modified: true
        };

        partnersData.push(newPartner);
        hasUnsavedChanges = true;
        showSaveButton();

        // Clear input row
        document.getElementById('inputFirstName').value = '';
        document.getElementById('inputLastName').value = '';
        document.getElementById('inputCompany').value = '';
        document.getElementById('inputCompanyId').value = '';
        document.getElementById('inputEmail').value = '';
        document.getElementById('inputPhone').value = '';
        document.getElementById('inputLastCall').value = '';
        document.getElementById('inputType').value = '';
        document.getElementById('inputFrequency').value = '';

        // Reset selectors
        document.getElementById('inputTypeSelector').querySelector('.structure-placeholder').textContent = 'Type...';
        document.getElementById('inputFrequencySelector').querySelector('.structure-placeholder').textContent = 'Freq...';

        inputRowState = {
            selectedCompanyId: null,
            selectedType: '',
            selectedFrequency: ''
        };

        applyFilters();
    };

    // ========================================
    // RENDER FUNCTIONS
    // ========================================

    function renderData() {
        const container = document.getElementById('dataContent');
        if (!container) return;

        if (filteredData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Partners Found</h3>
                    <p>Try adjusting your filters or add a new partner</p>
                </div>
            `;
            return;
        }

        const rows = filteredData.map(partner => {
            const name = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
            const initials = `${(partner.firstName || 'X')[0]}${(partner.lastName || 'X')[0]}`.toUpperCase();
            const primaryEmail = partner.emails && partner.emails[0] ? partner.emails[0] : '';
            const primaryPhone = partner.phones && partner.phones[0] ? partner.phones[0] : '';
            const companyName = getCompanyName(partner.companyId);
            const isModified = partner._modified ? ' modified' : '';

            const typeLabel = partner.partnerType ?
                partner.partnerType.charAt(0).toUpperCase() + partner.partnerType.slice(1) : '';

            const freqLabels = {
                daily: 'Daily',
                weekly: 'Weekly',
                biweekly: 'Bi-weekly',
                monthly: 'Monthly',
                quarterly: 'Quarterly',
                never: 'Never'
            };
            const freqLabel = partner.pushingFrequency ? freqLabels[partner.pushingFrequency] || partner.pushingFrequency : '';

            // Avatar: show image if available, otherwise initials
            const hasAvatar = partner.avatarUrl && partner.avatarUrl.endsWith('.jpg');
            const avatarHtml = hasAvatar
                ? `<img class="partner-avatar-img" src="${partner.avatarUrl}" alt="${initials}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="partner-avatar" style="display:none">${initials}</div>`
                : `<div class="partner-avatar">${initials}</div>`;

            return `
                <div class="data-row${isModified}" data-id="${partner.id}">
                    <div class="data-cell col-name editable-cell" onclick="startCellEdit(this, 'name', ${partner.id})">
                        <div class="partner-info">
                            ${avatarHtml}
                            <span class="partner-name">${name || '—'}</span>
                        </div>
                    </div>
                    <div class="data-cell col-company">
                        ${companyName ? `<a href="/companies.html" class="company-link">${companyName}</a>` : '<span class="empty-value">—</span>'}
                    </div>
                    <div class="data-cell col-type editable-cell" onclick="startCellEdit(this, 'partnerType', ${partner.id})">
                        ${typeLabel ? `<span class="type-badge ${partner.partnerType}">${typeLabel}</span>` : '<span class="empty-value">—</span>'}
                    </div>
                    <div class="data-cell col-email editable-cell" onclick="startCellEdit(this, 'email', ${partner.id})">
                        ${primaryEmail || '<span class="empty-value">—</span>'}
                    </div>
                    <div class="data-cell col-phone editable-cell" onclick="startCellEdit(this, 'phone', ${partner.id})">
                        ${primaryPhone || '<span class="empty-value">—</span>'}
                    </div>
                    <div class="data-cell col-frequency editable-cell" onclick="startCellEdit(this, 'pushingFrequency', ${partner.id})">
                        ${freqLabel ? `<span class="frequency-badge ${partner.pushingFrequency}">${freqLabel}</span>` : '<span class="empty-value">—</span>'}
                    </div>
                    <div class="data-cell col-lastcall editable-cell" onclick="startCellEdit(this, 'lastCall', ${partner.id})">
                        ${partner.lastCall ? formatDate(partner.lastCall) : '<span class="empty-value">—</span>'}
                    </div>
                    <div class="data-cell col-action">
                        <button class="btn-edit" onclick="openEditModal(${partner.id})">Edit</button>
                        <button class="btn-delete-row" onclick="openDeleteModal(${partner.id})">&times;</button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="data-table">${rows}</div>`;
    }

    function renderMobileData() {
        const container = document.getElementById('mobile-dataContent');
        if (!container) return;

        if (filteredData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Partners Found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        const cards = filteredData.map(partner => {
            const name = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
            const initials = `${(partner.firstName || 'X')[0]}${(partner.lastName || 'X')[0]}`.toUpperCase();
            const primaryEmail = partner.emails && partner.emails[0] ? partner.emails[0] : '';
            const companyName = getCompanyName(partner.companyId);

            const typeLabel = partner.partnerType ?
                partner.partnerType.charAt(0).toUpperCase() + partner.partnerType.slice(1) : '';

            // Avatar: show image if available, otherwise initials
            const hasAvatar = partner.avatarUrl && partner.avatarUrl.endsWith('.jpg');
            const avatarHtml = hasAvatar
                ? `<img class="partner-avatar-img" src="${partner.avatarUrl}" alt="${initials}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="partner-avatar" style="display:none">${initials}</div>`
                : `<div class="partner-avatar">${initials}</div>`;

            return `
                <div class="mobile-card" onclick="showPartnerDetail(${partner.id})">
                    <div class="mobile-card-header">
                        ${avatarHtml}
                        <div class="mobile-card-title">
                            <span class="partner-name">${name || 'Unknown'}</span>
                            ${primaryEmail ? `<span class="partner-email">${primaryEmail}</span>` : ''}
                        </div>
                        ${typeLabel ? `<span class="type-badge ${partner.partnerType}">${typeLabel}</span>` : ''}
                    </div>
                    <div class="mobile-card-body">
                        ${companyName ? `
                            <div class="mobile-field">
                                <span class="mobile-label">Company:</span>
                                <span class="mobile-value">${companyName}</span>
                            </div>
                        ` : ''}
                        ${partner.lastCall ? `
                            <div class="mobile-field">
                                <span class="mobile-label">Last Call:</span>
                                <span class="mobile-value">${formatDate(partner.lastCall)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = cards;
    }

    // ========================================
    // INLINE CELL EDITING
    // ========================================

    window.startCellEdit = function(cell, field, partnerId) {
        // Cancel any existing edit
        if (currentEditingCell) {
            cancelCellEdit();
        }

        const partner = partnersData.find(p => p.id === partnerId);
        if (!partner) return;

        currentEditingCell = cell;
        cell.classList.add('editing');

        let currentValue = '';
        let inputType = 'text';

        if (field === 'name') {
            currentValue = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
        } else if (field === 'email') {
            currentValue = partner.emails && partner.emails[0] ? partner.emails[0] : '';
        } else if (field === 'phone') {
            currentValue = partner.phones && partner.phones[0] ? partner.phones[0] : '';
        } else if (field === 'partnerType') {
            renderTypeEditDropdown(cell, partnerId, partner.partnerType);
            return;
        } else if (field === 'pushingFrequency') {
            renderFrequencyEditDropdown(cell, partnerId, partner.pushingFrequency);
            return;
        } else if (field === 'lastCall') {
            currentValue = partner.lastCall || '';
            inputType = 'date';
        } else {
            currentValue = partner[field] || '';
        }

        const input = document.createElement('input');
        input.type = inputType;
        input.className = 'cell-edit-input';
        input.value = currentValue;
        input.dataset.partnerId = partnerId;
        input.dataset.field = field;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveCellEdit(input);
            } else if (e.key === 'Escape') {
                cancelCellEdit();
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (currentEditingCell === cell) {
                    saveCellEdit(input);
                }
            }, 100);
        });

        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
    };

    function renderTypeEditDropdown(cell, partnerId, currentValue) {
        const options = PARTNER_TYPES.map(type => {
            const label = type.charAt(0).toUpperCase() + type.slice(1);
            return `<div class="edit-dropdown-item" onclick="saveCellDropdown(${partnerId}, 'partnerType', '${type}')">${label}</div>`;
        }).join('');

        cell.innerHTML = `
            <div class="cell-edit-dropdown">
                <div class="edit-dropdown-item" onclick="saveCellDropdown(${partnerId}, 'partnerType', '')">— None —</div>
                ${options}
            </div>
        `;
    }

    function renderFrequencyEditDropdown(cell, partnerId, currentValue) {
        const labels = {
            daily: 'Daily',
            weekly: 'Weekly',
            biweekly: 'Bi-weekly',
            monthly: 'Monthly',
            quarterly: 'Quarterly',
            never: 'Never'
        };

        const options = FREQUENCIES.map(freq => {
            return `<div class="edit-dropdown-item" onclick="saveCellDropdown(${partnerId}, 'pushingFrequency', '${freq}')">${labels[freq]}</div>`;
        }).join('');

        cell.innerHTML = `
            <div class="cell-edit-dropdown">
                <div class="edit-dropdown-item" onclick="saveCellDropdown(${partnerId}, 'pushingFrequency', '')">— None —</div>
                ${options}
            </div>
        `;
    }

    window.saveCellDropdown = function(partnerId, field, value) {
        const partner = partnersData.find(p => p.id === partnerId);
        if (partner) {
            partner[field] = value || null;
            partner._modified = true;
            hasUnsavedChanges = true;
            showSaveButton();
        }
        currentEditingCell = null;
        renderData();
    };

    function saveCellEdit(input) {
        const partnerId = parseInt(input.dataset.partnerId);
        const field = input.dataset.field;
        const newValue = input.value.trim();

        const partner = partnersData.find(p => p.id === partnerId);
        if (partner) {
            if (field === 'name') {
                const parts = newValue.split(/\s+/);
                partner.firstName = parts[0] || '';
                partner.lastName = parts.slice(1).join(' ') || '';
            } else if (field === 'email') {
                if (newValue) {
                    partner.emails = [newValue, ...(partner.emails || []).slice(1)];
                } else {
                    partner.emails = (partner.emails || []).slice(1);
                }
            } else if (field === 'phone') {
                if (newValue) {
                    partner.phones = [newValue, ...(partner.phones || []).slice(1)];
                } else {
                    partner.phones = (partner.phones || []).slice(1);
                }
            } else {
                partner[field] = newValue || null;
            }
            partner._modified = true;
            hasUnsavedChanges = true;
            showSaveButton();
        }

        currentEditingCell = null;
        renderData();
    }

    function cancelCellEdit() {
        if (currentEditingCell) {
            currentEditingCell.classList.remove('editing');
        }
        currentEditingCell = null;
        renderData();
    }

    // ========================================
    // MODAL FUNCTIONS
    // ========================================

    window.openPartnerModal = function() {
        editingPartnerId = null;
        resetModalState();

        document.getElementById('modalTitle').textContent = 'New Partner';
        document.getElementById('modalFirstName').value = '';
        document.getElementById('modalLastName').value = '';
        document.getElementById('modalPartnerType').value = '';
        document.getElementById('modalCompanySearch').value = '';
        document.getElementById('modalCompanyId').value = '';
        document.getElementById('modalFrequency').value = '';
        document.getElementById('modalCountry').value = '';
        document.getElementById('modalLinkedin').value = '';
        document.getElementById('modalIntroducedBySearch').value = '';
        document.getElementById('modalIntroducedBy').value = '';
        document.getElementById('modalMarketingSource').value = '';
        document.getElementById('modalFirstTouch').value = '';
        document.getElementById('modalFirstCall').value = '';
        document.getElementById('modalLastCall').value = '';

        // Reset checkboxes
        document.querySelectorAll('#fundingStageGroup input[type="checkbox"]').forEach(cb => cb.checked = false);

        renderEmailTags();
        renderPhoneTags();
        renderSectorChips();
        renderExcludedSectorChips();

        document.getElementById('partnerModal').classList.add('active');
    };

    window.openEditModal = function(id) {
        const partner = partnersData.find(p => p.id === id);
        if (!partner) return;

        editingPartnerId = id;
        resetModalState();

        document.getElementById('modalTitle').textContent = 'Edit Partner';
        document.getElementById('modalFirstName').value = partner.firstName || '';
        document.getElementById('modalLastName').value = partner.lastName || '';
        document.getElementById('modalPartnerType').value = partner.partnerType || '';
        document.getElementById('modalFrequency').value = partner.pushingFrequency || '';
        document.getElementById('modalCountry').value = partner.country || '';
        document.getElementById('modalLinkedin').value = partner.linkedin || '';
        document.getElementById('modalMarketingSource').value = partner.marketingSource || '';
        document.getElementById('modalFirstTouch').value = partner.firstTouch || '';
        document.getElementById('modalFirstCall').value = partner.firstCall || '';
        document.getElementById('modalLastCall').value = partner.lastCall || '';

        // Set company
        if (partner.companyId) {
            const companyName = getCompanyName(partner.companyId);
            document.getElementById('modalCompanyId').value = partner.companyId;
            document.getElementById('modalCompanySearch').value = companyName || '';
            modalState.companyId = partner.companyId;
        } else {
            document.getElementById('modalCompanyId').value = '';
            document.getElementById('modalCompanySearch').value = '';
        }

        // Set introduced by
        if (partner.introducedBy) {
            const introducerName = getPartnerName(partner.introducedBy);
            document.getElementById('modalIntroducedBy').value = partner.introducedBy;
            document.getElementById('modalIntroducedBySearch').value = introducerName || '';
            modalState.introducedBy = partner.introducedBy;
        } else {
            document.getElementById('modalIntroducedBy').value = '';
            document.getElementById('modalIntroducedBySearch').value = '';
        }

        // Set emails and phones
        modalState.emails = [...(partner.emails || [])];
        modalState.phones = [...(partner.phones || [])];
        renderEmailTags();
        renderPhoneTags();

        // Set funding stages
        document.querySelectorAll('#fundingStageGroup input[type="checkbox"]').forEach(cb => {
            cb.checked = partner.fundingStage && partner.fundingStage.includes(cb.value);
        });

        // Set sectors
        modalState.sectors = [...(partner.investmentSectors || [])];
        modalState.excludedSectors = [...(partner.excludedSectors || [])];
        renderSectorChips();
        renderExcludedSectorChips();

        document.getElementById('partnerModal').classList.add('active');
    };

    window.closePartnerModal = function() {
        document.getElementById('partnerModal').classList.remove('active');
        editingPartnerId = null;
    };

    function resetModalState() {
        modalState = {
            emails: [],
            phones: [],
            sectors: [],
            excludedSectors: [],
            companyId: null,
            introducedBy: null
        };
    }

    window.submitPartner = function() {
        const firstName = document.getElementById('modalFirstName').value.trim();
        const lastName = document.getElementById('modalLastName').value.trim();

        if (!firstName && !lastName) {
            alert('Please enter at least a first name or last name');
            return;
        }

        const fundingStage = Array.from(
            document.querySelectorAll('#fundingStageGroup input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        const partnerData = {
            firstName,
            lastName,
            emails: [...modalState.emails],
            phones: [...modalState.phones],
            partnerType: document.getElementById('modalPartnerType').value || null,
            companyId: modalState.companyId,
            pushingFrequency: document.getElementById('modalFrequency').value || null,
            country: document.getElementById('modalCountry').value.trim() || null,
            linkedin: document.getElementById('modalLinkedin').value.trim() || null,
            introducedBy: modalState.introducedBy,
            marketingSource: document.getElementById('modalMarketingSource').value || null,
            fundingStage,
            investmentSectors: [...modalState.sectors],
            excludedSectors: [...modalState.excludedSectors],
            firstTouch: document.getElementById('modalFirstTouch').value || null,
            firstCall: document.getElementById('modalFirstCall').value || null,
            lastCall: document.getElementById('modalLastCall').value || null,
            _modified: true
        };

        if (editingPartnerId) {
            const partner = partnersData.find(p => p.id === editingPartnerId);
            if (partner) {
                Object.assign(partner, partnerData);
            }
        } else {
            const newId = Math.max(...partnersData.map(p => p.id || 0), 0) + 1;
            partnersData.push({
                id: newId,
                ...partnerData,
                createdAt: new Date().toISOString()
            });
        }

        hasUnsavedChanges = true;
        showSaveButton();
        closePartnerModal();
        applyFilters();
    };

    // ========================================
    // MODAL TAG/CHIP FUNCTIONS
    // ========================================

    function renderEmailTags() {
        const container = document.getElementById('emailsTags');
        if (!container) return;
        container.innerHTML = modalState.emails.map((email, i) => `
            <span class="tag-item">${email}<span class="tag-remove" onclick="window.removeEmail(${i})">×</span></span>
        `).join('');
    }

    window.removeEmail = function(index) {
        modalState.emails.splice(index, 1);
        renderEmailTags();
    };

    function renderPhoneTags() {
        const container = document.getElementById('phonesTags');
        if (!container) return;
        container.innerHTML = modalState.phones.map((phone, i) => `
            <span class="tag-item">${phone}<span class="tag-remove" onclick="window.removePhone(${i})">×</span></span>
        `).join('');
    }

    window.removePhone = function(index) {
        modalState.phones.splice(index, 1);
        renderPhoneTags();
    };

    window.selectModalCompany = function(id, name) {
        modalState.companyId = id;
        document.getElementById('modalCompanyId').value = id;
        document.getElementById('modalCompanySearch').value = name;
        document.getElementById('modalCompanyDropdown').classList.remove('open');
    };

    window.selectModalIntroducer = function(id, name) {
        modalState.introducedBy = id;
        document.getElementById('modalIntroducedBy').value = id;
        document.getElementById('modalIntroducedBySearch').value = name;
        document.getElementById('modalIntroducedByDropdown').classList.remove('open');
    };

    // Sectors
    window.toggleSectorsDropdown = function() {
        renderSectorsDropdown('');
        document.getElementById('sectorsDropdown').classList.toggle('open');
    };

    function renderSectorsDropdown(filter) {
        const dropdown = document.getElementById('sectorsDropdown');
        if (!dropdown) return;

        const query = filter.toUpperCase();
        const available = SECTORS.filter(s =>
            !modalState.sectors.includes(s) &&
            (!query || s.toUpperCase().includes(query))
        );

        if (available.length === 0) {
            dropdown.innerHTML = '<div class="multiselect-option" style="color: var(--platform-muted);">No sectors available</div>';
            return;
        }

        dropdown.innerHTML = available.map(sector => `
            <div class="multiselect-option" onclick="window.addSector('${sector}')">${sector}</div>
        `).join('');
    }

    window.addSector = function(sector) {
        if (!modalState.sectors.includes(sector)) {
            modalState.sectors.push(sector);
            renderSectorChips();
            document.getElementById('sectorsInput').value = '';
            renderSectorsDropdown('');
        }
    };

    window.removeSector = function(sector) {
        modalState.sectors = modalState.sectors.filter(s => s !== sector);
        renderSectorChips();
        renderSectorsDropdown('');
    };

    function renderSectorChips() {
        const container = document.getElementById('sectorsChips');
        if (!container) return;
        container.innerHTML = modalState.sectors.map(sector => `
            <span class="selected-chip">${sector}<span class="chip-remove" onclick="window.removeSector('${sector}')">×</span></span>
        `).join('');
    }

    // Excluded sectors
    window.toggleExcludedSectorsDropdown = function() {
        renderExcludedSectorsDropdown('');
        document.getElementById('excludedSectorsDropdown').classList.toggle('open');
    };

    function renderExcludedSectorsDropdown(filter) {
        const dropdown = document.getElementById('excludedSectorsDropdown');
        if (!dropdown) return;

        const query = filter.toUpperCase();
        const available = SECTORS.filter(s =>
            !modalState.excludedSectors.includes(s) &&
            (!query || s.toUpperCase().includes(query))
        );

        if (available.length === 0) {
            dropdown.innerHTML = '<div class="multiselect-option" style="color: var(--platform-muted);">No sectors available</div>';
            return;
        }

        dropdown.innerHTML = available.map(sector => `
            <div class="multiselect-option" onclick="window.addExcludedSector('${sector}')">${sector}</div>
        `).join('');
    }

    window.addExcludedSector = function(sector) {
        if (!modalState.excludedSectors.includes(sector)) {
            modalState.excludedSectors.push(sector);
            renderExcludedSectorChips();
            document.getElementById('excludedSectorsInput').value = '';
            renderExcludedSectorsDropdown('');
        }
    };

    window.removeExcludedSector = function(sector) {
        modalState.excludedSectors = modalState.excludedSectors.filter(s => s !== sector);
        renderExcludedSectorChips();
        renderExcludedSectorsDropdown('');
    };

    function renderExcludedSectorChips() {
        const container = document.getElementById('excludedSectorsChips');
        if (!container) return;
        container.innerHTML = modalState.excludedSectors.map(sector => `
            <span class="selected-chip">${sector}<span class="chip-remove" onclick="window.removeExcludedSector('${sector}')">×</span></span>
        `).join('');
    }

    // ========================================
    // DELETE MODAL
    // ========================================

    window.openDeleteModal = function(id) {
        const partner = partnersData.find(p => p.id === id);
        if (!partner) return;

        deletePartnerId = id;
        const name = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
        document.getElementById('deletePartnerName').textContent = name || 'this partner';
        document.getElementById('deleteModal').classList.add('active');
    };

    window.closeDeleteModal = function() {
        document.getElementById('deleteModal').classList.remove('active');
        deletePartnerId = null;
    };

    window.confirmDelete = function() {
        if (!deletePartnerId) return;

        const index = partnersData.findIndex(p => p.id === deletePartnerId);
        if (index > -1) {
            partnersData.splice(index, 1);
            hasUnsavedChanges = true;
            showSaveButton();
            applyFilters();
        }

        closeDeleteModal();
    };

    // ========================================
    // DETAIL MODAL
    // ========================================

    window.showPartnerDetail = function(id) {
        const partner = partnersData.find(p => p.id === id);
        if (!partner) return;

        detailPartnerId = id;
        const name = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
        document.getElementById('detailModalTitle').textContent = name || 'Partner Details';

        const companyName = getCompanyName(partner.companyId);
        const introducerName = getPartnerName(partner.introducedBy);

        const content = `
            <div class="detail-section">
                <div class="detail-section-title">Contact Information</div>
                <div class="detail-row">
                    <span class="detail-label">Emails</span>
                    <span class="detail-value">${partner.emails && partner.emails.length > 0 ? partner.emails.join(', ') : '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phones</span>
                    <span class="detail-value">${partner.phones && partner.phones.length > 0 ? partner.phones.join(', ') : '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">LinkedIn</span>
                    <span class="detail-value">${partner.linkedin ? `<a href="${partner.linkedin}" target="_blank">${partner.linkedin}</a>` : '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Country</span>
                    <span class="detail-value">${partner.country || '—'}</span>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">Business Details</div>
                <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">${partner.partnerType ? `<span class="type-badge ${partner.partnerType}">${partner.partnerType}</span>` : '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Company</span>
                    <span class="detail-value">${companyName || '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Frequency</span>
                    <span class="detail-value">${partner.pushingFrequency || '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Marketing Source</span>
                    <span class="detail-value">${partner.marketingSource || '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Introduced By</span>
                    <span class="detail-value">${introducerName || '—'}</span>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">Investment Preferences</div>
                <div class="detail-row">
                    <span class="detail-label">Funding Stages</span>
                    <span class="detail-value">
                        ${partner.fundingStage && partner.fundingStage.length > 0
                            ? `<div class="detail-chips">${partner.fundingStage.map(s => `<span class="detail-chip">${s}</span>`).join('')}</div>`
                            : '—'}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Investment Sectors</span>
                    <span class="detail-value">
                        ${partner.investmentSectors && partner.investmentSectors.length > 0
                            ? `<div class="detail-chips">${partner.investmentSectors.map(s => `<span class="detail-chip">${s}</span>`).join('')}</div>`
                            : '—'}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Excluded Sectors</span>
                    <span class="detail-value">
                        ${partner.excludedSectors && partner.excludedSectors.length > 0
                            ? `<div class="detail-chips">${partner.excludedSectors.map(s => `<span class="detail-chip">${s}</span>`).join('')}</div>`
                            : '—'}
                    </span>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">Activity</div>
                <div class="detail-row">
                    <span class="detail-label">First Touch</span>
                    <span class="detail-value">${partner.firstTouch ? formatDate(partner.firstTouch) : '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">First Call</span>
                    <span class="detail-value">${partner.firstCall ? formatDate(partner.firstCall) : '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Last Call</span>
                    <span class="detail-value">${partner.lastCall ? formatDate(partner.lastCall) : '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">${partner.createdAt ? formatDate(partner.createdAt) : '—'}</span>
                </div>
            </div>
        `;

        document.getElementById('detailModalContent').innerHTML = content;
        document.getElementById('detailModal').classList.add('active');
    };

    window.closeDetailModal = function() {
        document.getElementById('detailModal').classList.remove('active');
        detailPartnerId = null;
    };

    window.editFromDetail = function() {
        if (detailPartnerId) {
            closeDetailModal();
            openEditModal(detailPartnerId);
        }
    };

    // ========================================
    // SAVE FUNCTIONS
    // ========================================

    function showSaveButton() {
        const btn = document.getElementById('btnSave');
        if (btn) {
            btn.style.display = hasUnsavedChanges ? 'flex' : 'none';
        }
    }

    window.saveAllChanges = async function() {
        try {
            const response = await fetch(UPDATE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: partnersData,
                    apiKey: API_KEY
                })
            });

            if (response.ok) {
                partnersData.forEach(p => delete p._modified);
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

    // ========================================
    // LOGOUT
    // ========================================

    window.logout = function() {
        if (typeof clearSession === 'function') {
            clearSession();
        }
        window.location.href = '/login.html';
    };

    // ========================================
    // UNSAVED CHANGES WARNING
    // ========================================

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // ========================================
    // START
    // ========================================

    init();
})();
