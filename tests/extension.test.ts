import { describe, expect, test } from "bun:test";
import civicpulse from "../extensions/civpulse";
import type { ToolAnnotations } from "../src/config";

interface FakeTool {
	name: string;
	annotations?: ToolAnnotations;
}

function createHarness(env: NodeJS.ProcessEnv = {}, tools: FakeTool[] = []) {
	const servers: Array<{ name: string; config: Record<string, unknown> }> = [];
	const commands: string[] = [];
	let toolCallHandler: ((event: { toolName: string; input: Record<string, unknown> }, ctx: unknown) => unknown) | undefined;

	const pi = {
		registerMcpServer(name: string, config: Record<string, unknown>) {
			servers.push({ name, config });
		},
		registerCommand(name: string) {
			commands.push(name);
		},
		on(event: string, handler: (typeof toolCallHandler)) {
			if (event === "tool_call") toolCallHandler = handler;
			return () => {};
		},
		getAllTools: () => tools,
	};

	// The extension reads process.env at load; isolate it per harness.
	const saved = process.env;
	process.env = { ...saved, ...env };
	try {
		civicpulse(pi as never);
	} finally {
		process.env = saved;
	}

	return { servers, commands, hasGuard: () => Boolean(toolCallHandler), call: toolCallHandler };
}

const noUI = { hasUI: false, ui: { confirm: async () => true } };
const confirmTrue = { hasUI: true, ui: { confirm: async () => true } };
const confirmFalse = { hasUI: true, ui: { confirm: async () => false } };

describe("civpulse extension", () => {
	test("registers the hosted MCP server with OAuth and attribution", () => {
		const { servers, commands } = createHarness();
		expect(servers).toHaveLength(1);
		expect(servers[0]?.name).toBe("civpulse");
		expect(servers[0]?.config.url).toBe("https://api.civpulse.org/functions/v1/mcp");
		expect(servers[0]?.config.exposure).toBe("codemode");
		expect(servers[0]?.config.headers).toMatchObject({ "X-Source-Name": "pi-plugin" });
		expect(servers[0]?.config).not.toHaveProperty("oauth");
		expect(commands).toContain("civpulse");
	});

	test("adds an OAuth metadata override and bearer headers when configured", () => {
		const { servers } = createHarness({
			CIVICPULSE_MCP_BEARER_TOKEN: "tok",
			CIVICPULSE_MCP_AUTH_SERVER_METADATA_URL: "https://auth.example/.well-known/openid-configuration",
		});
		expect(servers[0]?.config.headers).toMatchObject({ Authorization: "Bearer tok" });
		expect(servers[0]?.config.oauth).toEqual({
			authServerMetadataUrl: "https://auth.example/.well-known/openid-configuration",
		});
	});

	test("does not register the server when disabled", () => {
		const { servers, commands, hasGuard } = createHarness({ CIVICPULSE_MCP_DISABLED: "true" });
		expect(servers).toHaveLength(0);
		expect(commands).toContain("civpulse");
		// The guard stays active: a file-configured server of the same name should
		// still be protected even when the extension registration is disabled.
		expect(hasGuard()).toBe(true);
	});

	test("lets read-only calls pass and confirms writes", async () => {
		const { call, hasGuard } = createHarness({}, [
			{ name: "mcp__civpulse__search_site", annotations: { readOnlyHint: true } },
			{ name: "mcp__civpulse__create_event", annotations: { readOnlyHint: false, destructiveHint: false } },
		]);
		expect(hasGuard()).toBe(true);

		expect(await call?.({ toolName: "mcp__civpulse__search_site", input: {} }, noUI)).toBeUndefined();
		expect(await call?.({ toolName: "mcp__civpulse__create_event", input: { id: "1" } }, confirmTrue)).toBeUndefined();

		const denied = await call?.({ toolName: "mcp__civpulse__create_event", input: { id: "1" } }, confirmFalse);
		expect(denied).toMatchObject({ block: true });
	});

	test("ignores non-civpulse tools", async () => {
		const { call } = createHarness({}, []);
		expect(await call?.({ toolName: "mcp__supabase__execute_sql", input: {} }, noUI)).toBeUndefined();
	});
});
