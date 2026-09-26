---
'@next-buildr/mcp': minor
---

Add the discovery tools and resources (PB-136): `createDiscoveryTools()` (`list_components`, `describe_component`, `list_templates`, `describe_template`, `get_style_reference`, `get_data_schema`, `list_media`, all read-only), `createResources()` (`buildr://components/{type}`, `buildr://templates/{id}`, `buildr://style-reference`) and the SDK-free `options.resources` seam of `createBuildrMcpServer`. Answers are cached per manifest hash (`createDiscoveryCache`).
