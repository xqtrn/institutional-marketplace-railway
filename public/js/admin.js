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

(function() {
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
            const baseWidth = 1250;
            const viewportWidth = window.innerWidth;
            const overlay = document.getElementById('institutional-overlay-platform');
            
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

    // Dynamic API endpoints (KV-based, synced with MailAI)
    const BUY_DATA_URL = '/api/buy';
    const SELL_DATA_URL = '/api/sell';
    const LOGOS_URL = '/api/logos.json';
    const PARTNERS_URL = '/api/partners.json';
    const UPDATE_API_URL = '/api/update';
    const EMAIL_ADDRESS = ''; // Email address will be configured later

    // API Key for write operations (set in Cloudflare Dashboard as API_SECRET)
    const API_KEY = 'investclub-admin-secure-key-2024';
    
    let platformState = {
        buyData: [],
        sellData: [],
        currentData: [],
        filteredData: [],
        activeTab: 'sell',
        selectedCompany: null,
        modalSelectedCompany: null,
        companyLogos: {},
        partners: [],
        sortColumn: 'date',
        sortDirection: 'desc',
        showAllData: true,
        selectedStructures: ['Direct trade', 'SPV', 'Forward'],
        selectedShareClasses: ['Common', 'Preferred']
    };
    
    const fallbackData = {
        buy: [],
        sell: []
    };
    
    async function init() {
        try {
            loadStateFromURL();
            await loadCompanyLogos();
            await loadPartners();
            await loadData();
            setupEventListeners();
            updateUIFromState();
            applyFilters();
        } catch (error) {
            console.error('Initialization error:', error);
            platformState.buyData = fallbackData.buy;
            platformState.sellData = fallbackData.sell;
            platformState.currentData = platformState.sellData;
            applyFilters();
        }
    }
    
    function loadStateFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        if (params.get('tab')) {
            platformState.activeTab = params.get('tab');
        }
        
        if (params.get('company')) {
            platformState.selectedCompany = decodeURIComponent(params.get('company'));
        }
        
        if (params.get('complete') !== null) {
            platformState.showAllData = params.get('complete') === 'false';
        }
        
        if (params.get('structure')) {
            platformState.selectedStructures = params.get('structure').split(',');
        }
        
        if (params.get('shareClass')) {
            platformState.selectedShareClasses = params.get('shareClass').split(',');
        }
        
        if (params.get('sortColumn')) {
            platformState.sortColumn = params.get('sortColumn');
        }
        
        if (params.get('sortDirection')) {
            platformState.sortDirection = params.get('sortDirection');
        }
    }
    
    function updateURL() {
        const params = new URLSearchParams();
        params.set('tab', platformState.activeTab);
        
        if (platformState.selectedCompany) {
            params.set('company', platformState.selectedCompany);
        }
        
        params.set('complete', !platformState.showAllData);
        
        if (platformState.selectedStructures.length < 3) {
            params.set('structure', platformState.selectedStructures.join(','));
        }
        
        if (platformState.selectedShareClasses.length < 2) {
            params.set('shareClass', platformState.selectedShareClasses.join(','));
        }
        
        params.set('sortColumn', platformState.sortColumn);
        params.set('sortDirection', platformState.sortDirection);
        
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
    
    function updateUIFromState() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === platformState.activeTab);
        });
        
        document.querySelectorAll('.mobile-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === platformState.activeTab);
        });
        
        if (platformState.selectedCompany) {
            const searchInput = document.getElementById('platform-searchInput');
            if (searchInput) {
                searchInput.value = platformState.selectedCompany;
                searchInput.classList.add('has-value');
            }
            
            const mobileSearch = document.getElementById('mobile-searchInput');
            if (mobileSearch) {
                mobileSearch.value = platformState.selectedCompany;
            }
        }
        
        const toggle = document.getElementById('platform-filterToggle');
        if (toggle) {
            toggle.classList.toggle('active', platformState.showAllData);
        }
        
        document.querySelectorAll('#platform-structureFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = platformState.selectedStructures.includes(cb.value);
        });
        
        document.querySelectorAll('#platform-shareFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = platformState.selectedShareClasses.includes(cb.value);
        });
        
        const structureIndicator = document.getElementById('platform-structureActiveIndicator');
        if (structureIndicator) {
            structureIndicator.style.display = platformState.selectedStructures.length < 3 ? 'inline-block' : 'none';
        }
        
        const shareIndicator = document.getElementById('platform-shareActiveIndicator');
        if (shareIndicator) {
            shareIndicator.style.display = platformState.selectedShareClasses.length < 2 ? 'inline-block' : 'none';
        }
        
        document.querySelectorAll('.header-cell.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.sort === platformState.sortColumn) {
                header.classList.add(platformState.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    }
    
    async function loadCompanyLogos() {
        try {
            const response = await fetch(LOGOS_URL);
            if (!response.ok) throw new Error('Failed to fetch logos');

            const logos = await response.json();
            platformState.companyLogos = logos;
        } catch (error) {
            console.error('Error loading logos:', error);
        }
    }

    async function loadPartners() {
        try {
            const response = await fetch(PARTNERS_URL);
            if (!response.ok) throw new Error('Failed to fetch partners');

            const data = await response.json();
            platformState.partners = data.partners || [];
        } catch (error) {
            console.error('Error loading partners:', error);
            platformState.partners = [];
        }
    }

    function findPartnerById(partnerId) {
        if (!partnerId) return null;
        return platformState.partners.find(p => p.id === partnerId);
    }

    function getPartnerDisplayName(partner) {
        if (!partner) return '';
        return `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
    }
    
    async function loadData() {
        try {
            const buyResponse = await fetch(BUY_DATA_URL);
            if (buyResponse.ok) {
                const buyJson = await buyResponse.json();
                // Handle both KV format (array of objects) and Google Sheets format
                if (Array.isArray(buyJson)) {
                    platformState.buyData = buyJson;
                } else if (buyJson.values) {
                    platformState.buyData = parseSheetData(buyJson.values);
                }
            }

            const sellResponse = await fetch(SELL_DATA_URL);
            if (sellResponse.ok) {
                const sellJson = await sellResponse.json();
                // Handle both KV format (array of objects) and Google Sheets format
                if (Array.isArray(sellJson)) {
                    platformState.sellData = sellJson;
                } else if (sellJson.values) {
                    platformState.sellData = parseSheetData(sellJson.values);
                }
            }

            if (platformState.buyData.length === 0) platformState.buyData = fallbackData.buy;
            if (platformState.sellData.length === 0) platformState.sellData = fallbackData.sell;

            // Data now comes directly from KV Storage API (no localStorage merge needed)
            platformState.currentData = platformState.activeTab === 'buy' ? platformState.buyData : platformState.sellData;
        } catch (error) {
            console.error('Error fetching data:', error);
            platformState.buyData = fallbackData.buy;
            platformState.sellData = fallbackData.sell;
            platformState.currentData = platformState.sellData;
        }
    }
    
    function parseSheetData(values) {
        if (!values || values.length < 2) return [];
        const rows = values.slice(1);
        return rows.map(row => ({
            company: row[0] || '',
            managementFee: row[1] || '',
            carry: row[2] || '',
            lastUpdate: row[3] || '',
            volume: row[5] || '',
            price: row[7] || '',
            valuation: row[8] || '',
            structure: row[9] || 'Unknown',
            shareClass: row[10] || 'Unknown'
        }));
    }
    
    function findCompanyLogo(companyName) {
        if (!companyName) return null;
        
        const upperName = companyName.toUpperCase();
        
        if (platformState.companyLogos[upperName]) {
            return platformState.companyLogos[upperName];
        }
        
        for (const [logoCompanyName, logoUrl] of Object.entries(platformState.companyLogos)) {
            if (logoCompanyName.toUpperCase() === upperName) {
                return logoUrl;
            }
        }
        
        const normalizedInput = upperName.replace(/[^A-Z0-9]/g, '');
        
        for (const [logoCompanyName, logoUrl] of Object.entries(platformState.companyLogos)) {
            const normalizedLogoName = logoCompanyName.toUpperCase().replace(/[^A-Z0-9]/g, '');
            
            if (normalizedLogoName.includes(normalizedInput) || normalizedInput.includes(normalizedLogoName)) {
                return logoUrl;
            }
        }
        
        const inputWords = upperName.split(/\s+/).filter(w => w.length > 2); // Only words longer than 2 chars
        
        for (const [logoCompanyName, logoUrl] of Object.entries(platformState.companyLogos)) {
            const logoWords = logoCompanyName.toUpperCase().split(/\s+/).filter(w => w.length > 2);
            
            const allInputWordsFound = inputWords.every(inputWord => 
                logoWords.some(logoWord => logoWord.includes(inputWord) || inputWord.includes(logoWord))
            );
            
            if (allInputWordsFound && inputWords.length > 0) {
                return logoUrl;
            }
            
            if (inputWords.length > 0 && logoWords.length > 0) {
                const firstInputWord = inputWords[0];
                const firstLogoWord = logoWords[0];
                
                if (firstInputWord === firstLogoWord || 
                    firstInputWord.includes(firstLogoWord) || 
                    firstLogoWord.includes(firstInputWord)) {
                    return logoUrl;
                }
            }
        }
        
        return null;
    }
    
    function formatStructure(row) {
        const structure = row.structure || '';

        if (structure.toUpperCase().includes('SPV')) {
            const fee = row.managementFee || '0';
            const carry = row.carry || '0';

            if (fee || carry) {
                return `${structure} (${fee}/${carry})`;
            }
        }

        return structure;
    }
    
    function applyFilters() {
        platformState.filteredData = platformState.currentData.filter(row => {
            if (platformState.selectedCompany &&
                row.company.toUpperCase() !== platformState.selectedCompany.toUpperCase()) {
                return false;
            }

            if (platformState.selectedStructures.length < 3) {
                const rowStructure = row.structure.toLowerCase();
                const match = platformState.selectedStructures.some(s =>
                    rowStructure.includes(s.toLowerCase()));
                if (!match) return false;
            }

            if (platformState.selectedShareClasses.length < 2) {
                const rowShare = row.shareClass.toLowerCase();
                const match = platformState.selectedShareClasses.some(s =>
                    rowShare.includes(s.toLowerCase()));
                if (!match) return false;
            }

            if (!platformState.showAllData) {
                const fields = [row.volume, row.price, row.valuation];
                for (const field of fields) {
                    const fieldStr = (field || '').toLowerCase();
                    if (fieldStr.includes('request') || fieldStr === 'n/a' || !field) {
                        return false;
                    }
                }
            }

            return true;
        });

        sortData();
        updateURL();
        renderData();
        renderMobileData();
    }
    
    function getCompanyBidCount(companyName) {
        return platformState.buyData.filter(row => 
            row.company.toUpperCase() === companyName.toUpperCase()
        ).length;
    }
    
    function sortData() {
        platformState.filteredData.sort((a, b) => {
            let aVal, bVal;
            
            if (platformState.sortColumn === 'company') {
                aVal = a.company.toLowerCase();
                bVal = b.company.toLowerCase();
            } else if (platformState.sortColumn === 'date') {
                aVal = parseDate(a.lastUpdate);
                bVal = parseDate(b.lastUpdate);
            } else if (platformState.sortColumn === 'volume') {
                aVal = parseValue(a.volume);
                bVal = parseValue(b.volume);
            } else if (platformState.sortColumn === 'price') {
                aVal = parseValue(a.price);
                bVal = parseValue(b.price);
            } else if (platformState.sortColumn === 'valuation') {
                aVal = parseValue(a.valuation);
                bVal = parseValue(b.valuation);
            } else {
                return 0;
            }
            
            let primaryResult;
            if (platformState.sortDirection === 'asc') {
                primaryResult = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                primaryResult = bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
            }
            
            if (primaryResult === 0) {
                const aCount = getCompanyBidCount(a.company);
                const bCount = getCompanyBidCount(b.company);
                
                if (aCount !== bCount) {
                    return bCount - aCount;
                }
                
                return a.company.toLowerCase().localeCompare(b.company.toLowerCase());
            }
            
            return primaryResult;
        });
    }
    
    function parseDate(dateStr) {
        if (!dateStr) return new Date(0);
        return new Date(dateStr);
    }
    
    function formatMobileDate(dateStr) {
        if (!dateStr) return '';
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        
        return `Updated: ${month}/${day}/${year}`;
    }
    
    function parseValue(str) {
        if (!str || str === 'N/A' || str.toLowerCase().includes('request')) return 0;
        let cleaned = str.replace(/[$,]/g, '');
        if (cleaned.includes('M')) {
            cleaned = cleaned.replace('M', '');
            return parseFloat(cleaned) * 1000000;
        }
        if (cleaned.includes('B')) {
            cleaned = cleaned.replace('B', '');
            return parseFloat(cleaned) * 1000000000;
        }
        return parseFloat(cleaned) || 0;
    }
    
    function formatVolume(input) {
        if (!input && input !== 0) return 'Request';

        // Handle number input (from MailAI)
        if (typeof input === 'number') {
            if (input >= 1000000) {
                const millions = input / 1000000;
                return '$' + millions.toFixed(2).replace(/\.00$/, '') + 'M';
            } else if (input >= 1000) {
                const thousands = input / 1000;
                return '$' + thousands.toFixed(0) + 'K';
            } else {
                return '$' + input.toFixed(0);
            }
        }

        // Handle string input
        const str = String(input);
        if (str === 'N/A' || str.toLowerCase().includes('request')) return str;

        const value = parseValue(str);
        if (value === 0) return str;

        if (value >= 1000000) {
            const millions = value / 1000000;
            return '$' + millions.toFixed(2).replace(/\.00$/, '') + 'M';
        } else if (value >= 1000) {
            const thousands = value / 1000;
            return '$' + thousands.toFixed(0) + 'K';
        } else {
            return '$' + value.toFixed(0);
        }
    }

    function formatValuation(input) {
        if (!input && input !== 0) return 'Request';

        // Handle number input (from MailAI)
        if (typeof input === 'number') {
            if (input >= 1000000000) {
                const billions = input / 1000000000;
                return '$' + billions.toFixed(1).replace(/\.0$/, '') + 'B';
            } else if (input >= 1000000) {
                const millions = input / 1000000;
                return '$' + millions.toFixed(1).replace(/\.0$/, '') + 'M';
            }
            return '$' + input;
        }

        // Handle string input
        const str = String(input);
        if (str === 'N/A' || str.toLowerCase().includes('request')) return str;

        if (str.includes('B')) {
            return str;
        }

        return str + 'B';
    }
    
    function renderData() {
        const container = document.getElementById('platform-dataContent');
        if (!container) return;

        if (platformState.filteredData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Deals Found</h3>
                    <p>Try adjusting your filters or add a new order</p>
                </div>
            `;
            return;
        }
        
        const dataRows = platformState.filteredData.map(row => {
            const logoUrl = findCompanyLogo(row.company);
            const logoHtml = logoUrl
                ? `<img src="${logoUrl}" alt="${row.company}">`
                : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f3f4f6; font-size: 9px; font-weight: 700;">${row.company.substring(0, 2).toUpperCase()}</div>`;

            const formattedVolume = formatVolume(row.volume);
            const formattedValuation = formatValuation(row.valuation);

            // Check if values are zero/empty for styling
            const isVolumeZero = !row.volume || row.volume === '0' || row.volume === '';
            const isPriceZero = !row.price || row.price === '0' || row.price === '';
            const isValuationZero = !row.valuation || row.valuation === '0' || row.valuation === '';

            const formattedStructure = formatStructure(row);

            const action = platformState.activeTab === 'buy' ? 'Purchase' : 'Sale';
            const subject = `RE: ${row.company} ${action} Order`;
            const body = `Dear Team,

I am interested in your ${action.toLowerCase()} order for ${row.company} securities.

Deal Details:
- Company: ${row.company}
- Structure: ${formattedStructure}
- Share Class: ${row.shareClass}
- Price: ${row.price}
- Volume: ${formattedVolume}
- Valuation: ${formattedValuation}
- Last Update: ${row.lastUpdate}

Please confirm the availability and provide any additional information.

Best regards`;
            const mailtoLink = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            // Create unique row ID for editing
            const rowId = row.id || `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            if (!row.id) row.id = rowId;

            // Store row type (buy/sell) to avoid ID collisions between datasets
            const rowType = platformState.activeTab;

            const partner = findPartnerById(row.partnerId);
            // Support both partnerId lookup and direct partner string (from MailAI)
            const partnerName = getPartnerDisplayName(partner) || row.partner || '';

            return `
                <div class="data-row" data-row-id="${rowId}" data-row-type="${rowType}">
                    <div class="data-cell col-company editable-cell" data-field="company" data-row-id="${rowId}" data-row-type="${rowType}" onclick="startCellEdit(this, 'company')">
                        <div class="company-info">
                            <div class="company-icon">${logoHtml}</div>
                            <span class="company-name">${row.company}</span>
                        </div>
                    </div>
                    <div class="data-cell col-partner editable-cell" data-field="partner" data-row-id="${rowId}" data-row-type="${rowType}" onclick="startCellEdit(this, 'partner')">
                        <span class="partner-name">${partnerName || '<span class="partner-placeholder">—</span>'}</span>
                    </div>
                    <div class="data-cell col-date editable-cell" data-field="date" data-row-id="${rowId}" data-row-type="${rowType}" onclick="startCellEdit(this, 'date')">
                        <span class="date-value">${row.lastUpdate}</span>
                    </div>
                    <div class="data-cell col-volume editable-cell" data-field="volume" data-row-id="${rowId}" data-row-type="${rowType}" onclick="startCellEdit(this, 'volume')">
                        <span class="volume-value${isVolumeZero ? ' zero-value' : ''}">${isVolumeZero ? '0' : formattedVolume}</span>
                    </div>
                    <div class="data-cell col-price editable-cell" data-field="price" data-row-id="${rowId}" data-row-type="${rowType}" onclick="startCellEdit(this, 'price')">
                        <span class="price-value${isPriceZero ? ' zero-value' : ''}">${isPriceZero ? '0' : row.price}</span>
                    </div>
                    <div class="data-cell col-valuation editable-cell" data-field="valuation" data-row-id="${rowId}" data-row-type="${rowType}" onclick="startCellEdit(this, 'valuation')">
                        <span class="valuation-value${isValuationZero ? ' zero-value' : ''}">${isValuationZero ? '0' : formattedValuation}</span>
                    </div>
                    <div class="data-cell col-structure editable-cell" data-field="structure" data-row-id="${rowId}" data-row-type="${rowType}" onclick="startCellEdit(this, 'structure')">
                        <span class="structure-tag">${formattedStructure}</span>
                    </div>
                    <div class="data-cell col-share editable-cell" data-field="shareClass" data-row-id="${rowId}" data-row-type="${rowType}" onclick="startCellEdit(this, 'shareClass')">
                        <span class="share-tag">${row.shareClass}</span>
                    </div>
                    <div class="data-cell col-action">
                        <button class="btn-inquire" onclick='openEditModal(${JSON.stringify(row)})'>Edit</button>
                        <button class="btn-delete-row" onclick='deleteRow("${rowId}", "${rowType}")' title="Delete row">&times;</button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `<div class="data-table">${dataRows}</div>`;
    }
    
    function renderMobileData() {
        const container = document.getElementById('mobile-dataContent');
        if (!container) return;
        
        if (platformState.filteredData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Deals Found</h3>
                    <p>Try adjusting your filters or add a new order</p>
                </div>
            `;
            return;
        }
        
        const mobileCards = platformState.filteredData.map(row => {
            const logoUrl = findCompanyLogo(row.company);
            const logoHtml = logoUrl
                ? `<img src="${logoUrl}" alt="${row.company}">`
                : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f3f4f6; font-size: 9px; font-weight: 700;">${row.company.substring(0, 2).toUpperCase()}</div>`;
            
            const formattedVolume = formatVolume(row.volume);
            const formattedValuation = formatValuation(row.valuation);
            
            const formattedStructure = formatStructure(row);
            
            const formattedDate = formatMobileDate(row.lastUpdate);
            
            const action = platformState.activeTab === 'buy' ? 'Purchase' : 'Sale';
            const subject = `RE: ${row.company} ${action} Order`;
            const body = `Dear Team,

I am interested in your ${action.toLowerCase()} order for ${row.company} securities.

Deal Details:
- Company: ${row.company}
- Structure: ${formattedStructure}
- Share Class: ${row.shareClass}
- Price: ${row.price}
- Volume: ${formattedVolume}
- Valuation: ${formattedValuation}
- Last Update: ${row.lastUpdate}

Please confirm the availability and provide any additional information.

Best regards`;
            const mailtoLink = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            return `
                <div class="mobile-deal-row">
                    <div class="mobile-deal-content">
                        <div class="mobile-col-1">
                            <div class="mobile-row-icon">${logoHtml}</div>
                            <div class="mobile-company-header">
                                <div class="mobile-row-company">${row.company}</div>
                                <div class="mobile-row-date">${formattedDate}</div>
                            </div>
                        </div>
                        
                        <div class="mobile-col-2">
                            <div class="mobile-tag structure">${formattedStructure}</div>
                            <div class="mobile-tag share">${row.shareClass}</div>
                        </div>
                        
                        <div class="mobile-col-3">
                            <div class="mobile-field-group">
                                <div class="mobile-field-label">Volume</div>
                                <div class="mobile-field-value">${formattedVolume}</div>
                            </div>
                            <div class="mobile-field-group">
                                <div class="mobile-field-label">Valuation</div>
                                <div class="mobile-field-value">${formattedValuation}</div>
                            </div>
                        </div>
                        
                        <div class="mobile-col-4">
                            <div class="mobile-price-row">
                                <span class="mobile-price-label">Price<br>per share</span>
                                <span class="mobile-price-value">${row.price}</span>
                            </div>
                            <button class="mobile-inquire-btn" onclick='openEditModal(${JSON.stringify(row)})'>Edit</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = mobileCards;
    }
    
    function setupSearchDropdown(inputId, dropdownId, mode = false) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);

        if (!input || !dropdown) return;

        input.addEventListener('focus', () => {
            renderSearchDropdown(dropdownId, input.value, mode);
            dropdown.classList.add('open');
        });

        input.addEventListener('input', () => {
            const hasValue = input.value.trim().length > 0;
            if (input.classList) {
                input.classList.toggle('has-value', hasValue);
            }
            renderSearchDropdown(dropdownId, input.value, mode);
            dropdown.classList.add('open');
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const searchValue = input.value.trim();
                if (searchValue) {
                    if (mode === true) {
                        platformState.modalSelectedCompany = searchValue;
                    } else if (mode === 'inputRow') {
                        inputRowState.selectedCompany = searchValue;
                        dropdown.classList.remove('open');
                        focusNextInputField('inputCompany');
                        return;
                    } else {
                        platformState.selectedCompany = searchValue;
                        applyFilters();
                    }
                }
                dropdown.classList.remove('open');
            }
        });
    }

    function renderSearchDropdown(dropdownId, searchValue, mode = false) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const dataCompaniesSet = new Set();
        platformState.currentData.forEach(row => {
            if (row.company) {
                dataCompaniesSet.add(row.company.toUpperCase().trim());
            }
        });
        const dataCompanies = Array.from(dataCompaniesSet);

        const logoCompanies = Object.keys(platformState.companyLogos);

        const uniqueCompanies = [];
        const seenUppercase = new Set();

        for (const company of [...dataCompanies, ...logoCompanies]) {
            if (!company) continue;
            const upperName = company.toUpperCase().trim();
            if (!seenUppercase.has(upperName)) {
                seenUppercase.add(upperName);
                uniqueCompanies.push(company);
            }
        }

        uniqueCompanies.sort((a, b) => a.toUpperCase().localeCompare(b.toUpperCase()));

        const search = (searchValue || '').toUpperCase().trim();
        const filteredCompanies = search
            ? uniqueCompanies.filter(c => c.toUpperCase().includes(search))
            : uniqueCompanies;

        const companyCounts = {};
        platformState.buyData.forEach(row => {
            const upperCompany = row.company.toUpperCase().trim();
            companyCounts[upperCompany] = (companyCounts[upperCompany] || 0) + 1;
        });

        filteredCompanies.sort((a, b) => {
            const upperA = a.toUpperCase().trim();
            const upperB = b.toUpperCase().trim();
            const countA = companyCounts[upperA] || 0;
            const countB = companyCounts[upperB] || 0;

            if (countB !== countA) {
                return countB - countA;
            }

            return a.toUpperCase().localeCompare(b.toUpperCase());
        });

        dropdown.innerHTML = filteredCompanies.map(company => {
            const logoUrl = findCompanyLogo(company);
            const logoHtml = logoUrl
                ? `<img src="${logoUrl}" alt="${company}">`
                : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f3f4f6; font-size: 9px; font-weight: 700;">${company.substring(0, 2).toUpperCase()}</div>`;

            // Determine which handler to use based on mode
            const onclickHandler = mode === 'inputRow'
                ? `selectInputCompany('${company.replace(/'/g, "\\'")}')`
                : `platformSelectFromSearch('${company.replace(/'/g, "\\'")}', ${mode === true})`;

            return `
                <div class="dropdown-item" onclick="${onclickHandler}">
                    <div class="company-icon" style="width: 24px; height: 24px;">${logoHtml}</div>
                    <span style="font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">${company}</span>
                </div>
            `;
        }).join('');
    }

    function setupEventListeners() {
        setupSearchDropdown('platform-searchInput', 'platform-searchDropdown', false);
        setupSearchDropdown('platform-modalSearchInput', 'platform-modalSearchDropdown', true);
        setupSearchDropdown('inputCompany', 'inputCompanyDropdown', 'inputRow');
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                platformState.activeTab = btn.dataset.tab;
                platformState.currentData = platformState.activeTab === 'buy' ? platformState.buyData : platformState.sellData;
                applyFilters();
            });
        });
        
        document.querySelectorAll('.mobile-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mobile-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                platformState.activeTab = btn.dataset.tab;
                platformState.currentData = platformState.activeTab === 'buy' ? platformState.buyData : platformState.sellData;
                applyFilters();
            });
        });
        
        const mobileSearchInput = document.getElementById('mobile-searchInput');
        const mobileSearchDropdown = document.getElementById('mobile-searchDropdown');
        
        if (mobileSearchInput && mobileSearchDropdown) {
            mobileSearchInput.addEventListener('focus', () => {
                renderMobileSearchDropdown();
                mobileSearchDropdown.classList.add('open');
            });
            
            mobileSearchInput.addEventListener('input', () => {
                const hasValue = mobileSearchInput.value.trim().length > 0;
                const mobileClear = document.querySelector('.mobile-search-clear');
                if (mobileClear) {
                    if (hasValue) {
                        mobileClear.classList.add('show');
                    } else {
                        mobileClear.classList.remove('show');
                    }
                }
                
                renderMobileSearchDropdown();
                if (mobileSearchInput.value.trim()) {
                    mobileSearchDropdown.classList.add('open');
                } else {
                    mobileSearchDropdown.classList.remove('open');
                }
            });
            
            mobileSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const searchValue = mobileSearchInput.value.trim();
                    if (searchValue) {
                        platformState.selectedCompany = searchValue;
                        applyFilters();
                    }
                    mobileSearchDropdown.classList.remove('open');
                }
            });
        }
        
        function renderMobileSearchDropdown() {
            if (!mobileSearchDropdown) return;
            
            const searchValue = mobileSearchInput.value.trim().toUpperCase();
            
            const dataCompaniesSet = new Set();
            platformState.currentData.forEach(row => {
                if (row.company) {
                    dataCompaniesSet.add(row.company.toUpperCase().trim());
                }
            });
            const dataCompanies = Array.from(dataCompaniesSet);
            
            const logoCompanies = Object.keys(platformState.companyLogos);
            
            const uniqueCompanies = [];
            const seenUppercase = new Set();
            
            for (const company of [...dataCompanies, ...logoCompanies]) {
                if (!company) continue;
                const upperName = company.toUpperCase().trim();
                if (!seenUppercase.has(upperName)) {
                    seenUppercase.add(upperName);
                    uniqueCompanies.push(company);
                }
            }
            
            uniqueCompanies.sort((a, b) => a.toUpperCase().localeCompare(b.toUpperCase()));
            
            const filteredCompanies = searchValue 
                ? uniqueCompanies.filter(c => c.toUpperCase().includes(searchValue))
                : uniqueCompanies;
            
            const companyCounts = {};
            platformState.buyData.forEach(row => {
                const upperCompany = row.company.toUpperCase().trim();
                companyCounts[upperCompany] = (companyCounts[upperCompany] || 0) + 1;
            });
            
            filteredCompanies.sort((a, b) => {
                const upperA = a.toUpperCase().trim();
                const upperB = b.toUpperCase().trim();
                const countA = companyCounts[upperA] || 0;
                const countB = companyCounts[upperB] || 0;
                if (countB !== countA) return countB - countA;
                return a.toUpperCase().localeCompare(b.toUpperCase());
            });
            
            if (filteredCompanies.length > 0) {
                mobileSearchDropdown.innerHTML = filteredCompanies.slice(0, 10).map(company => {
                    const logoUrl = findCompanyLogo(company);
                    const logoHtml = logoUrl
                        ? `<img src="${logoUrl}" alt="${company}" style="width: 100%; height: 100%; object-fit: contain;">`
                        : company.substring(0, 2).toUpperCase();
                    
                    return `
                        <div class="mobile-dropdown-item" onclick="platformSelectFromSearch('${company.replace(/'/g, "\\'")}', false)">
                            <div class="mobile-dropdown-icon">${logoHtml}</div>
                            <span class="mobile-dropdown-company-name">${company}</span>
                        </div>
                    `;
                }).join('');
            } else {
                mobileSearchDropdown.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--platform-muted); font-size: 10px;">No companies found</div>';
            }
        }
        
        
        const filterToggle = document.getElementById('platform-filterToggle');
        if (filterToggle) {
            filterToggle.addEventListener('click', function() {
                this.classList.toggle('active');
                platformState.showAllData = this.classList.contains('active');
                applyFilters();
            });
        }
        
        const structureHeader = document.getElementById('platform-structureHeader');
        const structureDropdown = document.getElementById('platform-structureFilterDropdown');
        
        if (structureHeader && structureDropdown) {
            structureHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                structureDropdown.classList.toggle('open');
                const shareDropdown = document.getElementById('platform-shareFilterDropdown');
                if (shareDropdown) {
                    shareDropdown.classList.remove('open');
                }
            });
        }
        
        const shareHeader = document.getElementById('platform-shareHeader');
        const shareDropdown = document.getElementById('platform-shareFilterDropdown');
        
        if (shareHeader && shareDropdown) {
            shareHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                shareDropdown.classList.toggle('open');
                if (structureDropdown) {
                    structureDropdown.classList.remove('open');
                }
            });
        }
        
        if (structureDropdown) {
            structureDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        if (shareDropdown) {
            shareDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        document.querySelectorAll('.header-cell.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const sortBy = header.dataset.sort;
                
                document.querySelectorAll('.header-cell.sortable').forEach(h => {
                    h.classList.remove('sort-asc', 'sort-desc');
                });
                
                if (platformState.sortColumn === sortBy) {
                    platformState.sortDirection = platformState.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    platformState.sortColumn = sortBy;
                    platformState.sortDirection = 'desc';
                }
                
                header.classList.add(platformState.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
                applyFilters();
            });
        });
        
        document.querySelectorAll('.deal-type-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.deal-type-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                const type = this.dataset.type;
                document.getElementById('platform-priceLabel').textContent = type === 'buy' ? 'Bid Price' : 'Offer Price';
                
                const modalContent = document.getElementById('platform-modalContent');
                if (type === 'buy') {
                    modalContent.classList.remove('sell-order-active');
                    modalContent.classList.add('buy-order-active');
                } else {
                    modalContent.classList.remove('buy-order-active');
                    modalContent.classList.add('sell-order-active');
                }
            });
        });
        
        document.querySelectorAll('#platform-structureCheckboxGroup .checkbox-option').forEach(option => {
            option.addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT') {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                const checkbox = this.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    
                    if (checkbox.checked) {
                        this.classList.add('selected');
                    } else {
                        this.classList.remove('selected');
                    }
                    
                    const spvFields = document.getElementById('platform-spvFields');
                    const spvChecked = document.querySelector('input[name="platformStructureBuy"][value="SPV"]:checked');
                    if (spvChecked) {
                        spvFields.classList.add('visible');
                    } else {
                        spvFields.classList.remove('visible');
                    }
                }
            });
            
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                    const parentOption = this.closest('.checkbox-option');
                    if (this.checked) {
                        parentOption.classList.add('selected');
                    } else {
                        parentOption.classList.remove('selected');
                    }
                    
                    const spvFields = document.getElementById('platform-spvFields');
                    const spvChecked = document.querySelector('input[name="platformStructureBuy"][value="SPV"]:checked');
                    if (spvChecked) {
                        spvFields.classList.add('visible');
                    } else {
                        spvFields.classList.remove('visible');
                    }
                });
            }
        });
        
        document.querySelectorAll('#platform-structureCheckboxGroupSell .checkbox-option').forEach(option => {
            option.addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT') {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                const checkbox = this.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    
                    if (checkbox.checked) {
                        this.classList.add('selected');
                    } else {
                        this.classList.remove('selected');
                    }
                    
                    const spvFields = document.getElementById('platform-spvFields');
                    const spvChecked = document.querySelector('input[name="platformStructureSell"][value="SPV"]:checked');
                    if (spvChecked) {
                        spvFields.classList.add('visible');
                    } else {
                        spvFields.classList.remove('visible');
                    }
                }
            });
            
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                    const parentOption = this.closest('.checkbox-option');
                    if (this.checked) {
                        parentOption.classList.add('selected');
                    } else {
                        parentOption.classList.remove('selected');
                    }
                    
                    const spvFields = document.getElementById('platform-spvFields');
                    const spvChecked = document.querySelector('input[name="platformStructureSell"][value="SPV"]:checked');
                    if (spvChecked) {
                        spvFields.classList.add('visible');
                    } else {
                        spvFields.classList.remove('visible');
                    }
                });
            }
        });
        
        document.querySelectorAll('#platform-shareCheckboxGroup .checkbox-option').forEach(option => {
            option.addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT') {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                const checkbox = this.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    
                    if (checkbox.checked) {
                        this.classList.add('selected');
                    } else {
                        this.classList.remove('selected');
                    }
                    
                    const seriesField = document.getElementById('platform-seriesField');
                    const preferredChecked = document.querySelector('input[name="platformShareClassBuy"][value="Preferred"]:checked');
                    if (preferredChecked) {
                        seriesField.classList.add('visible');
                    } else {
                        seriesField.classList.remove('visible');
                    }
                }
            });
            
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                    const parentOption = this.closest('.checkbox-option');
                    if (this.checked) {
                        parentOption.classList.add('selected');
                    } else {
                        parentOption.classList.remove('selected');
                    }
                    
                    const seriesField = document.getElementById('platform-seriesField');
                    const preferredChecked = document.querySelector('input[name="platformShareClassBuy"][value="Preferred"]:checked');
                    if (preferredChecked) {
                        seriesField.classList.add('visible');
                    } else {
                        seriesField.classList.remove('visible');
                    }
                });
            }
        });
        
        document.querySelectorAll('#platform-shareRadioGroup .radio-option').forEach(option => {
            option.addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT') {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                const radio = this.querySelector('input[type="radio"]');
                if (radio && !radio.checked) {
                    radio.checked = true;
                    
                    document.querySelectorAll('#platform-shareRadioGroup .radio-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    this.classList.add('selected');
                    
                    const seriesField = document.getElementById('platform-seriesField');
                    if (radio.value === 'Preferred') {
                        seriesField.classList.add('visible');
                    } else {
                        seriesField.classList.remove('visible');
                    }
                }
            });
            
            const radio = option.querySelector('input[type="radio"]');
            if (radio) {
                radio.addEventListener('change', function() {
                    document.querySelectorAll('#platform-shareRadioGroup .radio-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    this.closest('.radio-option').classList.add('selected');
                    
                    const seriesField = document.getElementById('platform-seriesField');
                    if (this.value === 'Preferred') {
                        seriesField.classList.add('visible');
                    } else {
                        seriesField.classList.remove('visible');
                    }
                });
            }
        });
        
        const modalOverlay = document.getElementById('platform-dealModal');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', function(e) {
                if (e.target === modalOverlay) {
                    platformCloseModal();
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            const searchDropdown = document.getElementById('platform-searchDropdown');
            const searchInput = document.getElementById('platform-searchInput');
            if (searchDropdown && !searchDropdown.contains(e.target) && e.target !== searchInput) {
                searchDropdown.classList.remove('open');
            }
            
            const modalDropdown = document.getElementById('platform-modalSearchDropdown');
            const modalInput = document.getElementById('platform-modalSearchInput');
            if (modalDropdown && !modalDropdown.contains(e.target) && e.target !== modalInput) {
                modalDropdown.classList.remove('open');
            }
            
            const mobileDropdown = document.getElementById('mobile-searchDropdown');
            const mobileInput = document.getElementById('mobile-searchInput');
            if (mobileDropdown && !mobileDropdown.contains(e.target) && e.target !== mobileInput) {
                mobileDropdown.classList.remove('open');
            }

            // Close input row company dropdown
            const inputCompanyDropdown = document.getElementById('inputCompanyDropdown');
            const inputCompanyField = document.getElementById('inputCompany');
            if (inputCompanyDropdown && !inputCompanyDropdown.contains(e.target) && e.target !== inputCompanyField) {
                inputCompanyDropdown.classList.remove('open');
            }

            if (structureHeader && !structureHeader.contains(e.target) && structureDropdown && !structureDropdown.contains(e.target)) {
                structureDropdown.classList.remove('open');
            }
            
            if (shareHeader && !shareHeader.contains(e.target) && shareDropdown && !shareDropdown.contains(e.target)) {
                shareDropdown.classList.remove('open');
            }
        });
    }
    
    window.platformSelectFromSearch = function(company, isModal) {
        if (isModal) {
            platformState.modalSelectedCompany = company;
            const input = document.getElementById('platform-modalSearchInput');
            if (input) {
                input.value = company;
                input.classList.add('has-value');
                input.classList.remove('error');
            }
            const searchBar = document.querySelector('.company-search-bar');
            if (searchBar) {
                searchBar.classList.remove('error');
            }
            document.getElementById('platform-modalSearchDropdown').classList.remove('open');
        } else {
            platformState.selectedCompany = company;
            
            const input = document.getElementById('platform-searchInput');
            if (input) {
                input.value = company;
                input.classList.add('has-value');
            }
            document.getElementById('platform-searchDropdown').classList.remove('open');
            
            const mobileInput = document.getElementById('mobile-searchInput');
            if (mobileInput) {
                mobileInput.value = company;
            }
            
            const mobileClear = document.querySelector('.mobile-search-clear');
            if (mobileClear && company) {
                mobileClear.classList.add('show');
            }
            
            const mobileDropdown = document.getElementById('mobile-searchDropdown');
            if (mobileDropdown) {
                mobileDropdown.classList.remove('open');
            }
            
            applyFilters();
        }
    }
    
    
    window.platformClearSearch = function() {
        platformState.selectedCompany = null;
        const input = document.getElementById('platform-searchInput');
        if (input) {
            input.value = '';
            input.classList.remove('has-value');
        }
        applyFilters();
    }
    
    window.platformClearMobileSearch = function() {
        platformState.selectedCompany = null;
        const input = document.getElementById('mobile-searchInput');
        if (input) {
            input.value = '';
        }
        const mobileClear = document.querySelector('.mobile-search-clear');
        if (mobileClear) {
            mobileClear.classList.remove('show');
        }
        applyFilters();
    }
    
    window.platformClearModalSearch = function() {
        platformState.modalSelectedCompany = null;
        const input = document.getElementById('platform-modalSearchInput');
        if (input) {
            input.value = '';
            input.classList.remove('has-value');
        }
    }
    
    window.platformResetAllFilters = function() {
        platformState.selectedCompany = null;
        const searchInput = document.getElementById('platform-searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.remove('has-value');
        }
        
        platformState.showAllData = true;
        const toggle = document.getElementById('platform-filterToggle');
        if (toggle) {
            toggle.classList.add('active');
        }
        
        platformState.selectedStructures = ['Direct trade', 'SPV', 'Forward'];
        document.querySelectorAll('#platform-structureFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        
        platformState.selectedShareClasses = ['Common', 'Preferred'];
        document.querySelectorAll('#platform-shareFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        
        platformState.sortColumn = 'date';
        platformState.sortDirection = 'desc';
        document.querySelectorAll('.header-cell.sortable').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
            if (h.dataset.sort === 'date') {
                h.classList.add('sort-desc');
            }
        });
        
        applyFilters();
    }
    
    window.platformResetAllMobileFilters = function() {
        platformState.selectedCompany = null;
        
        const searchInput = document.getElementById('platform-searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.remove('has-value');
        }
        
        const mobileSearchInput = document.getElementById('mobile-searchInput');
        if (mobileSearchInput) {
            mobileSearchInput.value = '';
        }
        
        platformState.showAllData = true;
        const toggle = document.getElementById('platform-filterToggle');
        if (toggle) {
            toggle.classList.add('active');
        }
        
        platformState.selectedStructures = ['Direct trade', 'SPV', 'Forward'];
        document.querySelectorAll('#platform-structureFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        
        platformState.selectedShareClasses = ['Common', 'Preferred'];
        document.querySelectorAll('#platform-shareFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        
        platformState.sortColumn = 'date';
        platformState.sortDirection = 'desc';
        document.querySelectorAll('.header-cell.sortable').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
            if (h.dataset.sort === 'date') {
                h.classList.add('sort-desc');
            }
        });
        
        applyFilters();
    }
    
    
    window.platformOpenModal = function() {
        document.getElementById('platform-dealModal').classList.add('active');
        platformClearModalSearch();
    }
    
    window.platformCloseModal = function() {
        document.getElementById('platform-dealModal').classList.remove('active');
        
        const modalContent = document.getElementById('platform-modalContent');
        modalContent.classList.remove('buy-order-active');
        modalContent.classList.add('sell-order-active');
        
        const spvFields = document.getElementById('platform-spvFields');
        if (spvFields) {
            spvFields.classList.remove('visible');
        }
        
        const seriesField = document.getElementById('platform-seriesField');
        if (seriesField) {
            seriesField.classList.remove('visible');
        }
        
        const managementFee = document.getElementById('platform-managementFee');
        const carry = document.getElementById('platform-carry');
        if (managementFee) managementFee.value = '';
        if (carry) carry.value = '';
        
        const series = document.getElementById('platform-series');
        if (series) series.value = '';
        
        document.querySelectorAll('input[name="platformStructureBuy"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        document.querySelectorAll('input[name="platformStructureSell"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        document.querySelectorAll('input[name="platformShareClassBuy"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        document.querySelectorAll('input[name="platformShareClass"]').forEach(radio => {
            radio.checked = false;
        });
        
        document.querySelectorAll('.checkbox-option, .radio-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        document.querySelectorAll('.deal-type-option').forEach(opt => opt.classList.remove('selected'));
        document.querySelector('.deal-type-option[data-type="sell"]').classList.add('selected');
        document.querySelector('input[name="platformDealType"][value="sell"]').checked = true;
        document.getElementById('platform-priceLabel').textContent = 'Offer Price';
    }
    
    window.platformSubmitDeal = function() {
        document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        
        const dealType = document.querySelector('input[name="platformDealType"]:checked').value;
        const company = platformState.modalSelectedCompany;
        const price = document.getElementById('platform-dealPrice').value;
        const volume = document.getElementById('platform-dealVolume').value;
        const valuation = document.getElementById('platform-dealValuation').value;
        
        let structures = [];
        let shareClasses = [];
        
        if (dealType === 'buy') {
            const checkedStructures = document.querySelectorAll('input[name="platformStructureBuy"]:checked');
            structures = Array.from(checkedStructures).map(cb => cb.value);
            
            const checkedShares = document.querySelectorAll('input[name="platformShareClassBuy"]:checked');
            shareClasses = Array.from(checkedShares).map(cb => cb.value);
        } else {
            const checkedStructures = document.querySelectorAll('input[name="platformStructureSell"]:checked');
            structures = Array.from(checkedStructures).map(cb => cb.value);
            
            const shareRadio = document.querySelector('input[name="platformShareClass"]:checked');
            if (shareRadio) {
                shareClasses = [shareRadio.value];
            }
        }
        
        if (!company) {
            const searchBar = document.querySelector('.company-search-bar');
            const searchInput = document.getElementById('platform-modalSearchInput');
            if (searchBar) searchBar.classList.add('error');
            if (searchInput) searchInput.classList.add('error');
            alert('Please select a target company');
            return;
        }
        
        const action = dealType === 'buy' ? 'Buy' : 'Sell';
        const subject = `New ${action} Order: ${company}`;
        
        let body = `Dear Team,

I would like to submit a new ${action.toLowerCase()} order with the following details:

Company: ${company}`;

        if (price) {
            body += `\n${action === 'Buy' ? 'Bid' : 'Offer'} Price: ${price}`;
        }
        
        if (volume) {
            body += `\nVolume: ${volume}`;
        }
        
        if (valuation) {
            body += `\nValuation: ${valuation}`;
        }
        
        if (structures.length > 0) {
            body += `\nStructure: ${structures.join(', ')}`;
            
            if (structures.includes('SPV')) {
                const managementFee = document.getElementById('platform-managementFee').value;
                const carry = document.getElementById('platform-carry').value;
                if (managementFee) {
                    body += `\nManagement Fee: ${managementFee}%`;
                }
                if (carry) {
                    body += `\nCarry: ${carry}%`;
                }
            }
        }

        if (shareClasses.length > 0) {
            body += `\nShare Class: ${shareClasses.join(', ')}`;
            
            if (shareClasses.includes('Preferred')) {
                const series = document.getElementById('platform-series').value;
                if (series) {
                    body += `\nSeries: ${series}`;
                }
            }
        }

        body += `

Please confirm receipt and next steps.

Best regards`;

        window.location.href = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        platformCloseModal();
    }
    
    window.platformApplyStructureFilter = function() {
        platformState.selectedStructures = [];
        document.querySelectorAll('#platform-structureFilterDropdown input[type="checkbox"]:checked').forEach(cb => {
            platformState.selectedStructures.push(cb.value);
        });
        
        const indicator = document.getElementById('platform-structureActiveIndicator');
        if (indicator) {
            indicator.style.display = platformState.selectedStructures.length < 3 ? 'inline-block' : 'none';
        }
        
        document.getElementById('platform-structureFilterDropdown').classList.remove('open');
        applyFilters();
    }
    
    window.platformResetStructureFilter = function() {
        document.querySelectorAll('#platform-structureFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        platformState.selectedStructures = ['Direct trade', 'SPV', 'Forward'];
        const indicator = document.getElementById('platform-structureActiveIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
        applyFilters();
    }
    
    window.platformApplyShareFilter = function() {
        platformState.selectedShareClasses = [];
        document.querySelectorAll('#platform-shareFilterDropdown input[type="checkbox"]:checked').forEach(cb => {
            platformState.selectedShareClasses.push(cb.value);
        });
        
        const indicator = document.getElementById('platform-shareActiveIndicator');
        if (indicator) {
            indicator.style.display = platformState.selectedShareClasses.length < 2 ? 'inline-block' : 'none';
        }
        
        document.getElementById('platform-shareFilterDropdown').classList.remove('open');
        applyFilters();
    }
    
    window.platformResetShareFilter = function() {
        document.querySelectorAll('#platform-shareFilterDropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        platformState.selectedShareClasses = ['Common', 'Preferred'];
        const indicator = document.getElementById('platform-shareActiveIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
        applyFilters();
    }

    // === ANTI-COPY PROTECTION ===

    // Block right-click context menu on images and logo containers
    document.addEventListener('contextmenu', function(e) {
        if (e.target.tagName === 'IMG' ||
            e.target.classList.contains('company-icon') ||
            e.target.classList.contains('mobile-row-icon') ||
            e.target.classList.contains('mobile-dropdown-icon')) {
            e.preventDefault();
            return false;
        }
    });

    // Block drag start on all images
    document.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });

    // Console warning when DevTools is opened
    const devtoolsWarning = function() {
        console.log('%c⚠️ WARNING', 'color: red; font-size: 20px; font-weight: bold;');
        console.log('%cThis is a browser feature intended for developers.', 'font-size: 14px;');
        console.log('%cIf someone told you to copy-paste something here, it\'s likely a scam.', 'font-size: 14px;');
        console.log('%c\nUnauthorized data extraction or logo copying is prohibited.', 'font-size: 14px; color: red;');
    };

    // Detect DevTools opening (simple check)
    let devtoolsOpen = false;
    const threshold = 160;
    setInterval(function() {
        if (window.outerWidth - window.innerWidth > threshold ||
            window.outerHeight - window.innerHeight > threshold) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                devtoolsWarning();
            }
        } else {
            devtoolsOpen = false;
        }
    }, 1000);

    // Make functions available globally for input row and delete functionality
    window.findCompanyLogo = findCompanyLogo;
    window.findPartnerById = findPartnerById;
    window.getPartnerDisplayName = getPartnerDisplayName;
    window.platformState = platformState;
    window.applyFilters = applyFilters;
    window.renderData = renderData;
    window.loadData = loadData;
    window.UPDATE_API_URL = UPDATE_API_URL;
    window.API_KEY = API_KEY;

    init();
})();

