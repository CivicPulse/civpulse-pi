/**
 * Shared configuration for the civpulse-pi package.
 *
 * Resolves the Civic Pulse MCP server settings from the environment and
 * describes them for the `/civpulse` command and `scripts/check-setup.ts`.
 * Keeping this in one place means the extension, the diagnostics script, and
 * the tests never disagree about the effective URL, exposure, or write guard.
 *
 * The Civic Pulse MCP endpoint is a Supabase Edge Function that authenticates
 * callers through Supabase Auth (OAuth 2.1 / OpenID Connect). Pi discovers the
 * authorization server from the protected-resource metadata, so no credentials
 * are required in configuration: sign in with `/mcp`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Registered MCP server name. Tools become `mcp__civpulse__<tool>`. */
export const SERVER_NAME = "civpulse";

/** Production MCP endpoint (streamable HTTP). */
export const HOSTED_URL = "https://api.civpulse.org/functions/v1/mcp";

/** RFC 9728 protected-resource metadata served by the MCP function. */
export const RESOURCE_METADATA_URL = `${HOSTED_URL}/.well-known/oauth-protected-resource`;

/** Supabase Auth OAuth 2.1 authorization server for the hosted project. */
export const AUTHORIZATION_SERVER = "https://drzcrodqflzkzzbqsags.supabase.co/auth/v1";

/** Public site that hosts the OAuth consent page and account settings. */
export const PUBLIC_SITE = "https://www.civpulse.org";

/** Prefix Pi assigns to this server's tools. */
export const TOOL_PREFIX = `mcp__${SERVER_NAME}__`;

export const SERVER_DESCRIPTION =
	"Search and manage Civic Pulse civic records: organizations, people, elections, contests, ballot questions, articles, calendars, events, maps, layers and stored features.";

/** Attribution header sent to the MCP server so usage can be identified. */
export const SOURCE_NAME = "pi-plugin";

export const EXPOSURES = ["codemode", "deferred", "direct", "hidden"] as const;
export type Exposure = (typeof EXPOSURES)[number];

/**
 * Tool names that are always read-only when the server has not yet sent its
 * annotations (for example before the first connection completes). The live
 * MCP annotations stay authoritative; this is only a conservative fallback.
 */
const READ_ONLY_PREFIXES = ["search_", "get_", "list_"] as const;

/** Read-only tools whose names do not follow the search/get/list convention. */
const READ_ONLY_TOOLS = new Set(["whoami"]);

export interface CivicPulseMcpConfig {
	/** Effective MCP server URL. */
	url: string;
	/** Extra headers. Set from `CIVICPULSE_MCP_BEARER_TOKEN` for CI use. */
	headers?: Record<string, string>;
	/** Optional OAuth authorization-server metadata override. */
	authServerMetadataUrl?: string;
	/** How the model reaches the server's tools. Default: `codemode`. */
	exposure: Exposure;
	/** Do not register the server; skills and prompts still load. */
	disabled: boolean;
	/** Confirm mutating tool calls before they run. Default: true. */
	confirmWrites: boolean;
}

export interface ToolAnnotations {
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
}

function env(source: NodeJS.ProcessEnv, name: string): string | undefined {
	const value = source[name];
	return value && value.trim() !== "" ? value.trim() : undefined;
}

function isTruthy(value: string | undefined): boolean {
	if (!value) return false;
	return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function isFalsy(value: string | undefined): boolean {
	if (!value) return false;
	return ["0", "false", "no", "off"].includes(value.toLowerCase());
}

function resolveExposure(source: NodeJS.ProcessEnv): Exposure {
	const value = env(source, "CIVICPULSE_MCP_EXPOSURE")?.toLowerCase();
	return (EXPOSURES as readonly string[]).includes(value ?? "") ? (value as Exposure) : "codemode";
}

export function resolveConfig(source: NodeJS.ProcessEnv = process.env): CivicPulseMcpConfig {
	const token = env(source, "CIVICPULSE_MCP_BEARER_TOKEN");
	const confirmWrites = env(source, "CIVICPULSE_MCP_CONFIRM_WRITES");
	return {
		url: env(source, "CIVICPULSE_MCP_URL") ?? HOSTED_URL,
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		authServerMetadataUrl: env(source, "CIVICPULSE_MCP_AUTH_SERVER_METADATA_URL"),
		exposure: resolveExposure(source),
		disabled: isTruthy(env(source, "CIVICPULSE_MCP_DISABLED")),
		// Default on: Pi does not support MCP elicitations, so the server's own
		// admin-write safeguards never reach the UI. Gate mutating calls here.
		confirmWrites: confirmWrites === undefined ? true : !isFalsy(confirmWrites),
	};
}

/** Read this package's version so `X-Source-Version` tracks releases. */
export function readPluginVersion(): string {
	try {
		const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
		const raw = readFileSync(join(packageRoot, "package.json"), "utf8");
		return (JSON.parse(raw) as { version?: string }).version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

export function authLabel(config: CivicPulseMcpConfig): string {
	return config.headers ? "bearer token (CIVICPULSE_MCP_BEARER_TOKEN)" : "OAuth — run /mcp to sign in";
}

/**
 * Whether a Civic Pulse tool call mutates data or schema and should be gated.
 *
 * Prefers the server's live MCP annotations. Falls back to the tool-name
 * convention (`search_*`, `get_*`, `list_*`, and `whoami` are read-only) when
 * the annotations are not available yet, so writes never slip through.
 */
export function isMutating(tool: string, annotations?: ToolAnnotations): boolean {
	if (annotations?.readOnlyHint === false) return true;
	if (annotations?.readOnlyHint === true) return false;
	if (READ_ONLY_TOOLS.has(tool)) return false;
	return !READ_ONLY_PREFIXES.some((prefix) => tool.startsWith(prefix));
}

/** Whether the tool destroys data, for a stronger confirmation prompt. */
export function isDestructive(annotations?: ToolAnnotations): boolean {
	return annotations?.destructiveHint === true;
}

export function statusLines(config: CivicPulseMcpConfig): string[] {
	return [
		`Civic Pulse MCP: ${config.disabled ? "disabled (CIVICPULSE_MCP_DISABLED)" : `registered as "${SERVER_NAME}"`}`,
		`  url:            ${config.url}`,
		`  exposure:       ${config.exposure}`,
		`  auth:           ${authLabel(config)}`,
		`  confirm writes: ${config.confirmWrites ? "on (fail closed without a UI)" : "off"}`,
		`  consent:        ${PUBLIC_SITE}/oauth/consent/`,
		"",
		"Skills:   civic-research, civic-editing, civic-mapping, civic-user-admin",
		"Commands: /civpulse-research, /civpulse-edit, /civpulse-map, /civpulse-user-admin",
		"Doctor:   bun run check",
		"Inspect connections with /mcp. Configuration is documented in the package README.",
	];
}
