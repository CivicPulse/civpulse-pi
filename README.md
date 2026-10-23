# civpulse-pi

A [Pi](https://pi.dev) package for **Civic Pulse**. One install adds the
authenticated Civic Pulse MCP server, the civic skills, a write-confirmation
guard, workflow slash commands, and a setup doctor.

Civic Pulse runs a remote [Model Context Protocol](https://modelcontextprotocol.io)
server at `https://api.civpulse.org/functions/v1/mcp`. Agents sign in with the
user's Civic Pulse account through Supabase Auth (OAuth 2.1 / OpenID Connect),
and every tool call runs as that user under Row Level Security. Regular users
can research permitted civic records; administrators can edit content, manage
maps, search accounts, and explicitly promote existing users.

This package is the Pi counterpart of the private Civic Pulse plugin for
OpenAI/ChatGPT/Codex (`civpulse-openai`). The skills and tool references are
ported from that plugin; the server, auth model, and permissions are shared.

## What it includes

| Resource | Path | Purpose |
|---|---|---|
| Extension | `extensions/civpulse.ts` | Registers the Civic Pulse MCP server for every Pi session and installs the write guard. |
| Config | `src/config.ts` | Env-driven server settings, write-guard policy, and status text shared with the doctor and tests. |
| Skill | `skills/civic-research/` | Read-only civic research: search, resolve, paginate, cite, respect visibility. |
| Skill | `skills/civic-editing/` | Admin content CRUD: organizations, people, elections, events, articles, images. |
| Skill | `skills/civic-mapping/` | Maps, reusable layers, GeoJSON import, and stored PostGIS features. |
| Skill | `skills/civic-user-admin/` | Registered-account search and explicit admin promotion. |
| Reference | `references/tools.md`, `references/tool-schemas.json` | Generated catalog and schemas for all 99 MCP tools. Live schemas remain authoritative. |
| Commands | `prompts/civpulse-*.md` | `/civpulse-research`, `/civpulse-edit`, `/civpulse-map`, `/civpulse-user-admin`. |
| Command | `/civpulse` | Prints the effective URL, exposure, auth mode, and write-guard state. |
| Doctor | `scripts/check-setup.ts` | Verifies endpoint reachability and OAuth discovery (`bun run check`). |

## Install

```bash
pi install git:github.com/CivicPulse/civpulse-pi
pi install /mnt/storage/projects/CivicPulse/civpulse-pi   # local checkout
```

Add `--local`/`-l` to install into a project's `.pi/settings.json`. For a
project checkout, point at the sibling package instead:

```json
{
  "packages": ["../civpulse-pi"]
}
```

Run `/reload` in a Pi session after changing the package.

## Connect and sign in

The hosted server needs no configuration and uses OAuth:

1. Run `/mcp`, select **Civic Pulse**, and choose **Sign in**.
2. Pi registers a client (dynamic client registration), opens the consent page
   at `https://www.civpulse.org/oauth/consent/`, and waits for approval.
3. Sign in with the Civic Pulse account whose permissions the agent should use.
4. Pi stores the tokens in `~/.pi/agent/mcp-auth.json` and refreshes them
   automatically.

Revoke access any time under
[Account → Connected apps](https://www.civpulse.org/account/). Revocation
rejects existing MCP access tokens and prevents refresh. Never paste tokens or
passwords into chat or into a repository.

## Configuration

Everything is environment-driven, so the same package works for hosted
projects, local backends, and CI. Defaults target production.

| Variable | Effect |
|---|---|
| `CIVICPULSE_MCP_URL` | Override the MCP endpoint (for example a local handler). |
| `CIVICPULSE_MCP_EXPOSURE` | `codemode` (default), `deferred`, `direct`, or `hidden`. Controls how the 99 tools reach the model. |
| `CIVICPULSE_MCP_BEARER_TOKEN` | Send `Authorization: Bearer …` instead of OAuth. For CI/non-interactive runs only. |
| `CIVICPULSE_MCP_AUTH_SERVER_METADATA_URL` | Override OAuth authorization-server metadata discovery. |
| `CIVICPULSE_MCP_CONFIRM_WRITES` | `off` disables the write guard. On by default; see [Safety](#safety). |
| `CIVICPULSE_MCP_DISABLED` | `true` skips server registration; skills and prompts still load. |

The server exposes 99 tools, so `codemode` is the default and keeps the model's
declared tool list small; scripts find tools with `searchTools()` and
`describeNamespace()`. Use `deferred` to load individual tools through
`tool_search`, or `direct` for a small, always-declared set.

A Civic Pulse entry in `~/.pi/agent/mcp.json` or `.pi/mcp.json` with the same
name takes precedence; `/mcp` then shows the extension registration as
overridden.

## Commands and skills

- `/civpulse` — effective URL, exposure, auth mode, and write-guard state.
- `/civpulse-research <topic>` — research organizations, people, elections,
  articles, calendars, and events.
- `/civpulse-edit <change>` — create, update, or delete content.
- `/civpulse-map <work>` — build or edit maps, layers, and stored features.
- `/civpulse-user-admin <request>` — find accounts or promote a user.
- Skills: `civic-research`, `civic-editing`, `civic-mapping`,
  `civic-user-admin` (load explicitly with `/skill:civic-research`).

Run `bun run check` to verify the endpoint and OAuth discovery without Pi.

## Safety

Pi does not support MCP elicitations, so the MCP server's own admin-write
safeguards never reach the UI. The extension installs a `tool_call` hook that
confirms any tool that is not read-only:

- reads (`whoami`, `search_*`, `get_*`, `list_*`) pass through untouched;
- `create_*`, `update_*`, `delete_*`, `save_postgis_layer`, `upload_image`,
  `delete_image`, `update_my_profile`, and `promote_user_to_admin` require
  approval;
- `delete_*` and `promote_user_to_admin` use a stronger destructive warning.

The guard prefers the server's live MCP `readOnlyHint`/`destructiveHint`
annotations and falls back to the tool-name convention before the server
connects. In modes without a dialog it **fails closed**: writes are blocked with
an explanation, while reads keep working. For unattended runs that must write,
set `CIVICPULSE_MCP_CONFIRM_WRITES=off` deliberately.

The database remains the enforcement boundary: RLS and guarded RPCs decide what
each account can see or change. The guard is a UX safeguard, not a security
control. The MCP server never uses a service-role key for agent traffic.

## Requirements

- Pi `1.3.0` or newer (for `pi.registerMcpServer`).
- Network access to `https://api.civpulse.org/functions/v1/mcp` and the
  Supabase Auth authorization server.
- A Civic Pulse account for sign-in.
- [Bun](https://bun.sh) for the doctor script and tests.

## Development

```
civpulse-pi/
├── package.json              # pi manifest: extension, skills, prompts
├── src/config.ts             # env → MCP config + write-guard policy
├── extensions/civpulse.ts    # MCP registration, write guard, /civpulse
├── scripts/check-setup.ts    # reachability + OAuth discovery doctor
├── tests/config.test.ts      # config and write-guard unit tests
├── skills/                   # civic-research, civic-editing, civic-mapping, civic-user-admin
├── prompts/                  # /civpulse-* slash commands
└── references/               # generated tool guide and schemas
```

```bash
bun test        # unit tests for config and the write guard
bun run check   # doctor: endpoint, metadata, authorization server
```

`references/tools.md` and `references/tool-schemas.json` are generated from the
MCP server in `civpulse-openai`. Re-copy them when the server's tool catalog
changes; live MCP schemas stay authoritative at runtime.

## License

MIT
