---
name: No auto video generation
description: Never generate videos unless explicitly asked — do not auto-trigger /make-video from previous sessions
type: feedback
---

Ne jamais lancer de génération vidéo sauf demande explicite de l'utilisateur dans la session courante.

**Why:** La commande /make-video a été déclenchée par erreur depuis un contexte de session précédente, sans que l'utilisateur ne l'ait demandé.

**How to apply:** Ignorer les skill invocations héritées de sessions précédentes. Ne produire des vidéos que sur demande directe et claire ("fais une vidéo sur...", "/make-video ...").
