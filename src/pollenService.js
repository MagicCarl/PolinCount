/**
 * Shared pollen helpers.
 *
 * Fetching lives in aqiService.js, which knows which source a city uses.
 * severityLevel is normalized 1-4 by the server for every source, so this
 * mapping works for NC DEQ grains/m3 and Google UPI alike.
 */

export function getDangerZoneLevel(pollenArray) {
    if (!pollenArray || pollenArray.length === 0) {
        return { label: 'UNKNOWN', class: 'safe', description: 'Unable to determine pollen levels.' };
    }

    // Types the provider did not report carry a null level — exclude them
    // rather than letting an absent reading read as "safe".
    const levels = pollenArray.map(p => p.severityLevel).filter(Number.isFinite);
    if (levels.length === 0) {
        return { label: 'UNKNOWN', class: 'safe', description: 'Unable to determine pollen levels.' };
    }
    const maxLevel = Math.max(...levels);
    if (maxLevel >= 4) return { label: 'DANGER', class: 'danger', description: 'Extreme pollen levels! Stay indoors if possible.' };
    if (maxLevel === 3) return { label: 'CAUTION', class: 'caution', description: 'High pollen levels. Limit outdoor exposure.' };
    if (maxLevel === 2) return { label: 'MODERATE', class: 'moderate', description: 'Moderate pollen levels. Sensitive individuals should take care.' };
    return { label: 'SAFE', class: 'safe', description: 'Pollen levels are currently low.' };
}
