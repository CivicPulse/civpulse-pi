# Project Instructions

Repo guidance for AI coding agents (Pi, Codex, Claude, etc.). Read the
[README](./README.md) too.

## What this repo is

A self-contained [Pi](https://pi.dev) package (`civpulse-pi`) that connects Pi to
the authenticated Civic Pulse MCP server and bundles the civic skills, a
write-confirmation guard, workflow commands, and a setup doctor. It has no
runtime dependencies; Bun is used for scripts and tests.

## Tooling

- Use **bun** for everything: `bun test`, `bun run check`, `bunx`.
- The extension imports Pi host APIs as `import type` from
  `@earendil-works/pi-coding-agent`; keep that a `peerDependency` and never add
  it to `dependencies`.

## Layout rules

- `src/config.ts` is the single source of truth for the MCP URL, exposure,
  auth mode, env overrides, and the write-guard policy. The extension, the
  doctor script, and the tests must all read it from there.
- `extensions/civpulse.ts` registers the MCP server and the `tool_call` guard.
  Keep behavior independent of rendering so print/JSON/RPC modes stay usable.
- `skills/` and `prompts/` mirror the private OpenAI plugin
  (`civpulse-openai`). Keep skill names and descriptions aligned so routing is
  consistent across agents.
- `references/` is generated from the MCP server. Re-copy it from
  `civpulse-openai/plugins/civpulse/references/` when the tool catalog changes;
  never hand-edit the schemas.

## Safety invariants

- The MCP server forwards the caller's OAuth token and never uses a
  service-role key. Do not add one.
- The write guard must confirm every non-read-only tool and **fail closed**
  when no confirmation UI is available. Reads must keep working unattended.
- Prefer the server's live MCP annotations (`readOnlyHint`,
  `destructiveHint`) over hardcoded tool lists; keep the name-based fallback
  conservative.
- Never commit tokens, `.env` files, or `mcp-auth.json` contents.

## Before calling work done

- Run `bun test` and `bun run check`.
- For behavior changes, exercise the extension in a real Pi session
  (`pi --extension ./extensions/civpulse.ts --print "…"`) and confirm no
  extension errors. OAuth sign-in stays a user action.
- Keep the README and this file in sync with configuration or command changes.
