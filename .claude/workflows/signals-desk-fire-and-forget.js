export const meta = {
  name: 'signals-desk-fire-and-forget',
  description: 'Version LEAN + AUTONOME de signals-desk (mains-libres, cron/cloud) : sort 3-5 bons signaux du jour, indépendant du bilan/ledger/harness multi-persona. Auto-poste sur alerts. Ne reste JAMAIS muet : MCP down → poste "MCP indispo" ; rien de propre → poste "pas de setup". Garde-fous : preflight MCP, zéro hallu, R/R≥1.5 recalculé (2e passe), earnings/dilution drop, date macro vérifiée. Le signals-desk COMPLET reste la référence (bilan+ledger+harness) — ceci est le variant fire-and-forget.',
  whenToUse: 'Run planifié / mains-libres pour poster 3-5 signaux du jour sans supervision. Pour le run complet avec bilan+ledger+harness multi-persona, utiliser le skill signals-desk.',
  phases: [
    { title: 'Generate', detail: 'preflight MCP + régime live + macro-date vérifiée + screen best 3-5 + validation niveaux' },
    { title: 'Verify', detail: 'recalcul INDÉPENDANT R/R_TP1≥1.5, stop≥1.5×ATR, earnings, actionnable, date macro — drop les échecs' },
    { title: 'Post', detail: 'auto-post alerts (html) + boutons feedback pris/passé + message_id persisté + log ledger léger + push ; statut posté même si MCP down ou 0 setup' },
  ],
}

// args (optionnel) : { dryRun?:bool, universe?:string, macroEvents?:[{name,dateISO,timeET,impact}] }
// Robuste : args peut arriver comme OBJET ou comme CHAÎNE JSON (selon l'appelant) — parser les deux.
let A = {}
try { A = (typeof args === 'string') ? (args.trim() ? JSON.parse(args) : {}) : (args && typeof args === 'object' ? args : {}) } catch (_) { A = {} }
// Sécurité : si dryRun est passé en string "true"/"false", le normaliser.
const DRY = A.dryRun === true || A.dryRun === 'true' || A.dryRun === 1
// Le feed MCP economic_events est aveugle au CPI/FOMC (ticket owner docs/specs/mcp-economic-calendar-request.md).
// Les dates macro VÉRIFIÉES (BLS/Fed) sont passées via args.macroEvents ; sinon l'agent vérifie via WebSearch.
const MACRO = Array.isArray(A.macroEvents) ? A.macroEvents : []

const RULES = `
⛔ GARDE-FOUS (variant lean — on garde SEULEMENT ceux qui évitent les incidents) :
- PREFLIGHT mcp__marketdata__GetStatus (healthy, pas stale>48h). Down/incohérent → MCP HARD STOP : ne rien fabriquer.
- ZÉRO HALLUCINATION : chaque chiffre (prix, ATR14, niveaux, R/R) vient d'un appel mcp__marketdata__ de CETTE session.
- R/R_TP1 = (TP1−entrée)/(entrée−stop) ≥ 1,5 à une ENTRÉE ACTIONNABLE (≤3% du spot, pas de chase). (entrée−stop)/ATR14 ≥ 1,5.
- earnings ≤ 3 séances → DROP. dilution (sec_filings,flags dilutif : shelf/ATM/underwriter toxique) → DROP.
- 📅 DATE MACRO (leçon macro-date-verify) : le feed MCP economic_events est AVEUGLE au CPI/FOMC. Vérifier toute date macro citée via args.macroEvents (dates BLS/Fed pré-vérifiées) OU WebSearch (BLS/Fed/BEA). NE JAMAIS asserter un jour non vérifié. Un event macro ≤3 séances → tilt demi-taille + éviter d'être long en aveugle le facteur menacé (semis/growth pour un CPI).
- idées ≠ données desk : 'alerts' est PUBLIC → idées de trade UNIQUEMENT, jamais positions/equity/P&L/ordres réels. format html <b> (jamais **), &→&amp;.
- BOUTONS DE FEEDBACK (obligatoire sur tout envoi PORTANT DES SIGNAUX ; pas sur les messages de statut
  MCP down / pas de setup, où « pris/passé » n'a aucun sens) : send_message porte
  actions=[{label:'👍 pris', value:'taken'}, {label:'👎 passé', value:'skipped'}] — libellés/valeurs EXACTS.
  Les clics sont relus par le bilan hebdo via get_responses(message_id) → taux de prise par famille.
  Sans actions, aucune donnée d'adoption n'est captée. Et TOUJOURS persister le message_id retourné
  (data/signals-telegram-messages.json) : get_responses n'a pas de recherche par date.
LEAN = PAS de bilan des signaux précédents, PAS de state-aggregation, PAS de harness multi-persona lourd (juste le recalcul 2e passe), PAS de branche/PR.
Presets testés config/signal-presets.yaml (status: tested).
`

