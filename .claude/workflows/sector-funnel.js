export const meta = {
  name: 'sector-funnel',
  description: 'Analyse sectorielle en ENTONNOIR : secteur choisi PAR LES DONNÉES (force relative des ETF sectoriels + catalyseur nommé découvert via calendriers) → observation (faits chiffrés datés) → ce qu\'on sait → thèse + falsification → plan de trading argumenté/concis/actionnable → invalidations. Certifiée par 3 relecteurs (war room agile detail-oriented, QA senior, contrarian) + gates scriptés (qa-content, check-ai-tells) ; BLOCK non levé = rien ne part. 3 livrables : analyse complète FR (web, add_card, push), notif Telegram FR concise AUTO-SUFFISANTE (alias analysis), Substack EN concis AUTO-SUFFISANT (section Analyses, send_email=false). Zéro fabrication : chaque chiffre vient d\'un appel MCP de la session.',
  whenToUse: 'Quand on veut une analyse sectorielle publiable multi-canaux, choisie par les données du jour. Passer OBLIGATOIREMENT args.refdate (dernière clôture YYYY-MM-DD) et args.date (dossier YYYYMMDD). Optionnel : args.sector (forcer un secteur), args.avoid (thèmes à éviter, ex. "mémoire/semis déjà couverts"), args.dryRun (tout sauf publication).',
  phases: [
    { title: 'Pick', detail: 'force relative des 15 ETF sectoriels + catalyseurs découverts → LE secteur' },
    { title: 'Deep-dive', detail: 'leaders, flux (options/short interest), niveaux ETF, calendrier earnings' },
    { title: 'Write', detail: 'entonnoir FR + drafts Telegram/Substack + gates scriptés en boucle' },
    { title: 'Panel', detail: 'war room détail + QA senior + contrarian ; arbitre si BLOCK' },
    { title: 'Publish', detail: 'web FR (push) + Telegram FR + Substack EN sans email — sauté si dryRun' },
  ],
}

// args : { refdate:'YYYY-MM-DD' (REQUIS), date:'YYYYMMDD' (REQUIS), sector?, avoid?, dryRun? }
// Robuste : args objet OU chaîne JSON.
let A = {}
try { A = (typeof args === 'string') ? (args.trim() ? JSON.parse(args) : {}) : (args && typeof args === 'object' ? args : {}) } catch (_) { A = {} }
const REFDATE = A.refdate
const DATE = A.date
if (!REFDATE || !DATE) { throw new Error('sector-funnel: args.refdate (YYYY-MM-DD, dernière clôture) et args.date (YYYYMMDD) sont REQUIS — pas de Date.now() dans un workflow.') }
const AVOID = A.avoid ? String(A.avoid) : ''
const FORCED = A.sector ? String(A.sector) : ''
const DRY = A.dryRun === true || A.dryRun === 'true' || A.dryRun === 1
const ROOT = '/Users/mohamed.elouadi/me/articles'

// ---------- Phase 1 : choix du secteur par les données ----------
phase('Pick')
const pick = FORCED
  ? { sector_pick: FORCED, etf: '', why: ['secteur imposé par l\'appelant'], catalyst: 'à identifier au deep-dive', forced: true }
  : await agent(
    `Analyste rotation sectorielle. Choisis LE secteur US le plus digne d'une analyse approfondie (clôture réf ${REFDATE}) — par les DONNÉES, pas l'intuition. MCP marketdata via ToolSearch (QueryData, GetEarningsCalendarFiltered, Jobs).
1. QueryData(symbols="XLK,XLF,XLE,XLV,XLI,XLY,XLP,XLU,XLC,XLRE,XLB,GDX,SMH,XRT,ITB", types="bars_daily", end_date="${REFDATE}", limit=25) → perf 5j/20j, force relative vs SPY, qui accélère.
2. Croise avec les CATALYSEURS réels que tu découvres : QueryData(types="economic_events", days=7) + GetEarningsCalendarFiltered(days_ahead=7) — un secteur avec un événement daté devant lui vaut plus qu'une simple perf.
3. GetMarketContext(facets="regime") pour le régime.
${AVOID ? 'ÉVITE les thèmes déjà couverts récemment : ' + AVOID + '.' : ''}
Choisis un secteur où il y a un VRAI plan de trading à construire (niveaux actionnables), pas juste une narration. Rends {sector_pick, etf, why (3 faits chiffrés), catalyst (nommé+daté), runner_up}.`,
    { label: 'sector-pick', phase: 'Pick', schema: { type: 'object', properties: { sector_pick: { type: 'string' }, etf: { type: 'string' }, why: { type: 'array', items: { type: 'string' } }, catalyst: { type: 'string' }, runner_up: { type: 'string' } }, required: ['sector_pick', 'etf', 'why', 'catalyst'] }, agentType: 'general-purpose', model: 'sonnet', effort: 'high' }
  )
