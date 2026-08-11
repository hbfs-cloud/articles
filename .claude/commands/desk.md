# /desk — Le desk du jour : décider quoi produire, le produire, le distribuer

Un seul appel. `/desk` regarde ce qui est dû, ne produit que ça, et le distribue selon des
règles qui ne se négocient pas. Il **orchestre** les commandes existantes — `/scanner`,
`/daily`, `/weekly`, `/retro`, `/signals-desk`, `/aplus`, `/sector-rotation`,
`/squeeze-radar`, `/earnings-reaction`, `/macro-event-playbook` — il ne les remplace pas.
Chacune reste invocable seule.

## Arguments
`$ARGUMENTS`
- vide → tout ce qui est dû
- `--only scanner,daily` / `--skip retro` → restreindre (passés tels quels à `desk-plan.js`)
- `--plan-only` → décider et s'arrêter. Aucune collecte, aucun jeton nécessaire.
- `ne poste pas` / `dry-run` → tout sauf `add_card` / push / Telegram / Substack

---

## Ce qui revient au modèle, et rien d'autre

Quatre choses. Elles tiennent en une phrase chacune, et c'est voulu.

1. **Émettre les jetons** (`GetReadOnlyToken(60)`, `DtxMintReadOnlyToken(1440)`) — deux vraies
   écritures, impossibles depuis un sous-processus.
2. **Sélectionner** parmi un vivier déjà conforme : quelles 2-3 familles de signaux ont un sens
   dans le régime du jour, quels candidats garder. Avec la raison écrite.
3. **Rédiger**, en anglais pour Substack, en français pour Telegram et le web.
4. **Contredire** — war room, panel `senior-review`. Puis décider de publier ou non.

Tout le reste est déterministe et appartient aux scripts : cadences, calendrier, anti-doublon,
contrat de date, collecte, mutualisation, gates, indexation, registre de publication. Doctrine :
skill `llm-script-boundary`. **Si tu te surprends à recopier une valeur d'un fichier vers un
autre, arrête-toi : il manque un script.**

---

## Phases

### Phase 0 — le plan (script, ~1 s, sans jeton)

```bash
node tools/desk-plan.js            # lecture humaine
bash tools/desk-run.sh --plan-only # + écrit data/desk/<jour>/plan.json
```

`desk-plan.js` n'appelle aucun MCP. Il croise trois sources déterministes : le registre de
publication (`publication-gate.js`, jamais réimplémenté ailleurs), le calendrier NYSE
(`lib/market-calendar.js`) et l'état du disque. Il en sort la liste EXACTE de ce qui est dû.

| produit | déclencheur réel |
|---|---|
| `scanner` | après 22h30 Paris, `scanner/<prochaine séance>/data.json` absent ou vide, séance non fériée |
| `daily` | aucune carte `/daily/<jour>/` dans `data/daily.json`. Samedi = bilan hebdo, dimanche = crypto + géopolitique (lecture de calendrier, pas décision) |
| `signals` | cadence OK et séance ouvrée. Le modèle choisit les familles |
| `weekly` | **calendaire** : vendredi→dimanche, pour le lundi À VENIR, `weekly/<lundi>/index.html` absent. La cadence 144 h n'est qu'une barrière anti-doublon |
| `retro` | **événementiel** : l'horizon d'un scan passé est échu et `scanner/<date>/retro/` n'existe pas |
| `rotation` | semaine close (vendredi après clôture → dimanche), jour fixe et non compteur qui dérive |
| `earnings` | **conditionné à la donnée** : ≥ 8 publications > 10 Md$ à J±3 dans le socle. Hors saison, on ne produit rien |
| `macro` | J-1 d'un événement de tier 1 (CPI/FOMC/NFP/OPEP). Date ET consensus à vérifier avant d'écrire |
| `squeeze` | fenêtre de publication FINRA (règlement bimensuel + ~8 séances) |
| `aplus` | **proposé, jamais lancé** : ~10 analyses profondes avec chacune sa war room. `/desk` le signale, tu décides |
| `analyse` | **jamais automatique.** Exclusion explicite, pas déléguée au gate : sa cadence vaut 0, donc rien ne l'arrêterait mécaniquement |
| `series`, `run-session`, `make-video` | hors périmètre. `run-session` touche l'exécution broker ; `make-video` relève de No Auto Video |

Le plan sort aussi les **trous de config** (un type sans cadence = barrière absente, pas
autorisation) et les **bloquants connus** par produit. Lis-les : ils disent pourquoi un produit
dû ne partira quand même pas.

