'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// A correction never rewrites the certified feed. It must bind its exact bytes,
// the independent primary registry and a correction actually disclosed to readers.
function primaryCorrection({ dir, registryPath, registry, event, row, prose }) {
  const file = path.join(dir, 'calendar-corrections.json');
  if (!fs.existsSync(file)) return false;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (doc.version !== 1 || doc.raw_sha256 !== hash(path.join(dir, '_data/economic_events.json'))
      || doc.registry_sha256 !== hash(registryPath)) return false;
  const source = registry.sources[event.source];
  const correction = (doc.corrections || []).find(c => c.event_id === event.id
    && c.raw_label === row.label && c.raw_date === row.date
    && c.authoritative_date === event.date && c.source_url === source.url);
  if (!correction || !correction.public_disclosure || correction.public_disclosure.length < 30) return false;
  const text = prose.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  return text.includes(correction.public_disclosure)
    && correction.public_disclosure.includes(row.date)
    && correction.public_disclosure.includes(event.date)
    && prose.includes(source.url);
}

module.exports = { primaryCorrection };