log(`Secteur : ${pick.sector_pick} (${pick.etf || 'ETF à identifier'}) — catalyseur : ${pick.catalyst}`)

// ---------- Phase 2 : deep-dive ciblé ----------
phase('Deep-dive')
const dive = await agent(
  `Analyste sectoriel. Deep-dive MCP sur "${pick.sector_pick}" (ETF ${pick.etf || 'à identifier via quotes'}), clôture réf ${REFDATE}. Justification : ${JSON.stringify(pick.why)}. Catalyseur : ${pick.catalyst}.
Collecte (batch, limit strict, types minimaux, poll Jobs) :
1. Leaders/laggards : 8-12 titres clés du secteur (RunScreener region=us pass_expr="market_cap>5e9 and avg_volume>1e6" filtré par champ sector, ou composition ETF vérifiée par quotes) → QueryData(symbols=CSV, types="quote,technicals", end_date="${REFDATE}").
2. Flux : QueryData(symbols=<4-5 leaders>, types="unusual_options,short_interest").
3. Niveaux ETF : QueryData(symbols="<ETF>,SPY", types="bars_daily,technicals", end_date="${REFDATE}", limit=30) → supports/résistances RÉELS datés, RS vs SPY.
4. Calendrier : GetEarningsCalendarFiltered(days_ahead=10, symbols=<leaders>).
Rends JSON compact : {facts:[8-12 faits chiffrés datés], leaders:[{ticker,price,rsi,atr,ema50,note}], flows:[...], levels:{etf_support,etf_resistance,rs_note}, earnings:[{ticker,date}], risks:[3-4]}. CHAQUE chiffre depuis un appel MCP de cette session — zéro fabrication.`,
  { label: 'sector-dive', phase: 'Deep-dive', schema: { type: 'object', properties: { facts: { type: 'array', items: { type: 'string' } }, leaders: { type: 'array', items: { type: 'object' } }, flows: { type: 'array', items: { type: 'string' } }, levels: { type: 'object' }, earnings: { type: 'array', items: { type: 'object' } }, risks: { type: 'array', items: { type: 'string' } } }, required: ['facts', 'leaders', 'risks'] }, agentType: 'general-purpose', model: 'sonnet', effort: 'high' }
)
log(`Deep-dive : ${(dive.facts || []).length} faits, ${(dive.leaders || []).length} leaders, ${(dive.risks || []).length} risques`)

