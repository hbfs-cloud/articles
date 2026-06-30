---
name: routine-redesign-v2
description: "Cloud routine architecture v2 — 11 active routines (10 original + watchdog) on Opus with 4 MCP connectors. Watchdog added 2026-06-27 (war room). Old conductors disabled 2026-06-24."
metadata: 
  node_type: memory
  type: project
  originSessionId: ac53259d-133a-4f6b-a082-5b75b9663be7
---

## Routine Architecture v2 (updated 2026-06-25)

Old conductors (AM/PM/WE) disabled — they had huge prompts (~2000 words), crashed silently, never sent notifications.

**Why:** Prompts too complex for cloud agents. They'd read CLAUDE.md, attempt 8-10 MCP calls, try to generate articles, and fail before reaching send_message. Zero crypto monitoring during trading hours.

**How to apply:** All routines on Opus. Monitoring routines = short prompts, no file writes. Article routines = full pipeline with git. All 10 routines have 4 MCP connectors (marketdata, notification, memory, simulator).

### Systemic fixes applied 2026-06-25
1. **GetMarketOverview** — `analysis_depth="quick" maxsize=20000` everywhere (default times out at 45s/70KB)
2. **Connector simulator** — added to Daily/Scanner/Nightly/Weekly (was missing → `get_portfolio()` silently failed)
3. **Connector memory** — added to all 4 monitoring routines (was missing)
4. **Telegram format** — `format='html'` + `<b>` tags on all routines (Telegram ignores `**bold**`)
5. **Anti-hallucination** — "NEVER invent" rule on all routines; Crash Detector v4 = intraday-only >3% drops, no 52W low

### Monitoring Routines (all Opus, short prompts)
| Routine | ID | Schedule (Paris) | Role |
|---------|-----|----------|------|
| Crash Detector | `trig_01D93bitp7HU3a26L4xC6ZD3` | 9h,13h,17h,21h daily | >3% intraday drop → urgent alert with MCP news. dedup_key per day. |
| Market Pulse | `trig_01E6dZ7jq7g4Fiz9Dk25Rv8C` | 9h,13h,18h,22h lun-ven | Compact Telegram: indices+crypto+regime+portfolio |
| Weekend Pulse | `trig_01UJz9m6BQYZbWi4XzpZkuVF` | 10h,18h sam-dim | Crypto + safe havens + next week earnings |
| Rotation Detector | `trig_01UTXmc1Z8PHjp5SfNHJ65xR` | 10h,16h,21h lun-ven | Free-form sector analysis, ~2-3 alerts/week. dedup_key per day. |

### Article Routines (all Opus, full pipeline)
| Routine | ID | Schedule (Paris) | Role |
|---------|-----|----------|------|
| Daily Briefing | `trig_01JHPdHZcMzJUEmo8eg4sAA4` | 7h daily | 17-section briefing + radar update |
| Scanner Nocturne | `trig_016idAivWzRTwcoeGnUgJB2S` | 23h lun-ven | Full scanner pipeline |
| Nightly Refresh | `trig_01MJRrjQ4C3HPJXiucWXbC57` | 00h30 mar-sam | Refresh top 5 analyses + auto-gen 2 new |
| Weekly Review | `trig_015zVDa29WvDuKGjtXbp21ft` | 18h dim | 18-section weekly review |
| Rétrospective | `trig_015aaWxMDUj43skqRJBzMhUJ` | 1h sam (ven soir UTC) | Week's closed trades with real outcomes |
| A+ Monitor | `trig_0145xrZhSgPLTQMzg4JkCd9i` | 22h15 lun-ven | Conviction portfolio monitoring |

### Infrastructure Routines
| Routine | ID | Schedule (Paris) | Role |
|---------|-----|----------|------|
| Watchdog | `trig_01PNBVTsubT5Ch6w21pxq6Aw` | 10h daily | Checks all routine outputs via git log + memory, sends red/green summary to alerts |

### Disabled
- Conductor AM/PM/WE — DISABLED
- Delta Pre-Open — DISABLED

Related: [[oauth2-migration]], [[feedback_mcp_hard_stop]], [[war-room-audit-findings]]
