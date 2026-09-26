---
"@next-buildr/mcp": minor
---

Add the document and editing tools (PB-137): `createDocumentTools({ store })` (`list_documents`, `create_document`, `open_document`, `get_outline`, `get_node`, `close_document`) and `createEditingTools({ store })` (`insert_nodes` with a tree or a template, `update_node`, `move_nodes`, `remove_nodes`, `duplicate_nodes`, `wrap_nodes`, `unwrap_node`, `apply_commands`, `undo`, `redo`). Every editing tool is one atomic core batch on the session's working copy and returns the new node ids and their outline.
