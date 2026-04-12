job "signal-monitor" {
  datacenters = ["hetzner"]
  type        = "service"

  constraint {
    attribute = "${node.unique.name}"
    value     = "hetzner-cloud"
  }

  group "monitor" {
    count = 1

    restart {
      attempts = 5
      interval = "30m"
      delay    = "15s"
      mode     = "delay"
    }

    reschedule {
      delay          = "30s"
      delay_function = "exponential"
      max_delay      = "1h"
      unlimited      = true
    }

    task "signal-monitor" {
      driver = "raw_exec"

      config {
        command = "/home/ci/projects/articles/tools/run-signal-monitor.sh"
      }

      template {
        data        = <<EOT
INFISICAL_CLIENT_ID={{ with nomadVar "nomad/jobs/signal-monitor" }}{{ .infisical_client_id }}{{ end }}
INFISICAL_CLIENT_SECRET={{ with nomadVar "nomad/jobs/signal-monitor" }}{{ .infisical_client_secret }}{{ end }}
INFISICAL_PROJECT_ID={{ with nomadVar "nomad/jobs/signal-monitor" }}{{ .infisical_project_id }}{{ end }}
INFISICAL_API_URL={{ with nomadVar "nomad/jobs/signal-monitor" }}{{ .infisical_api_url }}{{ end }}
EOT
        destination = "secrets/env.txt"
        env         = true
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
}
