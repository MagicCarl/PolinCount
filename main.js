import { fetchPollenData, getDangerZoneLevel } from './src/pollenService.js';
import { pollenData as fallbackData } from './src/pollenData.js';
import { CITIES, fetchAQI, getAQILevel, fetchCityPollen, getCityAllergens } from './src/aqiService.js';

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

// --- Privacy Policy & Terms of Service Modals ---

window.__showPrivacyPolicy = function () {
    showInfoModal('Privacy Policy', `
        <p>This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit this website. Please read this policy carefully to understand our views and practices regarding your personal data and how we will treat it.</p>
        <h4 class="legal-heading">1. Information We Collect</h4>
        <p>We may collect and process the following data about you:</p>
        <ul class="legal-list"><li><strong>Personal Identification Information:</strong> Email address when you subscribe to our Pollen Alerts.</li></ul>
        <h4 class="legal-heading">2. How We Use Your Information</h4>
        <p>We use the information we collect in the following ways:</p>
        <ul class="legal-list"><li>To communicate with you, to provide you with updates and other information relating to the website.</li></ul>
        <h4 class="legal-heading">3. How We Store Your Information</h4>
        <p>We store your email addresses and other collected data in a secure database with industry-standard safeguards. Access is limited to authorized personnel only. Despite our efforts, no method of transmission over the Internet or electronic storage is completely secure, and we cannot guarantee absolute security.</p>
        <h4 class="legal-heading">4. Sharing Your Information</h4>
        <p>We do not sell, trade, or otherwise transfer your personal information to outside parties except in the following situations:</p>
        <ul class="legal-list">
            <li>With service providers who assist us in operating our website or conducting our business.</li>
            <li>When required by law or to respond to legal processes.</li>
            <li>To protect our rights, privacy, safety, or property and/or that of you or others.</li>
        </ul>
        <h4 class="legal-heading">5. Your Data Protection Rights</h4>
        <p>Depending on your location, you may have the following rights regarding your personal data:</p>
        <ul class="legal-list">
            <li><strong>The right to access</strong> \u2013 You have the right to request copies of your personal data.</li>
            <li><strong>The right to rectification</strong> \u2013 You have the right to request correction of any information you believe is inaccurate or incomplete.</li>
            <li><strong>The right to erasure</strong> \u2013 You have the right to request we erase your personal data, under certain conditions.</li>
            <li><strong>The right to restrict processing</strong> \u2013 You have the right to request that we restrict the processing of your personal data.</li>
        </ul>
        <h4 class="legal-heading">6. Children's Privacy</h4>
        <p>We do not knowingly collect any personal information from children under the age of 13. If we become aware that we have collected personal data from a child under age 13 without verification of parental consent, we will take steps to remove that information from our servers.</p>
        <h4 class="legal-heading">7. Third-Party Services</h4>
        <ul class="legal-list">
            <li><strong>Analytics:</strong> We may use Google Analytics or other services to understand how users interact with our site. These tools may track things like pages visited, time spent on site, and referring URLs via cookies.</li>
            <li><strong>Hosting and Infrastructure:</strong> Our website may be hosted on platforms such as Vercel, Netlify, or AWS, which may collect limited technical or usage data for operational purposes.</li>
        </ul>
        <p>Each of these providers has its own privacy policies governing how they handle data. We encourage you to review their respective policies for further details.</p>
    `);
};

