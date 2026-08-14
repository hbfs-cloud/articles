---
name: sector-funnel
description: Analyse sectorielle en entonnoir (observation → connu → thèse+falsification → plan de trading → invalidations), secteur choisi par les données, certifiée war room + QA senior + contrarian, 3 livrables (web FR, Telegram FR auto-suffisant, Substack EN auto-suffisant). Trigger keywords — analyse sectorielle, secteur du moment, funnel sectoriel, entonnoir, quel secteur analyser, sector deep dive.
version: 1.0.0
user-invocable: true
argument-hint: "[optionnel : secteur imposé, 'dry-run', 'évite <thèmes>']"
license: Apache 2.0
---

# Sector-Funnel — analyse sectorielle en entonnoir, certifiée, 3 canaux

**Exécuter** : `Workflow({ name: "sector-funnel", args: { refdate, date, sector?, avoid?, dryRun? } })`
- `refdate` (REQUIS) : dernière clôture `YYYY-MM-DD` — vérifier via `GetStatus` (`max_last_bar_date`) avant de lancer ; jamais deviné.
- `date` (REQUIS) : dossier `YYYYMMDD` du jour de publication.
- `sector` : imposer un secteur (sinon le choix est fait PAR LES DONNÉES : force relative des 15 ETF sectoriels + catalyseur daté découvert via `economic_events`/earnings calendar).
- `avoid` : thèmes à écarter (ex. « mémoire/semis, déjà couverts cette semaine » — vérifier les publications récentes dans `data/analyses.json`).
- `dryRun` : produit les 3 livrables sur disque, ne publie rien.

## La doctrine de l'entonnoir (ce qui fait la valeur du format)
1. **OBSERVATION** — faits chiffrés datés, bruts, tous sourcés MCP dans la session.
2. **CE QU'ON SAIT** — catalyseur nommé+daté, flux (options/short interest), calendrier, régime.
3. **CE QUE ÇA IMPLIQUE** — la thèse DÉRIVÉE des étages 1-2 (zéro saut logique), avec sa **falsification explicite** (le niveau/événement précis qui la tue — testable, pas décoratif).
4. **LE PLAN** — 2-4 trades argumentés, concis, actionnables : instrument, entrée, stop ~1,5×ATR sous support réel, objectifs, taille (règle 1-2 % du compte), timing vs événements.
5. **CE QUI INVALIDE** — niveaux/événements d'annulation.

## Garde-fous (non négociables)
- **Zéro fabrication** : chaque chiffre publié provient d'un appel MCP de la session (le writer reçoit le JSON source et n'a pas le droit d'en sortir).
- **Gates scriptés en boucle** : `qa-content.js --strict` (0 ❌) + `check-ai-tells.js --strict` avant panel.
- **Panel 3 relecteurs** : war room agile detail-oriented (chaque maillon logique + chaque niveau recalculé), QA senior (cohérence inter-livrables : niveaux Telegram == article == Substack ; auto-suffisance des formats courts), contrarian (narrative-fitting, camp d'en face, falsification testable). **BLOCK non levé = rien ne part.**
- **Email JAMAIS envoyé par ce workflow** (Substack `send_email=false` en dur — l'email passe par `--authorize-email`, quota 1/24h sous verrou).
- Token-diet : sonnet partout sauf writer/arbitre (opus) ; données transmises en JSON compact, pas de relecture intégrale des docs de style.

## Livrables
| Canal | Langue | Forme |
|---|---|---|
| Web (`analyses/SECTEUR-<ETF>-<date>/`) | FR | entonnoir complet, add_card, push |
| Telegram (alias `analysis`) | FR | concis, AUTO-SUFFISANT, HTML (`<b>`, jamais `**`) |
| Substack (section Analyses) | EN | concis, AUTO-SUFFISANT, tableau des niveaux, sans email |

Après publication : enregistrer au registre desk (`bash tools/desk-run.sh --record analyse --channels web,telegram,substack`).
Voir aussi : `sector-rotation` (le bilan RS hebdo), `senior-review`, `perf-parallel-mcp`.