phase('Generate')
const gen = await agent(
  `Génère les 3-5 MEILLEURS signaux swing du jour (variant fire-and-forget, autonome).
${RULES}
Contrainte univers (si fournie) : ${A.universe || '(aucune — US large/mid liquides)'}.
Dates macro pré-vérifiées (si fournies) : ${JSON.stringify(MACRO)}.
DO :
1. PREFLIGHT GetStatus. Down/stale → status=MCP_STOP + le détail de l'erreur (pour le message).
2. RÉGIME (léger) : GetMarketContext(facets="overview") → risk-on/off + score, VIX, breadth, pétrole/or/taux.
3. MACRO : si un event macro est ≤3 séances (depuis args.macroEvents, sinon vérifie CPI/FOMC via WebSearch BLS/Fed) → note-le (date+heure vérifiées) et applique le tilt demi-taille.
4. SCREEN : RunScreener 1-2 presets testés adaptés au régime (force_async→poll Jobs, pas de market_cap dans pass_expr) → candidats.
5. VALIDATION top 3-5 : QueryData(quote,technicals,bars_daily) → prix/ATR14/MM/RSI ; niveaux entrée(≤3% spot)/stop/tp1/tp2 du bracket ATR du preset ; R/R_TP1≥1,5 (drop sinon) ; (entrée−stop)/ATR14≥1,5 (drop) ; earnings ≤3 séances (drop) ; sec_filings,flags dilutif (drop).
6. Garde 3-5 meilleurs. Rien de propre → status=NO_CLEAN_SETUP (avec le régime, pour le message).
Retourne : status, régime+VIX, macro event vérifié (nom/date/heure/impact), les 3-5 signaux {ticker,secteur,entrée,stop,tp1,tp2,rr,atr14,thèse 1 phrase,earnings_date,dilution_flag}, chaque chiffre tracé MCP.`,
  { label: 'generate', phase: 'Generate', effort: 'high', schema: { type: 'object', required: ['status'], properties: {
    status: { type: 'string', enum: ['OK', 'MCP_STOP', 'NO_CLEAN_SETUP'] },
    regime: { type: 'string' }, vix: { type: 'string' }, macro: { type: 'string' }, errorDetail: { type: 'string' },
    signals: { type: 'array', items: { type: 'object' } } } } }
)

