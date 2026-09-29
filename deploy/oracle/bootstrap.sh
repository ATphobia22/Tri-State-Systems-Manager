#!/usr/bin/env bash
# First-boot setup for the TSM Oracle Always Free VM (Ubuntu 24.04 aarch64).
# Run ONCE as the default ubuntu user:  bash bootstrap.sh
# It installs Docker, opens 80/443 in the instance firewall, and prepares
# /opt/tsm. The GitHub deploy workflow (or a manual compose up) does the rest.
set -euo pipefail

echo "==> Installing Docker Engine + compose plugin"
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg iptables-persistent
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER" || true
docker --version
docker compose version

echo "==> Opening HTTP/HTTPS in the instance firewall (Oracle images drop them)"
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

echo "==> Preparing /opt/tsm"
sudo mkdir -p /opt/tsm/tree
sudo chown -R "$USER:$USER" /opt/tsm

echo
echo "Done. Next steps:"
echo "  1. cp .env.example .env  (in deploy/oracle) and fill in the secrets"
echo "  2. cd /opt/tsm/tree/deploy/oracle && docker compose --env-file .env up -d --build"
echo "  3. curl -k https://<API_HOSTNAME>/ready   (expect build_sha + auth_ready true)"
