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


---

# MISE À JOUR — le scan du 12 est RÉDIGÉ mais BLOQUÉ par le panel

Le workflow a produit `data.json`, `signals.json` et la page, passé les gates, puis
le panel a rendu **BLOCK**. L'agent chargé d'appliquer les corrections est mort
d'une erreur réseau : rien n'a été corrigé, **rien n'a été publié ni poussé**
(page en 404, registre inchangé). Le verdict complet, 69 Ko, est dans
`scanner/20260812/_panel-verdict.txt`.

## Les défauts que j'ai revérifiés MOI-MÊME et qui sont réels

1. **Le plafond de perte de 8 % saute.** Il est calculé au milieu de zone, mais la
   zone haute est publiée donc atteignable : COMP coûte alors **8,37 %** et CLF
   **8,39 %**. Un plafond qui cède sur un remplissage haut n'est pas un plafond.
   Caler le calcul sur le HAUT de zone (COMP stop 11,77 · CLF 11,51).
2. **`dilution_clear: true` sur cinq lignes hors périmètre SEC** — AMP.MI, PGE.WA,
   INFY, SCHD, FXI. Un drapeau vert sur zéro observation, exactement la leçon
   INDO à l'envers. INFY, lui, l'assume dans sa thèse. Passer les autres à `null`
   avec la même mention.
3. **Les scores publiés ne sont pas ceux de la sélection figée** : FRSH 100 → 98,
   LYFT 99 → 97. Trancher et tracer.

## Le défaut qui touche MA sélection, pas la rédaction

**`adv_m` mélange les devises.** Mon crible de liquidité a comparé 37 (zlotys), 23
(euros) et 290 (dollars) comme des grandeurs homogènes. PGE.WA à 37 M PLN vaut
~10 M$ : c'est la ligne la plus MINCE du panier et elle frôle mon plancher, alors
que le texte désigne AMP.MI (23 M€ ≈ 26 M$). Même erreur sur
`market_cap_usd` de PGE.WA : 25 milliards de ZLOTYS, pas de dollars.
**Convertir avant tout classement, puis revérifier que PGE.WA passe le plancher.**

## Le bug d'archive nous a rattrapés

8 séries de barres sur 10 s'arrêtent au 10/08 alors que la clôture de référence
est le 11, et la barre du 10 est TRONQUÉE (FRSH 16 % de son volume médian, COMP
22 %, CLF 28 %). Le contrôle de fraîcheur a validé quand même. Conséquences : les
volumes moyens sont biaisés (FXI 696 publié contre 756 réel) et aucun relecteur ne
peut reproduire les indicateurs depuis les barres. Les indicateurs eux-mêmes sont
justes — ils viennent du service technique, qui a bien le 11/08. C'est la piste
d'audit qui est cassée. Voir `.claude/mcp-marketdata-bug-archive-profonde.md`.

## Erreurs de prose à corriger avec

SNAP « huit séances haussières sur dix » → cinq. SNAP « moyenne 200 j à 6,05
au-dessus de la cible 2 (6,22) » → elle est dessous, la phrase dit le contraire de
ses chiffres. INFY invalidation cite 13,49 → c'est la cible 2 d'AMP.MI, la sienne
vaut 13,80. AMP.MI « treizième séance au-dessus de sa moyenne 50 j » → vingt-deuxième.
CLF « deuxième volume du panier » → quatrième. PGE.WA deux plus-hauts 12 mois
différents dans le même document.

## Ce qu'il faut faire, dans l'ordre

1. Corriger `adv_m` et `market_cap` en devise commune, PUIS revalider la sélection.
2. Recaler le plafond de stop sur le haut de zone.
3. Passer les `dilution_clear` hors périmètre SEC à `null` avec la mention.
4. Aligner les scores.
5. Corriger les six erreurs de prose.
6. Repasser les gates, puis un panel de contrôle, puis publier.

La séance ouvre à 15h30. Ne pas publier avant que les points 1 à 3 soient traités :
ce sont des défauts de fond, pas de style.
