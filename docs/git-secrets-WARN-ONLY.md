# git-secrets — WARN-ONLY integration

```bash
# install once
git clone https://github.com/awslabs/git-secrets.git /tmp/git-secrets
(cd /tmp/git-secrets && sudo make install)
git secrets --install
git secrets --register-aws
```

CI / pre-commit: run `git secrets --scan` and emit `SECRET_PATTERN_DETECTED` label.  
**Never** exit non-zero for pattern matches. Commits, builds, and deploy continue.