// ===== INLINE CELL EDITING FUNCTIONS =====
let currentEditingCell = null;

window.startCellEdit = function(cell, fieldType) {
    // Prevent re-editing if already editing this cell
    if (cell.classList.contains('editing')) return;

    // Close any other editing cell
    if (currentEditingCell && currentEditingCell !== cell) {
        cancelCellEdit(currentEditingCell);
    }

    const rowId = cell.dataset.rowId;
    const rowType = cell.dataset.rowType; // 'buy' or 'sell'
    const row = findRowById(rowId, rowType);
    if (!row) return;

    cell.classList.add('editing');
    currentEditingCell = cell;

    // Store original content for cancel
    cell.dataset.originalHtml = cell.innerHTML;

    switch(fieldType) {
        case 'company':
            renderCompanyEdit(cell, row);
            break;
        case 'partner':
            renderPartnerEdit(cell, row);
            break;
        case 'date':
            renderDateEdit(cell, row);
            break;
        case 'volume':
        case 'price':
        case 'valuation':
            renderNumericEdit(cell, row, fieldType);
            break;
        case 'structure':
            renderStructureEdit(cell, row);
            break;
        case 'shareClass':
            renderShareClassEdit(cell, row);
            break;
    }
};

function findRowById(rowId, rowType) {
    // Use specific dataset based on rowType to avoid ID collisions between buy and sell data
    const data = rowType === 'buy' ? window.platformState.buyData : window.platformState.sellData;
    // Convert to string for comparison since dataset values are always strings
    return data.find(r => String(r.id) === String(rowId));
}

