#!/usr/bin/env bun
/**
 * Diagnose the civpulse-pi setup.
 *
 * Prints the effective MCP configuration, checks that the Civic Pulse endpoint
 * and its OAuth discovery documents are reachable, and exits non-zero when
 * something needs attention. Run with `bun run check`.
 */

import {
	authLabel,
	AUTHORIZATION_SERVER,
	readPluginVersion,
	RESOURCE_METADATA_URL,
	resolveConfig,
} from "../src/config";

const config = resolveConfig();
const problems: string[] = [];

console.log(`civpulse-pi v${readPluginVersion()}`);
console.log(`  server:         ${config.disabled ? "disabled" : config.url}`);
console.log(`  exposure:       ${config.exposure}`);
console.log(`  auth:           ${authLabel(config)}`);
console.log(`  confirm writes: ${config.confirmWrites ? "on (fail closed without a UI)" : "off"}`);

function ok(message: string): void {
	console.log(`  ${message}`);
}

function bad(message: string): void {
	console.log(`  ${message}`);
	problems.push(message);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
	return fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
}

if (config.disabled) {
	console.log("\nCIVICPULSE_MCP_DISABLED is set; nothing to check.");
	process.exit(0);
}

console.log("\nChecking protected-resource metadata…");
try {
	const response = await fetchWithTimeout(RESOURCE_METADATA_URL, { headers: config.headers });
	if (!response.ok) {
		bad(`metadata returned HTTP ${response.status}`);
	} else {
		const metadata = (await response.json()) as { resource?: string; authorization_servers?: string[] };
		const servers = metadata.authorization_servers ?? [];
		ok(`authorization_servers: ${servers.join(", ") || "(none advertised)"}`);
		if (servers.length === 0) problems.push("metadata does not advertise an authorization server");
	}
} catch (error) {
	bad(`unreachable: ${error instanceof Error ? error.message : String(error)}`);
}

console.log("\nChecking MCP endpoint…");
try {
	const response = await fetchWithTimeout(config.url, { method: "GET", headers: config.headers });
	const challenge = response.headers.get("www-authenticate");
	if (config.headers) {
		ok(`HTTP ${response.status} (bearer token configured)`);
		if (response.status === 401) problems.push("configured bearer token was rejected with 401");
	} else if ([200, 401, 405].includes(response.status)) {
		ok(`reachable (HTTP ${response.status}${challenge ? ` — ${challenge}` : ""})`);
		if (response.status !== 401) problems.push("endpoint did not return an OAuth 401 challenge");
	} else {
		bad(`unexpected HTTP ${response.status}`);
	}
} catch (error) {
	bad(`unreachable: ${error instanceof Error ? error.message : String(error)}`);
}

console.log("\nChecking authorization server metadata…");
try {
	const response = await fetchWithTimeout(`${AUTHORIZATION_SERVER}/.well-known/oauth-authorization-server`);
	ok(`HTTP ${response.status}`);
	if (!response.ok) problems.push(`authorization server metadata returned HTTP ${response.status}`);
} catch (error) {
	bad(`unreachable: ${error instanceof Error ? error.message : String(error)}`);
}

if (problems.length > 0) {
	console.error(`\nProblems:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
	process.exit(1);
}
console.log("\nSetup looks good. Run /mcp in Pi to connect and sign in.");