window.__showTermsOfService = function () {
    showInfoModal('Terms of Service', `
        <p>Welcome to PollenTracker ("we," "our," or "us"). These Terms of Service ("Terms") govern your use of our website ("Site"). By accessing or using the Site, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Site.</p>
        <h4 class="legal-heading">1. Use of Our Website</h4>
        <p>You agree to use the Site only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use of the Site. Prohibited behavior includes harassing or causing distress to any person and transmitting obscene or offensive content.</p>
        <h4 class="legal-heading">2. Intellectual Property</h4>
        <p>All content on this Site, including text, graphics, logos, and software, is the property of Pollen Alerts or its content suppliers and is protected by copyright and other intellectual property laws. You may not reproduce, duplicate, copy, sell, resell, or exploit any portion of the Site without our express written permission.</p>
        <h4 class="legal-heading">3. Email Subscriptions</h4>
        <p>When you provide your email address to subscribe to our updates, you agree to receive periodic emails from us. You may unsubscribe at any time by clicking the unsubscribe link.</p>
        <h4 class="legal-heading">4. Disclaimer</h4>
        <p>The information provided on this Site is for general informational purposes only. We make no warranties regarding the accuracy, reliability, or completeness of any information on the Site. Your use of the Site and reliance on any information is solely at your own risk.</p>
        <h4 class="legal-heading">5. Limitation of Liability</h4>
        <p>To the fullest extent permitted by applicable law, PollenTracker and its officers, directors, employees, or agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or use of, or inability to access or use, the Site or any content therein.</p>
        <h4 class="legal-heading">6. Third-Party Links</h4>
        <p>Our Site may contain links to third-party websites or services that are not owned or controlled by PollenTracker. We assume no responsibility for the content, privacy policies, or practices of any third-party websites or services.</p>
        <h4 class="legal-heading">7. Termination</h4>
        <p>We reserve the right to terminate or suspend your access to our Site, without prior notice or liability, for any reason, including without limitation if you breach these Terms.</p>
        <h4 class="legal-heading">8. Governing Law</h4>
        <p>These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.</p>
        <h4 class="legal-heading">9. Changes to These Terms</h4>
        <p>We may update these Terms from time to time. We will notify you of any changes by posting the new Terms on this page. By continuing to use the Site after those changes become effective, you agree to be bound by the revised Terms.</p>
    `);
};

// --- Breathable Score ---

function computeBreathableScore(pollenData, aqiData) {
    const maxSeverity = Math.max(...pollenData.pollen.map(p => p.severityLevel));

    // Pollen penalty based on max severity
    const pollenPenalty = { 1: 0.5, 2: 1.5, 3: 3, 4: 4.5 }[maxSeverity] || 0;

    // AQI penalty
    let aqiPenalty = 0;
    if (aqiData) {
        const aqi = aqiData.aqi;
        if (aqi > 300) aqiPenalty = 4.5;
        else if (aqi > 200) aqiPenalty = 3.5;
        else if (aqi > 150) aqiPenalty = 2.5;
        else if (aqi > 100) aqiPenalty = 1.5;
        else if (aqi > 50) aqiPenalty = 0.5;
    }

    return Math.max(1, Math.min(10, Math.round(10 - pollenPenalty - aqiPenalty)));
}

function generateBreathableInsights(score, pollenData, aqiData) {
    const insights = [];
    const currentCityName = localStorage.getItem('aqi_selected_city_name') || 'Raleigh';
    const fallbackAllergens = getCityAllergens(currentCityName);

    // Score summary
    const desc = score >= 8 ? 'good conditions for being outdoors'
        : score >= 6 ? 'mixed conditions that may vary through the day'
        : score >= 4 ? 'elevated allergen levels that may affect sensitive individuals'
        : 'challenging conditions for allergy sufferers';
    insights.push(`Score is <strong>${score}/10</strong> today (higher means better breathing conditions), suggesting ${desc}.`);

    // Main pollen concerns
    const trees = pollenData.pollen.find(p => p.type === 'Trees');
    const grasses = pollenData.pollen.find(p => p.type === 'Grasses');
    const weeds = pollenData.pollen.find(p => p.type === 'Weeds');

    const highTypes = pollenData.pollen.filter(p => p.severityLevel >= 3);
    if (highTypes.length > 0) {
        const mainConcern = highTypes.sort((a, b) => b.severityLevel - a.severityLevel)[0];
        let speciesNames = mainConcern.details?.filter(s => s) || [];
        // Fall back to common allergens if API didn't return species
        if (speciesNames.length === 0) {
            if (mainConcern.type === 'Trees') speciesNames = fallbackAllergens.trees;
            else if (mainConcern.type === 'Weeds') speciesNames = fallbackAllergens.weeds;
        }
        const species = speciesNames.slice(0, 2).join(' and ');
        insights.push(`${mainConcern.type} pollen is the main concern today${species ? ', led by <strong>' + species + '</strong>' : ''}.`);
    }

    // Low pollen types
    const lowTypes = pollenData.pollen.filter(p => p.severityLevel <= 1);
    if (lowTypes.length > 0) {
        const names = lowTypes.map(p => p.type.toLowerCase());
        const joined = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
        const capitalized = joined.charAt(0).toUpperCase() + joined.slice(1);
        const verb = lowTypes.length === 1 ? 'is' : 'are';
        insights.push(`${capitalized} pollen ${verb} currently low based on the latest provider readings.`);
    }

    // AQI insight
    if (aqiData) {
        const level = getAQILevel(aqiData.aqi);
        insights.push(`Air quality is <strong>${level.label}</strong> with an AQI of ${aqiData.aqi}, which can add to how the air feels alongside pollen.`);
    }

    // Quick tip
    insights.push('Quick tip: check levels again later today, since wind and weather can shift conditions.');

    return insights;
}

