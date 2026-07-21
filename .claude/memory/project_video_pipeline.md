---
name: video-pipeline
description: "Pipeline vidéo éducative Remotion + TTS local (traitement séquentiel pour l'espace disque, output sur SSD externe) + backlog complet (7 trading + 2 tech + ~43 scolaire + 6 langues enfants/ados EN/AR/ES)."
metadata:
  type: project
---

# Pipeline de production vidéo éducative

Pipeline Remotion dans le sous-dossier `videos/`. Traitement **séquentiel** obligatoire (espace disque :
~35GB libres, chaque vidéo ~2-3GB rendue ; cleanup après chaque upload). Output sur SSD externe
`/Volumes/Extreme SSD/video-factory/`.

## Architecture
- `EducationalVideo.tsx` : composant générique, 12 types de slides (bullets, concept, table, quiz, etc.).
  Réutiliser les composants existants (GlassBox, AnimatedCounter, Charts, Quiz slides…).
- `ScannerVideo.tsx` : composant scanner-spécifique (déployé).
- Durées audio-driven : chaque slide = longueur audio + 1.5s de padding.
- TTS : XTTS v2 sur `ser` (ci@ser.tail5d09f.ts.net), queue-based (`/tmp/tts-queue/`).

## Scripts pipeline (`videos/scripts/`)
- `generate-edu-content.mjs <series-id>` → `public/edu-data.json` + `public/edu-narration.json`
- `generate-edu-tts.mjs` → narration → TTS, download WAVs, calcule durées
- `pipeline.mjs <series-id>` → full : content → TTS → render → thumbnail → upload YouTube → cleanup
- Lancer un `series-id` à la fois. `--concurrency=4` pour les renders Remotion. Vidéos + playlists publiques.

## Backlog complet (~58 vidéos, 5 catégories)

**Trading (7) — content JSON prêt** : debuter-trading, swing-trading, maitrise-expert, algo-million,
bourses-mena, ai-singularity-fr, ai-singularity-en.

**Tech (2) — à générer** : claude-code-avance, signal-vs-noise.

**Scolaire (~43) — FR avec beaucoup de quizzes, une playlist YouTube par niveau** :
- CE2 (6) : maths, français, sciences, histoire-géo, EMC, anglais
- CM1 (6) : maths, français, sciences, histoire-géo, EMC, anglais
- 5ème (8) : maths, français, histoire-géo, physique, SVT, techno, anglais, espagnol
- 4ème (8) : maths, français, histoire-géo, physique, SVT, techno, anglais, espagnol
- Terminale (8) : maths-analyse, maths-proba, physique, SVT, philo, SES, NSI, HGGSP
- PCSI (7) : analyse, algèbre, mécanique, thermo, optique, électricité, chimie
Style plus coloré/ludique pour les jeunes ; skill `impeccable`/design-frontend pour la qualité visuelle.

**Langues — enfants 8-15 ans (6)** : anglais-enfants (8-10), anglais-ados (11-15), arabe-enfants,
arabe-ados, espagnol-enfants, espagnol-ados.

**Retiré (demande user 2026-03-19)** : série animée Salma ; finance islamique / bourse-musulman.

**Ordre** : trading d'abord (content prêt), puis scolaire, puis langues. Objectif user : #1 YouTube contenu
éducatif. **No Auto Video** : jamais lancer sauf demande explicite dans la session courante.