### Phase 1 — jetons (modèle)

```
GetReadOnlyToken(minutes=60)       → export MCP_TOKEN_MARKETDATA=…
DtxMintReadOnlyToken(ttl_minutes=240) → export MCP_TOKEN_SYSTEMATIC=…
```

Par l'**environnement**, jamais en argv (visible dans `ps`), jamais sur disque, jamais en `.env`.
Aucun jeton ne se renouvelle lui-même : un run de plus de 60 min se segmente, avec réémission.

### Phase 2 — collecte parallèle (script)

```bash
bash tools/desk-run.sh
```

Cinq chaînes, un seul temps mural = `max(chaînes)`, pas la somme :

```
  O  overview        détachée, deadline 240 s, personne ne l'attend
  V  scanner         scan-parallel.sh : vivier→enrichissement | dtx | suivi+sweep   ~200 s
  S  socle           14 appels mutualisés, une vague                                 ~30 s
  ↓ barrière B3 : socle complet AVANT toute rédaction
  P  produits        daily | weekly | signals | rotation | retro, en parallèle, héritant du socle
  ↓ barrière B4 : check-freshness par produit
  D  downstream      scanner uniquement, APRÈS B4, en --no-push
```

**`desk-run.sh` ne pousse rien et ne publie rien.** Le downstream du scanner se terminait par un
`git push origin main` lancé *avant* B4 : le scan était en ligne, sur le domaine public, quand la
barrière de fraîcheur le refusait ensuite — et le panel n'avait même pas encore été convoqué. Le
downstream tourne désormais après B4, en `--no-push` : artefacts produits, fichiers stagés,
aucun commit. Dans `publish-daily-card.sh`, le QA est également passé **devant** le push, où il
garde quelque chose au lieu de le constater.

Deux choix qui méritent qu'on les explique :

- **V ne l'attend pas.** Le scanner est le chemin critique (~200 s). Le retarder de 30 s pour
  lui économiser cinq appels rapides serait payer 30 pour gagner 3.
- **overview est sorti du chemin critique.** C'est l'appel le plus lent (63 s à 298 s mesurés)
  et le seul qui n'était pas caché, alors qu'il ne porte que de la prose de contexte. Il tourne
  détaché, caché 90 min, avec une laisse. Passé le délai, le run continue sans lui.
  ⚠️ **Condition stricte** : si un article cite un seul chiffre issu d'`overview`, cette
  dégradation n'est plus légitime et il redevient bloquant. Les nombres publiés viennent de
  `bars_indices` / `bars_sectors` / `regime`.

Le **socle** (`plans/socle.json`) est la mutualisation : 6 plans appelaient `GetStatus` à
l'identique, 3 le même `DtxRegime` à 16,7 s pièce. Il collecte une fois, `collect.js` sert aux
plans produits via `COLLECT_SOCLE_DIR`. Superset à la collecte (fenêtre la plus large, union des
symboles), découpe à la lecture. Fraîcheur = le **minimum** des consommateurs. Un filtre
(`min_expected_move_pct`, `min_market_cap_usd`, un DSL) n'est **pas** une fenêtre : il encode un
jugement produit et ne se mutualise pas. Chaque produit garde **son** `harness.json`, où la
source héritée est nommée comme telle — un socle partagé ne devient jamais un harnais partagé.

### Phase 3 — sélection et rédaction (modèle)

Sur un vivier déjà filtré, gaté et daté. Voix : `EDITORIAL_STYLE.md`. Aucun terme interne dans
le contenu publié.

### Phase 4 — gates (script, bloquants)

```bash
node tools/qa-content.js <path> --strict
node tools/check-ai-tells.js <path> --strict
node tools/validate-scan.js   # scanner
node tools/qa-check.js        # scanner
```

### Phase 5 — panel adversarial (modèle) — **non compressible**

`senior-review` sur chaque artefact. **BLOCK = on ne publie pas.** C'est le panel qui a rattrapé
la thèse fausse du 10 août, pas la vitesse de collecte. Le temps gagné en phase 2 se réinvestit
ici, il ne se rend pas.

> Budget honnête : 3-4 min de collecte, **8-12 min de bout en bout** avec le panel. Annoncer
> « 5 min tout compris » pousserait à rogner sur cette phase — exactement ce que la doctrine
> interdit.

### Phase 6 — distribution

