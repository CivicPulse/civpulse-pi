---
description: Create, update or delete Civic Pulse content through the MCP tools
argument-hint: "<what to change, including the record>"
---
Make this Civic Pulse content change: ${@:-<describe the change and the record>}

Work through the `civic-editing` skill:

1. Load the `civic-editing` skill, then run `whoami` and confirm the account is an admin.
2. Search for and read the target record before editing; resolve relationships to existing UUIDs.
3. Apply the smallest change with the matching `create_*`, `update_*` or `delete_*` tool. Updates are partial — send only intended fields.
4. Expect the `civpulse-pi` write guard to ask for confirmation before each mutating call. Do not attempt to bypass a denial.
5. Read the record back and report IDs, the applied change, cascades, and any remaining website rebuild work. This plugin does not deploy the site.
