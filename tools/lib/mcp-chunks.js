'use strict';
/** Strict JSON fragment reassembly. Data only: concatenate strings, JSON.parse once.
 * Never sorts, repairs, evaluates code, mutates inputs or treats partial JSON as data.
 */
const crypto = require('crypto');
const FIELDS = Object.freeze(['_chunk_data', '_chunk_encoding', '_chunk_field', '_chunk_index', '_chunk_item_index', '_chunk_requires_reassembly', '_chunk_total']);
const digest = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
class McpChunkError extends Error { constructor(message) { super(`MCP chunks: ${message}`); this.name = 'McpChunkError'; } }
const hasChunkFields = item => item && typeof item === 'object' && Object.keys(item).some(k => k.startsWith('_chunk_'));
// Legacy array-field pages carry data/type plus _chunk_field such as data.markets,
// with no JSON string or encoding. They are already structured data, not this codec.
const isJsonFragment = item => item && typeof item === 'object' && (Object.hasOwn(item, '_chunk_data') || Object.hasOwn(item, '_chunk_encoding') || item._chunk_field === '$');
function inspect(chunk) {
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) throw new McpChunkError('fragment must be an object');
  if (Object.keys(chunk).length !== FIELDS.length || !FIELDS.every(k => Object.hasOwn(chunk, k))) throw new McpChunkError('fragment fields missing or unexpected');
  if (chunk._chunk_requires_reassembly !== true || chunk._chunk_encoding !== 'json-utf8' || chunk._chunk_field !== '$') throw new McpChunkError('unsupported flag, encoding or field');
  if (typeof chunk._chunk_data !== 'string') throw new McpChunkError('fragment data must be a string');
  for (const key of ['_chunk_index', '_chunk_item_index', '_chunk_total']) if (!Number.isSafeInteger(chunk[key]) || chunk[key] < 1) throw new McpChunkError(`${key} must be a positive safe integer`);
  if (chunk._chunk_index > chunk._chunk_total) throw new McpChunkError('fragment index exceeds total');
}
function reassembleItems(input, { includeProvenance = true } = {}) {
  if (!Array.isArray(input)) throw new McpChunkError('items must be an array');
  const items = [], groups = [];
  for (let cursor = 0; cursor < input.length;) {
    const first = input[cursor];
    if (!isJsonFragment(first)) { items.push(first); cursor++; continue; }
    inspect(first);
    const count = first._chunk_total, itemIndex = first._chunk_item_index;
    if (first._chunk_index !== 1) throw new McpChunkError('group must begin at fragment index 1');
    // Original item indexes are one-based. Normal items occupy a slot as well.
    if (itemIndex !== items.length + 1) throw new McpChunkError('original item index/order mismatch');
    if (count > input.length - cursor) throw new McpChunkError('incomplete fragment group');
    const fragments = [], fragmentHashes = [];
    for (let offset = 0; offset < count; offset++) {
      const chunk = input[cursor + offset]; inspect(chunk);
      if (chunk._chunk_item_index !== itemIndex || chunk._chunk_total !== count) throw new McpChunkError('inconsistent or interleaved fragment group');
      if (chunk._chunk_index !== offset + 1) throw new McpChunkError('missing, duplicate or out-of-order fragment index');
      fragments.push(chunk._chunk_data);
      if (includeProvenance) fragmentHashes.push({ index: chunk._chunk_index, sha256: digest(chunk._chunk_data), utf8_bytes: Buffer.byteLength(chunk._chunk_data, 'utf8') });
    }
    const encoded = fragments.join('');
    let item;
    try { item = JSON.parse(encoded); } catch { throw new McpChunkError(`item ${itemIndex}: invalid assembled JSON`); }
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new McpChunkError(`item ${itemIndex}: assembled JSON must be an object`);
    if (hasChunkFields(item)) throw new McpChunkError(`item ${itemIndex}: assembled object is still a fragment envelope`);
    items.push(item);
    if (includeProvenance) groups.push({ item_index: itemIndex, fragments: count, encoding: 'json-utf8', field: '$', sha256: digest(encoded), utf8_bytes: Buffer.byteLength(encoded, 'utf8'), fragment_hashes: fragmentHashes });
    else groups.push({ item_index: itemIndex, fragments: count });
    cursor += count;
  }
  return { items, groups, input_items: input.length, output_items: items.length };
}
function reassembleJobResponse(response, options) {
  const input = response?.data?.items;
  if (!Array.isArray(input) || !input.some(isJsonFragment)) return response;
  const pagination = response.pagination || response.data.pagination;
  if (pagination?.has_next !== false) throw new McpChunkError('pagination must be exhausted before reassembly');
  const result = reassembleItems(input, options);
  const declaredTotal = response.data.total_items;
  // total_items describes original logical items, not their transport fragments.
  if (declaredTotal != null && (!Number.isSafeInteger(declaredTotal) || declaredTotal !== result.output_items)) throw new McpChunkError('logical total_items does not match reassembled count');
  if (Object.hasOwn(response, 'chunk_reassembly')) throw new McpChunkError('preexisting reassembly metadata on fragmented response');
  return { ...response, data: { ...response.data, items: result.items },
    chunk_reassembly: { version: 1, status: 'complete', input_items: result.input_items, output_items: result.output_items, groups: result.groups } };
}
module.exports = { McpChunkError, reassembleItems, reassembleJobResponse };
