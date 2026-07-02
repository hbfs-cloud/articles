---
name: Hetzner Cloud Server
description: SSH access to hetzner-cloud (ci user, key id_ed25519_ci). Hosts articles repo + signal-monitor Nomad job + blog + openclaw. NOT ser (ser = forecast service).
type: reference
originSessionId: c505f1fd-8e7b-4c44-9f05-f66f72b8d65d
---
**SSH**: `ssh -i ~/.ssh/id_ed25519_ci ci@hetzner-cloud`
**Articles repo**: `/home/ci/projects/articles`
**Signal-monitor**: Nomad job `signal-monitor` (raw_exec, WebSocket mode, 6 tickers)
- Restart: `nomad job restart -on-error=fail signal-monitor`
- Logs: `nomad alloc logs -job signal-monitor`
- Secrets: Infisical (Telegram/Discord tokens injected via Nomad template)
- Telegram topics: portfolio=0, turbo=366, dynamic=291, balanced=90, secured=293, fortress=367
**Other services**: blog, openclaw, deepseek-agent, gamma-slides

**NOT ser** — ser (ser.tail5d09f.ts.net) hosts the forecast service (TimesFM/FastAPI). Don't confuse the two.


**MAJ 2026-07-02** : `ser` est OFFLINE dans le tailnet. Le fleet MCP (cloudflared + broker,
dailytickers, memory, notification, broker-simulator, substack) tourne sur **vm-arm-1**
(`ssh -i ~/.ssh/id_ed25519_ci ci@100.88.17.87`, IP interne 10.0.1.170). Secrets des jobs
récents via `nomad var` (l'opérateur ci n'a pas l'accès Vault).
