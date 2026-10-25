# Gemma Semantic Reviewer: Local Setup & Security Guardrails

Greenwash integrates open-weight **Gemma** models (e.g., `gemma:2b`, `gemma:7b`, `gemma2:2b`) as an advisory semantic reviewer to explain why code changes weaken assertions or contracts and to propose candidate edge cases for human review.

---

## 1. Safety & Authority Guarantees

Greenwash enforces strict boundaries around model outputs:

1. **Deterministic Authority**:
   - The model has **zero authority** over the deterministic audit verdict.
   - It cannot downgrade or override a deterministic `BLOCKED` finding, modify an approved behavior contract, or turn a failing audit into a `PASS`.
   - Model-assisted findings can only yield `REVIEW` recommendations.

2. **Untrusted Model Output**:
   - Model responses are validated against a strict Zod schema (`GemmaReviewResponseSchema`).
   - Candidate edge cases and test cases proposed by Gemma are **never executed automatically**.
   - Edge cases require human engineer review and a trusted expected outcome before they can be added to a contract.

3. **No Paid Proprietary Key Requirement**:
   - Designed for local, open-weight execution via Ollama or self-hosted inference servers.
   - No paid OpenAI/Anthropic API keys are required for full system functionality.

4. **Honest Status & Telemetry**:
   - Greenwash never claims a model is running unless a live inference or health-check call succeeds.
   - If `GEMMA_ENDPOINT` is unconfigured, the UI displays `Not configured` and all deterministic audits remain 100% operational.
   - Only genuine model identifiers, runtimes, and real network latencies returned by the provider are shown.

5. **Diff Minimization & Secret Redaction**:
   - Only the minimal relevant diff hunk and assertion context are sent to the model.
   - Automatic regex filters scrub sensitive tokens (API keys, GitHub PATs, JWTs, AWS credentials) before the prompt is formatted.
   - Raw diffs are quarantined inside `<diff_to_review>` XML tags with explicit instructions neutralizing adversarial prompt injection attempts.

---

## 2. Local Setup Guide (Ollama)

### Step 1: Install & Start Ollama
Download and install Ollama from [ollama.ai](https://ollama.ai):
```bash
# Verify Ollama is running
ollama --version
```

### Step 2: Pull an Open-Weight Gemma Model
```bash
# Fast, lightweight model (recommended for local development)
ollama run gemma:2b

# Or higher-parameter model
ollama run gemma:7b
```

### Step 3: Configure Greenwash
Set the endpoint in your `.env` file or export environment variables:
```bash
# Standard local Ollama endpoint
export GEMMA_ENDPOINT="http://localhost:11434"
export GEMMA_MODEL="gemma:2b"
```

### Step 4: Verify Connection
You can verify the connection in two ways:
1. **Via UI**: Navigate to **Integrations & Environment** in the Greenwash web app and click **Test Connection** on the Gemma card.
2. **Via API**:
   ```bash
   curl http://localhost:3001/api/gemma/check
   ```
   Expected response:
   ```json
   {
     "configured": true,
     "connected": true,
     "model": "gemma:2b",
     "runtime": "Ollama / Local (35ms)",
     "latencyMs": 35,
     "message": "Successfully connected to Gemma inference endpoint (35ms)."
   }
   ```

---

## 3. Alternative OpenAI-Compatible Endpoints

Greenwash also supports OpenAI-compatible open-weight inference routes (LocalAI, vLLM, LM Studio, Text Generation WebUI):
```bash
export GEMMA_ENDPOINT="http://localhost:8000/v1/chat/completions"
export GEMMA_MODEL="google/gemma-2-2b-it"
```

---

## 4. Model Limitations

1. **Context Window & Truncation**:
   - Local Gemma models (especially 2B parameters) operate best on focused single-function diffs (< 100 lines). Greenwash minimizes input diffs to prevent hallucination.
2. **Non-Determinism**:
   - Unlike AST diff scanners and containerized contract replays, semantic model reviews are stochastic. They serve exclusively as developer aids, not compliance proofs.
3. **Prompt Injection Susceptibility**:
   - While Greenwash neutralizes instructions inside diffs with system boundaries, raw code diffs may attempt jailbreaking. Model recommendations must always be audited by humans.
4. **Offline Resilience**:
   - When offline or unconfigured, Greenwash degrades gracefully. Core AST diff rules and replay verification operate without network access.
