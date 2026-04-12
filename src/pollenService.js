/**
 * Client-side pollen service — fetches from /api/nc-pollen (server-side cached)
 */

export async function fetchPollenData() {
    const response = await fetch('/api/nc-pollen');
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${response.status}`);
    }
    return response.json();
}

export function getDangerZoneLevel(pollenArray) {
    if (!pollenArray || pollenArray.length === 0) {
        return { label: 'UNKNOWN', class: 'safe', description: 'Unable to determine pollen levels.' };
    }

    const maxLevel = Math.max(...pollenArray.map(p => p.severityLevel));
    if (maxLevel >= 4) return { label: 'DANGER', class: 'danger', description: 'Extreme pollen levels! Stay indoors if possible.' };
    if (maxLevel === 3) return { label: 'CAUTION', class: 'caution', description: 'High pollen levels. Limit outdoor exposure.' };
    if (maxLevel === 2) return { label: 'MODERATE', class: 'moderate', description: 'Moderate pollen levels. Sensitive individuals should take care.' };
    return { label: 'SAFE', class: 'safe', description: 'Pollen levels are currently low.' };
}
