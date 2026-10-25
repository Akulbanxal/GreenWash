export type GraphifyNodeType =
  | "SOURCE_MODULE"
  | "FUNCTION"
  | "TEST_SUITE"
  | "TEST_CASE"
  | "BEHAVIOR_CONTRACT"
  | "CI_WORKFLOW"
  | "AGENT_SESSION";

export interface GraphifyNode {
  id: string;
  name: string;
  type: GraphifyNodeType;
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  community: string;
  status: "intact" | "tampered" | "violated" | "verified";
  metadata?: Record<string, unknown>;
}

export interface GraphifyEdge {
  id: string;
  source: string;
  target: string;
  relation: "IMPORTS" | "DECLARES" | "TESTS" | "VERIFIES_INVARIANT" | "TAMPERED_BY" | "DEPENDS_ON";
  weight?: number;
  label?: string;
}

export interface GraphifyGraph {
  scenarioId?: string;
  generatedAt: string;
  nodes: GraphifyNode[];
  edges: GraphifyEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    tamperedNodes: number;
    communities: string[];
    blastRadiusCount: number;
  };
  blastRadius: {
    sourceTamperingId: string;
    affectedFunctions: string[];
    affectedContracts: string[];
    affectedSuites: string[];
  };
}