function getScoreColor(score) {
    if (score >= 8) return 'var(--color-safe)';
    if (score >= 6) return 'var(--color-moderate)';
    if (score >= 4) return 'var(--color-caution)';
    return 'var(--color-danger)';
}

function renderBreathableScore(pollenData, aqiData) {
    const container = document.getElementById('breathable-score-section');
    const score = computeBreathableScore(pollenData, aqiData);
    const insights = generateBreathableInsights(score, pollenData, aqiData);
    const color = getScoreColor(score);

    container.innerHTML = `
        <div class="glass-panel breathable-card">
            <h2 class="breathable-title">Breathable Score</h2>
            <p class="breathable-subtitle">What today's pollen and air quality mean</p>
            <div class="breathable-score-display">
                <div class="breathable-score-circle" style="border-color: ${color}; color: ${color}">
                    <span class="breathable-score-num">${score}</span>
                    <span class="breathable-score-denom">/10</span>
                </div>
            </div>
            <ul class="breathable-insights">
                ${insights.map(i => `<li>${i}</li>`).join('')}
            </ul>
        </div>
    `;
}

// --- Powered By ---

function renderPoweredBy(pollenData) {
    const container = document.getElementById('powered-by');
    // Determine active data sources
    const sources = [];
    if (pollenData?.city) {
        sources.push({ name: 'Pollen.com', desc: 'Pollen Forecasts' });
    } else {
        sources.push({ name: 'NC DEQ', desc: 'Pollen Monitoring' });
    }
    sources.push({ name: 'Open-Meteo', desc: 'Air Quality' });

    container.innerHTML = `
        <span class="powered-label">Powered by</span>
        ${sources.map(s => `<span class="powered-source" title="${s.desc}">${s.name}</span>`).join('<span class="powered-dot">&middot;</span>')}
    `;
}

// --- Health Guidance ---

function renderHealthGuidance(pollenData) {
    const container = document.getElementById('health-guidance-section');
    const maxSeverity = Math.max(...pollenData.pollen.map(p => p.severityLevel));
    const mainType = pollenData.pollen.reduce((a, b) => a.severityLevel >= b.severityLevel ? a : b);
    const typeName = mainType.type.toLowerCase();

    // Dynamic advice based on severity
    let mildAdvice, moderateAdvice, severeAdvice, medAdvice;

    if (maxSeverity >= 3) {
        mildAdvice = `You may notice mild irritation at peak times. ${mainType.type} pollen is elevated; consider shorter midday exposure and keep water handy.`;
        moderateAdvice = `Plan around peak pollen windows. Try errands early or later, and consider a mask in high-traffic outdoor areas.`;
        severeAdvice = `Use high-protection habits today: shorter trips, cleaner indoor air, and reduced exposure during peak pollen hours.`;
        medAdvice = `Talk to your doctor about daily antihistamines like cetirizine (Zyrtec), loratadine (Claritin), or fexofenadine (Allegra). Nasal corticosteroid sprays such as fluticasone (Flonase) are highly effective for congestion. Eye drops like ketotifen (Zaditor) can help itchy eyes.`;
    } else if (maxSeverity === 2) {
        mildAdvice = `Conditions are moderate today. You may feel occasional irritation from ${typeName} pollen, especially midday. Stay hydrated.`;
        moderateAdvice = `Keep antihistamines nearby and consider limiting prolonged outdoor activity during midday when pollen tends to peak.`;
        severeAdvice = `Stay cautious: even moderate days can trigger symptoms. Keep windows closed and consider running an air purifier.`;
        medAdvice = `Over-the-counter antihistamines like cetirizine (Zyrtec) or loratadine (Claritin) can help on moderate days. A saline nasal rinse can clear irritants. If symptoms persist, ask your doctor about nasal sprays like fluticasone (Flonase).`;
    } else {
        mildAdvice = `Today looks comfortable. Pollen levels are low, so outdoor activities should be fine with minimal concern.`;
        moderateAdvice = `Low pollen today is good news. You can enjoy outdoor activities but keep medication handy just in case conditions shift.`;
        severeAdvice = `Pollen is low today, which is good. Still follow your routine precautions, as conditions can change later in the day.`;
        medAdvice = `Low pollen days are a good time to restock your allergy kit. Common doctor-recommended options include cetirizine (Zyrtec), loratadine (Claritin), and nasal sprays like fluticasone (Flonase). Always consult your doctor before starting a new medication.`;
    }

    container.innerHTML = `
        <h2 class="section-title health-title">How today's pollen may affect you</h2>
        <div class="health-grid">
            <div class="glass-panel health-card">
                <div class="health-card-icon health-mild">~</div>
                <h3 class="health-card-label">Mild allergy sufferers</h3>
                <p class="health-card-text">${mildAdvice}</p>
            </div>
            <div class="glass-panel health-card">
                <div class="health-card-icon health-moderate">!</div>
                <h3 class="health-card-label">Moderate allergy sufferers</h3>
                <p class="health-card-text">${moderateAdvice}</p>
            </div>
            <div class="glass-panel health-card">
                <div class="health-card-icon health-severe">!!</div>
                <h3 class="health-card-label">Severe allergy sufferers</h3>
                <p class="health-card-text">${severeAdvice}</p>
            </div>
            <div class="glass-panel health-card">
                <div class="health-card-icon health-meds">+</div>
                <h3 class="health-card-label">Medicine recommendations</h3>
                <p class="health-card-text">${medAdvice}</p>
                <p class="health-card-disclaimer">Always consult your doctor before starting any medication.</p>
            </div>
        </div>
    `;
}

