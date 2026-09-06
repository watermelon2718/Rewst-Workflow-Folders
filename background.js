/**
 * background.js — Auto-export listener
 *
 * Runs as an event page (Firefox) or service worker (Chrome).
 * Watches for storage changes and, if auto-export is enabled,
 * writes the current org's config to a fixed filename via
 * the downloads API (overwriting each time).
 */
const STORAGE_KEY = 'rwf_data';
const SETTINGS_KEY = 'rwf_settings';

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] || { autoExportEnabled: false, autoExportOrgId: null };
}

async function exportOrgData(orgId, orgData) {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    orgId,
    folders: orgData.folders,
    assignments: orgData.assignments,
  };
  const json = JSON.stringify(exportData, null, 2);

  // Service workers/event pages can't use URL.createObjectURL reliably,
  // so use a data: URL instead — works in both contexts.
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);

  await chrome.downloads.download({
    url: dataUrl,
    filename: `rewst-folders-${orgId.slice(0, 8)}.json`,
    conflictAction: 'overwrite',
    saveAs: false,
  });
}

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;

  const settings = await getSettings();
  if (!settings.autoExportEnabled || !settings.autoExportOrgId) return;

  const newAll = changes[STORAGE_KEY].newValue || {};
  const orgData = newAll[settings.autoExportOrgId];
  if (!orgData) return;

  try {
    await exportOrgData(settings.autoExportOrgId, orgData);
  } catch (err) {
    console.error('rwf auto-export failed:', err);
  }
});