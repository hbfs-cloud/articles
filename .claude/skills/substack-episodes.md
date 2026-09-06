---
name: substack-episodes
description: Enrichir et pousser les épisodes de séries pédagogiques programmés sur Substack — schémas, exemples chiffrés, tableaux, phrases-clés. Déclencheurs : épisode substack, série pédagogique, illustrer un épisode, pousser les épisodes, scheduled substack, enrichir les séries.
---

# Épisodes Substack — enrichissement et poussée

## Ce que le connecteur sait faire (mesuré, pas supposé)

Établi par sonde le 2026-09-06 sur ce déploiement. À revérifier si Substack change de version.

| Capacité | État |
|---|---|
| Tableaux Markdown → image sur le CDN (`table_format: "image"`) | **fonctionne** — mais le `**gras**` dans une cellule reste littéral dans l'image |
| Image externe (URL `raw.githubusercontent`) | **fonctionne** directement, aucun téléversement requis |
| `<mark>`, `<sup>`, `<sub>` | **fonctionnent** → `highlight` / `superscript` / `subscript` |
| `::audience non_sub,free_sub` … `::else` … `::end` | **fonctionne** → nœud `dynamicContent`, vrai ciblage d'abonnés |
| Citation, `---`, `###`, listes ordonnées | **fonctionnent** |
| `[texte](url){.button}` | **NE FONCTIONNE PAS** — rendu littéral |
| `::chart {json}` | **NE FONCTIONNE PAS** — testé en option ECharts complète, en forme `{type,labels,data}`, via `create_draft` ET via `create_from_template` : retombe toujours en bloc de code. D'où le rendu PNG maison. |
| `list_drafts` | renvoie `[]`, et HTTP 400 au-delà de 50 — impossible d'énumérer les programmés par ce biais |
| Lire le corps d'un brouillon | aucun outil ne le permet |

**`update_draft` préserve `postSchedules`** — vérifié plusieurs fois, y compris sur un brouillon
programmé en 2028. `create_draft` et `create_from_template` créent un billet NEUF et **perdent la
date de publication**. Sur un billet DÉJÀ PUBLIÉ, `update_draft` ne change pas le corps : il faut
supprimer et recréer, à la main, un par un.

Un template existe (`educational-episode`) : il porte le contrat de réutilisation — quels champs, ce
qu'on y met, pourquoi. Le rendre sert à produire un corps cohérent ; l'INSTANCIER par
`create_from_template` ne sert qu'à créer un billet neuf, donc jamais pour un épisode déjà programmé.

## La règle qui décide de tout

**La prose peut être restructurée, les chiffres jamais introduits.**

Mettre une liste à puces en tableau ne crée aucune affirmation : les mots sont ceux de l'auteur,
seule la mise en page change. Mettre un chiffre dans un graphique en crée une, parce qu'un graphique
se lit comme une mesure. `tools/lib/episode-illustration.js` fait échouer la construction sur tout
nombre absent du texte de l'épisode.

Conséquence pratique : **on n'illustre qu'un calcul que l'épisode pose lui-même.** Le graphique
devient la lecture visuelle du paragraphe, pas une source parallèle.

Ce que la règle ne couvre pas : la justesse du chiffre dans le texte. Un graphique fidèle à un texte
faux reste faux — c'est le rôle de `audit-episode-claims.js` et de `data/substack/claim-rewrites.json`.

## Procédure

1. Reconstruire :
   ```bash
   bash tools/refresh-substack-episodes.sh          # exemples chiffrés + construction + état
   bash tools/refresh-substack-episodes.sh --full   # + re-rendu des schémas
   ```
   L'ordre est imposé : rendre avant de construire, sinon une figure déclarée mais inexistante
   passe et l'épisode part sans son image.

2. Relire ce qui est faible :
   ```bash
   node tools/check-figure-fit.js       # appariements figure/épisode sans vocabulaire commun
   node tools/audit-episode-claims.js   # affirmations chiffrées, par classe
   ```
   `check-figure-fit` n'attrape que les cas SANS AUCUN mot commun ; lire son en-tête avant de s'y
   fier. La pertinence d'une figure demande un jugement.

3. Pousser, en ordre de programmation :
   ```bash
   node tools/episode-push-state.js --next 10
   ```
   puis, par épisode : lire `build/substack/<série>/<fichier>`, retirer le front matter, appeler
   `update_draft(draft_id, body_markdown, table_format:"image")`, et **vérifier `postSchedules` dans
   la réponse**. Un `postSchedules` vide signifie que le billet a perdu sa date : arrêter aussitôt.

   Marquer ensuite en une passe (jamais en parallèle — les écritures concurrentes s'écrasent) :
   ```bash
   node tools/episode-push-state.js --mark "série/episode-01.md,série/episode-02.md"
   ```

4. Les images doivent être poussées sur `main` AVANT la poussée Substack : le corps référence
   `raw.githubusercontent`, et Substack va chercher l'image au moment de l'enregistrement.

## Ce qui est du ressort du jugement, donc de l'agent

- **Le choix de la figure.** Elle doit éclairer le mécanisme de CET épisode. Une figure décorative
  est pire que rien : le lecteur apprend à sauter les images, et les bonnes ne servent plus.
  Varier au sein d'une série — répéter le même schéma d'un épisode à l'autre a le même effet.
- **La phrase-clé.** Copiée mot pour mot du texte, une seule par épisode. C'est la leçon, pas la
  formule la plus citable.
- **L'exemple chiffré.** Rare et facultatif. Seulement quand l'épisode déroule son propre calcul.
  Ne jamais en forcer un.
- **Les en-têtes de tableau.** Propres au sujet — « What to check / What it means » ne convient pas
  à un catalogue de contraintes techniques.

## Interdits

- Ne jamais `create_draft` / `create_from_template` / `schedule_post` / `delete_draft` sur un épisode
  déjà programmé : la date serait perdue.
- Ne jamais modifier le texte au moment de pousser. Une correction faite là diverge du fichier que
  le pipeline sait reconstruire, et disparaîtra à la construction suivante. Corriger la source ou
  `claim-rewrites.json`.
- Ne jamais omettre `email_audience` autrement que par défaut : le laisser absent garantit qu'aucun
  e-mail ne part au moment de la mise à jour.
