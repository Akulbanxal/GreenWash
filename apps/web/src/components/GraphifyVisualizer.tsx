import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Share2,
  AlertTriangle,
  Download,
  Layers,
  RefreshCw,
  Box,
  Cpu,
  FileCode,
  ShieldCheck,
  Flame,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Activity,
  ChevronRight,
  Filter,
} from "lucide-react";
import { GraphifyGraph, GraphifyNode, GraphifyEdge } from "@greenwash/core/dist/browser.js";

interface GraphifyVisualizerProps {
  selectedScenarioId: string;
}

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function GraphifyVisualizer({ selectedScenarioId }: GraphifyVisualizerProps) {
  const [graph, setGraph] = useState<GraphifyGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightBlastRadius, setHighlightBlastRadius] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fetch Graphify data from API
  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/graphify/${selectedScenarioId}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: GraphifyGraph = await res.json();
      setGraph(data);
      if (data.nodes.length > 0) {
        setSelectedNodeId(data.nodes[0].id);
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

  // Initial intelligent topological layout positions based on node types
  const initialPositions = useMemo(() => {
    if (!graph) return {};
    const pos: Record<string, NodePosition> = {};
    const width = 850;
    const height = 480;

    // Group nodes by community/layer
    const layerX: Record<string, number> = {
      SOURCE_MODULE: 120,
      FUNCTION: 360,
      BEHAVIOR_CONTRACT: 640,
      TEST_SUITE: 200,
      TEST_CASE: 460,
      AGENT_SESSION: 720,
      CI_WORKFLOW: 280,
    };

    const typeCounts: Record<string, number> = {};
    graph.nodes.forEach((node) => {
      typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    });

    const typeIndices: Record<string, number> = {};
    graph.nodes.forEach((node) => {
      const idx = typeIndices[node.type] || 0;
      typeIndices[node.type] = idx + 1;
      const count = typeCounts[node.type] || 1;

      const baseX = layerX[node.type] || width / 2;
      const spacingY = height / (count + 1);
      const baseY = spacingY * (idx + 1);

      pos[node.id] = {
        x: baseX + (Math.sin(idx * 2) * 20),
        y: baseY,
        vx: 0,
        vy: 0,
      };
    });

    return pos;
  }, [graph]);

  const [positions, setPositions] = useState<Record<string, NodePosition>>({});

  useEffect(() => {
    if (initialPositions && Object.keys(initialPositions).length > 0) {
      setPositions(initialPositions);
    }
  }, [initialPositions]);

  // Selected node details
  const selectedNode = useMemo(() => {
    return graph?.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graph, selectedNodeId]);

  // Blast-radius highlighted nodes set
  const blastRadiusNodeIds = useMemo(() => {
    if (!graph || !highlightBlastRadius) return new Set<string>();
    const ids = new Set<string>();
    graph.nodes.forEach((n) => {
      if (n.status === "tampered" || n.status === "violated") {
        ids.add(n.id);
      }
    });
    graph.blastRadius.affectedFunctions.forEach((id) => ids.add(id));
    graph.blastRadius.affectedContracts.forEach((id) => ids.add(id));
    graph.blastRadius.affectedSuites.forEach((id) => ids.add(id));
    return ids;
  }, [graph, highlightBlastRadius]);

  // Canvas pan / drag handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === "svg") {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (draggedNodeId && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const newX = (e.clientX - rect.left - pan.x) / zoom;
      const newY = (e.clientY - rect.top - pan.y) / zoom;
      setPositions((prev) => ({
        ...prev,
        [draggedNodeId]: { ...prev[draggedNodeId], x: newX, y: newY },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggedNodeId(null);
  };

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

  const getNodeColor = (node: GraphifyNode) => {
    if (node.status === "tampered") return { fill: "#f43f5e", stroke: "#fb7185", glow: "rgba(244,63,94,0.4)" };
    if (node.status === "violated") return { fill: "#f59e0b", stroke: "#fbbf24", glow: "rgba(245,158,11,0.4)" };
    if (node.type === "BEHAVIOR_CONTRACT") return { fill: "#10b981", stroke: "#34d399", glow: "rgba(16,185,129,0.4)" };
    if (node.type === "FUNCTION") return { fill: "#06b6d4", stroke: "#22d3ee", glow: "rgba(6,182,212,0.4)" };
    return { fill: "#3b82f6", stroke: "#60a5fa", glow: "rgba(59,130,246,0.3)" };
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" /> Graphify Knowledge Graph
              </span>
              <span className="text-xs text-slate-400 font-mono">AST Directed Topology</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
              Architectural Code Graph & Blast-Radius Network
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Interactive force-directed graph mapping code declarations, test assertions, and immutable contracts. Drag nodes, trace relationship edges, and observe the downstream blast radius when assertions are tampered.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setHighlightBlastRadius(!highlightBlastRadius)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors ${
                highlightBlastRadius
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              {highlightBlastRadius ? "Blast Radius: ON" : "Blast Radius: OFF"}
            </button>

            <button
              onClick={fetchGraph}
              disabled={loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Re-Layout
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
            <div className="text-xs text-slate-500 mt-0.5">AST components & invariants</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-indigo-400" /> Dependency Edges
            </div>
            <div className="text-2xl font-bold text-white mt-1">{graph.summary.totalEdges}</div>
            <div className="text-xs text-slate-500 mt-0.5">Imports, calls & assertions</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Tampered Nodes
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{graph.summary.tamperedNodes}</div>
            <div className="text-xs text-slate-500 mt-0.5">Weakened by AI agent</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" /> Blast Radius Count
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{graph.summary.blastRadiusCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Cascading compromised assets</div>
          </div>
        </div>
      )}

      {/* Visual Force-Directed Graph Canvas */}
      {graph && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl relative overflow-hidden flex flex-col min-h-[550px]">
            {/* Canvas Toolbar */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Interactive Graphify Canvas (Drag nodes or pan canvas)</span>
            </div>

            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
                title="Reset View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* SVG Canvas */}
            <svg
              ref={svgRef}
              className="w-full h-full flex-1 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ minHeight: "520px" }}
            >
              {/* SVG Definitions (Arrowheads and Gradients) */}
              <defs>
                <marker
                  id="arrow-normal"
                  viewBox="0 0 10 10"
                  refX="25"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
                </marker>
                <marker
                  id="arrow-tampered"
                  viewBox="0 0 10 10"
                  refX="25"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                </marker>
                <marker
                  id="arrow-invariant"
                  viewBox="0 0 10 10"
                  refX="25"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                </marker>
                <radialGradient id="tamper-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </radialGradient>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Background grid */}
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="#1e293b" />
                </pattern>
                <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#grid)" />

                {/* Edges */}
                {graph.edges.map((edge) => {
                  const src = positions[edge.source];
                  const tgt = positions[edge.target];
                  if (!src || !tgt) return null;

                  const isTamperedPath =
                    blastRadiusNodeIds.has(edge.source) && blastRadiusNodeIds.has(edge.target);
                  const isInvariantPath = edge.relation === "VERIFIES_INVARIANT";

                  const strokeColor = isTamperedPath
                    ? "#f43f5e"
                    : isInvariantPath
                    ? "#10b981"
                    : "#334155";
                  const strokeWidth = isTamperedPath ? 2.5 : isInvariantPath ? 2 : 1.5;
                  const strokeDash = isTamperedPath ? "5,3" : undefined;
                  const markerId = isTamperedPath
                    ? "url(#arrow-tampered)"
                    : isInvariantPath
                    ? "url(#arrow-invariant)"
                    : "url(#arrow-normal)";

                  const midX = (src.x + tgt.x) / 2;
                  const midY = (src.y + tgt.y) / 2;

                  return (
                    <g key={edge.id} className="transition-opacity duration-300">
                      <line
                        x1={src.x}
                        y1={src.y}
                        x2={tgt.x}
                        y2={tgt.y}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDash}
                        markerEnd={markerId}
                        opacity={highlightBlastRadius && !isTamperedPath ? 0.35 : 0.85}
                      />
                      {/* Edge Label */}
                      <rect
                        x={midX - 35}
                        y={midY - 9}
                        width="70"
                        height="16"
                        rx="4"
                        fill="#090d16"
                        stroke={strokeColor}
                        strokeWidth="1"
                        opacity={highlightBlastRadius && !isTamperedPath ? 0.3 : 0.9}
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        textAnchor="middle"
                        fill={isTamperedPath ? "#fca5a5" : "#94a3b8"}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="600"
                        opacity={highlightBlastRadius && !isTamperedPath ? 0.4 : 1}
                      >
                        {edge.relation}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {graph.nodes.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;

                  const isSelected = selectedNodeId === node.id;
                  const isBlast = blastRadiusNodeIds.has(node.id);
                  const { fill, stroke, glow } = getNodeColor(node);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggedNodeId(node.id);
                      }}
                    >
                      {/* Tampering ripple pulse */}
                      {node.status === "tampered" && (
                        <circle
                          r="32"
                          fill="url(#tamper-glow)"
                          className="animate-ping opacity-30 pointer-events-none"
                        />
                      )}

                      {/* Selection halo */}
                      {isSelected && (
                        <circle
                          r="26"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          strokeDasharray="4,2"
                          className="animate-spin pointer-events-none"
                          style={{ animationDuration: "12s" }}
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r="20"
                        fill="#0f172a"
                        stroke={stroke}
                        strokeWidth={isSelected ? 3 : 2}
                        filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                        opacity={highlightBlastRadius && !isBlast ? 0.4 : 1}
                      />

                      {/* Inner community colored pip */}
                      <circle
                        r="7"
                        fill={fill}
                        opacity={highlightBlastRadius && !isBlast ? 0.4 : 1}
                      />

                      {/* Node Label Text */}
                      <text
                        y="32"
                        textAnchor="middle"
                        fill={isSelected ? "#38bdf8" : "#f1f5f9"}
                        fontSize="11"
                        fontWeight={isSelected ? "bold" : "500"}
                        fontFamily="sans-serif"
                        className="pointer-events-none drop-shadow"
                        opacity={highlightBlastRadius && !isBlast ? 0.4 : 1}
                      >
                        {node.name.length > 22 ? node.name.slice(0, 20) + "…" : node.name}
                      </text>

                      {/* Node Type Badge */}
                      <text
                        y="44"
                        textAnchor="middle"
                        fill={node.status === "tampered" ? "#f43f5e" : "#64748b"}
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                        className="pointer-events-none"
                        opacity={highlightBlastRadius && !isBlast ? 0.4 : 1}
                      >
                        {node.status === "tampered" ? "🚨 TAMPERED" : node.type}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Bottom Legend */}
            <div className="bg-slate-900/90 border-t border-slate-800 p-3 px-4 flex items-center justify-between gap-4 text-xs flex-wrap">
              <div className="flex items-center gap-4 text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm"></span> Tampered / Compromised
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Violated Contract
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Intact Invariant
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span> Business Function
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Click any node to inspect architectural metadata
              </span>
            </div>
          </div>

          {/* Right Pane: Selected Node Inspector & Blast Details */}
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
                    <div className="text-slate-100 font-medium text-sm">{selectedNode.name}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">File Path:</div>
                    <div className="font-mono text-slate-300 break-all">{selectedNode.filePath}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-slate-400">Node Type:</div>
                      <div className="font-mono text-indigo-400 font-semibold">{selectedNode.type}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Status:</div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          selectedNode.status === "tampered"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : selectedNode.status === "violated"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {selectedNode.status}
                      </span>
                    </div>
                  </div>

                  {selectedNode.metadata && (
                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-slate-400 mb-1">Node Metadata:</div>
                      <pre className="p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-800">
                        {JSON.stringify(selectedNode.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Select a node in the graph to inspect</div>
              )}
            </div>

            {/* Blast-Radius Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                Blast-Radius Cascade
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <span className="font-semibold">Tampering Root Vector: </span>
                  <div className="font-mono text-sm mt-0.5">{graph.blastRadius.sourceTamperingId}</div>
                </div>

                <div>
                  <div className="text-slate-400 mb-1">Downstream Compromised Functions:</div>
                  {graph.blastRadius.affectedFunctions.length > 0 ? (
                    graph.blastRadius.affectedFunctions.map((f) => (
                      <div key={f} className="font-mono text-rose-400 bg-slate-950 px-2 py-1 rounded mb-1 border border-rose-500/20 flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3" /> {f}
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
                      <div key={c} className="font-mono text-amber-400 bg-slate-950 px-2 py-1 rounded mb-1 border border-amber-500/20 flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3" /> {c}
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
