---
name: land
description: >-
  Land explicitly requested changes in donjo/nbasalarymodel through a verified
  GitHub pull request and squash merge to main. Invoke only when the user requests
  landing or merging, including Land Changes, /land, or acceptance of an offer to
  run this skill. Do not invoke merely for review, preparation, passing checks, or
  skill installation.
metadata:
  delta-action: land
---

# Land changes in nbasalarymodel

## Intent and scope

This skill applies to the repository published at
`https://github.com/donjo/nbasalarymodel`, not to unrelated repositories. It
carries out an explicit landing request, including preparation, verification,
publication, and merging. A visible `/land` invocation or acceptance of an offer
to run this skill supplies landing intent. Do not ask for the same permission
again or claim that such an invocation lacks an explicit request.

Use the current thread's requested change as the scope. If asked to land this
skill first and another change afterward, complete and verify the skill's
landing first, then repeat for the other change only if that change is
identifiable and available. Do not infer scope from an unrelated local branch or
open pull request. A clean worktree alone does not mean there is nothing to
land: inspect committed changes relative to the destination too. If there is no
relevant diff or unlanded commit, report that there is nothing further to land;
do not manufacture a change or call an unrelated existing merge a successful
landing.

## Preflight

1. Read applicable `AGENT.md` and `AGENTS.md`, contribution policies, PR
   templates, and any newer authoritative landing instructions. At setup, this
   checkout had no contribution policy, submission template, or existing landing
   implementation. Recheck at execution. Honor newly applicable signing,
   contributor agreements, reviews, discussions, tests, changelogs, and
   submission requirements, including their conditions and exceptions. If
   human-authored text is required, obtain the text rather than treating
   approval of generated text as authorship. Do not ask again about conditions
   already established.
2. Inspect `git --no-optional-locks status --short --branch`, staged and
   unstaged diffs, current branch, recent commits, and `git remote -v`. Identify
   exactly which changes belong to this request, including untracked files. Stop
   for unresolved scope, unfinished Git operations, or mixed changes that cannot
   be safely separated. Do not reset, discard, overwrite, or silently stash
   unrelated work. Never read credential values or stage secrets.
3. Verify `git`, `deno`, and `gh` availability and use `gh auth status` to check
   authentication without printing tokens. The inspected environment had Deno
   2.9.6 and GitHub CLI 2.94.0. The project uses Fresh 2, Vite 7, and a
   versioned Deno lockfile, but does not pin an exact Deno release. Recheck
   runtime compatibility against the manifests and current CI rather than
   requiring those exact local versions or assuming executable presence is
   sufficient. Do not globally install or upgrade tools without permission.
4. Use the publication remote pointing to `github.com/donjo/nbasalarymodel`. It
   was named `origin` at setup; verify this again. `local` is the user's primary
   checkout backlink and must never be used for publication. Check GitHub
   access, default branch, allowed merge methods, active branch rules, and
   protection:

   ```sh
   gh api repos/donjo/nbasalarymodel --jq '{default_branch,permissions,allow_squash_merge,archived}'
   gh api repos/donjo/nbasalarymodel/branches/main
   gh api repos/donjo/nbasalarymodel/rules/branches/main
   ```

   The approved destination is `main` and method is a GitHub PR squash merge.
   These are selected workflow defaults, not claims that the repository mandates
   them. At setup, squash merges were allowed, `main` was unprotected, and no
   branch rules were active. Recheck the actual destination settings every time;
   an access error is not evidence that rules are absent. Stop if the
   destination has changed or squash merging is incompatible with applicable
   rules. Never alter protections or use an administrator bypass. If a merge
   queue is now required, honor it only when compatible with the approved squash
   outcome, and verify actual landing rather than reporting queue entry as
   success.
5. Fetch the verified publication remote and inspect its latest `main`, ahead
   and behind commits, and any matching PR. Find a PR by its exact source branch
   and inspect its complete diff and destination. An existing PR is reusable
   only when its full change belongs to this request. Do not pick the first open
   PR.

## Prepare the requested change

- If necessary, create a uniquely named topic branch such as
  `donjo/land-<short-description>` without overwriting an existing branch. Keep
  the user's requested changes intact. If existing commits contain unrelated
  work, stop to clarify scope rather than including them in the PR.
- Inspect and explicitly stage only relevant paths or hunks; avoid blanket
  staging when unrelated changes are present. Use short, descriptive imperative
  commit messages. No issue-number or conventional-commit requirement was found
  at setup; follow any applicable newer policy and link issues only when
  relevant.
