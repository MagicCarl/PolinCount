import { fetchPollenData, getDangerZoneLevel, getCachedPollenData } from './src/pollenService.js';
import { pollenData as fallbackData } from './src/pollenData.js';
import { CITIES, fetchAQI, getAQILevel, fetchCityPollen } from './src/aqiService.js';

// --- Info Modal ---

function showInfoModal(title, content) {
    const overlay = document.createElement('div');
    overlay.className = 'info-modal-overlay';
    overlay.innerHTML = `
        <div class="info-modal">
            <h3>${title}</h3>
            ${content}
            <button class="info-modal-close">Got it</button>
        </div>
    `;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('info-modal-close')) {
            overlay.remove();
        }
    });
    document.body.appendChild(overlay);
}

window.__showPollenInfo = function () {
    showInfoModal('Pollen Index Guide', `
        <p>The pollen index measures airborne pollen concentration on a 0–12 scale from pollen.com.</p>
        <div class="info-scale">
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: var(--color-safe)"></div>
                <span class="info-scale-label">Low</span>
                <span class="info-scale-range">0 – 2.4</span>
            </div>
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: var(--color-moderate)"></div>
                <span class="info-scale-label">Moderate</span>
                <span class="info-scale-range">2.5 – 7.2</span>
            </div>
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: var(--color-caution)"></div>
                <span class="info-scale-label">High</span>
                <span class="info-scale-range">7.3 – 9.6</span>
            </div>
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: var(--color-danger)"></div>
                <span class="info-scale-label">Very High</span>
                <span class="info-scale-range">9.7 – 12.0</span>
            </div>
        </div>
        <p><strong>Trees</strong> — pollen from trees like oak, cedar, birch, pine, etc.</p>
        <p><strong>Grasses</strong> — pollen from lawn and field grasses.</p>
        <p><strong>Weeds</strong> — pollen from ragweed, nettle, sagebrush, etc.</p>
    `);
};

window.__showAQIInfo = function () {
    showInfoModal('Air Quality Index Guide', `
        <p>The US AQI measures air pollution levels on a 0–500 scale. Higher values mean worse air quality.</p>
        <div class="info-scale">
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: #22c55e"></div>
                <span class="info-scale-label">Good</span>
                <span class="info-scale-range">0 – 50</span>
            </div>
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: #eab308"></div>
                <span class="info-scale-label">Moderate</span>
                <span class="info-scale-range">51 – 100</span>
            </div>
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: #f97316"></div>
                <span class="info-scale-label">USG</span>
                <span class="info-scale-range">101 – 150</span>
            </div>
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: #ef4444"></div>
                <span class="info-scale-label">Unhealthy</span>
                <span class="info-scale-range">151 – 200</span>
            </div>
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: #7c3aed"></div>
                <span class="info-scale-label">Very Bad</span>
                <span class="info-scale-range">201 – 300</span>
            </div>
            <div class="info-scale-item">
                <div class="info-scale-dot" style="background: #991b1b"></div>
                <span class="info-scale-label">Hazardous</span>
                <span class="info-scale-range">301 – 500</span>
            </div>
        </div>
        <p><strong>PM2.5</strong> — fine particles (&lt;2.5μm) that penetrate deep into the lungs.</p>
        <p><strong>PM10</strong> — coarser particles (&lt;10μm) like dust and pollen.</p>
        <p><strong>NO₂</strong> — nitrogen dioxide, mainly from vehicle exhaust.</p>
        <p><strong>O₃</strong> — ground-level ozone, a key smog component.</p>
    `);
};

