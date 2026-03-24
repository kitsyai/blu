# Kitsy Mind — Implementation Specification

**Version:** 1.0  
**Date:** 2026-03-22  
**Status:** Implementation-ready companion to *Kitsy Blu — Single Source of Truth v2.0*  
**Scope:** Phase 4 deliverable — `@kitsy/mind`, `@kitsy/prompts`  
**License:** Proprietary  
**Read alongside:** SSOT §8.6, §2.5 (AI-readiness thesis), §6 (all contracts), Server Spec §12 (AI integration)

---

## Table of Contents

1. [Overview & Design Goals](#1-overview--design-goals)
2. [System Architecture](#2-system-architecture)
3. [Package Structure](#3-package-structure)
4. [LLM Gateway](#4-llm-gateway)
5. [Prompt Engine](#5-prompt-engine)
6. [Agent Registry](#6-agent-registry)
7. [Config Generator Agent](#7-config-generator-agent)
8. [Section Editor Agent](#8-section-editor-agent)
9. [Theme Advisor Agent](#9-theme-advisor-agent)
10. [Content Writer Agent](#10-content-writer-agent)
11. [Form Builder Agent](#11-form-builder-agent)
12. [Validation Pipeline](#12-validation-pipeline)
13. [Auto-Fix Engine](#13-auto-fix-engine)
14. [Conversation Manager](#14-conversation-manager)
15. [Context Assembly](#15-context-assembly)
16. [Prompt Templates](#16-prompt-templates)
17. [Few-Shot Example Library](#17-few-shot-example-library)
18. [Guardrails & Safety](#18-guardrails--safety)
19. [Observability & Evaluation](#19-observability--evaluation)
20. [Implementation Sequence](#20-implementation-sequence)

---

## 1. Overview & Design Goals

Kitsy Mind is the AI layer that generates, edits, and operates ApplicationConfiguration documents through the Blu EventBus. It is NOT a code generator — it produces structured data (ViewNode trees, Action declarations, DataSource configs) validated against the Blu schema.

### 1.1 Core principle: AI is not special

AI agents connect to Kitsy Server's EventBus like any other participant. `$source: "ai:agent-1"`. They use channels ask/answer RPC. The bus doesn't care if the endpoint is a browser, a server process, or an LLM.

### 1.2 Design goals

| Goal | Constraint |
|------|-----------|
| **Schema-constrained** | LLM output is always validated against the Blu JSON Schema. Invalid output is auto-fixed or rejected — never passed through raw. |
| **Incremental** | Mind can generate a full site AND edit a single component prop. Edits produce JSON Patches, not full regeneration. |
| **Context-aware** | Every AI request includes the current config, selected node, available components, theme tokens, and conversation history. |
| **Provider-agnostic** | LLM gateway supports Anthropic Claude, OpenAI GPT, and local models via LiteLLM. Provider is configurable per-agent, per-tenant, and per-request. |
| **Bus-native** | All AI operations are bus effects triggered by commands. Studio, CLI, and API all invoke AI the same way. |
| **Observable** | Every AI request logs: prompt tokens, completion tokens, latency, model used, validation result, auto-fix count. |

### 1.3 The structural advantage

Current AI code generators (Lovable, Bolt, v0) produce React/HTML code. This works for initial generation but creates problems for incremental editing, validation, versioning, and multi-actor collaboration.

Kitsy Mind produces **data** (ApplicationConfiguration), not code. This means:

- **Validation:** Every output passes a 7-step pipeline before reaching the user
- **Incremental edits:** JSON Patch on a structured tree, not find-and-replace in code
- **Collaboration:** Human edits and AI edits operate on the same config — no merge conflicts between code styles
- **Reliability:** AI can't produce XSS, broken imports, or undefined variables — the schema prevents it
- **Inspection:** Every AI-generated ViewNode is inspectable in Studio's property panel

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Kitsy Mind                                  │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐│
│  │ Conversation │  │ Context      │  │ Agent Registry              ││
│  │ Manager      │  │ Assembler    │  │                            ││
│  │              │  │              │  │ ┌──────────────────────┐   ││
│  │ • History    │  │ • Config     │  │ │ Config Generator     │   ││
│  │ • Session    │  │ • Selection  │  │ │ Section Editor       │   ││
│  │ • Intent     │  │ • Registry   │  │ │ Theme Advisor        │   ││
│  │   detection  │  │ • Theme      │  │ │ Content Writer       │   ││
│  │              │  │ • DataSources│  │ │ Form Builder         │   ││
│  └──────┬───────┘  └──────┬───────┘  │ │ (extensible)         │   ││
│         │                 │          │ └──────────────────────┘   ││
│         │                 │          └───────────┬────────────────┘│
│         └─────────┬───────┘                      │                 │
│                   │                              │                 │
│          ┌────────▼────────────────────────────────▼──────────┐    │
│          │                Prompt Engine                        │    │
│          │                                                    │    │
│          │  • Template selection (by agent + intent)           │    │
│          │  • Context injection (schema, catalog, examples)    │    │
│          │  • Few-shot example selection (by similarity)       │    │
│          │  • Token budget management                          │    │
│          └────────────────────┬───────────────────────────────┘    │
│                               │                                    │
│          ┌────────────────────▼───────────────────────────────┐    │
│          │                LLM Gateway                          │    │
│          │                                                    │    │
│          │  ┌───────────┐  ┌───────────┐  ┌───────────────┐  │    │
│          │  │ Anthropic  │  │ OpenAI    │  │ LiteLLM       │  │    │
│          │  │ (Claude)   │  │ (GPT)     │  │ (local/other) │  │    │
│          │  └───────────┘  └───────────┘  └───────────────┘  │    │
│          └────────────────────┬───────────────────────────────┘    │
│                               │                                    │
│          ┌────────────────────▼───────────────────────────────┐    │
│          │            Validation Pipeline                      │    │
│          │                                                    │    │
│          │  1. JSON parse                                      │    │
│          │  2. Schema validation                               │    │
│          │  3. URN resolution                                  │    │
│          │  4. Data source validation                          │    │
│          │  5. Action validation                               │    │
│          │  6. Circular reference check                        │    │
│          │  7. Accessibility baseline                          │    │
│          │                                                    │    │
│          │  → Auto-Fix Engine (if validation fails)            │    │
│          │  → Retry with feedback (if auto-fix fails)          │    │
│          └───────────────────────────────────────────────────┘    │
│                               │                                    │
│          ┌────────────────────▼───────────────────┐                │
│          │  Bus Integration (Effects on EventBus)  │                │
│          │                                        │                │
│          │  Subscribes: ai:generate-site           │                │
│          │              ai:edit-section             │                │
│          │              ai:suggest-theme            │                │
│          │              ai:write-copy               │                │
│          │              ai:generate-form            │                │
│          │              ai:chat                     │                │
│          │                                        │                │
│          │  Responds: via channels.answer()         │                │
│          └────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Package Structure

### 3.1 `@kitsy/mind` (Proprietary)

```
@kitsy/mind/
├── src/
│   ├── gateway/
│   │   ├── LLMGateway.ts            # Provider-agnostic LLM interface
│   │   ├── providers/
│   │   │   ├── anthropic.ts         # Claude adapter
│   │   │   ├── openai.ts            # GPT adapter
│   │   │   └── litellm.ts           # LiteLLM proxy adapter
│   │   ├── TokenCounter.ts          # Estimate token usage pre-request
│   │   └── RetryPolicy.ts           # Exponential backoff, provider fallback
│   ├── agents/
│   │   ├── AgentRegistry.ts         # Agent registration and routing
│   │   ├── BaseAgent.ts             # Shared agent logic (prompt → validate → respond)
│   │   ├── ConfigGeneratorAgent.ts  # Full site generation
│   │   ├── SectionEditorAgent.ts    # Edit/add/remove sections
│   │   ├── ThemeAdvisorAgent.ts     # Theme suggestions
│   │   ├── ContentWriterAgent.ts    # Copy/text generation
│   │   └── FormBuilderAgent.ts      # Form generation
│   ├── prompt/
│   │   ├── PromptEngine.ts          # Template selection + context injection
│   │   ├── ContextAssembler.ts      # Build LLM context from config + registry
│   │   ├── SchemaSerializer.ts      # Convert JSON Schema to LLM-friendly format
│   │   ├── CatalogSerializer.ts     # Convert ComponentMeta[] to compact prompt
│   │   └── TokenBudget.ts           # Manage context window limits
│   ├── conversation/
│   │   ├── ConversationManager.ts   # Multi-turn conversation state
│   │   ├── IntentDetector.ts        # Classify user prompt → agent + operation
│   │   └── ConversationStore.ts     # Per-session conversation history
│   ├── validation/
│   │   ├── ValidationPipeline.ts    # 7-step pipeline (reuses @kitsy/blu-validate)
│   │   ├── AutoFixEngine.ts         # Attempt to fix common LLM output issues
│   │   └── RetryWithFeedback.ts     # Re-prompt LLM with error context
│   ├── bus/
│   │   ├── mindEffects.ts           # Bus effect handlers for all ai:* commands
│   │   └── mindMiddleware.ts        # AI-specific middleware (rate limit, logging)
│   └── index.ts
├── tests/
└── package.json
```

### 3.2 `@kitsy/prompts` (Proprietary)

```
@kitsy/prompts/
├── src/
│   ├── templates/
│   │   ├── generate-site.md         # Full site generation prompt
│   │   ├── edit-section.md          # Section editing prompt
│   │   ├── suggest-theme.md         # Theme suggestion prompt
│   │   ├── write-copy.md            # Content writing prompt
│   │   ├── generate-form.md         # Form generation prompt
│   │   ├── fix-validation.md        # Re-prompt on validation failure
│   │   └── system.md               # Base system prompt (shared across agents)
│   ├── examples/
│   │   ├── landing-page.json        # Few-shot: SaaS landing page config
│   │   ├── business-site.json       # Few-shot: business website config
│   │   ├── storefront.json          # Few-shot: simple store config
│   │   ├── dashboard.json           # Few-shot: admin dashboard config
│   │   ├── contact-form.json        # Few-shot: contact form ViewNode
│   │   ├── hero-section.json        # Few-shot: hero section ViewNode
│   │   └── pricing-section.json     # Few-shot: pricing section ViewNode
│   ├── schema/
│   │   ├── config-schema.json       # ApplicationConfiguration JSON Schema (compact)
│   │   ├── viewnode-schema.json     # ViewNode schema subset for LLM
│   │   └── action-schema.json       # Action type schema for LLM
│   └── index.ts                     # Template loader and registry
├── tests/
└── package.json
```

---

## 4. LLM Gateway

### 4.1 Provider interface

```typescript
interface LLMProvider {
  name: string;                         // "anthropic", "openai", "litellm"

  generate(request: LLMRequest): Promise<LLMResponse>;

  // Streaming (for real-time UI feedback in Studio)
  generateStream?(request: LLMRequest): AsyncIterable<LLMStreamChunk>;

  // Capabilities
  maxContextTokens: number;
  supportsJSON: boolean;                // Native JSON mode
  supportsStreaming: boolean;
}

interface LLMRequest {
  model: string;                        // "claude-sonnet-4-20250514", "gpt-4o"
  systemPrompt: string;
  messages: LLMMessage[];
  maxTokens: number;
  temperature: number;
  responseFormat?: "json" | "text";     // Prefer JSON mode where supported
  stopSequences?: string[];
}

interface LLMResponse {
  content: string;                      // Raw LLM output
  model: string;                        // Actual model used
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  finishReason: "stop" | "max_tokens" | "error";
}
```

### 4.2 Provider selection logic

```typescript
class LLMGateway {
  // Priority: tenant config → agent config → global default
  async selectProvider(request: AgentRequest): Promise<LLMProvider> {
    // 1. Check tenant-level override (Enterprise customers can specify provider)
    const tenantConfig = await getTenantAIConfig(request.tenantId);
    if (tenantConfig?.provider) return this.providers[tenantConfig.provider];

    // 2. Check agent-level default
    const agentConfig = this.agentProviderMap[request.agentType];
    if (agentConfig) return this.providers[agentConfig.provider];

    // 3. Global default
    return this.providers[this.defaultProvider]; // Anthropic Claude
  }
}
```

### 4.3 Retry and fallback

```typescript
// Retry policy: 3 attempts with exponential backoff
// On provider failure: fall back to next provider in chain
// Chain: Anthropic → OpenAI → LiteLLM (local)

async function generateWithRetry(request: LLMRequest, providers: LLMProvider[]): Promise<LLMResponse> {
  for (const provider of providers) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await provider.generate(request);
      } catch (error) {
        if (attempt === 3) break; // Try next provider
        await sleep(Math.pow(2, attempt) * 1000); // 2s, 4s backoff
      }
    }
  }
  throw new AIError("AI_GENERATION_FAILED", "All providers failed");
}
```

---

## 5. Prompt Engine

### 5.1 Prompt assembly pipeline

```
User prompt: "Create a landing page for my bakery"
                    ↓
┌─── Intent Detection ─────────────────────┐
│  Agent: ConfigGeneratorAgent             │
│  Operation: generate-site                │
│  Domain: food/bakery                     │
└──────────────────────────────────────────┘
                    ↓
┌─── Context Assembly ─────────────────────┐
│  • ApplicationConfiguration JSON Schema  │
│  • Available components (compact catalog)│
│  • Current theme tokens                  │
│  • Available data source types           │
│  • Available action types                │
│  • Constraints and rules                 │
└──────────────────────────────────────────┘
                    ↓
┌─── Template Selection ───────────────────┐
│  Template: generate-site.md              │
│  Inject: schema, catalog, examples       │
└──────────────────────────────────────────┘
                    ↓
┌─── Few-Shot Selection ───────────────────┐
│  Best match: business-site.json          │
│  (selected by domain similarity)         │
└──────────────────────────────────────────┘
                    ↓
┌─── Token Budget ─────────────────────────┐
│  Model context: 200K tokens              │
│  System prompt: ~3K tokens               │
│  Schema + catalog: ~4K tokens            │
│  Few-shot examples: ~2K tokens           │
│  Conversation history: ~1K tokens        │
│  User prompt: ~50 tokens                 │
│  Reserved for output: ~8K tokens         │
│  ─────────────────────                   │
│  Budget OK: ~18K / 200K used             │
└──────────────────────────────────────────┘
                    ↓
            Final prompt assembled → LLM Gateway
```

### 5.2 Context serialization

The component catalog is serialized into a compact format for the LLM:

```typescript
function serializeCatalog(metas: ComponentMeta[]): string {
  // Compact format: URN | Name | Category | Required Props | Slots
  // LLM doesn't need full JSON Schema — just enough to use components correctly
  
  return metas.map(m => {
    const props = Object.entries(m.propSchema.properties || {})
      .map(([key, schema]) => {
        const req = m.requiredProps.includes(key) ? "*" : "";
        return `${key}${req}: ${schema.type}`;
      }).join(", ");
    
    const slots = m.slots.map(s => s.name).join(", ");
    
    return `${m.urn} — ${m.displayName} [${m.category}]
  Props: { ${props} }
  Slots: [${slots || "none"}]
  ${m.description}`;
  }).join("\n\n");
}

// Output example:
// urn:blu:block:hero — Hero Banner [marketing]
//   Props: { headline*: string, subheadline: string, height: string, alignment: string, backgroundImage: string, primaryCTA: object }
//   Slots: [media, actions]
//   Full-width hero section with headline, description, CTA buttons, and optional background image
```

### 5.3 Token budget management

```typescript
class TokenBudget {
  private model: string;
  private maxContext: number;
  private reservedForOutput: number;

  constructor(model: string) {
    this.maxContext = MODEL_LIMITS[model]; // e.g., 200000 for Claude
    this.reservedForOutput = 8000;
  }

  allocate(sections: { name: string; content: string; priority: "required" | "preferred" | "optional" }[]): string[] {
    let remaining = this.maxContext - this.reservedForOutput;
    const included: string[] = [];

    // Include required sections first, then preferred, then optional
    for (const priority of ["required", "preferred", "optional"]) {
      for (const section of sections.filter(s => s.priority === priority)) {
        const tokens = estimateTokens(section.content);
        if (tokens <= remaining) {
          included.push(section.content);
          remaining -= tokens;
        } else if (priority === "required") {
          // Truncate required sections rather than omitting
          included.push(truncateToTokens(section.content, remaining));
          remaining = 0;
        }
        // Optional sections silently dropped if no budget
      }
    }

    return included;
  }
}
```

---

## 6. Agent Registry

### 6.1 Agent routing

```typescript
class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

  register(agent: BaseAgent): void {
    for (const topic of agent.topics) {
      this.agents.set(topic, agent);
    }
  }

  route(command: Command): BaseAgent | undefined {
    return this.agents.get(command.type);
  }
}

// Registration at server bootstrap
const registry = new AgentRegistry();
registry.register(new ConfigGeneratorAgent());   // ai:generate-site
registry.register(new SectionEditorAgent());     // ai:edit-section, ai:add-section, ai:remove-section
registry.register(new ThemeAdvisorAgent());      // ai:suggest-theme
registry.register(new ContentWriterAgent());     // ai:write-copy
registry.register(new FormBuilderAgent());       // ai:generate-form
```

### 6.2 Base agent contract

```typescript
abstract class BaseAgent {
  abstract topics: string[];
  abstract name: string;

  async handle(command: Command, context: AgentContext): Promise<AgentResult> {
    // 1. Assemble context
    const llmContext = await this.assembleContext(command, context);

    // 2. Build prompt
    const prompt = await this.buildPrompt(command.payload, llmContext);

    // 3. Call LLM
    const raw = await context.gateway.generate(prompt);

    // 4. Parse output
    const parsed = this.parseOutput(raw.content);

    // 5. Validate
    const validation = context.validator.fullPipeline(parsed, context.registry);

    // 6. Auto-fix if needed
    if (!validation.valid) {
      const fixed = await this.autoFix(parsed, validation.errors, context);
      if (!fixed.valid) {
        // Retry with feedback
        return this.retryWithFeedback(command, raw, validation.errors, context);
      }
      return { success: true, result: fixed.config, fixes: fixed.appliedFixes };
    }

    return { success: true, result: parsed };
  }

  abstract assembleContext(command: Command, context: AgentContext): Promise<LLMContext>;
  abstract buildPrompt(payload: unknown, context: LLMContext): LLMRequest;
  abstract parseOutput(raw: string): unknown;

  // Default retry: re-prompt with error details (up to 2 retries)
  async retryWithFeedback(command: Command, previousOutput: LLMResponse, errors: ValidationError[], context: AgentContext, attempt: number = 1): Promise<AgentResult> {
    if (attempt > 2) return { success: false, errors };

    const feedbackPrompt = context.promptEngine.buildFeedbackPrompt(
      previousOutput.content,
      errors,
      "fix-validation"
    );

    const retryResult = await context.gateway.generate(feedbackPrompt);
    const parsed = this.parseOutput(retryResult.content);
    const validation = context.validator.fullPipeline(parsed, context.registry);

    if (!validation.valid) {
      return this.retryWithFeedback(command, retryResult, validation.errors, context, attempt + 1);
    }

    return { success: true, result: parsed, retries: attempt };
  }
}

interface AgentResult {
  success: boolean;
  result?: ApplicationConfiguration | ViewNode[] | JSONPatch[];
  errors?: ValidationError[];
  fixes?: string[];                     // Description of auto-fixes applied
  retries?: number;
}
```

---

## 7. Config Generator Agent

**Topic:** `ai:generate-site`

Generates a complete ApplicationConfiguration from a natural language description.

### 7.1 Input

```typescript
interface GenerateSitePayload {
  prompt: string;                       // "Create a landing page for my bakery"
  style?: string;                       // "modern", "minimal", "bold", "playful"
  pages?: string[];                     // Requested pages: ["home", "menu", "contact"]
  features?: string[];                  // Specific features: ["contact form", "menu display"]
}
```

### 7.2 Output

Complete `ApplicationConfiguration` with:
- Brand name extracted from prompt
- Appropriate views (pages) with ViewNode trees
- Navigation configured
- Theme tokens matching the requested style
- Data sources configured (static data for content)
- Actions wired (navigation between pages, form submissions)

### 7.3 Generation strategy

```
1. Extract intent: business type, style, pages, features
2. Select closest few-shot example
3. Build prompt with:
   - Full component catalog (marketing blocks, layout, UI)
   - Action types
   - Theme token structure
   - Few-shot example
   - User's specific requirements
4. Request JSON output
5. Validate → auto-fix → retry if needed
6. Return complete config
```

### 7.4 Example prompt → output

**Input:** "Create a modern landing page for a SaaS product called TaskFlow that helps teams manage projects"

**Output (abbreviated):**

```json
{
  "$schema": "https://blu.kitsy.ai/schema/v1.json",
  "$version": 1,
  "brand": { "name": "TaskFlow" },
  "home": "home",
  "views": [
    {
      "id": "home",
      "meta": { "title": "TaskFlow — Project Management for Modern Teams" },
      "children": [
        {
          "id": "nav", "componentUrn": "urn:blu:block:navbar",
          "props": { "brand": { "name": "TaskFlow" }, "links": [...], "sticky": true }
        },
        {
          "id": "hero", "componentUrn": "urn:blu:block:hero",
          "props": { "headline": "Ship Projects Faster", "subheadline": "The project management tool your team actually wants to use", "height": "lg", "primaryCTA": { "label": "Start Free Trial" } },
          "actions": { "onClick": { "type": "navigate", "path": "/signup" } }
        },
        {
          "id": "features", "componentUrn": "urn:blu:block:features",
          "props": { "headline": "Everything You Need", "columns": 3, "features": [...] }
        },
        {
          "id": "pricing", "componentUrn": "urn:blu:block:pricing",
          "props": { "plans": [...], "billingToggle": true }
        }
      ]
    }
  ],
  "navigation": { "links": [...] }
}
```

---

## 8. Section Editor Agent

**Topics:** `ai:edit-section`, `ai:add-section`, `ai:remove-section`

The most frequently used agent. Operates on individual sections within an existing config.

### 8.1 Edit operations

| Operation | Input | Output |
|-----------|-------|--------|
| **Edit** | `{ nodeId, prompt }` "Make the hero taller with a dark background" | JSON Patch targeting the specific node |
| **Add** | `{ afterNodeId, prompt }` "Add a testimonials section after features" | New ViewNode[] to insert |
| **Remove** | `{ nodeId, prompt }` "Remove the FAQ section" | JSON Patch removing the node |
| **Replace** | `{ nodeId, prompt }` "Replace this feature grid with a comparison table" | New ViewNode replacing the subtree |

### 8.2 Edit strategy

```
1. Receive: current full config + nodeId (or afterNodeId) + prompt
2. Extract the targeted section (ViewNode subtree)
3. Build focused prompt:
   - "Here is the current section: [targeted ViewNode JSON]"
   - "The user wants: [prompt]"
   - "Return the modified ViewNode JSON"
   - Available components catalog (filtered to relevant categories)
4. Request minimal JSON output (just the section, not the full config)
5. Compute JSON Patch (old section → new section)
6. Validate patch against full config
7. Return patch
```

### 8.3 Context-aware editing

The editor receives the FULL config context, not just the targeted section. This allows:

- "Make this section match the style of the hero" → reads hero's props for reference
- "Use the same color as the pricing section" → reads pricing's style
- "Connect this to the products data source" → knows available data sources
- "Add a button that goes to the contact page" → knows available routes

---

## 9. Theme Advisor Agent

**Topic:** `ai:suggest-theme`

### 9.1 Input

```typescript
interface SuggestThemePayload {
  prompt: string;                       // "Modern and professional", "Warm and friendly bakery", "Bold tech startup"
  currentTheme?: ThemeTokens;           // Current theme (for refinement)
  brandColors?: string[];               // Brand colors to incorporate
  industry?: string;                    // "saas", "food", "healthcare", "finance"
}
```

### 9.2 Output

```typescript
interface ThemeSuggestion {
  tokens: Partial<ThemeTokens>;         // Color scales, typography, spacing
  rationale: string;                    // "I chose warm earth tones to convey..."
  variants?: Partial<ThemeTokens>[];    // 2-3 alternative palettes
}
```

### 9.3 Strategy

The theme advisor generates color scales (full 50-900), font pairings, and spacing scales. It doesn't modify ViewNodes — only theme tokens. Studio applies the tokens and the preview updates instantly.

---

## 10. Content Writer Agent

**Topic:** `ai:write-copy`

### 10.1 Input

```typescript
interface WriteCopyPayload {
  nodeId: string;                       // Target ViewNode
  prompt?: string;                      // "Make it more professional" / "Shorter and punchier"
  context: {
    businessType: string;               // Extracted from config
    currentContent: string;             // Current text in the node
    tone?: string;                      // "professional", "casual", "playful"
    length?: "short" | "medium" | "long";
  };
}
```

### 10.2 Output

JSON Patch updating text props (headline, subheadline, description, features[].description, etc.) on the targeted node.

### 10.3 Strategy

Content writer ONLY modifies text content props — never structure, layout, or component types. This is intentionally narrow: text changes are safe and don't require structural validation.

---

## 11. Form Builder Agent

**Topic:** `ai:generate-form`

### 11.1 Input

```typescript
interface GenerateFormPayload {
  prompt: string;                       // "Contact form with name, email, phone, and message"
  purpose?: string;                     // "contact", "survey", "registration", "order"
  dataSources?: DataSource[];           // Available data sources for submission target
}
```

### 11.2 Output

A `FormViewNode` (SSOT §6.7) with fields, validation rules, submission target, and layout configuration.

### 11.3 Strategy

Forms are the highest-value AI generation target because they're tedious to build manually. The form builder:

1. Extracts field requirements from the prompt
2. Assigns appropriate field types (email → "email" with pattern validation, phone → "tel")
3. Adds sensible validation rules (required, format, length)
4. Configures submission target (creates a new data source if needed)
5. Sets up success/error actions

---

## 12. Validation Pipeline

The validation pipeline is the critical guardrail. Every AI output passes through it before reaching the user.

### 12.1 Pipeline steps

```typescript
class ValidationPipeline {
  // Reuses @kitsy/blu-validate for steps 1-5
  
  validate(output: unknown, registry: ComponentRegistry, config?: ApplicationConfiguration): PipelineResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Step 1: JSON parse
    if (typeof output === "string") {
      try { output = JSON.parse(extractJSON(output)); }
      catch { return { valid: false, errors: [{ step: 1, message: "Invalid JSON" }] }; }
    }

    // Step 2: Schema validation
    const schemaErrors = validateJSONSchema(output, ApplicationConfigurationSchema);
    if (schemaErrors.length > 0) {
      errors.push(...schemaErrors.map(e => ({ step: 2, ...e })));
      return { valid: false, errors }; // Fail fast — schema must pass
    }

    // Step 3: URN resolution
    for (const node of walkViewNodes(output)) {
      if (!registry.has(node.componentUrn)) {
        errors.push({ step: 3, path: `${node.id}.componentUrn`, message: `Unknown: ${node.componentUrn}` });
      }
    }

    // Step 4: Data source references
    const sourceIds = new Set((output.dataSources || []).map(ds => ds.id));
    for (const node of walkViewNodes(output)) {
      if (node.data?.source && !sourceIds.has(node.data.source)) {
        errors.push({ step: 4, path: `${node.id}.data.source`, message: `Unknown source: ${node.data.source}` });
      }
      if (node.repeat?.source && !sourceIds.has(node.repeat.source)) {
        errors.push({ step: 4, path: `${node.id}.repeat.source`, message: `Unknown source: ${node.repeat.source}` });
      }
    }

    // Step 5: Action validation
    for (const node of walkViewNodes(output)) {
      for (const [event, action] of Object.entries(node.actions || {})) {
        errors.push(...this.validateAction(action, sourceIds, output, `${node.id}.actions.${event}`));
      }
    }

    // Step 6: Circular references
    const visited = new Set<string>();
    for (const node of walkViewNodes(output)) {
      if (visited.has(node.id)) {
        errors.push({ step: 6, path: node.id, message: "Circular reference detected" });
      }
      visited.add(node.id);
    }

    // Step 7: Accessibility
    warnings.push(...this.checkAccessibility(output, registry));

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      autoFixable: errors.filter(e => AUTO_FIXABLE_STEPS.includes(e.step)),
    };
  }
}
```

---

## 13. Auto-Fix Engine

When the validation pipeline finds errors, the auto-fix engine attempts to repair the output before retrying with the LLM.

### 13.1 Auto-fixable issues

| Issue | Fix Strategy |
|-------|-------------|
| Unknown componentUrn | Replace with closest match by Levenshtein distance from registry |
| Missing required prop | Fill from ComponentMeta.defaultProps |
| Dangling data source reference | Remove the data binding (leave component as static) |
| Invalid action target | Remove the action |
| Duplicate ViewNode IDs | Regenerate IDs for duplicates |
| Missing accessibility labels | Add placeholder text: `"[Alt text needed]"`, `"[Label needed]"` |
| Extra properties not in schema | Strip unknown properties |
| Wrong prop type (string instead of number) | Attempt type coercion |

### 13.2 Non-auto-fixable issues (require LLM retry)

| Issue | Why |
|-------|-----|
| Invalid JSON | Can't parse = can't fix |
| Schema structure violation | Too many possible interpretations |
| Circular references | Structural problem needs redesign |
| Deeply wrong component usage | Fixing would change intent |

### 13.3 Implementation

```typescript
class AutoFixEngine {
  fix(config: unknown, errors: ValidationError[], registry: ComponentRegistry): AutoFixResult {
    let fixed = structuredClone(config);
    const appliedFixes: string[] = [];

    for (const error of errors) {
      switch (error.step) {
        case 3: // Unknown URN
          const closest = registry.findClosest(error.originalUrn);
          if (closest && levenshteinDistance(error.originalUrn, closest.urn) < 10) {
            setPath(fixed, error.path, closest.urn);
            appliedFixes.push(`Replaced ${error.originalUrn} with ${closest.urn}`);
          }
          break;

        case 4: // Dangling data source
          setPath(fixed, error.path, undefined); // Remove binding
          appliedFixes.push(`Removed dangling data binding at ${error.path}`);
          break;

        // ... other fixes
      }
    }

    // Re-validate after fixes
    const revalidation = this.pipeline.validate(fixed, registry);
    return {
      valid: revalidation.valid,
      config: fixed,
      appliedFixes,
      remainingErrors: revalidation.errors,
    };
  }
}
```

---

## 14. Conversation Manager

### 14.1 Multi-turn conversation

Studio interactions are conversational. The user says "Create a landing page," then "Make the hero taller," then "Add a pricing section." Each request builds on the previous.

```typescript
class ConversationManager {
  private sessions: Map<string, ConversationSession> = new Map();

  getOrCreate(sessionId: string): ConversationSession {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new ConversationSession());
    }
    return this.sessions.get(sessionId)!;
  }
}

class ConversationSession {
  private history: ConversationTurn[] = [];
  private maxTurns = 20;               // Keep last 20 turns for context

  addTurn(turn: ConversationTurn): void {
    this.history.push(turn);
    if (this.history.length > this.maxTurns) this.history.shift();
  }

  // Build conversation context for LLM
  toMessages(): LLMMessage[] {
    return this.history.map(turn => ({
      role: turn.role,
      content: turn.content,
    }));
  }
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: {
    agent: string;                      // Which agent handled this
    configVersion: number;              // Config version after this turn
    patchApplied?: JSONPatch[];         // What changed
  };
}
```

### 14.2 Intent detection

Before routing to an agent, the conversation manager classifies the user's intent:

```typescript
class IntentDetector {
  detect(prompt: string, context: ConversationContext): DetectedIntent {
    // Simple keyword/pattern matching for common intents
    // Falls back to LLM classification for ambiguous prompts
    
    const patterns: [RegExp, string, string][] = [
      [/create|build|make.*(?:site|page|landing)/i, "ai:generate-site", "ConfigGenerator"],
      [/add.*section|insert.*section/i, "ai:add-section", "SectionEditor"],
      [/edit|change|update|modify|make.*(?:bigger|smaller|taller|shorter)/i, "ai:edit-section", "SectionEditor"],
      [/remove|delete|get rid of/i, "ai:remove-section", "SectionEditor"],
      [/theme|color|style|look.*feel|branding/i, "ai:suggest-theme", "ThemeAdvisor"],
      [/write|copy|text|headline|description|content/i, "ai:write-copy", "ContentWriter"],
      [/form|input|field|submit|contact.*form/i, "ai:generate-form", "FormBuilder"],
    ];

    for (const [pattern, topic, agent] of patterns) {
      if (pattern.test(prompt)) return { topic, agent, confidence: "high" };
    }

    // Ambiguous: use LLM to classify
    return { topic: "ai:chat", agent: "ConversationRouter", confidence: "low" };
  }
}
```

---

## 15. Context Assembly

### 15.1 What the LLM receives

Every AI request includes rich context. The `ContextAssembler` builds this from the current state:

```typescript
interface LLMContext {
  // Schema (always included)
  schema: {
    configSchema: string;               // Compact JSON Schema representation
    viewNodeSchema: string;
    actionSchema: string;
  };

  // Component catalog (always included)
  catalog: string;                      // Serialized ComponentMeta[] (§5.2)

  // Current config (included for edit operations)
  currentConfig?: ApplicationConfiguration;

  // Selection context (included when user has selected a node)
  selectedNode?: {
    nodeId: string;
    viewNode: ViewNode;
    parentId?: string;
    path: string[];                     // Breadcrumb: ["home", "hero", "cta-button"]
  };

  // Theme (always included)
  themeTokens: ThemeTokens;

  // Data sources (always included)
  availableDataSources: DataSource[];

  // Conversation history (for multi-turn)
  conversationHistory: LLMMessage[];

  // Few-shot examples (selected by relevance)
  examples: string[];
}
```

### 15.2 Context compression

For large configs, the assembler compresses context to fit token budget:

1. **Full config:** Include if < 4K tokens. Otherwise, include only the targeted view.
2. **Catalog:** Include only categories relevant to the request (marketing blocks for landing pages, form components for form requests).
3. **History:** Include last 5 turns, summarize earlier turns.
4. **Examples:** Include 1-2 most relevant examples, truncate to schema + one page.

---

## 16. Prompt Templates

### 16.1 System prompt (shared)

```markdown
You are Kitsy Mind, an AI assistant that generates and edits UI configurations for the Blu framework.

You output structured JSON data — NOT code. Your output is validated against a strict JSON Schema.

RULES:
1. Only use component URNs from the provided catalog. Never invent URNs.
2. Every component must include all required props (marked with *).
3. Every ViewNode must have a unique `id` (lowercase, kebab-case).
4. Use actions for interactivity — never embed logic in props.
5. Use data bindings to connect components to data sources — never hardcode dynamic content.
6. Respect the current theme tokens when choosing colors or styles.
7. Generate accessible content: all images need alt text, all buttons need labels.
8. Output ONLY valid JSON. No markdown, no explanation, no code fences.
```

### 16.2 Generate-site template (excerpt)

```markdown
Generate a complete ApplicationConfiguration for the following request.

## User Request
{userPrompt}

## Available Components
{catalog}

## Theme Tokens
{themeTokens}

## JSON Schema (output must conform)
{schema}

## Example (for reference — do NOT copy blindly)
{fewShotExample}

## Requirements
- Include appropriate pages based on the request
- Set up navigation between pages
- Use block components (hero, features, pricing, etc.) for page sections
- Wire CTA buttons with navigate actions
- Set brand name from the user's request
- Output a single JSON object conforming to the ApplicationConfiguration schema
```

### 16.3 Edit-section template (excerpt)

```markdown
Edit the following ViewNode section based on the user's request.

## Current Section
```json
{currentNode}
```

## Full Page Context (for reference)
{currentViewSummary}

## User Request
{userPrompt}

## Available Components
{catalogSubset}

## Output
Return ONLY the modified ViewNode JSON. Keep the same `id`. Only change what the user requested.
```

### 16.4 Fix-validation template

```markdown
Your previous output had validation errors. Please fix them.

## Your Previous Output
{previousOutput}

## Validation Errors
{errors}

## Fix Instructions
- Fix each error listed above
- Keep everything else unchanged
- Output the corrected JSON only
```

---

## 17. Few-Shot Example Library

### 17.1 Example selection

Examples are selected by similarity to the user's request:

```typescript
function selectExamples(prompt: string, maxExamples: number = 2): FewShotExample[] {
  const examples = loadAllExamples();

  // Score each example by keyword overlap with prompt
  const scored = examples.map(ex => ({
    example: ex,
    score: computeSimilarity(prompt, ex.description + " " + ex.tags.join(" ")),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples)
    .map(s => s.example);
}
```

### 17.2 Example format

Each example is a complete, valid ApplicationConfiguration that passes the full validation pipeline:

```typescript
interface FewShotExample {
  id: string;                           // "landing-saas"
  description: string;                  // "SaaS product landing page with hero, features, pricing, FAQ"
  tags: string[];                       // ["saas", "landing", "pricing", "modern"]
  config: ApplicationConfiguration;     // The actual example config
  compact: string;                      // Pre-serialized compact version for prompt injection
}
```

### 17.3 MVP example set

| Example | Description | Components Used |
|---------|-------------|----------------|
| `landing-saas` | SaaS landing page | navbar, hero, features, pricing, testimonials, faq, cta, footer |
| `business-local` | Local business site | navbar, hero, features (services), team, contact form, map, footer |
| `portfolio` | Personal portfolio | navbar, hero, gallery, about, contact, footer |
| `storefront-simple` | Simple product store | navbar, hero, product grid (repeat), footer |
| `dashboard` | Admin dashboard | sidebar, header, stats, data table |
| `contact-form` | Contact form section | form with name, email, phone, message fields |
| `pricing-section` | Pricing table section | pricing block with 3 plans |

---

## 18. Guardrails & Safety

### 18.1 Content safety

```typescript
// Pre-generation: filter harmful prompts
const BLOCKED_PATTERNS = [
  /generate.*malware|phishing|scam/i,
  /impersonate|fake.*(?:bank|government|hospital)/i,
  // ... content policy patterns
];

function checkPromptSafety(prompt: string): SafetyResult {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return { safe: false, reason: "Request violates content policy" };
    }
  }
  return { safe: true };
}
```

### 18.2 Output safety

```typescript
// Post-generation: check output for unsafe content
function checkOutputSafety(config: ApplicationConfiguration): SafetyResult {
  for (const node of walkViewNodes(config)) {
    // No external script injection
    if (JSON.stringify(node.props).includes("<script")) {
      return { safe: false, reason: "Script injection detected" };
    }

    // No external URLs in data sources (unless explicitly allowed)
    // No links to known malicious domains
    // No adult content in text props
  }
  return { safe: true };
}
```

### 18.3 Rate limiting

AI requests are rate-limited per plan (Server Spec §11.2):

| Plan | AI Requests/Hour |
|------|-----------------|
| Starter | 10 |
| Pro | 100 |
| Business | 500 |
| Enterprise | 2000 |

### 18.4 Cost control

```typescript
// Per-request cost tracking
interface AICostEntry {
  tenantId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;                // USD
  timestamp: number;
}

// Monthly cost cap per tenant (configurable per plan)
// Exceeded → requests rejected with AI_QUOTA_EXCEEDED error
```

---

## 19. Observability & Evaluation

### 19.1 Metrics

```
kitsy_mind_requests_total{agent, model, tenant}           # Counter
kitsy_mind_latency_ms{agent, model}                        # Histogram
kitsy_mind_tokens_input{agent, model}                      # Counter
kitsy_mind_tokens_output{agent, model}                     # Counter
kitsy_mind_validation_pass_rate{agent}                     # Gauge (0-1)
kitsy_mind_autofix_rate{agent}                             # Gauge (0-1)
kitsy_mind_retry_rate{agent}                               # Gauge (0-1)
kitsy_mind_cost_usd{model, tenant}                         # Counter
```

### 19.2 Quality evaluation

```typescript
// Every AI output is logged for quality evaluation
interface AIEvalEntry {
  requestId: string;
  agent: string;
  prompt: string;
  output: unknown;
  validationResult: PipelineResult;
  autoFixesApplied: string[];
  retries: number;
  userAccepted: boolean;                // Did user click "Apply"?
  userModified: boolean;                // Did user modify AI output before applying?
  latencyMs: number;
  cost: number;
}

// Aggregate quality metrics:
// - Acceptance rate: % of AI outputs user accepted
// - First-pass rate: % that passed validation without auto-fix or retry
// - Modification rate: % that user modified after accepting
// - Retry rate: % that required LLM retry
```

---

## 20. Implementation Sequence

### 20.1 Sprint plan (2-week sprints)

| Sprint | Deliverables |
|--------|-------------|
| **S1** | LLM Gateway: Anthropic provider, retry policy, token counting |
| **S2** | Prompt Engine: template loading, context assembly, schema serialization, catalog serialization |
| **S3** | Validation Pipeline: 7-step validation (reuse `@kitsy/blu-validate`), auto-fix engine |
| **S4** | ConfigGeneratorAgent: full site generation, few-shot selection |
| **S5** | Bus integration: effect handlers for `ai:generate-site`, channels ask/answer |
| **S6** | SectionEditorAgent: edit, add, remove sections with JSON Patch output |
| **S7** | ThemeAdvisorAgent + ContentWriterAgent |
| **S8** | FormBuilderAgent |
| **S9** | Conversation Manager: multi-turn state, intent detection |
| **S10** | `@kitsy/prompts`: all templates, full few-shot example library (7 examples) |
| **S11** | OpenAI provider + LiteLLM provider, provider fallback chain |
| **S12** | Guardrails: prompt safety, output safety, rate limiting, cost tracking |
| **S13** | Observability: request logging, quality metrics, cost dashboards |
| **S14** | Evaluation: automated quality benchmarks against example library |

### 20.2 Dependencies

| Dependency | Required From | Required By Sprint |
|-----------|--------------|-------------------|
| `@kitsy/blu-validate` | Blu Phase 1 | S3 |
| `@kitsy/blu-types` (JSON Schema) | Blu Phase 0 | S2 |
| Component registry + ComponentMeta | Blu Phase 0 + Component Spec | S2 |
| `@kitsy/server` (bus effects) | Server Phase 2 | S5 |
| `@kitsy/canvas` (tree operations) | Studio Phase 3 | S6 |

**Parallelization:** S1-S4 can be built standalone with unit tests. S5 requires the server bus. S6 requires `@kitsy/canvas` for tree manipulation (but canvas can be developed in parallel as it has no UI dependency).
