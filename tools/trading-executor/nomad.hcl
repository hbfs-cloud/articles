// Nomad job: trading-executor — single instance, all 6 modes via raw_exec
// Deploy: nomad job run tools/trading-executor/nomad.hcl
// Stop:   nomad job stop trading-executor
// Logs:   nomad alloc logs -f <alloc-id>

job "trading-executor" {
  datacenters = ["hetzner"]
  type        = "service"

  constraint {
    attribute = "${node.unique.name}"
    value     = "hetzner-cloud"
  }

  group "executor" {
    count = 1

    task "run" {
      driver = "raw_exec"

      config {
        command = "/home/ci/projects/articles/tools/run-trading-executor.sh"
      }

      resources {
        cpu    = 500
        memory = 512
      }

      restart {
        attempts = 5
        interval = "30m"
        delay    = "15s"
        mode     = "delay"
      }
    }
  }
}
