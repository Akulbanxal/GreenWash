import React, { useEffect, useState } from "react";
import { Share2, AlertTriangle, ShieldCheck, Download, Layers, ArrowRight, RefreshCw, Box, Database, Cpu } from "lucide-react";
import { GraphifyGraph, GraphifyNode } from "@greenwash/core/dist/browser.js";

interface GraphifyVisualizerProps {
  selectedScenarioId: string;
}

export function GraphifyVisualizer({ selectedScenarioId }: GraphifyVisualizerProps) {
  const [graph, setGraph] = useState<GraphifyGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphifyNode | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/graphify/${selectedScenarioId}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: GraphifyGraph = await res.json();
      setGraph(data);
      if (data.nodes.length > 0) {
        setSelectedNode(data.nodes[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load Graphify knowledge graph: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [selectedScenarioId]);

  const downloadJson = () => {
    if (!graph) return;
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graphify-${selectedScenarioId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Graphify Integration
              </span>
              <span className="text-xs text-slate-400 font-mono">AST Knowledge Graph & Blast Radius</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
              <Share2 className="w-6 h-6 text-emerald-400" />
              Graphify Codebase Knowledge Graph
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Maps project source files, unit tests, and immutable contracts into a deterministic knowledge graph. Traces how agent assertion tampering cascades downstream across the architectural blast radius.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchGraph}
              disabled={loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Re-Graphify
            </button>
            <button
              onClick={downloadJson}
              disabled={!graph}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export graph.json
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary Metrics */}
      {graph && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Box className="w-4 h-4 text-sky-400" /> Total Graph Nodes
            </div>
            <div className="text-2xl font-bold text-white mt-1">{graph.summary.totalNodes}</div>
            <div className="text-xs text-slate-500 mt-0.5">AST components & tests</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-indigo-400" /> Relationships
            </div>
            <div className="text-2xl font-bold text-white mt-1">{graph.summary.totalEdges}</div>
            <div className="text-xs text-slate-500 mt-0.5">Imports, calls, tests edges</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Tampered Nodes
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{graph.summary.tamperedNodes}</div>
            <div className="text-xs text-slate-500 mt-0.5">Compromised by AI agent</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" /> Blast Radius
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{graph.summary.blastRadiusCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Downstream affected assets</div>
          </div>
        </div>
      )}

      {/* Main 2-Pane Graph View */}
      {graph && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Pane: Interactive Nodes Explorer */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Graphify Architectural Nodes ({graph.nodes.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {graph.nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const statusBg =
                  node.status === "tampered"
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                    : node.status === "violated"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "ring-2 ring-emerald-400 border-emerald-500 bg-slate-800"
                        : "border-slate-800 bg-slate-950/60 hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-medium text-slate-200 truncate">
                        {node.name}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${statusBg}`}>
                        {node.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                      <span className="font-mono">{node.type}</span>
                      <span className="text-slate-500">{node.community}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Relationship Edges Preview */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Explicit Relationship Edges
              </h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {graph.edges.map((edge) => (
                  <div
                    key={edge.id}
                    className="flex items-center gap-2 text-xs font-mono bg-slate-950/80 px-3 py-1.5 rounded border border-slate-800/80 text-slate-300"
                  >
                    <span className="text-sky-300 truncate">{edge.source}</span>
                    <span className="text-emerald-400 text-[11px] shrink-0 flex items-center gap-1">
                      --[{edge.relation}]--&gt;
                    </span>
                    <span className="text-indigo-300 truncate">{edge.target}</span>
                    {edge.label && <span className="text-slate-500 text-[10px] ml-auto shrink-0">({edge.label})</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Pane: Node Details & Blast Radius */}
          <div className="space-y-6">
            {/* Selected Node Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Box className="w-4 h-4 text-sky-400" />
                Selected Node Inspector
              </h3>

              {selectedNode ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="text-slate-400">Node ID:</div>
                    <div className="font-mono text-emerald-400 break-all">{selectedNode.id}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Component Name:</div>
                    <div className="text-slate-100 font-medium">{selectedNode.name}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">File Path:</div>
                    <div className="font-mono text-slate-300">{selectedNode.filePath}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-slate-400">Node Type:</div>
                      <div className="font-mono text-indigo-400">{selectedNode.type}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Community:</div>
                      <div className="text-slate-300">{selectedNode.community}</div>
                    </div>
                  </div>

                  {selectedNode.metadata && (
                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-slate-400 mb-1">Metadata:</div>
                      <pre className="p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
                        {JSON.stringify(selectedNode.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Select a node to inspect relationships</div>
              )}
            </div>

            {/* Blast-Radius Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-400" />
                Graphify Blast-Radius Analysis
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <span className="font-semibold">Tampering Root: </span>
                  <span className="font-mono">{graph.blastRadius.sourceTamperingId}</span>
                </div>

                <div>
                  <div className="text-slate-400 mb-1">Downstream Compromised Functions:</div>
                  {graph.blastRadius.affectedFunctions.length > 0 ? (
                    graph.blastRadius.affectedFunctions.map((f) => (
                      <div key={f} className="font-mono text-rose-400 bg-slate-950 px-2 py-1 rounded mb-1">
                        {f}
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">None (0 affected)</span>
                  )}
                </div>

                <div>
                  <div className="text-slate-400 mb-1">Violated Invariant Contracts:</div>
                  {graph.blastRadius.affectedContracts.length > 0 ? (
                    graph.blastRadius.affectedContracts.map((c) => (
                      <div key={c} className="font-mono text-amber-400 bg-slate-950 px-2 py-1 rounded mb-1">
                        {c}
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">None (0 affected)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
