# REPRISE — scan du 12 août, sélection faite, rédaction à faire

## Où ça en est

La collecte et la SÉLECTION du scan 20260812 sont terminées et vérifiées.
`scanner/20260812/_selection.json` porte les 10 lignes avec leurs niveaux et le
détail de chaque gate passé. Rien n'est publié, rien n'est poussé.

Ce qui RESTE : écrire `data.json` (c'est la grosse part — prose éditoriale,
thèse par ligne, confirmations/invalidations, thèse macro, pédagogie) puis
`signals.json`, rendre, `validate-scan` + `qa-check`, panel adversarial 5
lentilles, downstream, diffusion.

## La sélection, et pourquoi elle tient

Régime RISK-ON (risk_on 53,6 % · neutre 46,4 % · crise 0 · early risk-off 0) →
aucune réduction de voilure, les 10 lignes sont permises.

| # | ticker | score | zone | stop | TP1 | R/R | rég. | secteur |
|---|---|---|---|---|---|---|---|---|
| 1 | FRSH | 100 | 11,97–12,07 | 11,12 | 12,91 | 0,99 | US | Tech |
| 2 | LYFT | 99 | 17,54–17,68 | 16,52 | 18,70 | 1,00 | US | Consumer |
| 3 | COMP | 96 | 12,69–12,79 | 11,72 | 13,76 | 1,00 | US | RealEstate |
| 4 | AMP.MI ⟲ | 92 | 12,30–12,40 | 11,68 | 13,03 | 1,01 | EU | Healthcare |
| 5 | CLF ⟲ | 91 | 12,41–12,51 | 11,46 | 13,49 | 1,03 | US | Materials |
| 6 | INFY | 89 | 12,60–12,70 | 11,97 | 13,34 | 1,01 | ASIA | Tech |
| 7 | SNAP | 88 | 5,51–5,55 | 5,12 | 5,94 | 0,99 | US | Comm |
| 8 | PGE.WA ⟲ | 87 | 11,15–11,24 | 10,59 | 11,81 | 1,01 | EU | Utilities |
| 9 | SCHD | 83 | 34,27–34,54 | 33,74 | 35,16 | 1,14 | ETF | International |
| 10 | FXI | 75 | 35,66–35,95 | 35,00 | 36,70 | 1,12 | ETF | International |

Diversification 5 US + 2 EU + 1 ASIA + 2 ETF · max 2 par secteur · 3 reprises
sur 10 (plafond 3) · halal 8/10 (les deux ETF portent des financières).

**Les R/R vont de 0,99 à 1,14**, contre 0,81 à 0,98 la veille. Ce n'est pas de
la chance : stop à 1,6×ATR et TP1 à 1,5×ATR du haut de zone au lieu de niveaux
hérités. Le plafond arithmétique du système reste ~1,33.

## Gates passés, et ce qu'ils ont coûté

- **Résultats** : calendrier PAR TICKER (le calendrier global ne rendait que la
  journée du 11 malgré `days_ahead=7`). TUI1.DE écarté — il publie le 12.
- **Dilution** : par ticker, sur formulaires dilutifs uniquement
  (`form_types=S-3,S-1,424B5,…`) — sinon la réponse fait 40 Ko par nom.
  FRSH/LYFT/COMP/SNAP propres. **CLF porte deux 424B5 d'octobre 2025** : hors
  fenêtre de 90 jours donc non disqualifiant, mais à SIGNALER dans sa thèse.
- ⚠️ **Le lot groupé de dilution est INUTILISABLE** : `symbols` porte les 12
  demandés, `data` seulement les 10 trouvés. L'assembleur jette le lot entier
  plutôt que d'attribuer les dépôts d'une société à une autre. C'est pour ça
  que le contrôle se fait par ticker.

## Ce qui a été corrigé cette nuit (poussé)

- `desk-plan` : la fenêtre du scanner passait de 90 min/jour à 22h30 → ouverture
  du lendemain, et l'anti-doublon porte sur la SÉANCE (`session:2026-08-12`) et
  non sur une horloge de 12 h. Sans ça, le scan du 11 publié à 13h36 interdisait
  celui du 12.
- `desk-plan` : `macro`/`earnings` étaient inatteignables (sortie en 10 sans
  compter les produits en attente du socle) ; fenêtre macro calée sur
  l'antériorité réelle de l'événement, plus sur la date calendaire.
- `gen-status-page` : une apostrophe française tuait 900 lignes de script sur la
  page publiée. Le générateur vérifie désormais ses scripts avant d'écrire.
- Catalogue réduit à 5 modes (best/turbo/dynamic/balanced/fortress).

## Pièges de la nuit

- **`scan-parallel` échoue sous concurrence** avec le socle (3 essais, 3 échecs
  à des endroits différents), alors que chaque étape passe seule. Le `--quiet`
  de la chaîne masque l'erreur : **corriger d'abord ça**, faire écrire le
  journal même en mode silencieux. Contourné en lançant les étapes séparément —
  légitime ici, chaque sortie porte son manifeste et affiche zéro échec.
- **Archive profonde figée sur une barre partielle** : GLD au 10/08 vaut 402,54
  en fenêtre courte et 399,39 en fenêtre profonde, `sessions_complete: true`
  dans les deux cas. Dossier : `.claude/mcp-marketdata-bug-archive-profonde.md`.
- La note CPI est écrite mais **BLOQUÉE** (5 lentilles, 5 BLOCK) : fausse
  opposition en thèse centrale, auto-citation fabriquée, rapport emploi du 7/08
  omis. Fichier `analyses/cpi-20260812/` non commité, non indexé. Ne pas la
  publier telle quelle.
