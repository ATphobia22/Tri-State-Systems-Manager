# Ansible Infrastructure Patterns

Ansible is an optional infrastructure-as-code layer for dedicated TSM infrastructure. The `gitlab-ci-stack` repository supplies reference patterns only.

Production playbooks must be reviewed in TSM, pinned to explicit roles/collections, and run with least privilege. No remote script downloaded at runtime may be executed as an infrastructure bootstrap shortcut.
