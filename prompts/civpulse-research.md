---
description: Research Civic Pulse organizations, people, elections, articles, calendars and events
argument-hint: "<topic, person, organization or question>"
---
Research this in Civic Pulse: ${@:-<describe what to research>}

Work through the `civic-research` skill:

1. Load the `civic-research` skill and the connected Civic Pulse MCP tools (`mcp__civpulse__*`).
2. Run `whoami` if the answer depends on account visibility.
3. Search with `search_site` (or a dedicated `search_*` tool), then resolve results with the matching `get_*` tool. Paginate with `limit`/`offset` when a complete inventory is requested.
4. For elections, pull contests, ballot questions and candidates; for people, pull candidacies and affiliations.
5. Cite the supporting Civic Pulse record IDs and linked source URLs. Report unknown dates as unknown and never infer endorsements or results.
6. Keep private or unlisted records out of public-ready output unless the user is authorized and asks for it.

Summarize findings, the records you relied on, and any permission limits you hit.