function renderApp(pollenData, isRefreshing = false) {
    const reportDateEl = document.getElementById('report-date');
    const pollenContainer = document.getElementById('pollen-container');
    const dangerBadgeContainer = document.getElementById('danger-badge-container');
    const dangerDescription = document.getElementById('danger-description');
    const predominantEl = document.getElementById('predominant-types');
    const lastUpdatedEl = document.getElementById('last-updated');

    // Set Header Data
    reportDateEl.textContent = `Report Period: ${pollenData.period}`;
    lastUpdatedEl.innerHTML = `
        ${isRefreshing ? '<span class="refresh-spinner">Refreshing...</span> ' : ''}
        App Last Updated: ${pollenData.lastUpdated}
    `;

    // Danger Zone Badge
    const dangerInfo = getDangerZoneLevel(pollenData.pollen);
    dangerBadgeContainer.innerHTML = `
        <div class="danger-zone-badge ${dangerInfo.class}">
            ${dangerInfo.label} ZONE
        </div>
    `;
    dangerDescription.textContent = dangerInfo.description;

    // Render Pollen Cards
    pollenContainer.innerHTML = pollenData.pollen.map(p => {
        const percentage = Math.min((p.severityLevel / 4) * 100, 100);
        let barColor = 'var(--color-safe)';
        if (p.severityLevel === 2) barColor = 'var(--color-moderate)';
        if (p.severityLevel === 3) barColor = 'var(--color-caution)';
        if (p.severityLevel === 4) barColor = 'var(--color-danger)';

        return `
            <div class="glass-panel pollen-card ${isRefreshing ? 'updating' : ''}">
                <button class="info-btn" onclick="window.__showPollenInfo()" title="What does this mean?">i</button>
                <div class="pollen-type">${p.type}</div>
                <div class="pollen-value">
                    ${p.count} <span class="pollen-unit">${p.unit}</span>
                </div>
                <div class="severity-label" style="color: ${barColor}">${p.severity}</div>
                <div class="severity-indicator">
                    <div class="severity-progress" style="width: ${percentage}%; background-color: ${barColor}"></div>
                </div>
            </div>
        `;
    }).join('');

    // Predominant Types
    const treePollen = pollenData.pollen.find(p => p.type === 'Trees');
    if (treePollen && treePollen.details && treePollen.details.length > 0) {
        predominantEl.innerHTML = `
            <strong style="color: var(--text-secondary)">Predominant Tree Species:</strong>
            <p style="margin-top: 0.5rem; color: var(--text-primary)">
                ${treePollen.details.join(', ')}
            </p>
        `;
    } else {
        predominantEl.innerHTML = '';
    }
}

function showError(container, message) {
    container.innerHTML = `
        <div class="glass-panel" style="grid-column: 1/-1; text-align: center; border-color: var(--color-danger); color: var(--color-danger);">
            <p>${message}</p>
            <button onclick="window.__retryLoad()" style="
                margin-top: 1rem; padding: 0.6rem 1.5rem; border: 1px solid var(--color-danger);
                background: rgba(239,68,68,0.15); color: var(--color-danger); border-radius: 12px;
                cursor: pointer; font-family: var(--font-main); font-weight: 600; font-size: 0.9rem;
            ">Retry</button>
        </div>
    `;
}

/**
 * Get the best available data: fresh > cached > fallback
 */
async function loadPollenData() {
    try {
        return await fetchPollenData();
    } catch (fetchError) {
        console.warn('Live fetch failed:', fetchError);

        // Try cache (even if stale)
        const cached = getCachedPollenData();
        if (cached) {
            console.log('Using cached data as fallback');
            return cached.data;
        }

        // Ultimate fallback: hardcoded sample data
        console.log('Using hardcoded fallback data');
        return { ...fallbackData, lastUpdated: new Date().toLocaleString() };
    }
}

async function initApp() {
    // Pollen + AQI loading is handled by initAQI → loadCityData
    // initApp is now a no-op — kept for compatibility
}

// Expose retry for the error button
window.__retryLoad = async function () {
    const pollenContainer = document.getElementById('pollen-container');
    pollenContainer.innerHTML = '<div class="glass-panel" style="grid-column: 1/-1; text-align: center;">Retrying...</div>';

    const data = await loadPollenData();
    renderApp(data, false);
};

