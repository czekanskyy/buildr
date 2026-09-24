---
"@buildr/editor": minor
---

Issues panel and publish flow (PB-088): `IssuesPanel` merges validation, accessibility and canvas findings into one list with a severity filter, selects the node of a finding and runs the repair a finding offers as a command. `PublishDialog` re-runs the checks, summarises them, applies the publish policy (`publishGate`: a damaged document always blocks, errors block under `publishPolicy: 'block'`) and publishes through the new `PersistenceController.publish()`, which saves first and never rejects (`PublishOutcome`).
