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

The full, authoritative dependency list lives in each task's own card under `docs/backlog/phase-*.md` — this graph is a navigational aid, not a substitute for reading the cards.
