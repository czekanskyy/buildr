# Task dependency graph

```mermaid
flowchart LR
  subgraph F0[Phase 0]
    P000[PB-000] --> P001[PB-001] --> P002[PB-002] --> P003[PB-003] --> P004[PB-004]
    P002 --> P005[PB-005]
  end
  subgraph F1[Phases 1-2: document + registry]
    P006[PB-006] --> P007[PB-007] --> P008[PB-008] --> P009[PB-009]
    P008 --> P010[PB-010]
    P007 --> P011[PB-011]
    P006 --> P012[PB-012] --> P013[PB-013]
    P012 --> P014[PB-014] --> P015[PB-015] --> P016[PB-016]
    P015 --> P017[PB-017]
    P010 --> P018[PB-018]
    P015 --> P018
  end
  subgraph F3[Phase 3: values/data/expressions]
    P013 --> P019[PB-019] --> P021[PB-021]
    P006 --> P020[PB-020] --> P021
    P006 --> P022[PB-022] --> P023[PB-023] --> P024[PB-024]
    P021 --> P025[PB-025]
    P023 --> P025 --> P026[PB-026]
  end
  subgraph F4[Phase 4: styles]
    P006 --> P027[PB-027] --> P028[PB-028] --> P029[PB-029]
    P027 --> P030[PB-030]
  end
  subgraph F5[Phase 5: commands]
    P009 --> P031[PB-031]
    P016 --> P031 --> P032["PB-032 ... PB-038"] --> P039[PB-039] --> P040[PB-040]
    P031 --> P041[PB-041] --> P042[PB-042]
    P016 --> P043[PB-043]
  end
  P002 --> P006
  P015 --> P044["PB-044 ... PB-049 renderer"]
  P025 --> P044
  P044 --> P050["PB-050 ... PB-064 components"]
  P015 --> P065["PB-065 ... PB-072 protocol + canvas"]
  P044 --> P065
  P039 --> P073["PB-073 ... PB-092, PB-115 editor"]
  P065 --> P073
  P007 --> P093["PB-093 ... PB-102, PB-116 payload"]
  P041 --> P093
  P044 --> P103["PB-103 ... PB-107, PB-117 next"]
  P093 --> P103
  P093 --> P108["PB-108 ... PB-114 example + e2e + release"]
  P103 --> P108
  P073 --> P108
  P050 --> P108
  subgraph F13[Phase 13: editor visual polish]
    P118[PB-118 baseline] --> P147[PB-147 identity] --> P119[PB-119 tokens] --> P120[PB-120 icons]
    P121[PB-121 component icons]
    P120 --> P122[PB-122 shell] --> P124[PB-124 canvas stage]
    P122 --> P129[PB-129 toasts/dialogs]
    P120 --> P123[PB-123 toolbar]
    P120 --> P125[PB-125 insert]
    P121 --> P125
    P120 --> P126[PB-126 layers]
    P121 --> P126
    P120 --> P127[PB-127 inspector] --> P128[PB-128 style/value controls]
    P119 --> P130[PB-130 canvas overlay]
    P123 & P124 & P125 & P126 & P128 & P129 & P130 --> P131[PB-131 QA + docs]
  end
  subgraph F14[Phase 14: MCP server]
    P132[PB-132 ADR-024] --> P133[PB-133 scaffold] --> P134[PB-134 sessions] --> P135[PB-135 serialization]
    P135 --> P136[PB-136 discovery] --> P138[PB-138 validate/save]
    P135 --> P137[PB-137 editing] --> P138
    P132 --> P139[PB-139 payload API keys] --> P140[PB-140 HTTP backend]
    P138 & P140 --> P141[PB-141 stdio CLI]
    P138 & P139 --> P142[PB-142 HTTP route]
    P139 --> P143[PB-143 editor external changes]
    P141 & P142 --> P144[PB-144 guide + docs] --> P145[PB-145 E2E]
    P143 --> P145
    P142 -.-> P146[PB-146 screenshots, optional]
  end
  P113[PB-113] --> P118
  P064[PB-064] --> P121
  P114[PB-114] --> P132
```

## Critical path

The longest chain of tasks that must run strictly in sequence (roughly 20 sequential tasks):

`PB-000 -> 001 -> 002 -> 006 -> 012 -> 014 -> 015 -> 016 -> 031 -> 039 -> 074 -> 076 -> 086 -> 110 -> 112 -> 114`

A second, nearly-as-long branch feeds PB-076: `006 -> 012 -> 013 -> 019 -> 021 -> 025 -> 044/045 -> 047 -> 067`. PB-110 additionally depends on the Payload branch: `093 -> 094 -> 095 -> 100`.

## Suggested parallel work tracks (after PB-006 lands)

| Track | Tasks | Package |
|---|---|---|
| A: Document | 007-011 -> 031-040 | `core/document`, `core/commands` |
| B: Schema/Registry | 012-018 -> 043 | `core/schema`, `registry`, `rules`, `templates` |
| C: Values/Expressions | 019-026 (022-024 can start immediately after 006) | `core/values`, `data`, `expressions` |
| D: Styles | 027-030 | `core/styles` |
| E: Renderer + components | 044-049 -> 050-064 | `react`, `components` |
| F: Canvas | 065-072 | `core/protocol`, `react/canvas` |
| G: Editor | 073 (immediately after 002) -> 074-092, 115 | `editor` |
| H: Payload | 093 (after 007) -> 094-102, 116 | `payload` |
| I: Next + example | 103-107, 117 -> 108-114 | `next`, `apps` |

## Post-MVP tracks (phases 13 and 14)

The two phases are independent of each other and can run in parallel. They meet only in the editor's message catalogs (new strings from PB-143 and from the phase-13 tasks) — append-only edits that rebase trivially.

| Track | Tasks | Package |
|---|---|---|
| J: Editor visuals — foundation | 118 -> 147 -> 119 -> 120 (+ 121 in parallel) | `playground/e2e`, `editor/styles`, `editor/ui`, `components` |
| K: Editor visuals — areas (after 120, one agent per area) | 122, 123, 124, 125, 126, 127 -> 128, 129, 130 -> 131 | `editor/{app,toolbar,canvas-host,panels}`, `react/canvas` |
| L: MCP — tool layer | 132 -> 133 -> 134 -> 135 -> 136/137 -> 138 | `mcp` |
| M: MCP — site integration | 139 -> 140, 142, 143 | `payload`, `editor/persistence`, example app |
| N: MCP — delivery | 141, 144 -> 145 (146 optional) | `mcp/cli`, docs, e2e |

After PB-119 lands, the phase-13 area tasks each own a separate CSS partial (`styles/*.css`), which is what makes track K parallelisable without merge conflicts.

The full, authoritative dependency list lives in each task's own card under `docs/backlog/phase-*.md` — this graph is a navigational aid, not a substitute for reading the cards.
