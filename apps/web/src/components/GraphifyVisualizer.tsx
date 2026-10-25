import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Share2,
  AlertTriangle,
  Download,
  Layers,
  RefreshCw,
  Box,
  Flame,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Sparkles,
  ExternalLink,
  Compass,
} from "lucide-react";
import { GraphifyGraph, GraphifyNode, GraphifyEdge } from "@greenwash/core/dist/browser.js";

interface GraphifyVisualizerProps {
  selectedScenarioId: string;
}

interface NodePosition {
  x: number;
  y: number;
}

const CARD_WIDTH = 210;
const CARD_HEIGHT = 56;
const HALF_W = CARD_WIDTH / 2;
const HALF_H = CARD_HEIGHT / 2;

// 4 Architectural Column Centers for Topology mode
const COL_X = {
  CONTRACTS: 155, // Invariant Behavior Contracts
  CORE: 445,      // Source Modules & Business Functions
  TESTS: 735,     // Test Suites & Assertions
  TAMPERING: 1025 // Agent Tampering & Evasions
};

export function GraphifyVisualizer({ selectedScenarioId }: GraphifyVisualizerProps) {
  const [viewMode, setViewMode] = useState<"galaxy" | "topology">("galaxy");
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

  // Clean, spacious 4-tier architectural layout with zero overlap
  const initialPositions = useMemo(() => {
    if (!graph) return {};
    const pos: Record<string, NodePosition> = {};

    // Group nodes into the 4 architectural columns
    const col0: GraphifyNode[] = []; // Invariant Contracts
    const col1: GraphifyNode[] = []; // Source Modules & Business Logic
    const col2: GraphifyNode[] = []; // Test Suites & Assertions
    const col3: GraphifyNode[] = []; // Agent Tampering & Evasions

    graph.nodes.forEach((node) => {
      if (node.type === "BEHAVIOR_CONTRACT") {
        col0.push(node);
      } else if (node.type === "SOURCE_MODULE" || node.type === "FUNCTION") {
        col1.push(node);
      } else if (node.type === "TEST_SUITE" || node.type === "TEST_CASE") {
        col2.push(node);
      } else {
        col3.push(node);
      }
    });

    const assignY = (nodes: GraphifyNode[], colX: number) => {
      if (nodes.length === 1) {
        pos[nodes[0].id] = { x: colX, y: 310 };
      } else if (nodes.length === 2) {
        pos[nodes[0].id] = { x: colX, y: 190 };
        pos[nodes[1].id] = { x: colX, y: 430 };
      } else if (nodes.length === 3) {
        pos[nodes[0].id] = { x: colX, y: 140 };
        pos[nodes[1].id] = { x: colX, y: 310 };
        pos[nodes[2].id] = { x: colX, y: 480 };
      } else {
        const step = 420 / Math.max(nodes.length - 1, 1);
        nodes.forEach((n, idx) => {
          pos[n.id] = { x: colX, y: 100 + idx * step };
        });
      }
    };

    col1.sort((a, b) => (a.type === "SOURCE_MODULE" ? -1 : 1));
    col2.sort((a, b) => (a.type === "TEST_SUITE" ? -1 : 1));

    assignY(col0, COL_X.CONTRACTS);
    assignY(col1, COL_X.CORE);
    assignY(col2, COL_X.TESTS);
    assignY(col3, COL_X.TAMPERING);

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
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).tagName === "rect") {
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
        [draggedNodeId]: { x: newX, y: newY },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggedNodeId(null);
  };

  const downloadJson = () => {
    window.open("/graphify.json", "_blank");
  };

  const getNodeTheme = (node: GraphifyNode) => {
    if (node.status === "tampered") {
      return {
        bg: "#1e111a",
        border: "#f43f5e",
        accent: "#f43f5e",
        text: "#fda4af",
        badgeBg: "#4c0519",
        badgeText: "#f43f5e",
        pip: "#f43f5e",
      };
    }
    if (node.status === "violated") {
      return {
        bg: "#1f170e",
        border: "#f59e0b",
        accent: "#f59e0b",
        text: "#fde68a",
        badgeBg: "#451a03",
        badgeText: "#f59e0b",
        pip: "#f59e0b",
      };
    }
    if (node.type === "BEHAVIOR_CONTRACT") {
      return {
        bg: "#0d1f19",
        border: "#10b981",
        accent: "#10b981",
        text: "#6ee7b7",
        badgeBg: "#064e3b",
        badgeText: "#34d399",
        pip: "#10b981",
      };
    }
    if (node.type === "FUNCTION") {
      return {
        bg: "#0c1f24",
        border: "#06b6d4",
        accent: "#06b6d4",
        text: "#67e8f9",
        badgeBg: "#164e63",
        badgeText: "#22d3ee",
        pip: "#06b6d4",
      };
    }
    if (node.type === "SOURCE_MODULE") {
      return {
        bg: "#0f172a",
        border: "#3b82f6",
        accent: "#3b82f6",
        text: "#93c5fd",
        badgeBg: "#1e3a8a",
        badgeText: "#60a5fa",
        pip: "#3b82f6",
      };
    }
    return {
      bg: "#14132b",
      border: "#818cf8",
      accent: "#818cf8",
      text: "#c7d2fe",
      badgeBg: "#312e81",
      badgeText: "#a5b4fc",
      pip: "#818cf8",
    };
  };

  const renderEdge = (edge: GraphifyEdge) => {
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
      : "#475569";
    const strokeWidth = isTamperedPath ? 2.5 : isInvariantPath ? 2 : 1.5;
    const strokeDash = isTamperedPath ? "5,3" : undefined;
    const markerId = isTamperedPath
      ? "url(#arrow-tampered)"
      : isInvariantPath
      ? "url(#arrow-invariant)"
      : "url(#arrow-normal)";

    let pathData = "";
    let labelX = (src.x + tgt.x) / 2;
    let labelY = (src.y + tgt.y) / 2;

    const dx = Math.abs(tgt.x - src.x);

    if (dx < 40) {
      const isDown = tgt.y > src.y;
      const startY = isDown ? src.y + HALF_H : src.y - HALF_H;
      const endY = isDown ? tgt.y - HALF_H : tgt.y + HALF_H;
      pathData = `M ${src.x} ${startY} L ${tgt.x} ${endY}`;
      labelX = src.x + 44;
      labelY = (startY + endY) / 2;
    } else if (dx <= 350) {
      if (src.x < tgt.x) {
        const startX = src.x + HALF_W;
        const endX = tgt.x - HALF_W;
        const ctrlOffset = (endX - startX) * 0.5;
        pathData = `M ${startX} ${src.y} C ${startX + ctrlOffset} ${src.y}, ${endX - ctrlOffset} ${tgt.y}, ${endX} ${tgt.y}`;
        labelX = (startX + endX) / 2;
        labelY = (src.y + tgt.y) / 2;
      } else {
        const startX = src.x - HALF_W;
        const endX = tgt.x + HALF_W;
        const ctrlOffset = (startX - endX) * 0.5;
        pathData = `M ${startX} ${src.y} C ${startX - ctrlOffset} ${src.y}, ${endX + ctrlOffset} ${tgt.y}, ${endX} ${tgt.y}`;
        labelX = (startX + endX) / 2;
        labelY = (src.y + tgt.y) / 2;
      }
    } else {
      const useTopBypass = src.y < 280 && tgt.y < 280;
      if (useTopBypass) {
        const startY = src.y - HALF_H;
        const endY = tgt.y - HALF_H;
        const bypassY = 60;
        pathData = `M ${src.x} ${startY} C ${src.x} ${bypassY}, ${tgt.x} ${bypassY}, ${tgt.x} ${endY}`;
        labelX = (src.x + tgt.x) / 2;
        labelY = bypassY;
      } else {
        const startY = src.y + HALF_H;
        const endY = tgt.y + HALF_H;
        const bypassY = 560;
        pathData = `M ${src.x} ${startY} C ${src.x} ${bypassY}, ${tgt.x} ${bypassY}, ${tgt.x} ${endY}`;
        labelX = (src.x + tgt.x) / 2;
        labelY = bypassY;
      }
    }

    return (
      <g key={edge.id} className="transition-opacity duration-300">
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
          markerEnd={markerId}
          opacity={highlightBlastRadius && !isTamperedPath ? 0.35 : 0.85}
        />
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x="-44"
            y="-9"
            width="88"
            height="18"
            rx="9"
            fill="#090d16"
            stroke={strokeColor}
            strokeWidth="1"
            opacity={highlightBlastRadius && !isTamperedPath ? 0.4 : 0.95}
          />
          <text
            textAnchor="middle"
            y="3.5"
            fill={isTamperedPath ? "#fca5a5" : "#94a3b8"}
            fontSize="8"
            fontFamily="monospace"
            fontWeight="700"
            opacity={highlightBlastRadius && !isTamperedPath ? 0.5 : 1}
          >
            {edge.relation}
          </text>
        </g>
      </g>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" /> Graphify Official Integration
              </span>
              <span className="text-xs text-slate-400 font-mono">vis-network AST Knowledge Graph</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
              Architectural Code Graph & Blast-Radius Network
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Extracted with Graphify: 803 nodes, 1,876 edges, and 39 Leiden communities across the GreenWash repository. Explore full codebase constellations, search nodes, or inspect the forensic blast-radius DAG.
            </p>
          </div>

          {/* Mode Switcher & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle Buttons */}
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center">
              <button
                onClick={() => setViewMode("galaxy")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  viewMode === "galaxy"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Repository Galaxy (803 Nodes)
              </button>
              <button
                onClick={() => setViewMode("topology")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  viewMode === "topology"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Forensic Blast Radius (DAG)
              </button>
            </div>

            <a
              href="/graphify.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              Open Fullscreen
            </a>

            <button
              onClick={downloadJson}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              graph.json
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Box className="w-4 h-4 text-sky-400" /> Total Knowledge Graph Nodes
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {viewMode === "galaxy" ? "803" : graph ? graph.summary.totalNodes : "803"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">AST symbols, modules & invariants</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-indigo-400" /> Dependency & Call Edges
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {viewMode === "galaxy" ? "1,876" : graph ? graph.summary.totalEdges : "1,876"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Extracted calls, imports & assertions</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-emerald-400" /> Leiden Communities
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">39</div>
          <div className="text-xs text-slate-500 mt-0.5">Algorithmic architectural clusters</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-400" /> Tampered Invariants
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {graph ? graph.summary.tamperedNodes : 2}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Weakened assertions detected</div>
        </div>
      </div>

      {/* VIEW 1: FULL OFFICIAL GRAPHIFY GALAXY VISUALIZER (vis-network Physics Engine) */}
      {viewMode === "galaxy" && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden relative">
          <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-slate-200">Interactive Graphify Force-Directed Galaxy Engine</span>
              <span className="text-slate-500 font-mono text-[11px]">
                (vis-network physics · search nodes · filter communities · inspect degrees)
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
              <span>Drag canvas or nodes</span>
              <span>•</span>
              <span>Scroll to zoom</span>
              <span>•</span>
              <span>Click node for inspector</span>
            </div>
          </div>

          {/* Embedded Official Graphify Vis-Network HTML */}
          <div className="w-full h-[760px] relative bg-[#0f0f1a]">
            <iframe
              src="/graphify.html"
              title="Official Graphify Knowledge Graph"
              className="w-full h-full border-none"
            />
          </div>
        </div>
      )}

      {/* VIEW 2: FORENSIC BLAST-RADIUS TOPOLOGY DAG */}
      {viewMode === "topology" && graph && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl relative overflow-hidden flex flex-col min-h-[620px]">
            {/* 4 Architectural Zone Column Headers */}
            <div className="grid grid-cols-4 bg-slate-900/90 border-b border-slate-800 px-3 py-2.5 text-[11px] font-mono text-slate-400 select-none">
              <div className="text-center font-bold text-emerald-400 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 1. Invariant Specs
              </div>
              <div className="text-center font-bold text-cyan-400 flex items-center justify-center gap-1">
                <FileCode className="w-3.5 h-3.5" /> 2. Business Logic
              </div>
              <div className="text-center font-bold text-indigo-400 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 3. Test Quality
              </div>
              <div className="text-center font-bold text-rose-400 flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5" /> 4. Agent Evasions
              </div>
            </div>

            {/* Canvas Toolbar Controls */}
            <div className="absolute top-14 right-3 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg shadow-lg">
              <button
                onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                title="Reset View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* SVG Canvas */}
            <svg
              ref={svgRef}
              viewBox="0 0 1180 620"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full flex-1 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ minHeight: "560px" }}
            >
              <defs>
                <marker
                  id="arrow-normal"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                </marker>
                <marker
                  id="arrow-tampered"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
                </marker>
                <marker
                  id="arrow-invariant"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="0.75" fill="#1e293b" />
                </pattern>
                <rect x="-1000" y="-1000" width="3500" height="3000" fill="url(#grid)" />

                <line x1="300" y1="0" x2="300" y2="620" stroke="#1e293b" strokeDasharray="4,4" strokeWidth="1" />
                <line x1="590" y1="0" x2="590" y2="620" stroke="#1e293b" strokeDasharray="4,4" strokeWidth="1" />
                <line x1="880" y1="0" x2="880" y2="620" stroke="#1e293b" strokeDasharray="4,4" strokeWidth="1" />

                {graph.edges.map(renderEdge)}

                {graph.nodes.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;

                  const isSelected = selectedNodeId === node.id;
                  const isBlast = blastRadiusNodeIds.has(node.id);
                  const theme = getNodeTheme(node);

                  const cardX = pos.x - HALF_W;
                  const cardY = pos.y - HALF_H;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${cardX}, ${cardY})`}
                      className="cursor-pointer select-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggedNodeId(node.id);
                      }}
                    >
                      {node.status === "tampered" && (
                        <rect
                          x="-4"
                          y="-4"
                          width={CARD_WIDTH + 8}
                          height={CARD_HEIGHT + 8}
                          rx="12"
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="2"
                          className="animate-ping opacity-25 pointer-events-none"
                        />
                      )}

                      <rect
                        width={CARD_WIDTH}
                        height={CARD_HEIGHT}
                        rx="10"
                        fill={theme.bg}
                        stroke={isSelected ? "#38bdf8" : theme.border}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="drop-shadow(0 6px 12px rgba(0,0,0,0.5))"
                        opacity={highlightBlastRadius && !isBlast ? 0.35 : 1}
                      />

                      <rect
                        x="0"
                        y="0"
                        width="5"
                        height={CARD_HEIGHT}
                        rx="3"
                        fill={theme.accent}
                        opacity={highlightBlastRadius && !isBlast ? 0.4 : 1}
                      />

                      <circle cx="16" cy="16" r="3.5" fill={theme.pip} />
                      <text
                        x="24"
                        y="19"
                        fill={theme.text}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="700"
                        letterSpacing="0.4"
                        opacity={highlightBlastRadius && !isBlast ? 0.4 : 1}
                      >
                        {node.type.replace("_", " ")}
                      </text>

                      <rect
                        x={CARD_WIDTH - 58}
                        y="8"
                        width="50"
                        height="15"
                        rx="4"
                        fill={theme.badgeBg}
                        stroke={theme.border}
                        strokeWidth="1"
                        opacity={highlightBlastRadius && !isBlast ? 0.4 : 0.9}
                      />
                      <text
                        x={CARD_WIDTH - 33}
                        y="18.5"
                        textAnchor="middle"
                        fill={theme.badgeText}
                        fontSize="8"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        {node.status.toUpperCase()}
                      </text>

                      <text
                        x="14"
                        y="41"
                        fill={isSelected ? "#38bdf8" : "#f8fafc"}
                        fontSize="11.5"
                        fontWeight="600"
                        fontFamily="sans-serif"
                        opacity={highlightBlastRadius && !isBlast ? 0.4 : 1}
                      >
                        {node.name.length > 22 ? node.name.slice(0, 21) + "…" : node.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Bottom Legend */}
            <div className="bg-slate-900/95 border-t border-slate-800 p-3 px-4 flex items-center justify-between gap-4 text-xs flex-wrap">
              <div className="flex items-center gap-4 text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Invariant Ground Truth
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span> Core Function
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block"></span> Test Verification
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm"></span> Tampered Finding
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Topological Order: 1. Specs ➔ 2. Core ➔ 3. Tests ➔ 4. Tampering Evasions
              </span>
            </div>
          </div>

          {/* Right Pane: Selected Node Inspector & Blast Details */}
          <div className="space-y-6">
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
                      <div key={f} className="font-mono text-rose-400 bg-slate-950 px-2 py-1.5 rounded mb-1 border border-rose-500/20 flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3 shrink-0" /> {f}
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
                      <div key={c} className="font-mono text-amber-400 bg-slate-950 px-2 py-1.5 rounded mb-1 border border-amber-500/20 flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3 shrink-0" /> {c}
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
