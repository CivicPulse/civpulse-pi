import { describe, expect, test } from "bun:test";
import {
	authLabel,
	HOSTED_URL,
	isDestructive,
	isMutating,
	resolveConfig,
	SERVER_NAME,
	statusLines,
	TOOL_PREFIX,
} from "../src/config";

describe("resolveConfig", () => {
	test("uses hosted defaults with OAuth and the write guard on", () => {
		const config = resolveConfig({});
		expect(config.url).toBe(HOSTED_URL);
		expect(config.headers).toBeUndefined();
		expect(config.exposure).toBe("codemode");
		expect(config.disabled).toBe(false);
		expect(config.confirmWrites).toBe(true);
	});

	test("honors URL, token and exposure overrides", () => {
		const config = resolveConfig({
			CIVICPULSE_MCP_URL: "http://127.0.0.1:8789/mcp",
			CIVICPULSE_MCP_BEARER_TOKEN: "secret",
			CIVICPULSE_MCP_EXPOSURE: "deferred",
		});
		expect(config.url).toBe("http://127.0.0.1:8789/mcp");
		expect(config.headers).toEqual({ Authorization: "Bearer secret" });
		expect(config.exposure).toBe("deferred");
	});

	test("ignores an invalid exposure and disabled/confirm toggles", () => {
		expect(resolveConfig({ CIVICPULSE_MCP_EXPOSURE: "bogus" }).exposure).toBe("codemode");
		expect(resolveConfig({ CIVICPULSE_MCP_DISABLED: "true" }).disabled).toBe(true);
		expect(resolveConfig({ CIVICPULSE_MCP_CONFIRM_WRITES: "off" }).confirmWrites).toBe(false);
		expect(resolveConfig({ CIVICPULSE_MCP_CONFIRM_WRITES: "on" }).confirmWrites).toBe(true);
	});

	test("passes through an OAuth metadata override", () => {
		const config = resolveConfig({
			CIVICPULSE_MCP_AUTH_SERVER_METADATA_URL: "https://auth.example/.well-known/openid-configuration",
		});
		expect(config.authServerMetadataUrl).toBe("https://auth.example/.well-known/openid-configuration");
	});
});

describe("isMutating", () => {
	test("trusts read-only annotations", () => {
		expect(isMutating("search_site", { readOnlyHint: true })).toBe(false);
		expect(isMutating("create_event", { readOnlyHint: false })).toBe(true);
	});

	test("falls back to tool-name conventions without annotations", () => {
		expect(isMutating("whoami")).toBe(false);
		expect(isMutating("search_organizations")).toBe(false);
		expect(isMutating("get_election")).toBe(false);
		expect(isMutating("list_contests")).toBe(false);
		expect(isMutating("create_person")).toBe(true);
		expect(isMutating("update_my_profile")).toBe(true);
		expect(isMutating("delete_map")).toBe(true);
		expect(isMutating("promote_user_to_admin")).toBe(true);
		expect(isMutating("upload_image")).toBe(true);
	});

	test("does not let a read-only hint hide a mutating name", () => {
		// Only `readOnlyHint === false` proves a write; a missing hint must not.
		expect(isMutating("delete_layer", {})).toBe(true);
	});

	test("describes destructive annotations", () => {
		expect(isDestructive({ destructiveHint: true })).toBe(true);
		expect(isDestructive({ destructiveHint: false })).toBe(false);
		expect(isDestructive(undefined)).toBe(false);
	});
});

describe("status", () => {
	test("names the server and auth mode", () => {
		const config = resolveConfig({});
		const text = statusLines(config).join("\n");
		expect(text).toContain(SERVER_NAME);
		expect(text).toContain("OAuth");
		expect(text).toContain("civic-research");
	});

	test("labels bearer-token auth", () => {
		expect(authLabel(resolveConfig({ CIVICPULSE_MCP_BEARER_TOKEN: "x" }))).toContain("bearer token");
	});

	test("tool prefix matches the MCP naming convention", () => {
		expect(`${TOOL_PREFIX}search_site`).toBe("mcp__civpulse__search_site");
	});
});