// --- Email Alerts ---

function renderAlerts() {
    const container = document.getElementById('alerts-section');
    container.innerHTML = `
        <div class="glass-panel alerts-card">
            <h2 class="alerts-title">Get Pollen Alerts</h2>
            <p class="alerts-subtitle">Get email alerts when pollen or air quality will be dangerous in your area.</p>
            <div class="alerts-features">
                <span class="alerts-feature">Morning alerts</span>
                <span class="alerts-dot">&middot;</span>
                <span class="alerts-feature">Your location</span>
                <span class="alerts-dot">&middot;</span>
                <span class="alerts-feature">Only when needed</span>
            </div>
            <form class="alerts-form" id="alerts-form">
                <div class="alerts-inputs">
                    <input type="email" id="alert-email" class="alerts-input" placeholder="Your email" required>
                    <input type="text" id="alert-zip" class="alerts-input alerts-zip" placeholder="Zip code" maxlength="5" pattern="[0-9]{5}" required>
                </div>
                <button type="submit" class="alerts-btn">Get Pollen Alerts</button>
            </form>
            <div id="alerts-success" class="alerts-success" style="display:none;">
                You're signed up! We'll send morning alerts only when conditions are concerning in your area.
                <button type="button" class="alerts-unsubscribe-btn" id="alerts-unsubscribe">Unsubscribe</button>
            </div>
        </div>
    `;

    // Handle form submission
    document.getElementById('alerts-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('alert-email').value;
        const zip = document.getElementById('alert-zip').value;
        const btn = document.querySelector('.alerts-btn');
        btn.textContent = 'Signing up...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, zip }),
            });

            if (!res.ok) throw new Error('Signup failed');

            localStorage.setItem('pollen_alert_email', email);
            localStorage.setItem('pollen_alert_zip', zip);
            document.getElementById('alerts-form').style.display = 'none';
            document.getElementById('alerts-success').style.display = 'block';
        } catch (err) {
            btn.textContent = 'Get Pollen Alerts';
            btn.disabled = false;
            alert('Signup failed. Please try again.');
        }
    });

    // Handle unsubscribe
    document.getElementById('alerts-unsubscribe').addEventListener('click', async () => {
        const email = localStorage.getItem('pollen_alert_email');
        if (email) {
            try {
                await fetch(`/api/unsubscribe?email=${encodeURIComponent(email)}`);
            } catch { /* still clear locally */ }
        }
        localStorage.removeItem('pollen_alert_email');
        localStorage.removeItem('pollen_alert_zip');
        document.getElementById('alerts-form').style.display = 'block';
        document.getElementById('alerts-success').style.display = 'none';
        document.getElementById('alert-email').value = '';
        document.getElementById('alert-zip').value = '';
    });

    // Pre-fill if already signed up
    const savedEmail = localStorage.getItem('pollen_alert_email');
    const savedZip = localStorage.getItem('pollen_alert_zip');
    if (savedEmail) {
        document.getElementById('alerts-form').style.display = 'none';
        document.getElementById('alerts-success').style.display = 'block';
    }
}

