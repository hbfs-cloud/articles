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
  datacenters = ["hetzner"]
  type        = "service"

  group "executor" {
    count = 6

    task "run" {
      driver = "raw_exec"

      config {
        command = "/home/ci/projects/articles/tools/run-trading-executor.sh"
      }

      env {
        BROKER      = var.broker
        CAPITAL_USD = var.capital_usd
        VERBOSE     = "false"
        LOG_DIR     = "/home/ci/projects/articles/data/execution-logs"
      }

      // Map alloc index → mode (no `list` function in this Nomad version)
      template {
        data        = <<-EOT
          {{ $idx := env "NOMAD_ALLOC_INDEX" }}{{ if eq $idx "0" }}MODE=turbo{{ else if eq $idx "1" }}MODE=dynamic{{ else if eq $idx "2" }}MODE=balanced{{ else if eq $idx "3" }}MODE=secured{{ else if eq $idx "4" }}MODE=fortress{{ else if eq $idx "5" }}MODE=tkl{{ else }}MODE=balanced{{ end }}
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
    }
  }
}
