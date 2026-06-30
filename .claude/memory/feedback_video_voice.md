---
name: Video Voice Configuration — All 5 Languages LOCKED
description: Immutable voice config for all video languages. FR/EN/ES/ZH = Qwen3 CustomVoice eric. AR = Edge TTS ar-LB-RamiNeural.
type: feedback
---

Voice configuration is **LOCKED** — never change without explicit user request.

## Qwen3 CustomVoice (4 languages)
**Model:** `mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit` (NOT VoiceDesign)
**Speaker:** `eric` for all 4 languages

| Lang | voice | lang_code | model key |
|------|-------|-----------|-----------|
| **FR** | eric | french | qwen3-tts-cv |
| **EN** | eric | english | qwen3-tts-cv |
| **ES** | eric | spanish | qwen3-tts-cv |
| **ZH** | eric | chinese | qwen3-tts-cv |

## Edge TTS (Arabic)
| Lang | voice | engine |
|------|-------|--------|
| **AR** | ar-LB-RamiNeural | Edge TTS (Microsoft) |

## Pronunciation
Apply `_fix_pronunciation()` dictionary for French texts (CAC 40 → "quaque quarante", etc.)

**Why:** VoiceDesign model generates different voices per text even with same seed. CustomVoice with named speaker "eric" guarantees identical voice. For Arabic, all Qwen3 voices were rejected — Edge TTS ar-LB-RamiNeural (Lebanon) was chosen.

**How to apply:** Use `qwen3-tts-cv` model key in tts-mlx-batch.py for FR/EN/ES/ZH. Use `edge-tts --voice ar-LB-RamiNeural` for Arabic. Never use VoiceDesign for production audio.
