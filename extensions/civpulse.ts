/**
 * Civic Pulse MCP server, write guard, and status command for Pi.
 *
 * Registers the authenticated Civic Pulse MCP endpoint
 * (https://api.civpulse.org/functions/v1/mcp) for the current session and ships
 * the civic research, editing, mapping and user-administration skills next to
 * it. Nothing needs to be installed locally: Pi's built-in OAuth flow
 * (`/mcp` -> Sign in) connects the user's Civic Pulse account, and every tool
 * call runs as that user under Row Level Security.
 *
 * Pi does not support MCP elicitations, so the server's own admin-write
 * safeguards never reach the UI. This extension gates mutating tool calls with
 * a confirmation dialog that fails closed in modes without a UI. See the
 * package README and `src/config.ts`.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	isDestructive,
	isMutating,
	readPluginVersion,
	resolveConfig,
	SERVER_DESCRIPTION,
	SERVER_NAME,
	SOURCE_NAME,
	statusLines,
	TOOL_PREFIX,
	type ToolAnnotations,
} from "../src/config";

interface ToolCallLike {
	toolName: string;
	input: Record<string, unknown>;
}

interface RegisteredToolLike {
	name: string;
	annotations?: ToolAnnotations;
}

export default function civicpulse(pi: ExtensionAPI) {
	const config = resolveConfig();

	// A file-configured `mcp.json` server of the same name takes precedence, so
	// this never double-connects when the user already configured Civic Pulse.
	if (!config.disabled) {
		pi.registerMcpServer(SERVER_NAME, {
			url: config.url,
			exposure: config.exposure,
			description: SERVER_DESCRIPTION,
			headers: {
				"X-Source-Name": SOURCE_NAME,
				"X-Source-Version": readPluginVersion(),
				...config.headers,
			},
			// OAuth is handled by Pi through the protected-resource metadata.
			// A configured bearer token in `headers` disables the OAuth flow.
			// This override only helps when discovery advertises the wrong server.
			...(config.authServerMetadataUrl
				? { oauth: { authServerMetadataUrl: config.authServerMetadataUrl } }
				: {}),
		});
	}

	// Guard: confirm any tool that is not read-only. Reads pass through with no
	// prompt; every `create_*`, `update_*`, `delete_*`, image upload and account
	// promotion asks first. Without a confirmation UI the guard blocks writes
	// rather than approving them.
	if (config.confirmWrites) {
		pi.on("tool_call", async (event: ToolCallLike, ctx: ExtensionContext) => {
			if (!event.toolName.startsWith(TOOL_PREFIX)) return;
			const tool = event.toolName.slice(TOOL_PREFIX.length);

			const registered = (pi.getAllTools() as RegisteredToolLike[]).find(
				(candidate) => candidate.name === event.toolName,
			);
			if (!isMutating(tool, registered?.annotations)) return;

			// Fail closed in modes without a dialog rather than silently approving.
			if (!ctx.hasUI) {
				return {
					block: true,
					reason: `${event.toolName} blocked: the civpulse write guard is on but no confirmation UI is available. Set CIVICPULSE_MCP_CONFIRM_WRITES=off to allow writes in unattended runs.`,
				};
			}

			const preview = JSON.stringify(event.input);
			const detail = preview.length > 500 ? `${preview.slice(0, 500)}…` : preview;
			const destructive = isDestructive(registered?.annotations);
			const heading = destructive
				? "Run destructive Civic Pulse tool?"
				: "Run Civic Pulse write tool?";
			const note = destructive
				? "This can delete data or change account access."
				: "This changes Civic Pulse data.";
			const approved = await ctx.ui.confirm(heading, `${note}\n${event.toolName}\n${detail}`);
			if (!approved) {
				return { block: true, reason: `${event.toolName} was not approved` };
			}
		});
	}

	pi.registerCommand("civpulse", {
		description: "Show the Civic Pulse MCP configuration used in this session",
		handler: async (_args, ctx) => {
			ctx.ui.notify(statusLines(config).join("\n"), "info");
		},
	});
}