| canal | langue | règles |
|---|---|---|
| **web** | selon le produit (`/analyse` garde sa langue) | hors quota |
| **Substack** | **ANGLAIS**, concis, actionnable | **`send_email=false` PAR DÉFAUT** |
| **Telegram** | **FRANÇAIS**, concis, actionnable | `format: "html"` — `<b>`, `<i>`, `<code>`, `<a href>`, `\n`. **Jamais `**gras**`** (Telegram l'affiche en texte brut). Hors quota |

Aucun terme interne nulle part : pas de « MCP », « dtx », « Gateway », ni nom de script. On
décrit la donnée (« options flow & levels »), pas l'infrastructure.

### Phase 7 — registre, puis contrôle de bouclage (script)

```bash
bash tools/desk-run.sh --record <type> --channels web,telegram
bash tools/desk-run.sh --verify        # à la fin, ET au début du run suivant
```

Le registre est **append-only** (`data/publication-ledger.ndjson`, une ligne JSON par
publication, `O_APPEND`). Il l'est parce qu'il ne l'était pas : le read-modify-write précédent
perdait des écritures dès que deux enregistrements se croisaient — 4 entrées survivaient sur
20 — et un produit dont l'entrée disparaît est réputé jamais publié, donc republié le
lendemain, page en double et notification en double.

`--verify` rapproche les artefacts datés du disque et les lignes du registre. Le mode de panne
le plus probable ici n'est pas le contournement, c'est **l'oubli** : le panel a été long,
`--record` saute, rien ne le signale. Il sort en 1 sur tout écart. Il ne couvre que les produits
laissant un artefact canonique (`scanner`, `daily`, `weekly`, `retro`) — et il le dit.

---

## L'email — le point le plus important de la commande

**Un email part chez de vrais abonnés et ne se rattrape pas.** Le web se corrige, un email non.
Le 10 août, deux emails sont partis dans la journée, dont un portant une thèse que la relecture
a ensuite démolie.

D'où l'inversion : **Substack publie sans email. L'email est l'exception, à mériter.**

Trois barrières cumulatives dans `publication-gate.js` :
1. **cadence** par type ;
2. **quota : 1 email / 24 h, TOUS TYPES CONFONDUS** — pas un par type, un tout court ;
3. **matérialité** : entier **0-100, ≥ 70**, accompagnée d'une **justification écrite d'au moins
   120 caractères**, et les deux sont **persistées dans le registre**. Un score non borné et
   non tracé ne mesurait rien : `--materiality 999999` passait, et trois mois plus tard
   « pourquoi cet email est-il parti ? » n'avait aucune réponse.

**Un seul chemin :**

```bash
bash tools/desk-run.sh --authorize-email <type> --materiality N --evidence "<justification>"
# exit 0 → autorisé, quota DÉJÀ consommé, JETON émis → envoyer maintenant (10 min)
# exit 1 → refusé → publier avec send_email=false
```

#### Ce qui rend le refus exécutoire

Les trois barrières ci-dessus **décident**. Elles ne peuvent rien empêcher à elles seules :
`publish(draft_id, send_email=true)` est un booléen dans un appel d'outil, et rien n'oblige à
demander son avis à un script avant de le poser. Le dispositif gardait une porte à côté de
laquelle il n'y avait pas de mur.

Le mur est un **jeton à usage unique** (`tools/lib/email-grant.js`), écrit sur disque par
`--authorize`, sous verrou, **après** consommation du quota, valable **10 minutes**. Il est
consommé à deux endroits :

- **hook `PreToolUse`** sur `mcp__substack__publish` (`.claude/settings.json` →
  `tools/hooks/email-grant-guard.js`) : `send_email:true` sans jeton valide = `deny`. C'est
  l'application effective en local ;
- **handler `publish` du serveur substack** (`substack-mcp/src/tools.js`) : même contrôle côté
  service. S'il ne peut pas joindre le module de vérification, il **refuse** — ne pas savoir
  vérifier n'est pas une raison d'envoyer. Déployé hors du dépôt, il ne voit aucun jeton : le
  déploiement doit alors poser `EMAIL_GRANT_MODE=hook-only` pour déléguer explicitement au
  hook. Échappatoire assumée : un garde-fou qui ferme aussi le chemin légitime finit désactivé
  en bloc, et on perd celui qui marchait.

Les deux consomment le même jeton, **une fois chacun** (relais hook → serveur borné à 2 min, un
rôle par jeton). Deux envois ne peuvent donc pas se partager une autorisation.

#### Les détours, et pourquoi ils sont fermés

- **`--check` n'autorise plus rien.** Il n'écrit pas, donc il ne prononce plus le mot
  « autorisé » : il rend `email_eligible`, et son `send_email` vaut `false` en dur. Avant, deux
  appels successifs (`--check daily`, `--check weekly`) rendaient deux fois « Email AUTORISÉ »
  dans la même minute, sans qu'aucun registre n'existe sur disque. Le double envoi ne demandait
  même pas une course.
- **Décider et enregistrer sont le même geste.** Verrou `mkdir`, vérification, écriture de la
  ligne et émission du jeton se font dans **un seul processus** (`--authorize`). Un verrou pris
  dans le script appelant, autour d'un décideur qui expose par ailleurs un chemin non verrouillé,
  ne protège rien.
- **Le drapeau `--authorized` n'existe plus.** C'était une chaîne d'argv auto-déclarée : on
  pouvait forger une ligne `email` sans matérialité ni quota — donc bloquer un envoi légitime
  pendant 24 h — et surtout on ne pouvait plus rien déduire d'une ligne `email` lue dans le
  registre. Écrire une ligne `email` n'est désormais possible que depuis `authorize()`.
- **`--record` refuse le canal `email`**, à la casse et aux espaces près (`web, EMAIL` refusé
  comme `web,email`).
- **Le code de sortie de `--check` porte sur le WEB, et rien d'autre.** `--check … && envoyer`
  était un faux ami : il envoyait dès que le web était ouvert, quota email consommé ou non.
  L'email a sa propre sous-commande, avec son propre code de sortie.
- **Le registre est ancré sur le dépôt, append-only.** Un chemin relatif faisait du quota une
  passoire (`cd tools/` et le compteur repartait de zéro).
- **illisible ≠ vide.** Registre corrompu, conflit git non résolu, entrée `email` à date
  illisible : l'email est refusé au lieu d'être accordé. On ne sait pas ce qui est déjà parti,
  et un email ne se rattrape pas.
- **`desk-plan.js` n'autorise jamais** : `send_email` y sort à `false` en dur. Le plan est
  calculé avant la rédaction, donc avant qu'on sache si le contenu mérite d'interrompre
  quelqu'un.

#### Ce que ce dispositif ne couvre PAS

Le quota vit dans un fichier du dépôt. **Deux clones = deux registres.** Une routine cloud qui
envoie à 06h00 et commite, un poste local qui n'a pas `pull` à 10h00 : le second voit un quota
vierge. `.gitattributes` déclare `merge=union` sur le registre, ce qui règle la **convergence**
(deux publications sont deux faits, pas un conflit) — pas la **divergence**. **`git pull` avant
toute autorisation d'email.** Le seul endroit qui verrait réellement tous les envois est le
service d'envoi lui-même ; tant qu'il ne porte pas le compteur, cette limite est réelle.

Dernière question avant d'envoyer, et elle n'est pas rhétorique : **accepterais-tu de le
recevoir toi-même ?**

---

## Erreurs bloquantes

| situation | conduite |
|---|---|
| chaîne V (scanner) en échec | **arrêt**. Jamais de scan sur des données partielles, jamais de repli sur le vivier d'hier |
| vivier vide après les screeners | `extract-universe.js` sort en 1 → scanner avorté |
| socle sans index | **arrêt** : aucune source partageable, tous les produits seraient bancals |
| `check-freshness` en échec | bloquant **pour ce produit seulement** — il sort du plan. Recollecter, jamais estimer |
| MCP stale | `RefreshBars` / `DtxRefreshBars`, poller, re-vérifier. Hard stop **seulement** si le refresh ne rattrape pas |
| panel = BLOCK | on ne publie pas. Aucune exception, aucun chrono ne l'emporte |
| jeton expiré en cours de run | segmenter, réémettre. Ne jamais poursuivre sur une collecte à moitié faite |
| un produit dû porte un `blocker` | ne pas le lancer. Écrire d'abord la pièce manquante |

**Aucune étape ne se saute pour tenir un chrono. Zéro donnée inventée.**

---

## Ce que `/desk` ne fera jamais

- lancer une `/analyse` de son propre chef ;
- lancer `/aplus` en autonome (il le propose) ;
- toucher à l'exécution broker (`run-session`) ;
- produire une vidéo ;
- envoyer un email sans passer par `--authorize-email` ;
- publier un digest « parce que c'est dans la liste ».