function findAndUpdateRow(rowId, updates, rowType) {
    // Convert to string for comparison since dataset values are always strings
    const rowIdStr = String(rowId);

    // Use rowType to select the correct dataset
    if (rowType === 'buy') {
        const index = window.platformState.buyData.findIndex(r => String(r.id) === rowIdStr);
        if (index !== -1) {
            Object.assign(window.platformState.buyData[index], updates);
            saveToLocalStorage();
            saveToAPI('buy');
            return window.platformState.buyData[index];
        }
    } else if (rowType === 'sell') {
        const index = window.platformState.sellData.findIndex(r => String(r.id) === rowIdStr);
        if (index !== -1) {
            Object.assign(window.platformState.sellData[index], updates);
            saveToLocalStorage();
            saveToAPI('sell');
            return window.platformState.sellData[index];
        }
    }

    return null;
}

async function saveToAPI(type) {
    try {
        const data = type === 'buy' ? window.platformState.buyData : window.platformState.sellData;
        // API key inlined to prevent Terser from removing it
        const apiKey = 'investclub-admin-secure-key-2024';

        console.log('saveToAPI called:', { type, dataLength: data.length, hasApiKey: !!apiKey });

        const response = await fetch('/api/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: type,
                data: data,
                apiKey: apiKey
            })
        });

        console.log('API response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to save: ${response.status}`);
        }

        const result = await response.json();
        console.log('Saved successfully:', result);
        return true;
    } catch (error) {
        console.error('Error saving to API:', error);
        // Show error notification
        showNotification('Failed to save changes: ' + error.message, 'error');
        return false;
    }
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.api-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `api-notification api-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
        color: white;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Legacy function for backward compatibility (calls saveToAPI)
function saveToLocalStorage() {
    const activeTab = window.platformState.activeTab;
    saveToAPI(activeTab);
}

function cancelCellEdit(cell) {
    if (!cell || !cell.classList.contains('editing')) return;

    cell.innerHTML = cell.dataset.originalHtml;
    cell.classList.remove('editing');
    delete cell.dataset.originalHtml;

    if (currentEditingCell === cell) {
        currentEditingCell = null;
    }
}

function finishCellEdit(cell, rowId, field, newValue, additionalData = {}) {
    const updates = {};

    if (field === 'date') {
        updates.lastUpdate = newValue;
    } else {
        updates[field] = newValue;
    }

    // Merge additional data (e.g., managementFee and carry for structure)
    Object.assign(updates, additionalData);

    // Get rowType from cell dataset for correct data lookup
    const rowType = cell.dataset.rowType;
    const updatedRow = findAndUpdateRow(rowId, updates, rowType);

    if (updatedRow) {
        // Update currentData reference
        window.platformState.currentData = window.platformState.activeTab === 'buy'
            ? window.platformState.buyData
            : window.platformState.sellData;

        // Re-render the table
        window.applyFilters();
    }

    cell.classList.remove('editing');
    currentEditingCell = null;
}

// Company field edit - dropdown only, no free text (like input row)
function renderCompanyEdit(cell, row) {
    const companyInfo = cell.querySelector('.company-info');
    if (companyInfo) companyInfo.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'company-search-bar input-company-search';
    wrapper.innerHTML = `
        <input type="text" class="search-input input-cell" placeholder="Select company..." value="${row.company}" autocomplete="off" readonly>
        <span class="search-clear" style="display: none;">×</span>
        <div class="search-dropdown cell-edit-dropdown"></div>
    `;
    cell.appendChild(wrapper);

    const input = wrapper.querySelector('.search-input');
    const dropdown = wrapper.querySelector('.search-dropdown');
    const clearBtn = wrapper.querySelector('.search-clear');

    // Show dropdown immediately
    updateDropdown('');
    dropdown.classList.add('open');

    // Populate dropdown with companies
    function updateDropdown(searchValue) {
        const companies = Object.keys(window.platformState.companyLogos);
        const search = (searchValue || '').toUpperCase();
        const filtered = search
            ? companies.filter(c => c.toUpperCase().includes(search))
            : companies;

        const sorted = filtered.sort((a, b) => a.localeCompare(b)).slice(0, 10);

        dropdown.innerHTML = sorted.map(company => {
            const logoUrl = window.findCompanyLogo(company);
            const logoHtml = logoUrl
                ? `<img src="${logoUrl}" alt="${company}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: contain;">`
                : `<div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; font-size: 9px; font-weight: 700; border-radius: 4px;">${company.substring(0, 2).toUpperCase()}</div>`;
            return `<div class="dropdown-item" data-company="${company}"><div class="company-icon" style="width: 24px; height: 24px;">${logoHtml}</div><span style="font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">${company}</span></div>`;
        }).join('');

        if (sorted.length > 0) {
            dropdown.classList.add('open');
        } else {
            dropdown.classList.remove('open');
        }
    }

    // Make input filterable but not editable for free text
    input.addEventListener('click', () => {
        input.removeAttribute('readonly');
        input.select();
        updateDropdown(input.value);
        dropdown.classList.add('open');
    });

    input.addEventListener('input', () => {
        updateDropdown(input.value);
        clearBtn.style.display = input.value ? 'block' : 'none';
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        clearBtn.style.display = 'none';
        updateDropdown('');
        input.focus();
    });

    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
            const company = item.dataset.company;
            finishCellEdit(cell, row.id, 'company', company);
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelCellEdit(cell);
        }
        // Don't allow Enter for free text - must select from dropdown
    });
}

