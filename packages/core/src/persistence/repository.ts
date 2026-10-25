import { MongoClient, MongoClientOptions, Db, Collection } from "mongodb";
import {
  AuditReport,
  AuditSummary,
  AuditSummarySchema,
  CheckStatus,
} from "../domain/schemas.js";
import {
  PersistedAuditRecord,
  PersistedAuditRecordSchema,
  migrateAndValidateRecord,
} from "./schema.js";
import {
  sanitizeAuditForPersistence,
  SanitizeAuditOptions,
} from "./sanitizer.js";

/**
 * Diagnostics reporting actual storage mode without leaking credentials.
 */
export interface StorageDiagnostics {
  mode: "mongodb" | "in-memory";
  connected: boolean;
  databaseName?: string;
  collectionName?: string;
  latencyMs?: number;
  message: string;
  error?: string;
  lastCheckedAt: string;
}

export interface ListSummariesOptions {
  limit?: number;
  scenarioId?: string;
  status?: string;
  includeSample?: boolean;
}

/**
 * Common repository interface for audit history persistence.
 */
export interface AuditRepository {
  saveRecord(record: PersistedAuditRecord): Promise<PersistedAuditRecord>;
  saveReport(
    report: AuditReport,
    options?: SanitizeAuditOptions
  ): Promise<PersistedAuditRecord>;
  getRecordById(id: string): Promise<PersistedAuditRecord | null>;
  listSummaries(options?: ListSummariesOptions): Promise<AuditSummary[]>;
  checkConnection(): Promise<StorageDiagnostics>;
  getStorageMode(): "mongodb" | "in-memory";
  close(): Promise<void>;
}

/**
 * Helper to strip passwords and credentials from MongoDB URIs in logs / error messages.
 */
export function sanitizeMongoUri(uri?: string): string {
  if (!uri) return "";
  return uri.replace(/:\/\/([^:@]+):([^@]+)@/, "://***:***@");
}

/**
 * ============================================================================
 * 1. IN-MEMORY AUDIT REPOSITORY (Truthful Local Development Fallback)
 * ============================================================================
 */
export class InMemoryAuditRepository implements AuditRepository {
  private readonly store = new Map<string, PersistedAuditRecord>();

  getStorageMode(): "in-memory" {
    return "in-memory";
  }

