# Agent skills (process adoption)

Install from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) — workflows for coding agents, not application runtime dependencies.

```bash
npx skills add addyosmani/agent-skills --list
npx skills add addyosmani/agent-skills --skill code-review-and-quality
npx skills add addyosmani/agent-skills --skill test-driven-development
npx skills add addyosmani/agent-skills --skill interview-me
```

Combine with OpenSpec brownfield deltas in `openspec/`.

**TSM constraints for every skill run:**

- Human authority final
- No invented secrets, CRS, or datum transforms
- Fail closed; presentation ≠ regulation