// Partner field edit - dropdown with search (like company)
function renderPartnerEdit(cell, row) {
    const partnerNameEl = cell.querySelector('.partner-name');
    if (partnerNameEl) partnerNameEl.style.display = 'none';

    const currentPartner = window.findPartnerById ? window.findPartnerById(row.partnerId) : null;
    const currentName = currentPartner ? `${currentPartner.firstName || ''} ${currentPartner.lastName || ''}`.trim() : '';

    const wrapper = document.createElement('div');
    wrapper.className = 'company-search-bar input-partner-search';
    wrapper.innerHTML = `
        <input type="text" class="search-input input-cell" placeholder="Select partner..." value="${currentName}" autocomplete="off">
        <span class="search-clear" style="display: ${currentName ? 'block' : 'none'};">×</span>
        <div class="search-dropdown cell-edit-dropdown"></div>
    `;
    cell.appendChild(wrapper);

    const input = wrapper.querySelector('.search-input');
    const dropdown = wrapper.querySelector('.search-dropdown');
    const clearBtn = wrapper.querySelector('.search-clear');

    // Show dropdown immediately
    updateDropdown('');
    dropdown.classList.add('open');

    function updateDropdown(searchValue) {
        const partners = window.platformState.partners || [];
        const search = (searchValue || '').toLowerCase();

        const filtered = search
            ? partners.filter(p => {
                const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
                const email = (p.emails && p.emails[0]) ? p.emails[0].toLowerCase() : '';
                return fullName.includes(search) || email.includes(search);
            })
            : partners;

        const sorted = filtered.slice(0, 15);

        dropdown.innerHTML = sorted.map(partner => {
            const name = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
            const avatarUrl = partner.avatarUrl;
            const avatarHtml = avatarUrl
                ? `<img src="${avatarUrl}" alt="${name}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
                : `<div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: #e5e7eb; font-size: 9px; font-weight: 700; border-radius: 50%; color: #374151;">${(partner.firstName || 'P').charAt(0).toUpperCase()}</div>`;
            return `<div class="dropdown-item" data-partner-id="${partner.id}"><div class="partner-avatar" style="width: 24px; height: 24px;">${avatarHtml}</div><span style="font-weight: 500; font-size: 12px;">${name}</span></div>`;
        }).join('');

        if (sorted.length > 0) {
            dropdown.classList.add('open');
        } else {
            dropdown.innerHTML = '<div class="dropdown-empty" style="padding: 8px 12px; color: #6b7280; font-size: 12px;">No partners found</div>';
            dropdown.classList.add('open');
        }
    }

    input.addEventListener('click', () => {
        input.select();
        updateDropdown(input.value);
        dropdown.classList.add('open');
    });

    input.addEventListener('input', () => {
        updateDropdown(input.value);
        clearBtn.style.display = input.value ? 'block' : 'none';
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Clear the partner
        finishCellEdit(cell, row.id, 'partnerId', null);
    });

    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
            const partnerId = parseInt(item.dataset.partnerId, 10);
            finishCellEdit(cell, row.id, 'partnerId', partnerId);
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelCellEdit(cell);
        }
    });

    // Focus input
    setTimeout(() => input.focus(), 50);
}

