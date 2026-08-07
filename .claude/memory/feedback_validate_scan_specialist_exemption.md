---
name: validate-scan-specialist-exemption
description: validate-scan.js exclut 13 SPECIALIST_STRATEGIES AVANT toute règle → les 47 règles de scanner-lessons.json (hard_block inclus) ne couvrent plus au moins 50% des signaux (865/1731 depuis le 08/06). Le chiffre « 23% de couverture » n'est PAS reproductible.
metadata:
  type: feedback
---

**Angle mort `process` du diagnostic de juillet 2026 — direction confirmée, chiffre corrigé.**

`tools/validate-scan.js:55-60` exclut **13 `SPECIALIST_STRATEGIES`** (`highvolbreakout`,
`etfmomentum`, `momentumrotation`, `trendlinebreakout`, `adaptivefractal`, `cryptomomentum`,
`metalsmomentum`, `forexmultistrategy`, `fortressa`, `hybridmegacap`, `candlestick`, `indexrotation`,
`factorcomposite`) **AVANT toute règle**. Les **47 règles** de `data/scanner-lessons.json` — y compris
les `hard_block` : plancher/plafond de stop, R/R minimum, fenêtre earnings, dilution SEC, cooldown
ticker — ne s'appliquent donc plus à elles. Seules les règles 17/18 (multi-pool, enum stratégie)
lisent le fichier RAW.

**Comptage refait sur `scanner/2026*/signals.json` depuis le 08/06 : 1731 signaux sur 42 jours, dont
865 (50%) portant un tag spécialiste exempté.** Plus les pools que le parser ne charge pas.

⚠️ **Le chiffre « validate-scan ne couvre que 23% des candidats tradables (384/1703) » ne se reproduit
pas et ne doit PAS être cité.** Le chiffre honnête est **≥50% d'exemption**.

**Démonstration par MPLT** (`scanner/20260722/signals.json`) : émis avec `rr "1:0.52"` et un stop à
**-19,3%**, alors que la règle active `stops-min-atr-multiple` (`hard_block`) dit « JAMAIS > 8% ».
Accepté. Résultat scellé : **-65,57%**.

**Why:** L'exemption avait une raison légitime à l'origine (les spécialistes n'ont pas de screening
SEC et produisent ~200 faux positifs quand validate-scan tourne après l'append nocturne). Mais elle a
été écrite comme une exclusion **globale et en amont**, donc elle emporte aussi les règles
d'intégrité de setup (stop, R/R) qui, elles, s'appliquent à n'importe quelle stratégie. Une
optimisation de bruit a désactivé un garde-fou de risque.

**How to apply:**
- Séparer les règles en deux familles : **règles éditoriales/screening** (légitimement exemptables
  pour les spécialistes) et **règles d'intégrité de setup** (stop min/max, R/R min, bande
  dégénérée) — ces dernières doivent s'appliquer à **100% des signaux**, sur le fichier RAW.
- Toute nouvelle stratégie ajoutée à `SPECIALIST_STRATEGIES` doit s'accompagner d'une **dérogation
  écrite par règle**, pas d'une exclusion en bloc, et être ajoutée en miroir à
  `RR_GATE_STRATEGIES` (`tools/sweep.js:955`) ou justifiée.
- **Publier le taux de couverture** à chaque run de `validate-scan` (« N signaux, M exemptés, X% »),
  pour qu'une dérive de couverture soit visible sans audit. Lié à [[hybrid-illegal-promotion]] et
  [[trading-memory]].
