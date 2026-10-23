---
description: Build or edit Civic Pulse maps, reusable layers and stored features
argument-hint: "<map or layer work to do>"
---
Do this Civic Pulse mapping work: ${@:-<describe the map, layer or feature change>}

Work through the `civic-mapping` skill:

1. Load the `civic-mapping` skill, then run `whoami` and confirm the account is an admin.
2. Resolve existing maps and layers with `search_maps` / `search_layers`, and read `get_map` / `get_map_layers` before changing links.
3. For new data, import remote GeoJSON with `create_layer` or stored geometry with `save_postgis_layer`. Validate WGS84 coordinates, geometry types, polygon rings, and the 10 MB / 10,000-feature limits.
4. Change one feature at a time with `create_layer_feature` / `update_layer_feature` / `delete_layer_feature`; treat `geojson` updates as full dataset replacements and confirm before running them.
5. Expect the `civpulse-pi` write guard to ask for confirmation before each mutating call.
6. Read metadata, links and geometry back, and report what changed plus any separate website rebuild need.