// Date field edit
function renderDateEdit(cell, row) {
    const dateValue = cell.querySelector('.date-value');
    if (dateValue) dateValue.style.display = 'none';

    // Create wrapper with text input + hidden date picker (like input row)
    const wrapper = document.createElement('div');
    wrapper.className = 'input-cell-wrapper date-wrapper';

    // Get current formatted date from cell
    const currentDate = row.lastUpdate || '';

    // Parse to get date picker value
    let datePickerValue = '';
    if (currentDate) {
        const parsed = parseDate(currentDate);
        if (parsed) {
            datePickerValue = parsed;
        }
    }

    wrapper.innerHTML = `
        <input type="text" class="input-cell date-input cell-date-display" value="${currentDate}" readonly>
        <input type="date" class="hidden-date-picker cell-date-picker" value="${datePickerValue}">
    `;

    cell.appendChild(wrapper);

    const displayInput = wrapper.querySelector('.cell-date-display');
    const datePicker = wrapper.querySelector('.cell-date-picker');

    // Open calendar immediately
    setTimeout(() => {
        try {
            datePicker.showPicker();
        } catch (e) {
            // Fallback for browsers that don't support showPicker
            datePicker.click();
        }
    }, 50);

    // When date is selected from picker
    datePicker.addEventListener('change', () => {
        const selectedDate = new Date(datePicker.value + 'T00:00:00');
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const formatted = selectedDate.toLocaleDateString('en-US', options);
        displayInput.value = formatted;
        finishCellEdit(cell, row.id, 'date', formatted);
    });

    // Click on display opens calendar
    displayInput.addEventListener('click', () => {
        try {
            datePicker.showPicker();
        } catch (e) {
            datePicker.click();
        }
    });

    // Handle escape key
    datePicker.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelCellEdit(cell);
        }
    });

    // Handle blur - close edit if clicking outside
    datePicker.addEventListener('blur', () => {
        setTimeout(() => {
            if (currentEditingCell === cell && !cell.contains(document.activeElement)) {
                cancelCellEdit(cell);
            }
        }, 200);
    });
}