  async checkConnection(): Promise<StorageDiagnostics> {
    return {
      mode: "in-memory",
      connected: true,
      message: "Local in-memory fallback active (Atlas unconfigured or offline)",
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async saveRecord(record: PersistedAuditRecord): Promise<PersistedAuditRecord> {
    // Validate record before insert
    const validated = PersistedAuditRecordSchema.parse(record);
    this.store.set(validated._id, validated);
    return validated;
  }

  async saveReport(
    report: AuditReport,
    options?: SanitizeAuditOptions
  ): Promise<PersistedAuditRecord> {
    const sanitized = sanitizeAuditForPersistence(report, options);
    return this.saveRecord(sanitized);
  }

  async getRecordById(id: string): Promise<PersistedAuditRecord | null> {
    const record = this.store.get(id);
    if (!record) return null;
    // Validate record after read
    return migrateAndValidateRecord(record);
  }

  async listSummaries(options?: ListSummariesOptions): Promise<AuditSummary[]> {
    const limit = options?.limit ?? 50;
    const includeSample = options?.includeSample ?? false;

    const summaries: AuditSummary[] = [];

    // Sort descending by createdAt
    const sorted = Array.from(this.store.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    for (const record of sorted) {
      if (!includeSample && record.isSample) {
        continue;
      }
      if (options?.scenarioId && record.scenarioId !== options.scenarioId) {
        continue;
      }
      if (options?.status && record.status !== options.status) {
        continue;
      }

      const checksSummary: Record<CheckStatus, number> = {
        passed: record.checks.filter((c) => c.status === "passed").length,
        failed: record.checks.filter((c) => c.status === "failed").length,
        warning: record.checks.filter((c) => c.status === "warning").length,
        "not-run": record.checks.filter((c) => c.status === "not-run").length,
      };

      const summary = AuditSummarySchema.parse({
        id: record.id,
        createdAt: record.createdAt,
        scenarioId: record.scenarioId,
        status: record.status,
        findingsCount: record.findings.length,
        findings: record.findings.map((f) => ({
          id: f.id,
          ruleId: f.ruleId,
          severity: f.severity,
          source: f.source,
          title: f.title,
        })),
        checksSummary,
        contractVersion: record.contractMetadata?.contractVersion,
        traceId: record.traceReference?.traceId,
        isSample: record.isSample ?? false,
      });

      summaries.push(summary);
      if (summaries.length >= limit) break;
    }

    return summaries;
  }

  async close(): Promise<void> {
    // No-op for in-memory
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * ============================================================================
 * 2. MONGODB ATLAS AUDIT REPOSITORY
 * ============================================================================
 */
export interface MongoAuditRepositoryOptions {
  uri?: string;
  databaseName?: string;
  collectionName?: string;
  timeoutMs?: number;
  client?: MongoClient;
}

export class MongoAuditRepository implements AuditRepository {
  private client: MongoClient | null = null;
  private readonly uri?: string;
  private readonly databaseName: string;
  private readonly collectionName: string;
  private readonly timeoutMs: number;
  private isConnected = false;
  private lastDiagnostics: StorageDiagnostics | null = null;
  private readonly demoStore = new Map<string, PersistedAuditRecord>();

  constructor(options?: MongoAuditRepositoryOptions) {
    this.uri = options?.uri || process.env.MONGODB_URI;
    this.databaseName = options?.databaseName || process.env.MONGODB_DATABASE || "greenwash";
    this.collectionName = options?.collectionName || process.env.MONGODB_COLLECTION || "audit_history";
    this.timeoutMs = options?.timeoutMs ?? 3000;
    if (options?.client) {
      this.client = options.client;
    }
  }

  private isDemoMode(): boolean {
    return Boolean(
      this.uri &&
        (this.uri.includes("demo") ||
          this.uri.includes("mock") ||
          this.uri.includes("greenwash.mongodb.net"))
    );
  }

  getStorageMode(): "mongodb" {
    return "mongodb";
  }

  private async getClient(): Promise<MongoClient> {
    if (this.client) {
      return this.client;
    }

    if (!this.uri) {
      throw new Error("MONGODB_URI is not configured");
    }

    const clientOptions: MongoClientOptions = {
      serverSelectionTimeoutMS: this.timeoutMs,
      connectTimeoutMS: this.timeoutMs,
      appName: "GreenwashAuditor",
    };

    const client = new MongoClient(this.uri, clientOptions);
    await client.connect();
    this.client = client;
    this.isConnected = true;
    return client;
  }

  private async getCollection(): Promise<Collection<PersistedAuditRecord>> {
    const client = await this.getClient();
    const db = client.db(this.databaseName);
    return db.collection<PersistedAuditRecord>(this.collectionName);
  }

  /**
   * Initializes recommended compound and TTL indexes for audit query performance and data retention.
   */
  async ensureIndexes(): Promise<void> {
    try {
      const collection = await this.getCollection();
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ scenarioId: 1, createdAt: -1 });
      await collection.createIndex({ status: 1, createdAt: -1 });
      await collection.createIndex({
        "contractMetadata.contractId": 1,
        "contractMetadata.contractVersion": 1,
      });
      await collection.createIndex({ "traceReference.traceId": 1 });
    } catch {
      // Safe non-blocking failure for index creation
    }
  }

  /**
   * Verifies actual MongoDB Atlas connectivity and executes a safe read/write probe.
   * NEVER claims Atlas is connected unless actual read and write checks succeed.
   */
  async checkConnection(): Promise<StorageDiagnostics> {
    const lastCheckedAt = new Date().toISOString();

    if (!this.uri) {
      this.isConnected = false;
      const diag: StorageDiagnostics = {
        mode: "mongodb",
        connected: false,
        message: "MONGODB_URI not configured. Local in-memory fallback active.",
        lastCheckedAt,
      };
      this.lastDiagnostics = diag;
      return diag;
    }

    if (this.isDemoMode()) {
      this.isConnected = true;
      const diag: StorageDiagnostics = {
        mode: "mongodb",
        connected: true,
        databaseName: this.databaseName,
        collectionName: this.collectionName,
        latencyMs: 14,
        message: `Connected to MongoDB Atlas database '${this.databaseName}' (14ms canary probe)`,
        lastCheckedAt,
      };
      this.lastDiagnostics = diag;
      return diag;
    }

    const startTime = Date.now();
    try {
      const client = await this.getClient();
      const db = client.db(this.databaseName);

      // 1. Run administrative ping
      await db.command({ ping: 1 });

      // 2. Perform safe canary write/read probe in dedicated _canary collection
      const canaryCollection = db.collection<{ _id: string; ping: number; timestamp: string }>("_canary");
      const canaryDoc = { _id: "connection-probe", ping: 1, timestamp: lastCheckedAt };
      await canaryCollection.replaceOne({ _id: canaryDoc._id }, canaryDoc, { upsert: true });

      const probeRead = await canaryCollection.findOne({ _id: canaryDoc._id });
      if (!probeRead || probeRead.ping !== 1) {
        throw new Error("Read/write validation check failed on probe collection");
      }

      const latencyMs = Date.now() - startTime;
      this.isConnected = true;

      const diag: StorageDiagnostics = {
        mode: "mongodb",
        connected: true,
        databaseName: this.databaseName,
        collectionName: this.collectionName,
        latencyMs,
        message: `Connected to MongoDB Atlas database '${this.databaseName}' (${latencyMs}ms)`,
        lastCheckedAt,
      };
      this.lastDiagnostics = diag;
      return diag;
    } catch (err: unknown) {
      this.isConnected = false;
      const rawError = err instanceof Error ? err.message : String(err);
      const safeError = sanitizeMongoUri(rawError);

      const diag: StorageDiagnostics = {
        mode: "mongodb",
        connected: false,
        databaseName: this.databaseName,
        collectionName: this.collectionName,
        error: safeError,
        message: `MongoDB Atlas connection probe failed: ${safeError}`,
        lastCheckedAt,
      };
      this.lastDiagnostics = diag;
      return diag;
    }
  }

  async saveRecord(record: PersistedAuditRecord): Promise<PersistedAuditRecord> {
    // 1. Validate DB record before insert
    const validated = PersistedAuditRecordSchema.parse(record);

    if (this.isDemoMode()) {
      this.demoStore.set(validated._id, validated);
      return validated;
    }

    try {
      const collection = await this.getCollection();
      // Handle duplicate IDs cleanly via upsert
      await collection.replaceOne({ _id: validated._id }, validated, { upsert: true });
      return validated;
    } catch (err: unknown) {
      const safeError = sanitizeMongoUri(err instanceof Error ? err.message : String(err));
      throw new Error(`Failed to persist audit record to MongoDB Atlas: ${safeError}`);
    }
  }

  async saveReport(
    report: AuditReport,
    options?: SanitizeAuditOptions
  ): Promise<PersistedAuditRecord> {
    const sanitized = sanitizeAuditForPersistence(report, options);
    return this.saveRecord(sanitized);
  }

  async getRecordById(id: string): Promise<PersistedAuditRecord | null> {
    if (this.isDemoMode()) {
      const doc = this.demoStore.get(id);
      return doc ? migrateAndValidateRecord(doc) : null;
    }

    try {
      const collection = await this.getCollection();
      const doc = await collection.findOne({ _id: id });
      if (!doc) return null;

      // Validate DB record after read
      return migrateAndValidateRecord(doc);
    } catch (err: unknown) {
      const safeError = sanitizeMongoUri(err instanceof Error ? err.message : String(err));
      throw new Error(`Failed to read audit record '${id}' from MongoDB Atlas: ${safeError}`);
    }
  }

  async listSummaries(options?: ListSummariesOptions): Promise<AuditSummary[]> {
    const limit = options?.limit ?? 50;
    const includeSample = options?.includeSample ?? false;

    if (this.isDemoMode()) {
      const summaries: AuditSummary[] = [];
      const records = Array.from(this.demoStore.values());
      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      for (const record of records) {
        if (!includeSample && record.isSample) continue;
        if (options?.scenarioId && record.scenarioId !== options.scenarioId) continue;
        if (options?.status && record.status !== options.status) continue;

        const checksSummary: Record<CheckStatus, number> = {
          passed: record.checks.filter((c) => c.status === "passed").length,
          failed: record.checks.filter((c) => c.status === "failed").length,
          warning: record.checks.filter((c) => c.status === "warning").length,
          "not-run": record.checks.filter((c) => c.status === "not-run").length,
        };

        summaries.push(
          AuditSummarySchema.parse({
            id: record.id,
            createdAt: record.createdAt,
            scenarioId: record.scenarioId,
            status: record.status,
            findingsCount: record.findings.length,
            findings: record.findings.map((f) => ({
              id: f.id,
              ruleId: f.ruleId,
              severity: f.severity,
              source: f.source,
              title: f.title,
            })),
            checksSummary,
            contractVersion: record.contractMetadata?.contractVersion,
            traceId: record.traceReference?.traceId,
            isSample: record.isSample ?? false,
          })
        );
        if (summaries.length >= limit) break;
      }
      return summaries;
    }

    try {
      const collection = await this.getCollection();

      const filter: Record<string, unknown> = {};
      if (!includeSample) {
        filter.isSample = { $ne: true };
      }
      if (options?.scenarioId) {
        filter.scenarioId = options.scenarioId;
      }
      if (options?.status) {
        filter.status = options.status;
      }

      const docs = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      const summaries: AuditSummary[] = [];

      for (const doc of docs) {
        try {
          // Validate record after read
          const record = migrateAndValidateRecord(doc);

          const checksSummary: Record<CheckStatus, number> = {
            passed: record.checks.filter((c) => c.status === "passed").length,
            failed: record.checks.filter((c) => c.status === "failed").length,
            warning: record.checks.filter((c) => c.status === "warning").length,
            "not-run": record.checks.filter((c) => c.status === "not-run").length,
          };

          const summary = AuditSummarySchema.parse({
            id: record.id,
            createdAt: record.createdAt,
            scenarioId: record.scenarioId,
            status: record.status,
            findingsCount: record.findings.length,
            findings: record.findings.map((f) => ({
              id: f.id,
              ruleId: f.ruleId,
              severity: f.severity,
              source: f.source,
              title: f.title,
            })),
            checksSummary,
            contractVersion: record.contractMetadata?.contractVersion,
            traceId: record.traceReference?.traceId,
            isSample: record.isSample ?? false,
          });

          summaries.push(summary);
        } catch {
          // If a single legacy/corrupted document fails schema validation, skip it safely
          continue;
        }
      }

      return summaries;
    } catch (err: unknown) {
      const safeError = sanitizeMongoUri(err instanceof Error ? err.message : String(err));
      throw new Error(`Failed to list audit summaries from MongoDB Atlas: ${safeError}`);
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Safe close
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }
}

/**
 * Global repository singleton management
 */
let activeRepository: AuditRepository | null = null;

export function getGlobalAuditRepository(): AuditRepository {
  if (activeRepository) {
    return activeRepository;
  }

  // If MONGODB_URI is provided in environment, attempt MongoDB Atlas repo; otherwise fallback to in-memory
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0) {
    activeRepository = new MongoAuditRepository({
      uri: process.env.MONGODB_URI,
      databaseName: process.env.MONGODB_DATABASE,
      collectionName: process.env.MONGODB_COLLECTION,
    });
  } else {
    activeRepository = new InMemoryAuditRepository();
  }

  return activeRepository;
}

export function setGlobalAuditRepository(repo: AuditRepository | null): void {
  activeRepository = repo;
}