// Fire-and-forget : ne jamais rester muet — poster un STATUT même sur MCP_STOP / NO_CLEAN_SETUP.
if (!gen || gen.status === 'MCP_STOP') {
  const body = `⚠️ <b>Signaux — MCP indisponible</b>\nLe service de données marché est injoignable (${(gen && gen.errorDetail || 'preflight KO').slice(0,120)}). Aucun signal produit — rien n'a été estimé/inventé (règle données réelles). Reprise dès rétablissement.`
  if (!DRY) { await agent(`Poste ce statut sur alerts (fire-and-forget ne reste jamais muet). mcp__notification__send_message(to='alerts', format='html', body ci-dessous). Retourne message_id + delivery.\n${RULES}\nBODY:\n${body}`, { label: 'post:mcp-stop', phase: 'Post', effort: 'low' }) }
  return { status: 'MCP_STOP', posted: !DRY, note: 'MCP down — statut posté (ou dry-run), zéro fabrication.' }
}
if (gen.status === 'NO_CLEAN_SETUP') {
  const body = `🎯 <b>Signaux du jour — ${gen.regime || 'marché'}</b>\nPas de setup propre aujourd'hui (R/R sous 1,5 ou entrées étendues${gen.macro ? ' · ' + gen.macro : ''}). On n'en force aucun — on attend une meilleure config.\n<i>Idées de trading, pas un conseil.</i>`
  if (!DRY) { await agent(`Poste ce statut sur alerts (fire-and-forget ne reste jamais muet). mcp__notification__send_message(to='alerts', format='html'). Retourne message_id + delivery.\n${RULES}\nBODY:\n${body}`, { label: 'post:no-setup', phase: 'Post', effort: 'low' }) }
  return { status: 'NO_CLEAN_SETUP', posted: !DRY, note: 'Rien de propre — statut honnête posté (ou dry-run).' }
}
log(`Generate OK: régime ${gen.regime}, ${(gen.signals||[]).length} signaux`)

phase('Verify')
const verify = await agent(
  `Recalcul INDÉPENDANT des 3-5 signaux (mini-harness 2e passe — c'est ce contrôle croisé qui attrape un R/R gonflé, cf post-mortem 10/07). Tu RECALCULES, tu ne relis pas.
${RULES}
Signaux = ${JSON.stringify(gen.signals).slice(0, 2000)}. Macro vérifié = ${JSON.stringify(gen.macro)}.
Pour CHAQUE signal, re-vérifie via MCP si besoin : (a) R/R_TP1=(tp1−entrée)/(entrée−stop)≥1,5 (drop sinon) ; (b) (entrée−stop)/ATR14≥1,5 (drop) ; (c) entrée ≤3% du spot (drop ou « attendre repli ») ; (d) earnings ≤3 séances (drop) ; (e) prix/ATR tracés MCP (drop si non). Puis rédige le DIGEST html LEAN (section « 🎯 Signaux du jour » uniquement, PAS de bilan) : titre « 🎯 <b>Signaux du jour — [régime]${gen.macro ? ' · ' + gen.macro + ', demi-taille' : ''}</b> », par signal pastille 🟢/🟡 + <b>TICKER</b> (secteur) + thèse 1 phrase + « ▸ Achète si … <b>niveau</b> » + « ▸ Skip si … » + « Stop x (−x%) · Cibles y (+y%) / z (+z%) · R/R n », clôture « ⚠️ [risque macro avec DATE vérifiée] » + « <i>Idées de trading, pas un conseil — gère ta taille.</i> ». html <b> (pas de **), toute date macro = celle vérifiée (jamais un jour non vérifié). Retourne : kept (avec R/R recalculé), dropped+raison, finalDigest html.`,
  { label: 'verify', phase: 'Verify', effort: 'high', schema: { type: 'object', properties: {
    kept: { type: 'array', items: { type: 'object' } }, dropped: { type: 'array', items: { type: 'string' } },
    finalDigest: { type: 'string' } } } }
)
if (!verify || !(verify.kept || []).length) {
  const body = `🎯 <b>Signaux du jour — ${gen.regime || 'marché'}</b>\nRien ne passe le contrôle R/R aujourd'hui — pas de signal. On attend une meilleure config.\n<i>Idées de trading, pas un conseil.</i>`
  if (!DRY) { await agent(`Poste ce statut sur alerts. mcp__notification__send_message(to='alerts', format='html').\n${RULES}\nBODY:\n${body}`, { label: 'post:verify-empty', phase: 'Post', effort: 'low' }) }
  return { status: 'NO_CLEAN_SETUP', posted: !DRY, note: 'Tous droppés au recalcul R/R — statut posté.' }
}

