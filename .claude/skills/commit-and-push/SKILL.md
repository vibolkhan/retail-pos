---
name: commit-and-push
description: "Use when the user asks to commit, commit and push, or save/ship changes in this repo. Triggers: \"commit\", \"commit this\", \"commit and push\", \"push these changes\", \"save this to git\". Defines this project's commit message format (type(branch): message) and the safe commit/push sequence."
metadata:
  type: project-workflow
---

# Commit and push (this repo)

This repo has no enforced commit convention yet (history has messages like
`'d'`, `'init'`, `dkmv'`). Going forward, use the format below for every
commit made through Claude Code.

## Commit message format

```
type(branch): message
```

- **type** — one conventional-commit type, chosen for what the change
  actually is:
  - `feat` — new user-facing capability
  - `fix` — bug fix
  - `refactor` — code restructuring with no behavior change
  - `style` — formatting/whitespace only, no logic change
  - `chore` — deps, tooling, config, non-code maintenance
  - `docs` — documentation only (README, CLAUDE.md, comments)
  - `test` — tests only
  - `perf` — performance improvement
  - `build` — build system (Vite, `vercel.json`, `package.json` scripts)
  - `ci` — CI/CD pipeline changes
  - `revert` — reverting a previous commit
- **branch** — the *current* git branch name, taken from
  `git branch --show-current` — never a placeholder or invented value. On
  this repo that's usually `main` since there's a single branch.
- **message** — short, imperative, lowercase-start summary of *why*, no
  trailing period.

Example: `feat(main): add out-of-stock badge to product card`

Keep the subject line under ~70 characters. If more detail is needed, add it
as a body after a blank line — the `type(branch): message` line stays the
first line either way.

## Sequence

1. Run in parallel: `git status`, `git diff` (staged + unstaged), and
   `git branch --show-current` to see what changed and confirm the real
   branch name — never assume it.
2. Stage the specific files relevant to the request by name (not `-A` or
   `.`). Re-check `git status` after a broad stage to make sure nothing
   unintended (secrets, build output, unrelated edits) got included.
3. Compose the message using the format above, via a heredoc so
   formatting survives:
   ```bash
   git commit -m "$(cat <<'EOF'
   type(branch): message

   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   EOF
   )"
   ```
4. Push: `git push` if the branch already tracks a remote, otherwise
   `git push -u origin <branch>`. This repo's only remote is
   `origin` → `https://github.com/vibolkhan/retail-pos.git`.

## Safety rules (standing, not just for this skill)

- Always create a new commit — never `--amend` an existing one unless the
  user explicitly asks.
- Never use `--no-verify`, `--no-gpg-sign`, or otherwise skip hooks.
- Never force-push (`--force`/`-f`) to `main` without explicit, in-the-moment
  user confirmation — this repo has one branch and no PR safety net, so a
  bad force-push there is unrecoverable from the remote side.
- If `git push` is rejected because the remote has moved on, stop and tell
  the user rather than force-pushing or rebasing unasked.
- Double-check staged content for secrets before committing — this repo
  keeps real credentials in `.env.local` (gitignored); if a diff ever touches
  that file or embeds a key/token literal, flag it instead of committing.
