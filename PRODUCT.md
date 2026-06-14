# Product

## Register

product

> Système unifié : le registre **primaire est product** (le design SERT la lisibilité de la
> data — modes, régime, equity, drawdown, positions — pour que le retail puisse agir). Une
> couche **brand/éditoriale** coexiste sur la landing (`index.html`) et les articles
> (scanner/daily/analyses) : même design system, mêmes tokens, voix éditoriale FT/Economist.
> Ne pas fragmenter en deux identités — un seul langage visuel sert les deux.

## Users

Investisseurs **retail sérieux et avertis**, **multilingues** (en, fr, ar, es, zh), qui suivent
les modes et signaux algorithmiques de DailyTickers pour **trader eux-mêmes**.

- **Contexte** : consultation quotidienne, **souvent sur mobile**, parfois desktop. Ils veulent
  savoir vite *quoi faire* (entrées/sorties/positions) et *à quel point faire confiance* (track
  record réel par mode, drawdown, régime de marché).
- **Job to be done** : décider d'agir sur un signal — comprendre la perf honnête d'un mode, son
  exposition, son risque actuel — sans être ni noyés (Bloomberg overload) ni infantilisés.
- Audience secondaire : **prospects** qui jugent la crédibilité via la vitrine de performance
  avant de s'abonner.

## Product Purpose

Publier des **analyses financières de qualité institutionnelle** + des **signaux de scanner
algorithmique**, avec un **dashboard de performance live transparent** (`scanner/status`) qui
suit chaque mode (turbo, dynamic, balanced, secured/Orbit, fortress, bull, + bientôt **crypto,
metals, forex**) — track record réel (append-only, frozen), drawdown et pertes inclus.

Le produit s'étend du **multi-actifs** : actions (US/EU/Asia/ETF) aujourd'hui, et demain des
modes **dédiés par classe d'actif** (crypto 24/7, métaux + minières associées, forex par
sessions) avec leurs spécificités de marché. Succès = le retail comprend, fait confiance, et agit.

## Brand Personality

**Rigoureux · Clair · Expert.** La confiance vient de la **précision**, pas du bling.

- Voix : publication financière sérieuse (**FT / The Economist**) croisée avec la **précision d'un
  terminal data**. Expert mais accessible — on explique sans condescendre.
- Honnêteté radicale : on montre les pertes, les drawdowns, les semaines ratées (les
  rétrospectives notent en A→F). La transparence EST la marque.
- Calme et autorité : pas d'urgence artificielle, pas de hype, pas d'emojis-fusée.

## Anti-references

À ne **surtout pas** ressembler à (les quatre rejetés explicitement) :

1. **Crypto-bro néon** — fonds noirs néon violet/vert, gradients flashy, hype.
2. **Fintech SaaS générique** — navy + gradient bleu/violet, cartes identiques, hero-metric
   template, illustrations 3D interchangeables.
3. **Bloomberg overload** — densité écrasante illisible, terminal noir hostile au retail.
4. **Cream/sand AI-default** — le beige chaud "editorial-warm" généré par défaut, faux-premium fade.

## Design Principles

1. **Clarté avant densité.** Data complexe rendue lisible et actionnable par divulgation
   progressive — le retail voit d'abord *quoi faire* et *à quel point faire confiance*, puis
   peut creuser. Riche ≠ encombré.
2. **Confiance par la précision.** Crédibilité via des chiffres rigoureux et honnêtes (perf
   réelle, DD, pertes visibles). Pas de décoration qui simule la sophistication.
3. **Un système, cinq langues, mobile d'abord.** Un design system unique qui tient en
   en/fr/ar/es/zh (RTL arabe inclus) et reste dense-mais-lisible sur mobile.
4. **Performance honnête, toujours.** Track records frozen/append-only, drawdowns et flops
   montrés. La transparence est un argument de vente, pas une faiblesse à cacher.
5. **Multi-actifs cohérent.** À mesure que les modes s'étendent (actions → crypto/metals/forex),
   le système scale par classe d'actif sans casser l'unité visuelle ni la grammaire d'interaction.

## Accessibility & Inclusion

- **Mobile-first dense** (priorité explicite) : la data dense reste lisible et navigable au pouce
  sur téléphone — c'est le device dominant du retail.
- **RTL arabe** : layout, tableaux et charts réellement mirrorés en arabe (pas juste le texte
  traduit) — l'arabe est une langue publiée existante, c'est un prérequis, pas une option.
- **P&L colorblind-safe** : gain/perte jamais portés par la seule couleur vert/rouge — ajouter
  signe (+/−), forme ou intensité.
- **WCAG AA** : contraste ≥4.5:1 sur la data dense (le plus à risque), ≥3:1 large.
- **Reduced-motion** : alternative (crossfade/instant) à chaque animation.
