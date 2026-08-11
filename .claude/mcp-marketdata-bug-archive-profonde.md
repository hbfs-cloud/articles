# Bug — l'archive profonde sert une séance partielle et la déclare complète

**Service** : `mcp.dailytickers.com` · `QueryData(types=bars_daily)`
**Constaté le** : 2026-08-11 vers 22h00–22h30 UTC
**Gravité** : silencieuse. La réponse est fausse *et* se déclare fiable.

---

## Le symptôme, en deux appels à trente secondes d'écart

Même symbole, même jour, même service. Seule la profondeur de la fenêtre change.

```
QueryData(types="bars_daily", symbols="GLD", end_date="2026-08-11", days=2)
→ 2026-08-10  close 402.54   volume 11 057 000
  2026-08-11  close 400.96   volume  7 212 665
  sessions_complete: true

QueryData(types="bars_daily", symbols="GLD", end_date="2026-08-11", days=5)
→ 2026-08-07  close 398.47   volume 13 301 600
  2026-08-10  close 399.39   volume  5 869 555      ← partielle
  (pas de barre du 11 août)
  sessions_complete: true
```

La clôture du 10 août vaut 402,54 dans un cas et 399,39 dans l'autre, soit
**0,79 % d'écart**. Le volume de la barre fautive fait **53 %** de la vraie : la
signature d'une séance capturée en cours de route puis figée.

`limit` produit le même effet que `days` dès que la fenêtre devient profonde :

```
QueryData(types="bars_daily", symbols="GLD", end_date="2026-08-11", limit=6)
→ 754 barres servies, span 2024-07-18 → 2026-08-10, dernière = 399.39
```

## Ce que ce n'est pas

- **Pas un rafraîchissement en cours.** `GetStatus` au même moment :
  `bar_service_status: ready`, `bar_service_1d_progress: 100.0%`,
  `bar_service_1d_max_last_bar_date: 2026-08-11`,
  `bar_service_1d_ref_lag_sessions: 0`, témoins SPY/QQQ/^VIX à
  « 300 bars, last 2026-08-11 ». Le service se dit à jour pendant qu'il sert
  une barre partielle de la veille.
- **Pas un effet de `end_date`.** Le paramètre est présent dans les deux appels.
- **Pas global.** Dans une *même* réponse profonde, TLT portait sa barre du
  11 août quand GLD s'arrêtait au 10. C'est par symbole.
- **Pas transitoire.** Reproduit à 22h13 et à 22h30 UTC, après que le service
  se soit déclaré prêt.

## Mécanisme supposé

La documentation de l'outil distingue deux chemins : sans fenêtre, les
dernières barres viennent du cache chaud en RAM ; avec fenêtre, la lecture
descend dans l'historique profond, et « la première requête d'un symbole paie
un backfill unique, les suivantes sont servies depuis le disque ».

L'hypothèse qui colle à toutes les observations : **le backfill de GLD a été
déclenché pendant une séance ouverte**, la barre du jour était partielle, elle
a été écrite dans l'archive — et le rafraîchissement quotidien ne révise pas
l'archive. Elle reste fausse indéfiniment. Le cache chaud, lui, se corrige.

## Pourquoi c'est grave côté client

`include_partial` vaut `false` par défaut et la documentation promet qu'une
séance non close est retenue. Ici la barre partielle est **servie**, et
`sessions_complete: true` affirme le contraire de la réalité. Un client qui
respecte le contrat n'a aucun moyen de détecter le problème.

Nos plans de collecte lisent en fenêtre profonde (`limit` 90 à 130 avec
`end_date`, imposé par notre contrat de date point-in-time). Une note publiable
a ainsi porté une performance de l'or fausse de 0,8 %, sur un chiffre mis en
titre. Rien dans la réponse ne permettait de s'en apercevoir.

## Demandes, par ordre d'utilité

1. **Ne jamais écrire une barre non close dans l'archive profonde.** Le backfill
   doit s'arrêter à la dernière séance close, comme le fait déjà le chemin
   `include_partial=false`.
2. **Réviser la dernière barre de l'archive au rafraîchissement quotidien**, ou
   invalider les entrées d'archive dont la dernière barre est antérieure à
   `bar_service_1d_max_last_bar_date`. Une archive écrite une fois et jamais
   relue est une bombe à retardement par symbole.
3. **Rendre `sessions_complete` honnête** : il doit refléter la série
   réellement servie, pas l'état général du service. Un `false` nous aurait
   permis de refuser la donnée.
4. **Signaler l'écart** : si la dernière barre servie est antérieure à
   `max_last_bar_date`, l'exposer dans `note` ou dans `span`. Le champ `note`
   existe déjà pour dire qu'une requête n'a pas été entièrement couverte — ce
   cas devrait le déclencher.
5. Si un correctif de fond prend du temps : un moyen de **forcer le
   re-backfill** d'un symbole (`refresh_archive=true`) nous débloquerait au
   cas par cas.

## Reproduction minimale

```
GetStatus()                                                   # doit dire ready / lag 0
QueryData(types="bars_daily", symbols="GLD", days=2)          # 10/08 = 402.54
QueryData(types="bars_daily", symbols="GLD", days=5)          # 10/08 = 399.39, 11/08 absent
```

Si GLD a été réparé entre-temps, chercher un symbole dont l'archive profonde a
été créée pendant les heures de marché : comparer, pour un panier, la dernière
clôture en fenêtre courte et en fenêtre profonde. Tout écart non nul est une
occurrence.