function parseDate(dateStr) {
    if (!dateStr) return null;

    // Try YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // Try MM/DD/YYYY format
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
        const [, month, day, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try DD.MM.YYYY format
    const match2 = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (match2) {
        const [, day, month, year] = match2;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
}

function formatDateForDisplay(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
}

// Numeric fields edit (volume, price, valuation) - matching input row style
function renderNumericEdit(cell, row, fieldType) {
    const valueSpan = cell.querySelector(`.${fieldType}-value`);
    if (valueSpan) valueSpan.style.display = 'none';

    // Get the displayed formatted value from the cell
    const displayedValue = valueSpan ? valueSpan.textContent.trim() : '';

    // Parse current value to extract currency, number, and suffix
    let currency = '$';
    let numericPart = '';
    let suffix = '';

    if (displayedValue) {
        // Extract currency (first character if it's a currency symbol)
        const currencyMatch = displayedValue.match(/^([€$£¥₣])/);
        if (currencyMatch) {
            currency = currencyMatch[1];
        }

        // Extract numeric part (digits and decimal point)
        const numMatch = displayedValue.match(/[\d.]+/);
        if (numMatch) {
            numericPart = numMatch[0];
        }

        // Extract suffix (M, K, B at the end)
        const suffixMatch = displayedValue.match(/([MKB])$/);
        if (suffixMatch) {
            suffix = suffixMatch[1];
        }
    }

    const uniqueId = `edit-${fieldType}-${row.id}`;
    let wrapperClass = '';
    let suffixHtml = '';
    let defaultSuffix = '';

    if (fieldType === 'volume') {
        wrapperClass = 'volume-wrapper';
        defaultSuffix = suffix || 'M';
        suffixHtml = `<span class="input-suffix volume-suffix" id="${uniqueId}-suffix" onclick="toggleEditVolumeSuffix('${uniqueId}')">${defaultSuffix}</span>`;
    } else if (fieldType === 'price') {
        wrapperClass = 'price-wrapper';
        // Price has no suffix
    } else if (fieldType === 'valuation') {
        wrapperClass = 'valuation-wrapper';
        defaultSuffix = suffix || 'B';
        suffixHtml = `<span class="input-suffix">${defaultSuffix}</span>`;
    }

    const wrapper = document.createElement('div');
    wrapper.className = `input-cell-wrapper ${wrapperClass}`;
    wrapper.innerHTML = `
        <span class="input-prefix currency-selector" id="${uniqueId}-currency" onclick="toggleEditCurrencyDropdown('${uniqueId}')">${currency}</span>
        <div class="currency-dropdown" id="${uniqueId}-dropdown"></div>
        <input type="text" class="input-cell ${fieldType}-input" id="${uniqueId}-input" placeholder="0" value="${numericPart}">
        ${suffixHtml}
    `;

    cell.appendChild(wrapper);

    const input = wrapper.querySelector(`#${uniqueId}-input`);
    input.focus();
    input.select();

    // Initialize currency dropdown
    initEditCurrencyDropdown(uniqueId, fieldType);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const currencyVal = wrapper.querySelector('.currency-selector').textContent;
            const suffixVal = wrapper.querySelector('.input-suffix')?.textContent || '';
            const formattedValue = currencyVal + (input.value || '0') + suffixVal;
            finishCellEdit(cell, row.id, fieldType, formattedValue);
        } else if (e.key === 'Escape') {
            cancelCellEdit(cell);
        }
    });

    input.addEventListener('blur', (e) => {
        // Check if clicking within the same cell wrapper
        setTimeout(() => {
            if (currentEditingCell === cell && !wrapper.contains(document.activeElement)) {
                const currencyVal = wrapper.querySelector('.currency-selector').textContent;
                const suffixVal = wrapper.querySelector('.input-suffix')?.textContent || '';
                const formattedValue = currencyVal + (input.value || '0') + suffixVal;
                finishCellEdit(cell, row.id, fieldType, formattedValue);
            }
        }, 150);
    });
}

// Initialize currency dropdown for edit mode
function initEditCurrencyDropdown(uniqueId, fieldType) {
    const dropdown = document.getElementById(`${uniqueId}-dropdown`);
    if (!dropdown) return;

    const currencies = ['$', '€', '£', '¥', '₣'];
    dropdown.innerHTML = currencies.map(c =>
        `<div class="currency-option" onclick="selectEditCurrency('${uniqueId}', '${c}')">${c}</div>`
    ).join('');
}

// Toggle currency dropdown in edit mode
window.toggleEditCurrencyDropdown = function(uniqueId) {
    const dropdown = document.getElementById(`${uniqueId}-dropdown`);
    if (dropdown) {
        dropdown.classList.toggle('open');
    }
};

// Select currency in edit mode
window.selectEditCurrency = function(uniqueId, currency) {
    const currencyEl = document.getElementById(`${uniqueId}-currency`);
    const dropdown = document.getElementById(`${uniqueId}-dropdown`);
    if (currencyEl) currencyEl.textContent = currency;
    if (dropdown) dropdown.classList.remove('open');
};

// Toggle volume suffix (M/K) in edit mode
window.toggleEditVolumeSuffix = function(uniqueId) {
    const suffix = document.getElementById(`${uniqueId}-suffix`);
    if (suffix) {
        suffix.textContent = suffix.textContent === 'M' ? 'K' : 'M';
    }
};

// Structure field edit - matching input row style
function renderStructureEdit(cell, row) {
    const tag = cell.querySelector('.structure-tag');
    if (tag) tag.style.display = 'none';

    const currentStructure = row.structure || '';

    // Parse structures - handle "SPV (0/5)" format by removing parentheses content
    const structureText = currentStructure.replace(/\s*\([^)]*\)/g, ''); // Remove fee/carry part
    const structures = structureText.split(/[\/,]/).map(s => s.trim()).filter(Boolean);

    // Check structure types - use case-insensitive matching
    const hasDirect = structures.some(s => s.toLowerCase().includes('direct'));
    const hasSPV = structures.some(s => s.toUpperCase().includes('SPV'));
    const hasForward = structures.some(s => s.toLowerCase().includes('forward'));

    // Get current fee and carry values from row data
    const currentFee = row.managementFee || '0';
    const currentCarry = row.carry || '0';

    const uniqueId = `edit-structure-${row.id}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'input-cell-wrapper structure-wrapper';
    wrapper.innerHTML = `
        <div class="input-cell structure-input" id="${uniqueId}-input" tabindex="0">
            <span class="structure-placeholder">${currentStructure || 'Select...'}</span>
            <span class="filter-icon">▼</span>
        </div>
        <div class="structure-dropdown" id="${uniqueId}-dropdown">
            <div class="filter-list">
                <div class="filter-item">
                    <input type="checkbox" id="${uniqueId}-direct" value="Direct trade" ${hasDirect ? 'checked' : ''}>
                    <label for="${uniqueId}-direct">Direct Trade</label>
                </div>
                <div class="filter-item">
                    <input type="checkbox" id="${uniqueId}-spv" value="SPV" ${hasSPV ? 'checked' : ''}>
                    <label for="${uniqueId}-spv">SPV</label>
                </div>
                <div class="filter-item">
                    <input type="checkbox" id="${uniqueId}-forward" value="Forward" ${hasForward ? 'checked' : ''}>
                    <label for="${uniqueId}-forward">Forward</label>
                </div>
            </div>
            <div class="spv-fee-input" id="${uniqueId}-spv-fee" style="display: ${hasSPV ? 'block' : 'none'};">
                <div class="spv-fee-fields">
                    <div class="spv-fee-field-wrapper">
                        <label class="spv-fee-label">Fee %</label>
                        <input type="text" class="input-cell spv-fee-field" id="${uniqueId}-fee" placeholder="0" value="${currentFee}">
                    </div>
                    <span class="spv-fee-separator">/</span>
                    <div class="spv-fee-field-wrapper">
                        <label class="spv-fee-label">Carry %</label>
                        <input type="text" class="input-cell spv-fee-field" id="${uniqueId}-carry" placeholder="0" value="${currentCarry}">
                    </div>
                </div>
            </div>
            <div class="filter-actions">
                <button class="filter-btn apply" id="${uniqueId}-apply">Apply</button>
            </div>
        </div>
    `;

    cell.appendChild(wrapper);

    const inputBtn = wrapper.querySelector(`#${uniqueId}-input`);
    const dropdown = wrapper.querySelector(`#${uniqueId}-dropdown`);
    const applyBtn = wrapper.querySelector(`#${uniqueId}-apply`);
    const spvCheckbox = wrapper.querySelector(`#${uniqueId}-spv`);
    const spvFeeContainer = wrapper.querySelector(`#${uniqueId}-spv-fee`);

    inputBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    // Show/hide SPV fee input based on SPV checkbox
    spvCheckbox.addEventListener('change', () => {
        spvFeeContainer.style.display = spvCheckbox.checked ? 'block' : 'none';
    });

    applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = [];
        wrapper.querySelectorAll('.filter-list input[type="checkbox"]:checked').forEach(cb => {
            selected.push(cb.value);
        });

        let newValue = selected.join(' / ') || 'Request';

        // Get SPV fee and carry if SPV is selected
        let newFee = '';
        let newCarry = '';
        if (selected.includes('SPV')) {
            const feeInput = wrapper.querySelector(`#${uniqueId}-fee`);
            const carryInput = wrapper.querySelector(`#${uniqueId}-carry`);
            newFee = feeInput?.value.trim() || '0';
            newCarry = carryInput?.value.trim() || '0';
        }

        // Pass structure with fee/carry info
        finishCellEdit(cell, row.id, 'structure', newValue, { managementFee: newFee, carry: newCarry });
    });

    // Open dropdown immediately
    setTimeout(() => dropdown.classList.add('open'), 10);
}

// Share Class field edit - matching input row style
function renderShareClassEdit(cell, row) {
    const tag = cell.querySelector('.share-tag');
    if (tag) tag.style.display = 'none';

    const currentShare = row.shareClass || '';
    const shares = currentShare.split('/').map(s => s.trim()).filter(Boolean);
    const uniqueId = `edit-share-${row.id}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'input-cell-wrapper share-wrapper';
    wrapper.innerHTML = `
        <div class="input-cell share-input" id="${uniqueId}-input" tabindex="0">
            <span class="share-placeholder">${currentShare || 'Select...'}</span>
            <span class="filter-icon">▼</span>
        </div>
        <div class="share-dropdown" id="${uniqueId}-dropdown">
            <div class="filter-list">
                <div class="filter-item">
                    <input type="checkbox" id="${uniqueId}-common" value="Common" ${shares.includes('Common') ? 'checked' : ''}>
                    <label for="${uniqueId}-common">Common</label>
                </div>
                <div class="filter-item">
                    <input type="checkbox" id="${uniqueId}-preferred" value="Preferred" ${shares.includes('Preferred') ? 'checked' : ''}>
                    <label for="${uniqueId}-preferred">Preferred</label>
                </div>
            </div>
            <div class="filter-actions">
                <button class="filter-btn apply" id="${uniqueId}-apply">Apply</button>
            </div>
        </div>
    `;

    cell.appendChild(wrapper);

    const inputBtn = wrapper.querySelector(`#${uniqueId}-input`);
    const dropdown = wrapper.querySelector(`#${uniqueId}-dropdown`);
    const applyBtn = wrapper.querySelector(`#${uniqueId}-apply`);

    inputBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = [];
        wrapper.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            selected.push(cb.value);
        });
        const newValue = selected.join(' / ') || 'Request';
        finishCellEdit(cell, row.id, 'shareClass', newValue);
    });

    // Open dropdown immediately
    setTimeout(() => dropdown.classList.add('open'), 10);
}

// Close editing when clicking outside
document.addEventListener('click', (e) => {
    if (currentEditingCell && !currentEditingCell.contains(e.target)) {
        // Don't cancel if clicking on dropdown items
        if (!e.target.closest('.cell-edit-dropdown') && !e.target.closest('.structure-dropdown') && !e.target.closest('.share-dropdown')) {
            cancelCellEdit(currentEditingCell);
        }
    }
});

