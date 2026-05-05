// Nomad job: trading-executor — 6 instances (one per mode)
// Deploy: nomad job run tools/trading-executor/nomad.hcl
// Env vars set per-mode via template block reading from Nomad variables/Vault.

variable "image" {
  type    = string
  default = "ghcr.io/marketwatchxyz/trading-executor:latest"
}

variable "broker" {
  type    = string
  default = "paper"
}

variable "capital_usd" {
  type    = string
  default = "10000"
}

job "trading-executor" {
  datacenters = ["dc1"]
  type        = "service"

  group "executor" {
    count = 6

    network {
      mode = "bridge"
    }

    // Spread across available nodes
    spread {
      attribute = "${node.unique.id}"
    }

    task "run" {
      driver = "docker"

      config {
        image = var.image
        force_pull = true
      }

      // Each allocation gets a different MODE based on index
      template {
        data        = <<-EOT
          {{- $modes := list "turbo" "dynamic" "balanced" "secured" "fortress" "tkl" -}}
          {{- $idx := env "NOMAD_ALLOC_INDEX" | parseInt -}}
          MODE={{ index $modes $idx }}
          BROKER={{ env "NOMAD_META_BROKER" }}
          CAPITAL_USD={{ env "NOMAD_META_CAPITAL_USD" }}
          VERBOSE={{ env "NOMAD_META_VERBOSE" }}
          LOG_DIR=/app/data/execution-logs

          # Notifications (shared across all modes)
          {{ with nomadVar "nomad/jobs/trading-executor" }}
          TELEGRAM_BOT_TOKEN={{ .telegram_bot_token }}
          TELEGRAM_CHAT_ID={{ .telegram_chat_id }}
          TELEGRAM_TOPIC_TURBO={{ .telegram_topic_turbo }}
          TELEGRAM_TOPIC_DYNAMIC={{ .telegram_topic_dynamic }}
          TELEGRAM_TOPIC_BALANCED={{ .telegram_topic_balanced }}
          TELEGRAM_TOPIC_SECURED={{ .telegram_topic_secured }}
          TELEGRAM_TOPIC_FORTRESS={{ .telegram_topic_fortress }}
          TELEGRAM_TOPIC_TKL={{ .telegram_topic_tkl }}
          DISCORD_WEBHOOK_URL={{ .discord_webhook_url }}
          {{ end }}

          # Broker credentials (from Nomad variables)
          {{ with nomadVar "nomad/jobs/trading-executor/broker" }}
          ALPACA_API_KEY={{ .alpaca_api_key }}
          ALPACA_API_SECRET={{ .alpaca_api_secret }}
          IBKR_GATEWAY_HOST={{ .ibkr_gateway_host }}
          IBKR_GATEWAY_PORT={{ .ibkr_gateway_port }}
          IBKR_ACCOUNT_ID={{ .ibkr_account_id }}
          SAXO_ACCESS_TOKEN={{ .saxo_access_token }}
          SAXO_ACCOUNT_KEY={{ .saxo_account_key }}
          T212_API_KEY={{ .t212_api_key }}
          BINANCE_API_KEY={{ .binance_api_key }}
          BINANCE_API_SECRET={{ .binance_api_secret }}
          {{ end }}
        EOT
        destination = "secrets/env.env"
        env         = true
      }

      meta {
        BROKER      = var.broker
        CAPITAL_USD = var.capital_usd
        VERBOSE     = "false"
      }

      resources {
        cpu    = 200  // MHz per instance
        memory = 128  // MB per instance
      }

      restart {
        attempts = 5
        interval = "10m"
        delay    = "30s"
        mode     = "delay"
      }

      // Health: process stays alive
      service {
        name = "trading-executor"
        tags = ["trading", "executor"]

        check {
          type     = "script"
          command  = "/bin/sh"
          args     = ["-c", "pgrep -f daemon.js"]
          interval = "30s"
          timeout  = "5s"
        }
      }
    }
  }
}
