---
name: substack-mcp-tools
description: Substack MCP full toolset (maj 2026-07-03) — update_draft édite un post PUBLIÉ en place (même URL), delete_draft supprime les publiés, upload_image → CDN. Fini le churn d'URL.
metadata:
  type: reference
---

Le MCP Substack permet le cycle complet **sans churn d'URL** :

- **`update_draft(draft_id, …)`** : édite « le draft derrière un post publié » → **corrige un post publié EN PLACE, même URL** (fini « publier neuf + supprimer l'ancien »). `body_markdown` remplace tout le corps ; accepte title/subtitle/seo_*/section_id/cover_image.
- **`delete_draft(draft_id)`** : supprime AUSSI les **posts publiés** (pas seulement les brouillons ; renvoie 404 si déjà supprimé). Vérifié 2026-07-03 : 5 vieux posts purgés.
- **`upload_image(source_url | content_base64)`** : héberge sur le CDN Substack (`substack-post-media` S3) → renvoie l'URL + un snippet `![](url)`. **Préférer ça à raw.githubusercontent pour les images Substack** (indépendant du repo public). raw.github reste utile pour Telegram `send_media`.
- **`tag_post(post_id, tags[])`** : crée+applique des tags (page publique /t/<slug>). `list_tags` / `list_sections` pour l'existant ; `section_id` dans create/update_draft.
- **`create_draft` → `publish(draft_id, send_email=false)`** : draft privé puis publication web-only par défaut.
- `delete_article` / `get_article` / `list_articles` = **registre de documents contrôlés** (via `doc_key`), PAS les posts Substack.

**Workflow routine** : générer les data (board/charts) → `upload_image` (CDN) → `create_draft` + `publish`. Pour **corriger/mettre à jour** un post existant (ex : remplir les outcomes du board la semaine suivante) → **`update_draft` en place, jamais un nouveau post**. Cf [[image-hosting-raw-github]], format data-forward [[editorial-density-no-recycling]].