// ---------- Phase 3 : rédaction entonnoir + 3 livrables + gates ----------
phase('Write')
const DATASRC = JSON.stringify({ pick, dive })
const write = await agent(
  `Rédacteur-analyste DailyTickers. cwd ${ROOT}. Produis l'ANALYSE SECTORIELLE EN ENTONNOIR de "${pick.sector_pick}" (dossier ${DATE}, clôture réf ${REFDATE}). Données source (SEULS chiffres autorisés — zéro fabrication) :
${DATASRC}

STRUCTURE ENTONNOIR OBLIGATOIRE (chaque étage découle du précédent, zéro saut logique) :
1. OBSERVATION — les faits chiffrés datés, bruts. 2. CE QU'ON SAIT — catalyseur nommé, flux, calendrier, régime. 3. CE QUE ÇA IMPLIQUE — la thèse dérivée de 1-2, avec sa FALSIFICATION explicite (niveau/événement qui la tue). 4. LE PLAN — 2-4 trades argumentés, concis, actionnables : instrument, entrée, stop (~1,5×ATR sous support réel), objectifs, taille (règle 1-2% du compte), timing vs événements. 5. CE QUI INVALIDE.

Voix : FR institutionnel FT/Economist (lis les 30 premières lignes de ${ROOT}/EDITORIAL_STYLE.md — PAS tout). Interdits : tics IA, termes internes (aucun nom d'outil/script/infra), chiffre non sourcé.

3 LIVRABLES :
A. Article web FR → ${ROOT}/analyses/SECTEUR-<ETF>-${DATE}/index.html (structure HTML copiée d'un article analyses récent : brand-bar/FAB/footer/scripts) + node tools/add_card.js <path>. Gates EN BOUCLE jusqu'à passage : node tools/qa-content.js <path> --strict (0 ❌) ET node tools/check-ai-tells.js <path> --strict.
B. Telegram FR → <dossier>/_telegram.txt : concis mais AUTO-SUFFISANT (entonnoir miniature : observation→thèse→plan principal avec niveaux→invalidation), HTML Telegram (<b>,<i>,\\n, JAMAIS **), finit par le lien article + "Éducatif — pas un conseil en investissement."
C. Substack EN → <dossier>/_substack.md : title + subtitle + body markdown, concis, AUTO-SUFFISANT, mêmes chiffres, un tableau des niveaux.
Rends {path, etf, tickers_plan, qa_passed, ai_tells_passed, telegram_path, substack_path}. Ne commit/push RIEN.`,
  { label: 'funnel-write', phase: 'Write', schema: { type: 'object', properties: { path: { type: 'string' }, etf: { type: 'string' }, tickers_plan: { type: 'array', items: { type: 'string' } }, qa_passed: { type: 'boolean' }, ai_tells_passed: { type: 'boolean' }, telegram_path: { type: 'string' }, substack_path: { type: 'string' } }, required: ['path', 'qa_passed', 'ai_tells_passed', 'telegram_path', 'substack_path'] }, agentType: 'general-purpose', model: 'opus', effort: 'high' }
)
log(`Écrit : ${write.path} — qa=${write.qa_passed} tells=${write.ai_tells_passed} plan=${(write.tickers_plan || []).join(',')}`)
if (!write.qa_passed || !write.ai_tells_passed) return { stopped: 'gates scriptés non passés', write }

// ---------- Phase 4 : panel — les 3 relecteurs ----------
phase('Panel')
const LENSES = [
  { key: 'warroom', p: `WAR ROOM AGILE DETAIL-ORIENTED : vérifie CHAQUE maillon — chaque fait de l'étage 1 est-il dans le JSON source ? chaque implication découle-t-elle VRAIMENT des étages précédents (pas de saut) ? chaque niveau du plan est-il cohérent avec les technicals (stop ~1,5×ATR sous support réel, R/R recalculé) ? Traque le détail faux (RSI recopié de travers, date décalée, arrondi qui change le sens).` },
  { key: 'qa-senior', p: `QA SENIOR : HTML conforme (brand-bar, FAB, footer article-footer, scripts, GTM), cohérence inter-livrables (niveaux Telegram == article == Substack, AUCUN écart), auto-suffisance réelle des 2 formats courts, accents FR, anglais correct, zéro terme interne, zéro placeholder/undefined.` },
  { key: 'contrarian', p: `CONTRARIAN : démolis la thèse. Narrative-fitting (faits choisis pour la conclusion) ? Catalyseur vraiment daté/nommé ? Que dit le camp d'en face et est-il traité honnêtement ? La falsification est-elle testable (niveau précis) ou décorative ? Le plan survit-il à un -2% secteur ?` },
]
const panel = await parallel(LENSES.map(l => () =>
  agent(`Relecteur ${l.key.toUpperCase()} d'un panel sur ${ROOT}/${write.path} (+ drafts ${write.telegram_path}, ${write.substack_path}). JSON source de vérité : ${DATASRC}
${l.p}
Rends COMPACT : {lens:'${l.key}', verdict PASS/WARN/BLOCK, findings[]}. BLOCK seulement pour donnée non sourcée, écart de niveau inter-livrables, ou saut logique matériel. Ne modifie aucun fichier.`,
    { label: `panel:${l.key}`, phase: 'Panel', schema: { type: 'object', properties: { lens: { type: 'string' }, verdict: { type: 'string' }, findings: { type: 'array', items: { type: 'string' } } }, required: ['verdict'] }, agentType: 'general-purpose', model: 'sonnet', effort: 'high' })
))
const verdicts = panel.filter(Boolean)
const blocks = verdicts.filter(v => (v.verdict || '').toUpperCase() === 'BLOCK')
log(`Panel : ${verdicts.map(v => (v.lens || '?') + '=' + v.verdict).join(', ')} | BLOCK:${blocks.length}`)
if (blocks.length > 0) {
  const fix = await agent(`Arbitre. cwd ${ROOT}. BLOCKs : ${JSON.stringify(verdicts)}. Corrige UNIQUEMENT les vrais BLOCKs dans ${write.path} + ${write.telegram_path} + ${write.substack_path} (cohérence des niveaux entre les 3 livrables comprise), re-passe node tools/qa-content.js ${write.path} --strict et node tools/check-ai-tells.js ${write.path} --strict jusqu'à propre. Rends {blocks_cleared, notes}. Ne push pas.`,
    { label: 'arbitrate', phase: 'Panel', schema: { type: 'object', properties: { blocks_cleared: { type: 'boolean' }, notes: { type: 'string' } }, required: ['blocks_cleared'] }, agentType: 'general-purpose', model: 'opus', effort: 'high' })
  if (!fix.blocks_cleared) return { stopped: 'BLOCK non levé — rien publié', verdicts, fix }
}

