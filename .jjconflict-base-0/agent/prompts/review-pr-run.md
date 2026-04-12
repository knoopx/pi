---
description: Review Last GitHub workflow run for current branch
---

Fetch and review the GitHub Actions logs for current branch.

1. Get last workflow run: `gh run list --branch $1 --limit 1`
2. Download failed logs: `gh run view <run-id> --log-failed`
3. If no failures, download full logs: `gh run view <run-id> --log`

Analyze the logs and:

- Understand which jobs/steps failed and why
- Root cause of each failure (test error, lint, build, timeout, flaky)
- Fix failures
