# Kitsy Mind — Execution Pack

**Track:** E2 (Mind / AI)  
**Phase:** 4 (INACTIVE — do not begin until Phase 2 gate is met)  
**Owner:** TBD + Codex agents  
**Repo:** `github.com/kitsy-ai/kitsy` → `packages/mind/`, `packages/prompts/`  
**Spec Document:** Mind Implementation Spec  
**License:** Proprietary

---

## Start Condition

> **DO NOT BEGIN THIS TRACK** until ALL of the following are true:
>
> 1. Phase 2 gate met (Server operational — bus effects, config store, sync all working)
> 2. `@kitsy/blu-validate` published and functional (Blu A9)
> 3. `@kitsy/blu-types` published with full JSON Schema (Blu A2)
> 4. `@kitsy/canvas` operational (Studio E1-S1 — needed for tree operations in AI edits)
> 5. Component registry populated with ComponentMeta for all 49 components
>
> **If any of these are not met, this document is for REFERENCE ONLY.**

---

## Scope Rule

> **This track builds @kitsy/mind (AI agent framework) and @kitsy/prompts (prompt templates). It does NOT build Studio UI (that's the Studio track), platform features, or Crew agents beyond basic Blu skills.**
>
> Mind agents run as server-side bus effect handlers. They receive commands, call LLMs, validate output, and respond via channels. The Studio track handles the chat UI that invokes Mind.

---

## 1. Sprint Plan

### Sprint E2-S1 — LLM Gateway (Weeks 17-18)

**Objective:** Build the provider-agnostic LLM interface with Anthropic as the primary provider.

**Ref:** Mind Spec §4 (LLM Gateway)

| # | Task |
|---|------|
| 1 | Create `packages/mind/` |
| 2 | Define LLMProvider interface: generate(request) → LLMResponse, generateStream(request) → AsyncIterable |
| 3 | Define LLMRequest: model, systemPrompt, messages, maxTokens, temperature, responseFormat |
| 4 | Define LLMResponse: content, model, inputTokens, outputTokens, latencyMs, finishReason |
| 5 | Implement AnthropicProvider: calls Claude API via `@anthropic-ai/sdk`, maps to LLMProvider interface |
| 6 | Implement LLMGateway: provider selection (tenant config → agent config → default), retry policy (3 attempts, exponential backoff), provider fallback chain |
| 7 | Implement TokenCounter: estimate token count from string (approximate, for budget planning) |
| 8 | Configuration: model selection, API keys, rate limits — all from environment variables |

**Exit criteria:**
- [ ] AnthropicProvider generates a response from Claude
- [ ] LLMGateway retries on failure with exponential backoff
- [ ] Token counting estimates are within 10% of actual
- [ ] Provider is configurable via environment variables
- [ ] Streaming generation works

**DO NOT:** Implement OpenAI or LiteLLM providers (future). Don't build prompt templates or agents yet.

---

### Sprint E2-S2 — Prompt Engine & Context Assembly (Weeks 19-20)

**Objective:** Build the prompt construction pipeline: template selection, context injection, catalog serialization.

**Ref:** Mind Spec §5 (Prompt Engine), §15 (Context Assembly), §16 (Prompt Templates)

| # | Task |
|---|------|
| 1 | Create `packages/prompts/` |
| 2 | Implement PromptEngine: loads templates from `@kitsy/prompts`, selects template by agent + operation |
| 3 | Implement ContextAssembler: builds LLMContext from current state — config schema (compact), component catalog, current config, selected node, theme tokens, data sources, conversation history, examples |
| 4 | Implement SchemaSerializer: convert ApplicationConfiguration JSON Schema to a compact LLM-friendly text format |
| 5 | Implement CatalogSerializer: convert ComponentMeta[] to compact prompt format (`URN — Name [category]\n  Props: {...}\n  Slots: [...]`) |
| 6 | Implement TokenBudget: allocate context window across required/preferred/optional sections, truncate if needed |
| 7 | Write system prompt (shared across all agents): from Mind Spec §16.1 |
| 8 | Write generate-site template: from Mind Spec §16.2 |
| 9 | Write edit-section template: from Mind Spec §16.3 |
| 10 | Write fix-validation template: from Mind Spec §16.4 |

**Exit criteria:**
- [ ] `@kitsy/prompts` package created with system prompt + 3 templates
- [ ] ContextAssembler produces valid LLM context from a config + registry
- [ ] CatalogSerializer produces readable compact format from ComponentMeta[]
- [ ] TokenBudget correctly allocates within model limits
- [ ] Full prompt assembled from template + context + examples fits within token budget

**DO NOT:** Build agents or bus integration yet. This sprint is prompt infrastructure only.

---

### Sprint E2-S3 — Validation Pipeline & Auto-Fix (Weeks 21-22)

**Objective:** Build the 7-step validation pipeline and auto-fix engine for AI output.

**Ref:** Mind Spec §12 (Validation Pipeline), §13 (Auto-Fix Engine)

| # | Task |
|---|------|
| 1 | Implement ValidationPipeline (wraps `@kitsy/blu-validate` with AI-specific steps): (1) JSON parse + extract from LLM fences, (2) Schema validation, (3) URN resolution, (4) Data source references, (5) Action targets, (6) Circular references, (7) Accessibility baseline |
| 2 | JSON extraction: handle LLM responses wrapped in ```json fences, with preamble text, or raw JSON |
| 3 | Implement AutoFixEngine: unknown URN → closest match by Levenshtein, missing required prop → fill from defaultProps, dangling data source → remove binding, invalid action → remove, duplicate IDs → regenerate, missing a11y labels → placeholder, extra properties → strip, wrong type → coerce |
| 4 | Implement RetryWithFeedback: if auto-fix fails, re-prompt LLM with error details using fix-validation template (max 2 retries) |
| 5 | Return PipelineResult: valid, errors, warnings, autoFixable, appliedFixes |

**Exit criteria:**
- [ ] Valid AI output passes all 7 steps
- [ ] Invalid URN auto-fixed to closest match
- [ ] Missing required props auto-filled from defaults
- [ ] Dangling data source references auto-removed
- [ ] RetryWithFeedback re-prompts and succeeds on fixable errors
- [ ] Unfixable errors (bad JSON, circular refs) reported cleanly
- [ ] 95%+ test coverage (validation is critical path)

**DO NOT:** Build agents. This is validation infrastructure shared by all agents.

---

### Sprint E2-S4 — Config Generator Agent (Weeks 23-24)

**Objective:** Build the full-site generation agent and wire it to the bus.

**Ref:** Mind Spec §6 (Agent Registry), §7 (Config Generator)

| # | Task |
|---|------|
| 1 | Implement BaseAgent abstract class: handle(command) → assembleContext → buildPrompt → LLM → parseOutput → validate → autoFix → retryIfNeeded → return AgentResult |
| 2 | Implement AgentRegistry: register agents by topic, route commands to agents |
| 3 | Implement ConfigGeneratorAgent: topic = "ai:generate-site", accepts prompt + style + optional pages list, builds full ApplicationConfiguration |
| 4 | Few-shot example library: create 4 example configs (SaaS landing, business site, portfolio, storefront) — all must pass validation |
| 5 | Implement FewShotSelector: select most relevant example by keyword similarity with user prompt |
| 6 | Wire bus integration: register effect on server bus — `bus.effects.onEvery("ai:generate-site", handler)` |
| 7 | Response via channels: `channels.answer(correlationId, { success, config, errors })` |
| 8 | End-to-end test: user prompt → bus command → LLM call → validation → response |

**Exit criteria:**
- [ ] "Create a landing page for a bakery" → valid ApplicationConfiguration with hero, features, CTA, footer
- [ ] Generated config passes full 7-step validation
- [ ] Few-shot examples selected by relevance
- [ ] Agent responds via bus channels within 15 seconds
- [ ] Auto-fix handles common LLM output issues
- [ ] 4 few-shot examples all pass validation

**DO NOT:** Build other agents (edit, theme, content, form). One agent at a time.

---

### Sprint E2-S5 — Section Editor Agent (Weeks 25-26)

**Objective:** Build the agent that edits, adds, and removes individual sections.

**Ref:** Mind Spec §8 (Section Editor)

| # | Task |
|---|------|
| 1 | Implement SectionEditorAgent: topics = "ai:edit-section", "ai:add-section", "ai:remove-section" |
| 2 | Edit: receives nodeId + prompt + full config context → extracts targeted section → sends section + context to LLM → receives modified section → computes JSON Patch → validates → returns patch |
| 3 | Add: receives afterNodeId + prompt → LLM generates new ViewNode[] → validate → return as insertable nodes |
| 4 | Remove: receives nodeId → return JSON Patch removing the subtree |
| 5 | Context injection: include full config summary so LLM can reference other sections ("match the hero style") |
| 6 | Use `@kitsy/canvas` operations for tree manipulation (insertNode, removeNode, replaceSubtree) |
| 7 | Bus effects registered for all 3 topics |

**Exit criteria:**
- [ ] "Make the hero taller with a dark background" → correct JSON Patch on the hero node
- [ ] "Add a testimonials section after features" → new ViewNode[] inserted at correct position
- [ ] "Remove the FAQ section" → node removed, config valid
- [ ] Edit preserves node ID (identity stable)
- [ ] Cross-section references work ("use the same color as pricing")

**DO NOT:** Build theme, content, or form agents.

---

### Sprint E2-S6 — Theme, Content, Form Agents (Weeks 27-28)

**Ref:** Mind Spec §9 (Theme), §10 (Content), §11 (Form)

| # | Task |
|---|------|
| 1 | ThemeAdvisorAgent: topic = "ai:suggest-theme" → generates ThemeTokens (color scales, typography, spacing) from prompt + optional brand colors. Returns token overrides, not ViewNode changes. Optional: return 2-3 variant palettes. |
| 2 | ContentWriterAgent: topic = "ai:write-copy" → modifies ONLY text content props (headline, description, etc.) on a targeted node. Returns JSON Patch. Never changes structure. |
| 3 | FormBuilderAgent: topic = "ai:generate-form" → generates FormViewNode from prompt ("contact form with name, email, phone, message"). Includes field types, validation rules, submission target. |
| 4 | Register all 3 agents as bus effects |
| 5 | Write prompt templates for each: suggest-theme.md, write-copy.md, generate-form.md |

**Exit criteria:**
- [ ] "Modern and professional" → valid ThemeTokens with full color scales
- [ ] "Make the hero headline more punchy" → text-only JSON Patch
- [ ] "Contact form with name, email, phone, message" → valid FormViewNode
- [ ] Theme suggestions include rationale text
- [ ] Content writer never changes component structure

---

### Sprint E2-S7 — Conversation & Safety (Weeks 29-30)

**Ref:** Mind Spec §14 (Conversation), §18 (Guardrails)

| # | Task |
|---|------|
| 1 | ConversationManager: per-session conversation history (max 20 turns), builds multi-turn LLM context |
| 2 | IntentDetector: classify user prompt → route to correct agent (pattern matching + LLM fallback for ambiguous) |
| 3 | Multi-turn flow: "Create a landing page" → generates → "Add pricing" → edits → "Make it darker" → theme change. Each turn builds on previous config state. |
| 4 | Guardrails — input: blocked prompt patterns (malware, phishing, impersonation) |
| 5 | Guardrails — output: check for script injection, external URLs in data sources, unsafe content |
| 6 | Rate limiting: per-tenant AI request quotas (from plan limits), cost tracking per request |
| 7 | Observability: log every request with prompt, model, tokens, latency, validation result, user accepted |
| 8 | Metrics: requests_total, latency_ms, validation_pass_rate, autofix_rate, retry_rate, cost_usd |

**Exit criteria:**
- [ ] Multi-turn conversation maintains context across 5+ turns
- [ ] Intent detection routes correctly for all agent types
- [ ] Blocked prompts rejected with clear message
- [ ] Script injection in output detected and blocked
- [ ] Rate limiting enforced per tenant plan
- [ ] All requests logged with full metadata

---

## 2. Phase 4 Gate (Mind)

- [ ] All 5 agents operational: ConfigGenerator, SectionEditor, ThemeAdvisor, ContentWriter, FormBuilder
- [ ] Validation pipeline catches and auto-fixes common LLM output issues
- [ ] Multi-turn conversation with context
- [ ] Safety guardrails on input and output
- [ ] Rate limiting and cost tracking
- [ ] All agents accessible via bus commands from any client
- [ ] End-to-end: Studio AI chat → bus command → Mind → validated config → Studio applies

---

## 3. Track Governance

```
@kitsy/mind:
  - Server-side only (runs in Kitsy Server process)
  - All agents are bus effect handlers (same protocol as any bus participant)
  - All LLM output passes through validation pipeline — NEVER sent raw to client
  - AutoFix before retry: don't waste LLM calls on fixable issues
  - Max 2 retries per request (3 total attempts including original)
  - Every request logged for quality evaluation

@kitsy/prompts:
  - Prompt templates are version-controlled markdown files
  - Few-shot examples are valid JSON configs that pass validation in CI
  - System prompt is shared across all agents (single source of truth)
  - Templates are parameterized — no hardcoded component names or schema details
```

```
DEPENDENCY RULES:
  @kitsy/mind → @kitsy/blu-bus, @kitsy/blu-types, @kitsy/blu-validate, @kitsy/canvas
  @kitsy/mind → @anthropic-ai/sdk (primary LLM provider)
  @kitsy/mind → @kitsy/server (registers effects on server bus)
  @kitsy/prompts → @kitsy/blu-types (for schema references)

NOT ALLOWED:
  @kitsy/mind → @kitsy/studio (Mind doesn't know about Studio UI)
  @kitsy/mind → React (server-side only, no UI)
  @kitsy/prompts → any runtime dependency (text files + types only)
```

### Sprint handoff template

```markdown
## Sprint E2-S{N} Complete

### What shipped
- Agents: [list operational agents]
- Templates: [list prompt templates]
- Examples: [list few-shot examples]

### Exit criteria
- [ ] Criterion: [evidence]

### AI quality metrics
- Validation pass rate (first attempt): [%]
- Auto-fix rate: [%]
- Average latency: [ms]
- Token usage per request: [input/output]

### Known limitations
- [Edge cases where generation fails]
- [Prompt improvements needed]

### What next sprint needs
- [Agents available for bus subscription]
- [Prompt template changes]
```