// Edit Modal Functions (Global scope for onclick handlers)
window.openEditModal = function(dealData) {
    const modal = document.getElementById('editModal');

    // Pre-fill form fields
    document.getElementById('editCompany').value = dealData.company || '';
    document.getElementById('editPrice').value = dealData.price || '';
    document.getElementById('editVolume').value = dealData.volume || '';
    document.getElementById('editValuation').value = dealData.valuation || '';
    document.getElementById('editStructure').value = dealData.structure || '';
    document.getElementById('editShareClass').value = dealData.shareClass || '';

    // Store original data for reference
    modal.dataset.originalData = JSON.stringify(dealData);

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeEditModal = function() {
    const modal = document.getElementById('editModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
};

window.saveEditedDeal = function() {
    const dealData = {
        company: document.getElementById('editCompany').value,
        price: document.getElementById('editPrice').value,
        volume: document.getElementById('editVolume').value,
        valuation: document.getElementById('editValuation').value,
        structure: document.getElementById('editStructure').value,
        shareClass: document.getElementById('editShareClass').value
    };

    console.log('Edited Deal Data:', dealData);
    window.closeEditModal();
};

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        window.closeEditModal();
    }
});

// History Modal Functions
window.openHistoryModal = async function() {
    const modal = document.getElementById('historyModal');
    const loading = document.getElementById('historyLoading');
    const table = document.getElementById('historyTable');
    const tbody = document.getElementById('historyTableBody');
    const empty = document.getElementById('historyEmpty');

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show loading
    loading.style.display = 'block';
    table.style.display = 'none';
    empty.style.display = 'none';

    try {
        const response = await fetch('/api/changelog?limit=100');
        const data = await response.json();

        loading.style.display = 'none';

        if (!data.changelog || data.changelog.length === 0) {
            empty.style.display = 'block';
            return;
        }

        // Build table rows
        tbody.innerHTML = data.changelog.map(entry => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const actionClass = entry.action || 'update';
            const typeClass = entry.type || 'sell';
            const company = entry.company || (entry.action === 'bulk_update' ? `${entry.count || 0} records` : '-');

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td><span class="history-action ${actionClass}">${entry.action}</span></td>
                    <td><span class="history-type ${typeClass}">${entry.type}</span></td>
                    <td>${company}</td>
                </tr>
            `;
        }).join('');

        table.style.display = 'table';

    } catch (error) {
        console.error('Failed to load history:', error);
        loading.style.display = 'none';
        empty.textContent = 'Failed to load history';
        empty.style.display = 'block';
    }
};

window.closeHistoryModal = function() {
    const modal = document.getElementById('historyModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
};

// Close history modal on overlay click
document.addEventListener('click', function(e) {
    const modal = document.getElementById('historyModal');
    if (e.target === modal) {
        window.closeHistoryModal();
    }
});

// Delete row function - completely rewritten
window.deleteRow = async function(rowId, rowType) {
    console.log('[DELETE] Starting delete for rowId:', rowId, 'rowType:', rowType);

    // Step 1: Show confirm dialog
    if (!confirm('Are you sure you want to delete this row?')) {
        console.log('[DELETE] User cancelled');
        return;
    }
    console.log('[DELETE] User confirmed deletion');

    try {
        // Step 2: Get global references
        const updateUrl = window.UPDATE_API_URL || '/api/update';
        const apiKey = window.API_KEY || 'investclub-admin-secure-key-2024';
        console.log('[DELETE] Using API URL:', updateUrl);

        // Step 3: Send DELETE request to API
        const requestBody = {
            action: 'delete',
            type: rowType,
            id: rowId,
            apiKey: apiKey
        };
        console.log('[DELETE] Sending request:', JSON.stringify(requestBody));

        const response = await fetch(updateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        console.log('[DELETE] Response status:', response.status);

        // Step 4: Check response
        const result = await response.json();
        console.log('[DELETE] Response body:', JSON.stringify(result));

        if (!response.ok) {
            throw new Error(result.error || 'API request failed');
        }

        if (!result.success) {
            throw new Error(result.error || 'Delete operation failed');
        }

        console.log('[DELETE] API confirmed deletion. Remaining count:', result.remainingCount);

        // Step 5: Update local state
        const state = window.platformState;
        if (state) {
            const dataArray = rowType === 'buy' ? state.buyData : state.sellData;
            const rowIndex = dataArray.findIndex(row => String(row.id) == String(rowId));

            if (rowIndex !== -1) {
                dataArray.splice(rowIndex, 1);
                console.log('[DELETE] Removed from local state at index:', rowIndex);
            }

            // Update current data reference
            state.currentData = rowType === 'buy' ? state.buyData : state.sellData;
        }

        // Step 6: Re-render UI
        if (typeof window.applyFilters === 'function') {
            window.applyFilters();
            console.log('[DELETE] UI re-rendered via applyFilters');
        } else if (typeof window.renderData === 'function') {
            window.renderData();
            console.log('[DELETE] UI re-rendered via renderData');
        }

        console.log('[DELETE] Delete completed successfully!');

    } catch (error) {
        console.error('[DELETE] Error:', error);
        alert('Failed to delete row: ' + error.message);

        // Reload data to restore state
        if (typeof window.loadData === 'function') {
            await window.loadData();
            if (typeof window.applyFilters === 'function') {
                window.applyFilters();
            }
        }
    }
};

// ============================================
// INPUT ROW FUNCTIONALITY FOR ADDING NEW DEALS
// ============================================

// State for the new deal input row
let inputRowState = {
    selectedCompany: null,
    selectedPartner: null,
    selectedStructures: [],
    selectedShareClasses: [],
    spvFee: ''
};

// Input field navigation order
const inputFieldOrder = [
    'inputCompany',
    'inputPartner',
    'inputDate',
    'inputVolume',
    'inputPrice',
    'inputValuation',
    'inputStructure',
    'inputShareClass'
];

// Initialize input row functionality
function initInputRow() {
    // Note: company search is set up via setupSearchDropdown in setupEventListeners()
    setupInputPartnerDropdown();
    setupInputDatePicker();
    setupInputStructureDropdown();
    setupInputShareDropdown();
    setupInputKeyboardNavigation();
    setupSpvFeeKeyboardNav();
    setDefaultDate();
    initCurrencyDropdowns();
}

// Set current date as default
function setDefaultDate() {
    const dateInput = document.getElementById('inputDate');
    const datePicker = document.getElementById('inputDatePicker');
    if (dateInput && datePicker) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateInput.value = today.toLocaleDateString('en-US', options);
        datePicker.value = today.toISOString().split('T')[0];
    }
}

// Select company for input row
window.selectInputCompany = function(company) {
    inputRowState.selectedCompany = company;
    const input = document.getElementById('inputCompany');
    if (input) {
        input.value = company;
        input.classList.add('has-value');
    }
    document.getElementById('inputCompanyDropdown').classList.remove('open');
};

// Clear input company search
window.clearInputCompanySearch = function() {
    inputRowState.selectedCompany = null;
    const input = document.getElementById('inputCompany');
    if (input) {
        input.value = '';
        input.classList.remove('has-value');
    }
};

// Clear input partner search
window.clearInputPartnerSearch = function() {
    inputRowState.selectedPartner = null;
    const input = document.getElementById('inputPartner');
    if (input) {
        input.value = '';
        input.classList.remove('has-value');
    }
};

// Setup partner dropdown for input row
function setupInputPartnerDropdown() {
    const input = document.getElementById('inputPartner');
    const dropdown = document.getElementById('inputPartnerDropdown');
    const clearBtn = input?.parentElement?.querySelector('.search-clear');

    if (!input || !dropdown) return;

    function updateDropdown(searchValue) {
        const partners = window.platformState.partners || [];
        const search = (searchValue || '').toLowerCase();

        const filtered = search
            ? partners.filter(p => {
                const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
                const email = (p.emails && p.emails[0]) ? p.emails[0].toLowerCase() : '';
                return fullName.includes(search) || email.includes(search);
            })
            : partners;

        const sorted = filtered.slice(0, 15);

        dropdown.innerHTML = sorted.map(partner => {
            const name = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
            const avatarUrl = partner.avatarUrl;
            const avatarHtml = avatarUrl
                ? `<img src="${avatarUrl}" alt="${name}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
                : `<div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: #e5e7eb; font-size: 9px; font-weight: 700; border-radius: 50%; color: #374151;">${(partner.firstName || 'P').charAt(0).toUpperCase()}</div>`;
            return `<div class="dropdown-item" data-partner-id="${partner.id}" onclick="selectInputPartner(${partner.id}, '${name.replace(/'/g, "\\'")}')"><div class="partner-avatar" style="width: 24px; height: 24px;">${avatarHtml}</div><span style="font-weight: 500; font-size: 12px;">${name}</span></div>`;
        }).join('');

        if (sorted.length > 0) {
            dropdown.classList.add('open');
        } else {
            dropdown.innerHTML = '<div class="dropdown-empty" style="padding: 8px 12px; color: #6b7280; font-size: 12px;">No partners found</div>';
            dropdown.classList.add('open');
        }
    }

    input.addEventListener('focus', () => {
        updateDropdown(input.value);
        dropdown.classList.add('open');
    });

    input.addEventListener('input', () => {
        updateDropdown(input.value);
        if (clearBtn) clearBtn.style.display = input.value ? 'block' : 'none';
    });

    input.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.remove('open'), 200);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdown.classList.remove('open');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            dropdown.classList.remove('open');
            focusNextInputField('inputPartner');
        }
    });
}

// Select partner for input row
window.selectInputPartner = function(partnerId, partnerName) {
    inputRowState.selectedPartner = partnerId;
    const input = document.getElementById('inputPartner');
    if (input) {
        input.value = partnerName;
        input.classList.add('has-value');
    }
    document.getElementById('inputPartnerDropdown')?.classList.remove('open');
    focusNextInputField('inputPartner');
};

// Setup date picker
function setupInputDatePicker() {
    const dateCell = document.getElementById('dateCell');
    const dateInput = document.getElementById('inputDate');
    const datePicker = document.getElementById('inputDatePicker');

    if (!dateCell || !dateInput || !datePicker) return;

    // Click anywhere on the cell opens calendar
    dateCell.addEventListener('click', () => {
        datePicker.showPicker();
    });

    // When date is selected from picker
    datePicker.addEventListener('change', () => {
        const selectedDate = new Date(datePicker.value + 'T00:00:00');
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateInput.value = selectedDate.toLocaleDateString('en-US', options);
    });

    // Handle Enter key - move to next field
    dateCell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            focusNextInputField('inputDate');
        }
    });
}

// Setup structure dropdown
function setupInputStructureDropdown() {
    const structureInput = document.getElementById('inputStructure');
    const dropdown = document.getElementById('inputStructureDropdown');
    const spvCheckbox = document.getElementById('input-structure-spv');
    const spvFeeContainer = document.getElementById('inputSpvFeeContainer');

    if (!structureInput || !dropdown) return;

    // Toggle dropdown on click
    structureInput.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
        // Close share dropdown
        document.getElementById('inputShareDropdown')?.classList.remove('open');
    });

    // Handle focus
    structureInput.addEventListener('focus', () => {
        dropdown.classList.add('open');
    });

    // Handle keydown
    structureInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (dropdown.classList.contains('open')) {
                applyInputStructure();
            } else {
                focusNextInputField('inputStructure');
            }
        } else if (e.key === ' ') {
            e.preventDefault();
            dropdown.classList.toggle('open');
        }
    });

    // Show/hide SPV fee input based on SPV checkbox
    if (spvCheckbox && spvFeeContainer) {
        spvCheckbox.addEventListener('change', () => {
            spvFeeContainer.style.display = spvCheckbox.checked ? 'block' : 'none';
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!structureInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });

    // Prevent dropdown from closing when clicking inside
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Apply structure selection
window.applyInputStructure = function() {
    const checkboxes = document.querySelectorAll('#inputStructureDropdown .filter-item input[type="checkbox"]:checked');
    const selectedValues = Array.from(checkboxes).map(cb => cb.value);
    inputRowState.selectedStructures = selectedValues;

    // Get SPV fee and carry if SPV is selected
    const spvFeeInput = document.getElementById('inputSpvFee');
    const spvCarryInput = document.getElementById('inputSpvCarry');
    if (selectedValues.includes('SPV')) {
        const fee = spvFeeInput?.value.trim() || '0';
        const carry = spvCarryInput?.value.trim() || '0';
        inputRowState.spvFee = `${fee}/${carry}`;
    } else {
        inputRowState.spvFee = '';
    }

    // Update display
    const structureInput = document.getElementById('inputStructure');
    if (structureInput) {
        if (selectedValues.length > 0) {
            let displayText = selectedValues.join(', ');
            if (inputRowState.spvFee && selectedValues.includes('SPV')) {
                displayText = displayText.replace('SPV', `SPV (${inputRowState.spvFee})`);
            }
            structureInput.innerHTML = `<span class="structure-tag" style="margin: 0; font-size: 9px; padding: 3px 8px;">${displayText}</span>`;
            structureInput.classList.add('has-value');
        } else {
            structureInput.innerHTML = `<span class="structure-placeholder">Select...</span><span class="filter-icon">▼</span>`;
            structureInput.classList.remove('has-value');
        }
    }

    document.getElementById('inputStructureDropdown').classList.remove('open');
    focusNextInputField('inputStructure');
};

// Setup SPV fee/carry Enter key navigation
function setupSpvFeeKeyboardNav() {
    const feeInput = document.getElementById('inputSpvFee');
    const carryInput = document.getElementById('inputSpvCarry');

    if (feeInput) {
        feeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                carryInput?.focus();
            }
        });
    }

    if (carryInput) {
        carryInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyInputStructure();
            }
        });
    }
}

