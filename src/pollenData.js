export const pollenData = {
  date: "March 13, 2026",
  period: "9:00 AM Thursday, March 12, 2026 - 9:00 AM Friday, March 13, 2026",
  lastUpdated: new Date().toLocaleString(),
  pollen: [
    {
      type: "Trees",
      count: 176.0,
      severity: "VERY HIGH",
      severityLevel: 4, // 1: Low, 2: Moderate, 3: High, 4: Very High
      details: ["Oak", "Juniper", "Cedar", "Cypress", "Pine", "Mulberry", "Sweet Gum"],
      unit: "grains/m³"
    },
    {
      type: "Grasses",
      count: 0.3,
      severity: "LOW",
      severityLevel: 1,
      details: [],
      unit: "grains/m³"
    },
    {
      type: "Weeds",
      count: 0.6,
      severity: "LOW",
      severityLevel: 1,
      details: [],
      unit: "grains/m³"
    }
  ],
  totalCount: 176.9
};

export function getDangerZoneLevel(pollenArray) {
  const maxLevel = Math.max(...pollenArray.map(p => p.severityLevel));
  if (maxLevel >= 4) return { label: "DANGER", class: "danger", description: "Extreme pollen levels! Stay indoors if possible." };
  if (maxLevel === 3) return { label: "CAUTION", class: "caution", description: "High pollen levels. Limit outdoor exposure." };
  if (maxLevel === 2) return { label: "MODERATE", class: "moderate", description: "Moderate pollen levels. Sensitive individuals should take care." };
  return { label: "SAFE", class: "safe", description: "Pollen levels are currently low." };
}
