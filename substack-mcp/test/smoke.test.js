/**
 * smoke.test.js — offline sanity for the Markdown -> ProseMirror conversion. No network, no secrets.
 * Run: node --test test/
 */
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToProseMirror, noteToProseMirror } from '../src/markdown-to-prosemirror.js';

test('headings and paragraphs', () => {
  const doc = markdownToProseMirror('# Title\n\nHello **world** and [link](https://x.com).');
  assert.equal(doc.type, 'doc');
  assert.equal(doc.content[0].type, 'heading');
  assert.equal(doc.content[0].attrs.level, 1);
  const p = doc.content[1];
  assert.equal(p.type, 'paragraph');
  assert.ok(p.content.some(n => n.marks && n.marks[0].type === 'strong'));
  assert.ok(p.content.some(n => n.marks && n.marks[0].type === 'link' && n.marks[0].attrs.href === 'https://x.com'));
});

test('bullet list', () => {
  const doc = markdownToProseMirror('- one\n- two');
  assert.equal(doc.content[0].type, 'bullet_list');
  assert.equal(doc.content[0].content.length, 2);
});

test('table', () => {
  const doc = markdownToProseMirror('| A | B |\n| --- | --- |\n| 1 | 2 |');
  assert.equal(doc.content[0].type, 'table');
  assert.equal(doc.content[0].content[0].content[0].type, 'table_header');
});

test('note builder', () => {
  const doc = noteToProseMirror('Teaser line\n\nhttps://articles.dailytickers.com/');
  assert.equal(doc.type, 'doc');
  assert.equal(doc.content.length, 2);
});
