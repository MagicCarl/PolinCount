import { fetchPollenData, getDangerZoneLevel, getCachedPollenData } from './src/pollenService.js';
import { pollenData as fallbackData } from './src/pollenData.js';
import { CITIES, fetchAQI, getAQILevel, fetchCityPollen } from './src/aqiService.js';

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
        const cached = getCachedPollenData();
        if (!cached || cached.isStale) {
            // Data is stale or missing — refresh silently
            fetchPollenData()
                .then(freshData => renderApp(freshData, false))
                .catch(() => {}); // fail silently, current display stays
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

    // Restore last selected city
    const saved = localStorage.getItem('aqi_selected_city');
    if (saved !== null && saved < CITIES.length) {
        select.value = saved;
    }

    select.addEventListener('change', () => {
        localStorage.setItem('aqi_selected_city', select.value);
        loadCityData(CITIES[select.value]);
    });
}

function renderAQI(data) {
    const container = document.getElementById('aqi-container');
    const level = getAQILevel(data.aqi);

    container.innerHTML = `
        <div class="glass-panel aqi-card">
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
    const savedIdx = localStorage.getItem('aqi_selected_city') || 0;
    loadCityData(CITIES[savedIdx]);
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    initAQI();
});
