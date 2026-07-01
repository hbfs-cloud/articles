/**
 * substack-client.js — session-cookie client for Substack's INTERNAL (reverse-engineered) API.
 *
 * ⚠️ There is no official Substack write API. Every endpoint path below is reverse-engineered from
 * the web app and is UNVERIFIED — confirm live with a real cookie before trusting create/publish.
 * Keep ALL endpoint knowledge in this file so there is a single place to fix.
 *
 * Auth: the raw `Cookie` header captured after an interactive login (see SUBSTACK_MCP_PLAN.md §3).
 * The cookie is a user secret — passed in from the caller, never hardcoded, never logged.
 */
'use strict';

export class SubstackClient {
  /**
   * @param {object} opts
   * @param {string} opts.publication  subdomain, e.g. "dailytickers"
   * @param {string} opts.cookie       raw Cookie header value (secret)
   */
  constructor({ publication, cookie }) {
    if (!publication) throw new Error('SubstackClient: publication is required');
    if (!cookie) throw new Error('SubstackClient: cookie is required (interactive login needed)');
    this.publication = publication;
    this.cookie = cookie;
    this.base = `https://${publication}.substack.com`;
  }

  async _req(method, pathname, body) {
    const url = this.base + pathname;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookie,
        'Origin': this.base,
        'Referer': this.base + '/publish/home',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      // HARD STOP signal: cookie expired / unauthorized. Caller must surface + halt.
      const err = new Error('Substack auth failed (401/403): session cookie expired or invalid.');
      err.code = 'SUBSTACK_AUTH';
      throw err;
    }
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      const err = new Error(`Substack ${method} ${pathname} -> ${res.status}`);
      err.code = 'SUBSTACK_HTTP';
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  /** Sanity check the cookie. Returns the logged-in publication user, or throws SUBSTACK_AUTH. */
  async whoami() {
    // Endpoint: current publication user context. UNVERIFIED path.
    return this._req('GET', '/api/v1/publication/subscription');
  }

  /**
   * Create a draft.
   * @param {object} d
   * @param {string} d.title
   * @param {string} [d.subtitle]
   * @param {object} d.body   ProseMirror doc { type:"doc", content:[...] }
   * @param {string} [d.audience]  "everyone" | "only_paid" | "founding"
   */
  async createDraft({ title, subtitle = '', body, audience = 'everyone' }) {
    if (!title) throw new Error('createDraft: title required');
    if (!body || body.type !== 'doc') throw new Error('createDraft: body must be a ProseMirror doc');
    // UNVERIFIED path/shape. Substack stores body as a JSON-stringified ProseMirror doc.
    return this._req('POST', '/api/v1/drafts', {
      draft_title: title,
      draft_subtitle: subtitle,
      draft_body: JSON.stringify(body),
      audience,
      type: 'newsletter',
    });
  }

  /** List drafts (unpublished). UNVERIFIED path. */
  async listDrafts({ limit = 20 } = {}) {
    const res = await this._req('GET', `/api/v1/drafts?limit=${encodeURIComponent(limit)}`);
    const items = Array.isArray(res) ? res : (res.drafts || res.posts || []);
    return items
      .filter(p => !p.is_published && !p.post_date)
      .map(p => ({
        id: p.id,
        title: p.draft_title || p.title || '(untitled)',
        updated_at: p.updated_at || p.draft_updated_at || null,
        url: p.id ? `${this.base}/publish/post/${p.id}` : null,
      }));
  }

  /**
   * Publish a draft. Substack's web flow is prepublish -> publish. Both UNVERIFIED.
   * @param {number|string} draftId
   * @param {boolean} sendEmail  also send to email list
   */
  async publish(draftId, { sendEmail = false } = {}) {
    if (!draftId) throw new Error('publish: draftId required');
    await this._req('POST', `/api/v1/drafts/${draftId}/prepublish`, {});
    const res = await this._req('POST', `/api/v1/drafts/${draftId}/publish`, {
      send: sendEmail,
      share_automatically: false,
    });
    return {
      post_id: res.id || draftId,
      url: res.canonical_url || res.slug ? `${this.base}/p/${res.slug}` : null,
      published_at: res.post_date || new Date().toISOString(),
    };
  }

  /**
   * Post a short Note (teaser). Separate surface from long posts. UNVERIFIED.
   * @param {object} note ProseMirror-ish body for the note
   */
  async createNote(bodyJson) {
    return this._req('POST', '/api/v1/comment/feed', {
      bodyJson,
      type: 'feed',
    });
  }
}