// Auto-refresh when user returns to the tab
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Refresh the currently selected city's data
        const select = document.getElementById('city-select');
        if (select && select.value !== undefined) {
            const city = CITIES[select.value];
            if (city) loadCityData(city);
        }
    }
});

// --- AQI Section ---

function populateCityPicker() {
    const select = document.getElementById('city-select');
    CITIES.forEach((city, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${city.name}, ${city.state}`;
        select.appendChild(option);
    });

    // Restore last selected city by name (reorder-safe)
    const savedName = localStorage.getItem('aqi_selected_city_name');
    if (savedName) {
        const idx = CITIES.findIndex(c => c.name === savedName);
        if (idx >= 0) select.value = idx;
    }

    select.addEventListener('change', () => {
        const city = CITIES[select.value];
        localStorage.setItem('aqi_selected_city_name', city.name);
        loadCityData(city);
    });
}

function renderAQI(data) {
    const container = document.getElementById('aqi-container');
    const level = getAQILevel(data.aqi);

    container.innerHTML = `
        <div class="glass-panel aqi-card">
            <button class="info-btn" onclick="window.__showAQIInfo()" title="What does this mean?">i</button>
            <div class="aqi-header">
                <div class="aqi-city">${data.city}, ${data.state}</div>
                <div class="aqi-badge" style="background: ${level.color}20; color: ${level.color}; border: 1px solid ${level.color};">
                    ${level.label}
                </div>
            </div>
            <div class="aqi-value" style="color: ${level.color}">
                ${data.aqi}
                <span class="aqi-unit">US AQI</span>
            </div>
            <p class="aqi-description">${level.description}</p>
            <div class="aqi-pollutants">
                <div class="pollutant">
                    <span class="pollutant-label">PM2.5</span>
                    <span class="pollutant-value">${data.pm25} <small>μg/m³</small></span>
                </div>
                <div class="pollutant">
                    <span class="pollutant-label">PM10</span>
                    <span class="pollutant-value">${data.pm10} <small>μg/m³</small></span>
                </div>
                <div class="pollutant">
                    <span class="pollutant-label">NO₂</span>
                    <span class="pollutant-value">${data.no2} <small>μg/m³</small></span>
                </div>
                <div class="pollutant">
                    <span class="pollutant-label">O₃</span>
                    <span class="pollutant-value">${data.ozone} <small>μg/m³</small></span>
                </div>
            </div>
            <div class="aqi-time">Updated: ${data.time}</div>
        </div>
    `;
}

async function loadCityData(city) {
    const aqiContainer = document.getElementById('aqi-container');
    const pollenContainer = document.getElementById('pollen-container');

    aqiContainer.innerHTML = '<div class="glass-panel" style="text-align: center; padding: 2rem;">Loading air quality data...</div>';
    pollenContainer.innerHTML = '<div class="glass-panel" style="grid-column: 1/-1; text-align: center;">Loading pollen data...</div>';

    // Fetch AQI and pollen in parallel
    const aqiPromise = fetchAQI(city).then(data => {
        renderAQI(data);
    }).catch(error => {
        console.error('AQI fetch failed:', error);
        aqiContainer.innerHTML = `
            <div class="glass-panel" style="text-align: center; color: var(--color-danger);">
                Unable to load air quality data for ${city.name}.
            </div>
        `;
    });

    const pollenPromise = fetchCityPollen(city).then(data => {
        renderApp(data, false);
    }).catch(async (error) => {
        console.warn('City pollen fetch failed, trying NC DEQ fallback:', error);
        // Fall back to NC DEQ data
        const data = await loadPollenData();
        renderApp(data, false);
    });

    await Promise.allSettled([aqiPromise, pollenPromise]);
}

function initAQI() {
    populateCityPicker();
    const savedName = localStorage.getItem('aqi_selected_city_name');
    const idx = savedName ? CITIES.findIndex(c => c.name === savedName) : 0;
    loadCityData(CITIES[idx >= 0 ? idx : 0]);
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    initAQI();
});
