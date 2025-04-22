#!/usr/bin/env node
/**
 * Build Script: Auto-generate campaign_settings/index.json
 *
 * Scans the campaign_settings directory for all JSON files (excluding index.json),
 * reads their "id" and "name" properties, and writes an up-to-date index.json manifest.
 */
const fs = require('fs');
const path = require('path');

// Directory containing campaign JSON files
const campaignDir = path.resolve(__dirname, '../campaign_settings');
const indexPath = path.join(campaignDir, 'index.json');

function run() {
  let files;
  try {
    files = fs.readdirSync(campaignDir);
  } catch (err) {
    console.error(`Failed to read directory ${campaignDir}:`, err);
    process.exit(1);
  }
  // Filter JSON files, skip index.json
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');

  const campaignSettings = jsonFiles.map(file => {
    const filePath = path.join(campaignDir, file);
    let raw;
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error(`Failed to read file ${file}:`, err);
      process.exit(1);
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error(`Invalid JSON in ${file}:`, err);
      process.exit(1);
    }
    if (!data.id || !data.name) {
      console.error(`File ${file} missing required 'id' or 'name' fields`);
      process.exit(1);
    }
    return { id: data.id, name: data.name, path: file };
  });

  // Sort alphabetically by name
  campaignSettings.sort((a, b) => a.name.localeCompare(b.name));
  const indexData = { campaignSettings };
  try {
    fs.writeFileSync(
      indexPath,
      JSON.stringify(indexData, null, 4) + '\n',
      'utf8'
    );
    console.log(`Generated index.json with ${campaignSettings.length} entries.`);
  } catch (err) {
    console.error(`Failed to write index.json to ${indexPath}:`, err);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}
// Export for testing if needed
module.exports = { run };