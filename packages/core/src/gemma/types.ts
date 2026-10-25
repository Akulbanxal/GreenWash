import { z } from "zod";

/**
 * Minimum relevant context sent to Gemma reviewer
 */
export const GemmaReviewRequestSchema = z.object({
  ruleId: z.string().min(1),
  ruleDescription: z.string().min(1),
  filePath: z.string().min(1),
  diffSnippet: z.string().min(1),
  assertionContext: z.string().optional(),
});
export type GemmaReviewRequest = z.infer<typeof GemmaReviewRequestSchema>;

/**
 * Strict schema for Gemma semantic review response
 */
export const GemmaSuggestedEdgeCaseSchema = z.object({
  description: z.string().min(1),
  sampleInput: z.unknown().optional(),
  suggestedCheck: z.string().min(1),
});
export type GemmaSuggestedEdgeCase = z.infer<typeof GemmaSuggestedEdgeCaseSchema>;

export const GemmaReviewResponseSchema = z.object({
  explanation: z.string().min(1),
  weakeningAnalysis: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]),
  suggestedEdgeCases: z.array(GemmaSuggestedEdgeCaseSchema).default([]),
  runtime: z.string().optional(),
  model: z.string().optional(),
});
export type GemmaReviewResponse = z.infer<typeof GemmaReviewResponseSchema>;

export interface GemmaProviderOptions {
  endpoint?: string;
  modelName?: string;
  timeoutMs?: number;
  apiKey?: string;
}

export interface GemmaReviewResult {
  success: boolean;
  modelName?: string;
  runtime?: string;
  response?: GemmaReviewResponse;
  error?: string;
  latencyMs?: number;
}
