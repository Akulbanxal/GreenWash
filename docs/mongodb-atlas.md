# MongoDB Atlas Integration Guide

## Overview

Greenwash uses MongoDB Atlas to optionally persist sanitized audit summaries and contract-version metadata across sessions. The local deterministic audit and red-team lab work with zero configuration — Atlas persistence is purely additive.

> **Privacy Invariant**: Full source files, entire unified diffs, raw agent transcripts, and credentials are _never_ persisted. Only an explicit allow-list of fields is stored.

---

## Persisted Fields (Allow-List)

| Field | Description |
|---|---|
| `id` / `_id` | Audit UUID |
| `schemaVersion` | Schema migration version (current: 1) |
| `createdAt` | When the audit ran |
| `storedAt` | When the record was persisted |
| `scenarioId` | Scenario label (e.g. `weakened-assertion`) |
| `repositoryLabel` | Sanitized repo/ref label |
| `status` | `PASS`, `REVIEW`, or `BLOCKED` |
| `summary` | Short summary string (max 500 chars, secret-scrubbed) |
| `findings[].id/ruleId/title/summary/severity/source` | Sanitized finding metadata |
| `findings[].evidence[].redactedExcerpt` | Code excerpt capped at **200 chars**, secrets redacted |
| `checks[].id/label/status/durationMs` | Check results |
| `contractMetadata.contractId/contractVersion` | Contract version snapshot |
| `traceReference.traceId/spanId` | Sentry trace reference |
| `isSample` | Distinguishes fixture data from real audit history |

**Permanently Excluded:**
- Raw source files or entire file contents
- Full unified diffs
- Raw agent transcripts or conversation history
- Authentication tokens, API keys, passwords, private keys

---

## Setup

### 1. Create a MongoDB Atlas Cluster

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a new M0 (free tier) or M10+ cluster
3. Create a **Database User** with **Read and Write** to any database (or scope to `greenwash`)
4. Add your IP to the **Network Access** allowlist (or use `0.0.0.0/0` for development)

### 2. Configure the Connection String

Copy `.env.example` to `.env` and set:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
MONGODB_DATABASE=greenwash           # Optional (defaults to "greenwash")
MONGODB_COLLECTION=audit_history     # Optional (defaults to "audit_history")
```

**Never commit `.env` to version control.**

### 3. Smoke-Test Credentials

```bash
npm run greenwash -- test-mongo
```

This performs:
- A `ping` to the Atlas cluster
- A safe canary write/read probe on `_canary` collection
- Reports latency and connection state
- Masks all credentials in output

Expected output on success:
```
=======================================================
MONGODB ATLAS CREDENTIAL SMOKE-TEST
-------------------------------------------------------
Target URI:     mongodb+srv://***:***@cluster.mongodb.net
Database:       greenwash
Connecting and performing ping & safe read/write probe...
[PASS] Ping & Canary Probe Succeeded (43ms)
[PASS] Collection Ready: audit_history
Zero Secrets Exposed: Credentials masked in all diagnostics
=======================================================
```

---

## Index Strategy

Greenwash calls `ensureIndexes()` at startup when Atlas is connected. The following indexes are created automatically:

### Compound Query Indexes

```json
{ "createdAt": -1 }
```
→ Default sort: newest audit first.

```json
{ "scenarioId": 1, "createdAt": -1 }
```
→ Filter by scenario with time ordering.

```json
{ "status": 1, "createdAt": -1 }
```
→ Filter by audit result status.

```json
{ "contractMetadata.contractId": 1, "contractMetadata.contractVersion": 1 }
```
→ Look up audits by approved contract version.

```json
{ "traceReference.traceId": 1 }
```
→ Correlate audit records with Sentry traces.

### Data Retention (TTL Index)

To automatically expire old audit records, add a TTL index manually in Atlas:

```javascript
// Expire records older than 90 days (7776000 seconds)
db.audit_history.createIndex(
  { "storedAt": 1 },
  { expireAfterSeconds: 7776000 }
)
```

Adjust the TTL to match your retention policy. For compliance environments, consider 1–3 years.

---

## Storage Mode Transparency

The API always reports the actual storage mode without exposing credentials:

```json
GET /api/diagnostics/mongodb

{
  "mode": "in-memory",
  "connected": false,
  "message": "MONGODB_URI not configured. Local in-memory fallback active.",
  "lastCheckedAt": "2024-11-15T10:32:00.000Z"
}
```

```json
GET /api/diagnostics/mongodb  (with Atlas configured and connected)

{
  "mode": "mongodb",
  "connected": true,
  "databaseName": "greenwash",
  "collectionName": "audit_history",
  "latencyMs": 43,
  "message": "Connected to MongoDB Atlas database 'greenwash' (43ms)",
  "lastCheckedAt": "2024-11-15T10:32:00.000Z"
}
```

Connection strings are **never** included in API responses or logs.

---

## Schema Migration

All records include a `schemaVersion` field (current: `1`). The `migrateAndValidateRecord()` function handles missing optional fields for older records:

- `schemaVersion` defaults to `1`
- `storedAt` defaults to `createdAt` if missing
- `isSample` defaults to `false`

New schema fields should increment `CURRENT_PERSISTENCE_SCHEMA_VERSION` and add migration logic in `migrateAndValidateRecord()`.

---

## In-Memory Fallback

When `MONGODB_URI` is unset or the Atlas cluster is unreachable, Greenwash automatically uses `InMemoryAuditRepository`:

- All audit history is retained in application memory for the current session only
- History is lost on API server restart
- No credentials required
- API and UI accurately report `"Storage Mode: Ephemeral Memory (Atlas Unconnected)"`

The deterministic audit engine and local demo always work regardless of database configuration.

---

## Security Notes

- Use Atlas **Database Users** with minimum privilege: `readWrite` on the `greenwash` database only
- Enable Atlas **Network Access** IP allowlisting for production
- Rotate credentials immediately if exposed
- Prefer **AWS IAM / Azure AD / GCP Service Account** authentication for production Atlas clusters
- Never log, print, or API-return connection strings (enforced by `sanitizeMongoUri()`)