// --- Render Main App ---

function renderApp(pollenData, isRefreshing = false) {
    const reportDateEl = document.getElementById('report-date');
    const pollenContainer = document.getElementById('pollen-container');
    const dangerBadgeContainer = document.getElementById('danger-badge-container');
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

    // Get fallback allergens for current city
    const currentCityName = localStorage.getItem('aqi_selected_city_name') || 'Raleigh';
    const fallbackAllergens = getCityAllergens(currentCityName);

    // Render Pollen Cards with species details
    pollenContainer.innerHTML = pollenData.pollen.map(p => {
        const percentage = Math.min((p.severityLevel / 4) * 100, 100);
        let barColor = 'var(--color-safe)';
        if (p.severityLevel === 2) barColor = 'var(--color-moderate)';
        if (p.severityLevel === 3) barColor = 'var(--color-caution)';
        if (p.severityLevel === 4) barColor = 'var(--color-danger)';

        // Species details section
        let speciesHTML = '';
        if (p.type === 'Trees') {
            const treeDetails = (p.details && p.details.length > 0) ? p.details : fallbackAllergens.trees;
            speciesHTML = `
                <div class="species-section">
                    <div class="species-title">Top Tree Allergens</div>
                    <div class="species-tags">
                        ${treeDetails.map(name => `<span class="species-tag" style="border-color: ${barColor}40; color: ${barColor}">${name}</span>`).join('')}
                    </div>
                </div>
            `;
        } else if (p.type === 'Weeds') {
            const weedDetails = (p.details && p.details.length > 0) ? p.details : fallbackAllergens.weeds;
            if (p.severityLevel >= 2 || (p.details && p.details.length > 0)) {
                speciesHTML = `
                    <div class="species-section">
                        <div class="species-title">Top Weed Allergens</div>
                        <div class="species-tags">
                            ${weedDetails.map(name => `<span class="species-tag" style="border-color: ${barColor}40; color: ${barColor}">${name}</span>`).join('')}
                        </div>
                    </div>
                `;
            } else {
                speciesHTML = `
                    <div class="species-section">
                        <div class="species-title">Top Weed Allergens</div>
                        <div class="species-tags">
                            ${weedDetails.map(name => `<span class="species-tag" style="border-color: ${barColor}40; color: ${barColor}">${name}</span>`).join('')}
                        </div>
                        <p class="species-note">Currently low — these are common area allergens to watch.</p>
                    </div>
                `;
            }
        }

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
                ${speciesHTML}
            </div>
        `;
    }).join('');

    // Render powered-by
    renderPoweredBy(pollenData);
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
        console.warn('Live fetch failed, using hardcoded fallback:', fetchError);
        return { ...fallbackData, lastUpdated: new Date().toLocaleString() };
    }
}

async function initApp() {
    // Pollen + AQI loading is handled by initAQI → loadCityData
    // Render email alerts section (static UI)
    renderAlerts();
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

    let aqiResult = null;
    let pollenResult = null;

    // Fetch AQI and pollen in parallel
    const aqiPromise = fetchAQI(city).then(data => {
        aqiResult = data;
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
        pollenResult = data;
        renderApp(data, false);
    }).catch(async (error) => {
        console.warn('City pollen fetch failed, trying NC DEQ fallback:', error);
        // Fall back to NC DEQ data
        const data = await loadPollenData();
        pollenResult = data;
        renderApp(data, false);
    });

    await Promise.allSettled([aqiPromise, pollenPromise]);

    // Render sections that depend on both datasets
    if (pollenResult) {
        renderBreathableScore(pollenResult, aqiResult);
        renderHealthGuidance(pollenResult);
    }
}

function initAQI() {
    populateCityPicker();
    const savedName = localStorage.getItem('aqi_selected_city_name');
    const idx = savedName ? CITIES.findIndex(c => c.name === savedName) : 0;
    const city = CITIES[idx >= 0 ? idx : 0];
    localStorage.setItem('aqi_selected_city_name', city.name);
    loadCityData(city);
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    initAQI();
});
