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

    // Static JSON API endpoints (100% cloud, no KV dependency)
    const BUY_DATA_URL = '/api/buy';
    const SELL_DATA_URL = '/api/sell';
    const LOGOS_URL = '/api/logos.json';
    const EMAIL_ADDRESS = ''; // Email address will be configured later
    
    let platformState = {
        buyData: [],
        sellData: [],
        currentData: [],
        filteredData: [],
        activeTab: 'sell',
        selectedCompany: null,
        modalSelectedCompany: null,
        companyLogos: {},
        sortColumn: 'date',
        sortDirection: 'desc',
        showAllData: true,
        selectedStructures: ['Direct trade', 'SPV', 'Forward'],
        selectedShareClasses: ['Common', 'Preferred'],
        displaySettings: {
            volume: {
                showCurrencySymbol: true,
                currencySymbol: '$',
                useSuffix: true,
                suffixes: { thousand: 'K', million: 'M', billion: 'B', trillion: 'T' },
                decimalPlaces: { default: 2, millions: 1, billions: 1 },
                nullDisplay: 'Request'
            },
            price: {
                showCurrencySymbol: true,
                currencySymbol: '$',
                decimalPlaces: 2,
                nullDisplay: 'Request'
            },
            valuation: {
                showCurrencySymbol: true,
                currencySymbol: '$',
                alwaysShowBillionSuffix: true,
                suffixes: { million: 'M', billion: 'B', trillion: 'T' },
                decimalPlaces: 1,
                nullDisplay: 'Request'
            },
            thresholds: {
                showAsK: 1000,
                showAsM: 1000000,
                showAsB: 1000000000,
                showAsT: 1000000000000
            }
        }
    };
    
    const fallbackData = {
        buy: [],
        sell: []
    };
    
    async function loadDisplaySettings() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                const data = await response.json();
                if (data.display) {
                    platformState.displaySettings = { ...platformState.displaySettings, ...data.display };
                }
                if (data.thresholds) {
                    platformState.displaySettings.thresholds = { ...platformState.displaySettings.thresholds, ...data.thresholds };
                }
            }
        } catch (error) {
            console.log('Using default display settings');
        }
    }

    async function init() {
        try {
            loadStateFromURL();
            await loadDisplaySettings();
            await loadCompanyLogos();
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
    
    function formatVolume(str) {
        const settings = platformState.displaySettings.volume;
        const thresholds = platformState.displaySettings.thresholds;

        // Handle null, undefined, empty, or special values
        if (str === null || str === undefined || str === '' || str === 'null') {
            return settings.nullDisplay || 'Request';
        }

        // Convert to string if number
        if (typeof str === 'number') str = String(str);
        str = str.trim();

        // Handle special display values
        if (str === 'N/A' || str.toLowerCase().includes('request')) {
            return settings.nullDisplay || str;
        }

        const value = parseValue(str);
        if (value === 0) return settings.nullDisplay || str;

        const symbol = settings.showCurrencySymbol ? settings.currencySymbol : '';
        const suffixes = settings.suffixes;

        if (value >= thresholds.showAsB) {
            const billions = value / thresholds.showAsB;
            const decimals = settings.decimalPlaces.billions || 1;
            return symbol + billions.toFixed(decimals).replace(/\.0+$/, '') + suffixes.billion;
        } else if (value >= thresholds.showAsM) {
            const millions = value / thresholds.showAsM;
            const decimals = settings.decimalPlaces.millions || 1;
            return symbol + millions.toFixed(decimals).replace(/\.0+$/, '') + suffixes.million;
        } else if (value >= thresholds.showAsK) {
            const thousands = value / thresholds.showAsK;
            return symbol + thousands.toFixed(0) + suffixes.thousand;
        } else {
            return symbol + value.toFixed(0);
        }
    }

    function formatPrice(str) {
        const settings = platformState.displaySettings.price;

        // Handle null, undefined, empty, or special values
        if (str === null || str === undefined || str === '' || str === 'null') {
            return settings.nullDisplay || 'Request';
        }

        // Convert to string if number
        if (typeof str === 'number') str = String(str);
        str = str.trim();

        // Handle special display values
        if (str === 'N/A' || str.toLowerCase().includes('request')) {
            return settings.nullDisplay || str;
        }

        // If already formatted with $ symbol, clean it up
        if (str.startsWith('$')) {
            return str;
        }

        // Try to parse and format
        const value = parseFloat(str.replace(/[,$]/g, ''));
        if (isNaN(value) || value === 0) {
            return settings.nullDisplay || str;
        }

        const symbol = settings.showCurrencySymbol ? settings.currencySymbol : '';
        const decimals = settings.decimalPlaces || 2;
        return symbol + value.toFixed(decimals);
    }

    function formatValuation(str) {
        const settings = platformState.displaySettings.valuation;
        const thresholds = platformState.displaySettings.thresholds;

        // Handle null, undefined, empty, or special values
        if (str === null || str === undefined || str === '' || str === 'null') {
            return settings.nullDisplay || 'Request';
        }

        // Convert to string if number
        if (typeof str === 'number') str = String(str);
        str = str.trim();

        // Handle special display values
        if (str === 'N/A' || str.toLowerCase().includes('request')) {
            return settings.nullDisplay || str;
        }

        const symbol = settings.showCurrencySymbol ? settings.currencySymbol : '';
        const suffixes = settings.suffixes;
        const decimals = settings.decimalPlaces || 1;

        // If already properly formatted (e.g., "$1.47B"), return as-is
        if (str.includes('B') || str.includes('T') || str.includes('M')) {
            // Clean up and standardize format
            const cleaned = str.replace(/[$,]/g, '');
            const numMatch = cleaned.match(/^([\d.]+)\s*(B|T|M)$/i);
            if (numMatch) {
                const num = parseFloat(numMatch[1]);
                const suffix = numMatch[2].toUpperCase();
                return symbol + num.toFixed(decimals).replace(/\.0+$/, '') + suffix;
            }
            return str;
        }

        // Parse raw numeric values (data shows valuation in billions, so column header says "(b)")
        const value = parseValue(str);
        if (value === 0) return settings.nullDisplay || str;

        // The data column is "Implied Valuation (b)" - values are already in billions
        // So "$0.96" means $0.96B, not raw 0.96
        // Check if the value looks like it's already a small number (representing billions)
        if (value > 0 && value < 1000) {
            // This is likely already in billions format (e.g., "0.96" = $0.96B)
            return symbol + value.toFixed(decimals).replace(/\.0+$/, '') + suffixes.billion;
        }

        // For large raw numbers, convert appropriately
        if (value >= thresholds.showAsT) {
            const trillions = value / thresholds.showAsT;
            return symbol + trillions.toFixed(decimals).replace(/\.0+$/, '') + suffixes.trillion;
        } else if (value >= thresholds.showAsB) {
            const billions = value / thresholds.showAsB;
            return symbol + billions.toFixed(decimals).replace(/\.0+$/, '') + suffixes.billion;
        } else if (value >= thresholds.showAsM) {
            const millions = value / thresholds.showAsM;
            return symbol + millions.toFixed(decimals).replace(/\.0+$/, '') + suffixes.million;
        } else {
            // Already a small number, treat as billions per column header
            return symbol + value.toFixed(decimals).replace(/\.0+$/, '') + suffixes.billion;
        }
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
            const formattedPrice = formatPrice(row.price);

            const formattedStructure = formatStructure(row);

            const action = platformState.activeTab === 'buy' ? 'Purchase' : 'Sale';
            const subject = `RE: ${row.company} ${action} Order`;
            const body = `Dear Team,

I am interested in your ${action.toLowerCase()} order for ${row.company} securities.

Deal Details:
- Company: ${row.company}
- Structure: ${formattedStructure}
- Share Class: ${row.shareClass}
- Price: ${formattedPrice}
- Volume: ${formattedVolume}
- Valuation: ${formattedValuation}
- Last Update: ${row.lastUpdate}

Please confirm the availability and provide any additional information.

Best regards`;
            const mailtoLink = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            return `
                <div class="data-row">
                    <div class="data-cell col-company">
                        <div class="company-info">
                            <div class="company-icon">${logoHtml}</div>
                            <span class="company-name">${row.company}</span>
                        </div>
                    </div>
                    <div class="data-cell col-date">
                        <span class="date-value">${row.lastUpdate}</span>
                    </div>
                    <div class="data-cell col-volume">
                        <span class="volume-value">${formattedVolume}</span>
                    </div>
                    <div class="data-cell col-price">
                        <span class="price-value">${formattedPrice}</span>
                    </div>
                    <div class="data-cell col-valuation">
                        <span class="valuation-value">${formattedValuation}</span>
                    </div>
                    <div class="data-cell col-structure">
                        <span class="structure-tag">${formattedStructure}</span>
                    </div>
                    <div class="data-cell col-share">
                        <span class="share-tag">${row.shareClass}</span>
                    </div>
                    <div class="data-cell col-action">
                        <a href="${mailtoLink}" class="btn-inquire">Inquire</a>
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
            const formattedPrice = formatPrice(row.price);

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
- Price: ${formattedPrice}
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
                                <span class="mobile-price-value">${formattedPrice}</span>
                            </div>
                            <a href="${mailtoLink}" class="mobile-inquire-btn">Inquire</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = mobileCards;
    }
    
    function setupSearchDropdown(inputId, dropdownId, isModal = false) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        
        if (!input || !dropdown) return;
        
        input.addEventListener('focus', () => {
            renderSearchDropdown(dropdownId, input.value, isModal);
            dropdown.classList.add('open');
        });
        
        input.addEventListener('input', () => {
            const hasValue = input.value.trim().length > 0;
            if (input.classList) {
                input.classList.toggle('has-value', hasValue);
            }
            renderSearchDropdown(dropdownId, input.value, isModal);
            dropdown.classList.add('open');
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const searchValue = input.value.trim();
                if (searchValue) {
                    if (isModal) {
                        platformState.modalSelectedCompany = searchValue;
                    } else {
                        platformState.selectedCompany = searchValue;
                        applyFilters();
                    }
                }
                dropdown.classList.remove('open');
            }
        });
    }
    
    function renderSearchDropdown(dropdownId, searchValue, isModal = false) {
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
        
        const search = searchValue.toUpperCase().trim();
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
            
            return `
                <div class="dropdown-item" onclick="platformSelectFromSearch('${company.replace(/'/g, "\\'")}', ${isModal})">
                    <div class="company-icon" style="width: 24px; height: 24px;">${logoHtml}</div>
                    <span style="font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">${company}</span>
                </div>
            `;
        }).join('');
    }
    
    function setupEventListeners() {
        setupSearchDropdown('platform-searchInput', 'platform-searchDropdown', false);
        setupSearchDropdown('platform-modalSearchInput', 'platform-modalSearchDropdown', true);
        
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

    init();
})();
