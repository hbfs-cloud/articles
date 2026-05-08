// Nomad job: trading-executor — 6 instances (one per mode) via raw_exec
// Deploy: nomad job run tools/trading-executor/nomad.hcl
// Stop:   nomad job stop trading-executor
// Logs:   nomad alloc logs -f <alloc-id>

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

    task "run" {
      driver = "raw_exec"

      config {
        command = "/home/ci/projects/articles/tools/run-trading-executor.sh"
      }

      // Each allocation gets a different MODE based on index
      env {
        BROKER      = var.broker
        CAPITAL_USD = var.capital_usd
        VERBOSE     = "false"
        LOG_DIR     = "/home/ci/projects/articles/data/execution-logs"
      }

      // Map alloc index → mode via dispatch_payload or template
      template {
        data        = <<-EOT
          {{- $modes := list "turbo" "dynamic" "balanced" "secured" "fortress" "tkl" -}}
          {{- $idx := env "NOMAD_ALLOC_INDEX" | parseInt -}}
          MODE={{ index $modes $idx }}
        EOT
        destination = "local/mode.env"
        env         = true
      }

      resources {
        cpu    = 200
        memory = 128
      }

      restart {
        attempts = 5
        interval = "10m"
        delay    = "30s"
        mode     = "delay"
      }

      service {
        name = "trading-executor"
        tags = ["trading", "executor"]

        check {
          type     = "script"
          command  = "/bin/sh"
          args     = ["-c", "pgrep -f 'daemon.js'"]
          interval = "30s"
          timeout  = "5s"
        }
      }
    }
  }
}