phase('Post')
if (DRY) { return { status: 'OK', dryRun: true, regime: gen.regime, kept: verify.kept, dropped: verify.dropped, digest: verify.finalDigest, note: 'DRY-RUN : digest prêt, NON posté.' } }
const post = await agent(
  `Auto-poste le digest lean + log léger (fire-and-forget). Digest html (déjà recalculé) : ${JSON.stringify(verify.finalDigest || '').slice(0, 3000)}.
${RULES}
DO : (1) dernier check : html <b> (pas de **), date macro vérifiée, aucune donnée sensible. (2) mcp__notification__send_message(to='alerts', format='html', body=digest, actions=[{label:'👍 pris', value:'taken'}, {label:'👎 passé', value:'skipped'}]) → message_id. Les deux boutons sont OBLIGATOIRES (libellés/valeurs exacts) : c'est la seule mesure d'adoption, relue par le bilan hebdo via get_responses(message_id). (3) get_delivery_status(message_id) → provider_msg_id présent = livré. (4) log léger : écris les signaux dans un JSON puis node tools/signals-ledger.js append --payload <f.json> (pour le track-record) ; PUIS apponds {date, messageId, kind:'fire-and-forget', tickers:[...]} dans data/signals-telegram-messages.json (get_responses n'a pas de recherche par date : sans cet id, le feedback des boutons est irrécupérable). (5) git : add data/signals-ledger.json data/signals-telegram-messages.json (SPÉCIFIQUES) ; commit "signals(fire-and-forget): <date> — <n> signaux" ; git fetch origin main && rebase ; push origin HEAD:main (retry si rejeté). Retourne message_id + provider_msg_id + nb loggés + commit + push OK.`,
  { label: 'post', phase: 'Post', effort: 'high' }
)
// Note Substack courte (EN, best-effort) — UNIQUEMENT après un post Telegram réussi ci-dessus.
// Un échec de note ne fait JAMAIS échouer le run (try/catch dédié + agent() déjà tolérant aux erreurs).
let substackNote = null
try {
  substackNote = await agent(
    `Poste une Note Substack COURTE (3-4 phrases, ANGLAIS) — best-effort, ne bloque JAMAIS le run.
${RULES}
Contexte (pour le thème du jour uniquement — NE PAS reproduire les niveaux/tickers/entrées/stops en clair, la Note est un teaser public, pas le digest) : régime=${gen.regime || 'n/a'}${gen.macro ? ', macro=' + gen.macro : ''}, ${(verify.kept||[]).length} signal(s) posté(s) sur Telegram.
DIGEST (référence de thème seulement, pas à copier) : ${JSON.stringify(verify.finalDigest || '').slice(0, 1200)}.
DO : mcp__claude_ai_substack__create_note(body=<3-4 phrases EN : (1) le thème du marché du jour (régime + catalyseur, sans chiffre non tracé MCP), (2) une phrase teaser sur l'opportunité sans donner les niveaux, (3) "Levels on the site.", (4) le lien https://articles.dailytickers.com/scanner/status/ >).
Contraintes : zéro terme interne (jamais "MCP", "dtx", "Gateway", nom de script — décrire la donnée, pas l'infra) ; zéro tic IA (EDITORIAL_STYLE.md) ; zéro chiffre inventé. Retourne note_id, ou l'erreur si l'appel échoue (n'insiste pas, ne réessaie pas en boucle).`,
    { label: 'post:substack-note', phase: 'Post', effort: 'low' }
  )
} catch (_e) { substackNote = { error: 'substack note failed (best-effort, run non affecté)' } }

return { status: 'OK', posted: true, regime: gen.regime, kept: verify.kept, dropped: verify.dropped, post: (post||'').slice(0,900),
  substackNote: (typeof substackNote === 'string' ? substackNote.slice(0, 300) : substackNote),
  note: 'signals-desk-fire-and-forget : 3-5 signaux auto-postés sur alerts + loggés + Note Substack EN best-effort. Le signals-desk complet (bilan+ledger+harness) reste la référence.' }