// Setup share class dropdown
function setupInputShareDropdown() {
    const shareInput = document.getElementById('inputShareClass');
    const dropdown = document.getElementById('inputShareDropdown');

    if (!shareInput || !dropdown) return;

    // Toggle dropdown on click
    shareInput.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
        // Close structure dropdown
        document.getElementById('inputStructureDropdown')?.classList.remove('open');
    });

    // Handle focus
    shareInput.addEventListener('focus', () => {
        dropdown.classList.add('open');
    });

    // Handle keydown
    shareInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (dropdown.classList.contains('open')) {
                applyInputShareClass();
            } else {
                // Last field - save the deal
                saveNewDeal();
            }
        } else if (e.key === ' ') {
            e.preventDefault();
            dropdown.classList.toggle('open');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!shareInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });

    // Prevent dropdown from closing when clicking inside
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Apply share class selection
window.applyInputShareClass = function() {
    const checkboxes = document.querySelectorAll('#inputShareDropdown .filter-item input[type="checkbox"]:checked');
    const selectedValues = Array.from(checkboxes).map(cb => cb.value);
    inputRowState.selectedShareClasses = selectedValues;

    // Update display
    const shareInput = document.getElementById('inputShareClass');
    if (shareInput) {
        if (selectedValues.length > 0) {
            shareInput.innerHTML = `<span class="share-tag" style="margin: 0; font-size: 9px; padding: 3px 8px;">${selectedValues.join(', ')}</span>`;
            shareInput.classList.add('has-value');
        } else {
            shareInput.innerHTML = `<span class="share-placeholder">Select...</span><span class="filter-icon">▼</span>`;
            shareInput.classList.remove('has-value');
        }
    }

    document.getElementById('inputShareDropdown').classList.remove('open');
};

// Setup keyboard navigation
function setupInputKeyboardNavigation() {
    const inputs = ['inputVolume', 'inputPrice', 'inputValuation'];

    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextInputField(inputId);
                }
            });
        }
    });
}

// Focus next input field
function focusNextInputField(currentFieldId) {
    const currentIndex = inputFieldOrder.indexOf(currentFieldId);
    if (currentIndex >= 0 && currentIndex < inputFieldOrder.length - 1) {
        const nextFieldId = inputFieldOrder[currentIndex + 1];
        const nextField = document.getElementById(nextFieldId);
        if (nextField) {
            nextField.focus();
            // If it's a dropdown field, also trigger click
            if (nextFieldId === 'inputStructure' || nextFieldId === 'inputShareClass') {
                nextField.click();
            }
        }
    } else if (currentFieldId === 'inputShareClass') {
        // Last field - save the deal
        saveNewDeal();
    }
}

// Toggle Volume suffix between M and K
window.toggleVolumeSuffix = function() {
    const suffix = document.getElementById('volumeSuffix');
    if (suffix) {
        suffix.textContent = suffix.textContent === 'M' ? 'K' : 'M';
    }
};

// Currency list ordered by popularity
const CURRENCIES = [
    { symbol: '$', code: 'USD' },
    { symbol: '€', code: 'EUR' },
    { symbol: '£', code: 'GBP' },
    { symbol: '¥', code: 'JPY' },
    { symbol: '₣', code: 'CHF' },
    { symbol: 'C$', code: 'CAD' },
    { symbol: 'A$', code: 'AUD' },
    { symbol: '¥', code: 'CNY' },
    { symbol: '₹', code: 'INR' },
    { symbol: '₽', code: 'RUB' },
    { symbol: '₩', code: 'KRW' },
    { symbol: 'R$', code: 'BRL' },
    { symbol: 'S$', code: 'SGD' },
    { symbol: 'HK$', code: 'HKD' },
    { symbol: '₪', code: 'ILS' }
];

// Initialize currency dropdowns
function initCurrencyDropdowns() {
    ['volume', 'price', 'valuation'].forEach(field => {
        const dropdown = document.getElementById(`${field}CurrencyDropdown`);
        if (dropdown) {
            dropdown.innerHTML = CURRENCIES.map(curr =>
                `<div class="currency-option${curr.symbol === '$' ? ' selected' : ''}" data-symbol="${curr.symbol}" data-code="${curr.code}" onclick="selectCurrency('${field}', '${curr.symbol}')">
                    <span class="currency-symbol">${curr.symbol}</span>
                    <span class="currency-code">${curr.code}</span>
                </div>`
            ).join('');
        }
    });
}

// Toggle currency dropdown
window.toggleCurrencyDropdown = function(field) {
    const dropdown = document.getElementById(`${field}CurrencyDropdown`);
    if (!dropdown) return;

    // Close all other dropdowns
    document.querySelectorAll('.currency-dropdown').forEach(d => {
        if (d.id !== `${field}CurrencyDropdown`) {
            d.classList.remove('show');
        }
    });

    dropdown.classList.toggle('show');

    // Stop propagation to prevent immediate close
    event.stopPropagation();
};

// Select currency
window.selectCurrency = function(field, symbol) {
    const currencyEl = document.getElementById(`${field}Currency`);
    const dropdown = document.getElementById(`${field}CurrencyDropdown`);

    if (currencyEl) {
        currencyEl.textContent = symbol;
    }

    // Update selected state
    if (dropdown) {
        dropdown.querySelectorAll('.currency-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.symbol === symbol);
        });
        dropdown.classList.remove('show');
    }

    event.stopPropagation();
};

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.currency-selector') && !e.target.closest('.currency-dropdown')) {
        document.querySelectorAll('.currency-dropdown').forEach(d => d.classList.remove('show'));
    }
});

// Get current currency for a field
function getCurrency(field) {
    const currencyEl = document.getElementById(`${field}Currency`);
    return currencyEl ? currencyEl.textContent : '$';
}

// Get formatted volume with suffix
function getFormattedVolume() {
    const input = document.getElementById('inputVolume');
    const suffix = document.getElementById('volumeSuffix');
    const currency = getCurrency('volume');
    if (!input || !suffix) return '';
    const value = input.value.trim();
    if (!value) return '';
    return currency + value + suffix.textContent;
}

// Get formatted price value
function getFormattedPrice() {
    const input = document.getElementById('inputPrice');
    const currency = getCurrency('price');
    if (!input) return '';
    const value = input.value.trim();
    if (!value) return '';
    return currency + value;
}

// Get formatted valuation value
function getFormattedValuation() {
    const input = document.getElementById('inputValuation');
    const currency = getCurrency('valuation');
    if (!input) return '';
    const value = input.value.trim();
    if (!value) return '';
    return currency + value + 'B';
}

// Save new deal
window.saveNewDeal = function() {
    const company = document.getElementById('inputCompany')?.value.trim();
    const dateInput = document.getElementById('inputDate')?.value.trim() || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const volume = getFormattedVolume();
    const price = getFormattedPrice();
    const valuation = getFormattedValuation();

    // Validate company is required
    if (!company) {
        alert('Please select a target company');
        document.getElementById('inputCompany')?.focus();
        return;
    }

    // Build structure string
    let structureStr = inputRowState.selectedStructures.join(', ');
    if (inputRowState.spvFee && inputRowState.selectedStructures.includes('SPV')) {
        structureStr = structureStr.replace('SPV', `SPV (${inputRowState.spvFee})`);
    }

    // Build share class string
    const shareClassStr = inputRowState.selectedShareClasses.join(', ');

    // Generate unique ID for new deal
    const allDeals = [...window.platformState.buyData, ...window.platformState.sellData];
    const maxId = allDeals.reduce((max, d) => Math.max(max, d.id || 0), 0);
    const newId = maxId + 1;

    // Create new deal object - use "0" for empty numeric fields, "Request" for others
    const newDeal = {
        id: newId,
        company: company,
        partnerId: inputRowState.selectedPartner,
        lastUpdate: dateInput,
        volume: volume || '0',
        price: price || '0',
        valuation: valuation || '0',
        structure: structureStr || 'Request',
        shareClass: shareClassStr || 'Request',
        managementFee: '',
        carry: ''
    };

    // Parse SPV fee if present
    if (inputRowState.spvFee && inputRowState.selectedStructures.includes('SPV')) {
        const feeParts = inputRowState.spvFee.split('/');
        if (feeParts.length >= 2) {
            newDeal.managementFee = feeParts[0].trim();
            newDeal.carry = feeParts[1].trim();
        }
    }

    console.log('New Deal Data:', newDeal);

    // Add to current data (at the beginning) - use window.platformState
    if (window.platformState.activeTab === 'buy') {
        window.platformState.buyData.unshift(newDeal);
    } else {
        window.platformState.sellData.unshift(newDeal);
    }

    // Update current data reference
    window.platformState.currentData = window.platformState.activeTab === 'buy' ? window.platformState.buyData : window.platformState.sellData;

    // Save to localStorage for persistence
    saveDealsToLocalStorage();

    // Clear the input row first
    clearInputRow();

    // Refresh the display
    window.applyFilters();

    // Add animation to the first data row (newly added)
    setTimeout(() => {
        const dataContainer = document.getElementById('platform-dataContent');
        const firstRow = dataContainer?.querySelector('.data-row');
        if (firstRow) {
            firstRow.classList.add('new-row-animation');
            // Remove class after animation completes
            setTimeout(() => {
                firstRow.classList.remove('new-row-animation');
            }, 500);
        }
    }, 50);
};

// Save deals to API (syncs with KV Storage)
async function saveDealsToLocalStorage() {
    const activeTab = window.platformState.activeTab;
    const success = await saveToAPI(activeTab);
    if (success) {
        showNotification('Deal saved successfully!', 'success');
    }
}

// Clear input row
function clearInputRow() {
    // Clear text inputs
    document.getElementById('inputCompany').value = '';
    document.getElementById('inputCompany').classList.remove('has-value');
    document.getElementById('inputPartner').value = '';
    document.getElementById('inputPartner').classList.remove('has-value');
    document.getElementById('inputVolume').value = '';
    document.getElementById('inputPrice').value = '';
    document.getElementById('inputValuation').value = '';
    document.getElementById('inputSpvFee').value = '';
    document.getElementById('inputSpvCarry').value = '';

    // Reset volume suffix to M
    const volumeSuffix = document.getElementById('volumeSuffix');
    if (volumeSuffix) {
        volumeSuffix.textContent = 'M';
    }

    // Reset currencies to $
    ['volume', 'price', 'valuation'].forEach(field => {
        const currencyEl = document.getElementById(`${field}Currency`);
        if (currencyEl) currencyEl.textContent = '$';
    });

    // Reset date to today
    setDefaultDate();

    // Clear checkboxes
    document.querySelectorAll('#inputStructureDropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll('#inputShareDropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Hide SPV fee container
    document.getElementById('inputSpvFeeContainer').style.display = 'none';

    // Reset display text
    const structureEl = document.getElementById('inputStructure');
    const shareEl = document.getElementById('inputShareClass');
    structureEl.innerHTML = `<span class="structure-placeholder">Select...</span><span class="filter-icon">▼</span>`;
    structureEl.classList.remove('has-value');
    shareEl.innerHTML = `<span class="share-placeholder">Select...</span><span class="filter-icon">▼</span>`;
    shareEl.classList.remove('has-value');

    // Reset state
    inputRowState = {
        selectedCompany: null,
        selectedPartner: null,
        selectedStructures: [],
        selectedShareClasses: [],
        spvFee: ''
    };
}

// Initialize input row after DOM is ready
document.addEventListener('DOMContentLoaded', initInputRow);

// Also initialize when the main init runs (in case DOMContentLoaded already fired)
setTimeout(initInputRow, 100);
