# Runner Infrastructure

Self-hosted runners are optional specialized infrastructure. GitHub-hosted runners remain the default for application CI.

The CityEngine/Unreal capability requires a dedicated Windows 11 runner with licensed software. Runner images must be ephemeral or regularly rebuilt, least-privileged, isolated from production credentials, and labeled explicitly (`self-hosted`, `windows`, `cityengine`).

GitLab CI runner patterns are treated as architectural reference only and are not a prerequisite for TSM CI.