- Use non-interactive Git commands. Prefix commands that can open an editor with
  `GIT_EDITOR=true`, including commits, merges, and cherry-picks. Supply commit
  messages explicitly, for example
  `GIT_EDITOR=true git commit -m "Add landing skill"`. Respect signing
  requirements without changing the user's signing configuration.
- Bring the latest destination changes into the topic branch with an ordinary
  merge when needed, rather than rewriting a shared branch. Use
  `GIT_EDITOR=true git merge --no-edit <publication-remote>/main` after
  replacing the remote placeholder with the verified name.
- **Conflict preference: resolve automatically whenever possible.** Resolve
  clear conflicts in favor of the requested behavior while preserving unrelated
  work. Do not apply blanket `ours` or `theirs` resolutions. Pause only when
  intent is ambiguous, the resolution is unsafe, or checks cannot pass. Report
  the actual blocker and ask a focused question. Rerun applicable verification
  after any resolution. Do not force-push, perform interactive rebases, or
  rewrite shared history.

## Local verification

Run checks on the final content intended for publication. Rerun affected checks
whenever content changes, including conflict resolution or updates from `main`.
Review the diff afterward for accidental generated files or lockfile changes.

### Code, configuration, and runtime data changes

Run both defined project tasks:

```sh
deno task check
deno task build
```

Source: `deno.json` task definitions, lines 7-10. `check` expands to
`deno fmt --check . && deno lint . && deno check`; `build` expands to
`vite build`. `vite.config.ts`, lines 1-18, configures the Fresh plugin and
production build. Do not substitute commands from stale documentation for these
definitions.

The project uses manual `node_modules` management. If dependencies are missing,
use `deno install --frozen-lockfile` inside the worktree, preserving
`deno.lock`. Sources: `deno.json:2` and its `imports` map, plus `deno.lock`; the
`--frozen-lockfile` argument was verified in the installed Deno CLI help. Do not
upgrade dependencies, disable lockfile checks, or enable arbitrary install
scripts just to get a green result. If lockfile or runtime incompatibility
prevents the checks, report the blocker instead of silently weakening
verification.

Run any additional applicable tests defined by the change or newer project
configuration. At setup there was no ordinary unit-test task or checked-in unit
suite; do not invent a `deno task test` command or call a production data fetch
a unit test. Tests for ingestion should use local fixtures or mocks, with
permissions limited to their actual requirements.

A failed defined check, even if it appears pre-existing, is a blocker under this
workflow. Explain its origin and seek a scoped fix or explicit workflow
decision; do not mass-format unrelated files, disable lint rules, or silently
waive failures.

### Documentation or skill-only changes

When the entire requested diff is documentation or skill text and changes no
runtime code, configuration, or data, use targeted formatting instead of an
unrelated application build:

```sh
deno fmt --check <changed-markdown-paths>
```

Replace the placeholder with the explicitly enumerated changed Markdown files.
Source: the formatter used by `deno.json:8`; the Deno CLI supports the
positional file arguments verified during setup. Check referenced paths and
links. For every changed `SKILL.md`, validate that its YAML frontmatter parses,
has nonempty `name` and `description`, and retains its intended metadata. For
this skill specifically, require `name: land` and `metadata.delta-action: land`.
Do not treat a missing parser or an unverified frontmatter block as successful
validation.

This local exemption never exempts a change from applicable remote checks or
contribution rules. Mixed documentation and code changes follow the code path.

### Do not use live workflows as verification

Do not run `seed`, `merge-stats`, `merge-darko`, `update-stats`, or
`test-sandbox` as landing checks. Their definitions are in `deno.json:13-18`.
The data scripts write KV and/or generated fallback data;
`scripts/test-sandbox.ts:17-24,94-113` shows external sandbox access and
optional persistent writes. Even its default mode provisions a sandbox and
fetches real data. Do not enable cron execution or use live data services to
make verification pass. `main.ts:1-2` imports the cron module, and
`lib/crons.ts:91-114` registers jobs and provisions external sandboxes when
supported. Any genuinely necessary live integration test needs a separately
approved, isolated plan; never expose credentials in files, logs, or PR text.

## Publish, verify remote checks, and land

1. Publish the topic branch to the verified GitHub publication remote using a
   normal push, with no force option. The explicit landing request authorizes
   publishing this scoped change to this repository; it does not authorize
   sending private code elsewhere. Reuse the matching PR or create one against
   `main` with
   `gh pr create --repo donjo/nbasalarymodel --base main --head <topic-branch>`
   and explicit `--title` and `--body` or `--body-file` arguments to avoid
   prompts. Follow any applicable template and authorship rules. Include a
   concise summary and actual verification results. Do not claim checks that
   were not run.