// ---------- Phase 5 : publication des 3 livrables ----------
phase('Publish')
if (DRY) {
  log('dryRun : publication SAUTÉE — livrables prêts sur disque.')
  return { status: 'DRY-RUN OK', sector: pick.sector_pick, etf: write.etf, plan: write.tickers_plan, panel: verdicts.map(v => (v.lens || '?') + '=' + v.verdict), path: write.path, telegram_draft: write.telegram_path, substack_draft: write.substack_path }
}
const pub = await agent(
  `Éditeur-publieur. cwd ${ROOT}. L'analyse ${write.path} a passé gates + panel (aucun BLOCK non résolu). Publie les 3 livrables :
1. WEB : carte indexée (node tools/add_card.js ${write.path} si absente de data/analyses.json). git add CIBLÉ (jamais -A) : dossier article + data/analyses.json + data/search_data.js si modifié ; git commit -m "feat: analyse sectorielle ${write.etf || ''} ${DATE}"; git push origin main.
2. TELEGRAM FR : envoie le CONTENU EXACT de ${write.telegram_path} via ToolSearch mcp__claude_ai_notification__send_message (to="analysis", format="html").
3. SUBSTACK EN : lis ${write.substack_path} ; ToolSearch mcp__claude_ai_substack__create_draft (title/subtitle/body) puis mcp__claude_ai_substack__publish(draft_id, section_id=417759, send_email=false) — JAMAIS d'email ici (quota sous verrou, autorisation séparée).
Rends {pushed, commit, telegram_message_id, substack_url}.`,
  { label: 'publish-3', phase: 'Publish', schema: { type: 'object', properties: { pushed: { type: 'boolean' }, commit: { type: 'string' }, telegram_message_id: { type: 'string' }, substack_url: { type: 'string' }, warnings: { type: 'string' } }, required: ['pushed'] }, agentType: 'general-purpose', model: 'sonnet', effort: 'high' }
)
log(`Publié : push=${pub.pushed} commit=${pub.commit} tg=${pub.telegram_message_id} substack=${pub.substack_url}`)
return {
  status: pub.pushed ? 'PUBLISHED' : 'NOT PUBLISHED',
  sector: pick.sector_pick, etf: write.etf, plan: write.tickers_plan,
  panel: verdicts.map(v => (v.lens || '?') + '=' + v.verdict),
  commit: pub.commit, telegram: pub.telegram_message_id, substack: pub.substack_url,
  url: 'https://articles.dailytickers.com/' + (write.path || '').replace('/index.html', '/'),
}