2. Record the PR's exact `headRefOid` and inspect its base, full diff, draft
   state, review decision, mergeability, and check rollup. Recheck branch
   protections and active rules. Address actionable review findings safely and
   satisfy applicable required reviews. Do not approve on behalf of a human or
   bypass unmet policy.
3. Require the `deploy/donjo/nbasalarymodel` status to succeed for that exact PR
   head, in addition to **all** checks and reviews required by current rules and
   repository policy. This Deno Deploy gate is part of the approved workflow;
   setup observed it on both `main` and a PR, rather than finding a checked-in
   Actions test workflow. Copilot agent workflows are not a substitute for build
   or test evidence.
4. Inspect checks using `gh pr checks <pr-number> --repo donjo/nbasalarymodel`
   and exact-commit endpoints:

   ```sh
   gh api repos/donjo/nbasalarymodel/commits/<head-sha>/check-runs
   gh api repos/donjo/nbasalarymodel/commits/<head-sha>/status
   ```

   Replace placeholders with verified values. Include every page when results
   are paginated, and distinguish duplicate names by the required provider when
   rules specify one. Pending, failing, cancelled, missing, or unverifiable
   required checks are not success. An empty required-check list does not
   satisfy the Deno Deploy gate. Never reuse a previous revision's result.
   Respect any explicit skip semantics in repository rules rather than inventing
   an exemption.
5. Bounded waiting is allowed, for example
   `gh pr checks <pr-number> --repo donjo/nbasalarymodel --watch --interval 10 --fail-fast`
   with a terminal timeout. A timeout or pending exit is not a pass. If checks
   or reviews remain blocked, report that the change has not landed. Continue
   safe recovery when possible, but do not enable auto-merge merely to avoid
   verifying requirements before landing.
6. Immediately before merging, ensure the reviewed head SHA is unchanged and all
   applicable local and remote checks are successful for that content. If `main`
   moved and updating the topic branch is required, merge the latest
   destination, resolve clear conflicts, and repeat verification. Land with:

   ```sh
   GIT_EDITOR=true gh pr merge <pr-number> --repo donjo/nbasalarymodel --squash --match-head-commit <verified-head-sha>
   ```

   The `--match-head-commit` flag was verified in GitHub CLI help. Never use
   `--admin`, force pushes, or protection changes. If required rules impose a
   compatible merge queue, satisfy its checks on the queued revision and wait
   until the merge actually occurs. Starting checks, pushing a topic branch,
   preparing a commit, or entering a queue is not successful landing.

## Verify destination and report

- Read the PR's final state, `mergedAt`, and merge commit SHA from GitHub. Fetch
  the destination and verify that the merge commit is reachable from its current
  `main`, for example with
  `git merge-base --is-ancestor <merge-sha> <publication-remote>/main` after
  substituting verified values. A squash merge has a new SHA; do not expect the
  original topic commit to become an ancestor.
- Confirm the landed diff corresponds to the requested changes. Preserve the
  local worktree and unrelated work; do not reset the user's primary checkout,
  force-update branches, or automatically delete branches.
- Report the actual destination and a verified commit URL. Link checks using
  their real `details_url`, `target_url`, or PR check link, identifying whether
  evidence is for the PR head or the landed commit. Do not call a pending or
  unchecked production deployment successful merely because the PR checks
  passed. If post-merge deployment fails, distinguish that failure from the
  already completed Git merge and report the remaining blocker accurately.
- When running in a subthread and `report_subthread_status` is available, report
  the verified outcome to the parent. Otherwise report directly in the current
  conversation. Use `status: "success"` only after verifying the requested
  change reached the intended target. Use `status: "failure"` for a failed
  attempt or a genuine blocker. Do not report skill installation, routine
  progress, a prepared commit, a branch push, or a passing build as landing
  success.
- Keep status titles to a few sentence-case words and descriptions to one short
  line. Use actual short SHAs and verified URLs; omit unavailable links.
  Examples of wording, not literal values to send:
  - Success: title `Landed on main`; description links the landed short SHA and
    `PR checks passed` to their verified results.
  - Failed checks: title `Blocked by checks`; description links the failed check
    and its short SHA and says `Not landed.`
  - Publication failure: title `Push blocked`; description identifies the
    verified commit and missing access and says `Not landed.`
  - Ambiguous or unsafe conflict: title `Conflict needs a decision`; description
    identifies the change and destination and says `Not landed.` Resolve clear
    conflicts automatically without reporting them as blockers.
- Keep questions in the conversation, not the status event. A failure report
  does not end safe recovery: once the blocker is resolved and landing is
  verified, report the updated outcome. If there are no further relevant changes
  after landing the skill itself, state that plainly rather than selecting
  another PR.
