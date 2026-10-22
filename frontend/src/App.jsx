import { useState, useEffect, useRef, useCallback } from "react";

// ─── City Map Data (fixed, cannot be changed by users) ──────────────────────
const NODES = {
  "Airport": { x: 120, y: 60, icon: "✈" },
  "Highway Hub": { x: 240, y: 110, icon: "⬡" },
  "North Park": { x: 60, y: 170, icon: "⬡" },
  "University": { x: 80, y: 260, icon: "⬡" },
  "Tech District": { x: 360, y: 145, icon: "⬡" },
  "Central Station": { x: 240, y: 230, icon: "⬡" },
  "Hospital": { x: 130, y: 330, icon: "⬡" },
  "Market Square": { x: 248, y: 318, icon: "⬡" },
  "Business Hub": { x: 390, y: 250, icon: "⬡" },
  "Old Town": { x: 320, y: 325, icon: "⬡" },
  "Residential East": { x: 210, y: 410, icon: "⬡" },
  "Residential West": { x: 340, y: 400, icon: "⬡" },
  "Port Area": { x: 330, y: 470, icon: "⬡" },
};

const EDGES = [
  ["Airport", "Highway Hub", 3.2],
  ["Airport", "North Park", 4.1],
  ["Highway Hub", "Tech District", 2.8],
  ["Highway Hub", "Central Station", 3.5],
  ["North Park", "University", 2.3],
  ["North Park", "Central Station", 3.0],
  ["University", "Hospital", 1.8],
  ["University", "Market Square", 3.1],
  ["Tech District", "Central Station", 2.1],
  ["Tech District", "Business Hub", 2.5],
  ["Central Station", "Market Square", 1.9],
  ["Central Station", "Old Town", 2.4],
  ["Hospital", "Market Square", 2.0],
  ["Hospital", "Residential East", 2.5],
  ["Market Square", "Old Town", 1.5],
  ["Market Square", "Port Area", 3.8],
  ["Business Hub", "Old Town", 2.2],
  ["Business Hub", "Port Area", 3.0],
  ["Old Town", "Residential West", 2.0],
  ["Residential East", "Port Area", 2.8],
  ["Residential West", "Port Area", 3.2],
];

const NODE_LIST = Object.keys(NODES);
const API = "http://localhost:8000";

// ─── Colour helpers ──────────────────────────────────────────────────────────
const ALGO_COLOR = { bfs: "#00d4ff", dfs: "#c24010", astar: "#21bd0c" };
const TRAFFIC_COLOR = { low: "#21bd0c", medium: "#d6ab45", high: "#c24010" };

// ─── SVG Map Component ───────────────────────────────────────────────────────
function CityMap({ start, end, result, onSelectNode, selecting }) {
  const pathSet = new Set();
  if (result?.path?.length > 1) {
    for (let i = 0; i < result.path.length - 1; i++) {
      const a = result.path[i], b = result.path[i + 1];
      pathSet.add(a + "|" + b);
      pathSet.add(b + "|" + a);
    }
  }
  const exploredSet = new Set(result?.all_explored || []);

  return (
    <svg
      viewBox="0 0 470 530"
      style={{ width: "100%", background: "transparent", cursor: selecting ? "crosshair" : "default" }}
    >
      {/* Grid lines */}
      {[60, 120, 180, 240, 300, 360, 420, 480].map(x => (
        <line key={x} x1={x} y1={0} x2={x} y2={530} stroke="#1a2535" strokeWidth="0.5" />
      ))}
      {[50, 110, 170, 230, 290, 350, 410, 470, 530].map(y => (
        <line key={y} x1={0} y1={y} x2={470} y2={y} stroke="#1a2535" strokeWidth="0.5" />
      ))}

      {/* Edges */}
      {EDGES.map(([a, b, dist]) => {
        const na = NODES[a], nb = NODES[b];
        const isPath = pathSet.has(a + "|" + b);
        return (
          <g key={a + b}>
            <line
              x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke={isPath ? "#00d4ff" : "#1e3050"}
              strokeWidth={isPath ? 3 : 1.5}
              strokeDasharray={isPath ? "none" : "4 3"}
              opacity={isPath ? 1 : 0.7}
              style={{ transition: "stroke 0.4s, stroke-width 0.3s" }}
            />
            {isPath && (
              <line
                x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                stroke="#00d4ff"
                strokeWidth={6}
                opacity={0.15}
              />
            )}
            {/* distance label on edge midpoint */}
            <text
              x={(na.x + nb.x) / 2}
              y={(na.y + nb.y) / 2 - 4}
              fontSize="8"
              fill="#555"
              textAnchor="middle"
              fontFamily="'Courier New', monospace"
            >
              {dist}km
            </text>
          </g>
        );
      })}

      {/* Nodes */}
      {NODE_LIST.map(name => {
        const n = NODES[name];
        const isStart = name === start;
        const isEnd = name === end;
        const isPath = result?.path?.includes(name);
        const isExplored = exploredSet.has(name) && !isPath;
        const r = isStart || isEnd ? 18 : isPath ? 15 : 12;
        const fill = isStart ? "#7cff6b"
          : isEnd ? "#ff6b6b"
            : isPath ? "#00d4ff"
              : isExplored ? "#2a4a7a"
                : "#0d1f33";
        const stroke = isStart ? "#3d9b2a" : isEnd ? "#c43030" : isPath ? "#0099bb" : "#1e3a5a";

        return (
          <g
            key={name}
            onClick={() => onSelectNode(name)}
            style={{ cursor: "pointer" }}
          >
            {/* Glow ring for start/end */}
            {(isStart || isEnd) && (
              <circle cx={n.x} cy={n.y} r={r + 6} fill="none"
                stroke={isStart ? "#7cff6b" : "#ff6b6b"} strokeWidth="1.5" opacity="0.4" />
            )}
            <circle
              cx={n.x} cy={n.y} r={r}
              fill={fill} stroke={stroke} strokeWidth={isPath || isStart || isEnd ? 2 : 1}
              style={{ transition: "all 0.3s" }}
            />
            <text
              x={n.x} y={n.y + 1}
              fontSize={isStart || isEnd ? "10" : "8"}
              fill={isStart || isEnd || isPath ? "#001122" : "#4a7aaa"}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="'Courier New', monospace"
              fontWeight="bold"
            >
              {isStart ? "S" : isEnd ? "E" : name.substring(0, 2)}
            </text>
            {/* Label */}
            <text
              x={n.x}
              y={n.y + r + 11}
              fontSize="8.5"
              fill={isStart ? "#7cff6b" : isEnd ? "#ff6b6b" : isPath ? "#00d4ff" : "#444"}
              textAnchor="middle"
              fontFamily="'Courier New', monospace"
              fontWeight={isPath || isStart || isEnd ? "bold" : "normal"}
            >
              {name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [algo, setAlgo] = useState("astar");
  const [traffic, setTraffic] = useState("low");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState(null); // "start" | "end" | null
  const [activeTab, setActiveTab] = useState("map"); // "map" | "steps" | "history"
  const [stepIdx, setStepIdx] = useState(0);

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch(`${API}/history`);
      if (r.ok) setHistory(await r.json());
    } catch { }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleNodeClick = (name) => {
    if (selecting === "start") { setStart(name); setSelecting(null); }
    else if (selecting === "end") { setEnd(name); setSelecting(null); }
  };

  const navigate = async () => {
    if (!start || !end) { setError("Select start and end nodes."); return; }
    if (start === end) { setError("Start and end must be different."); return; }
    setError(""); setLoading(true); setResult(null); setStepIdx(0);
    try {
      const res = await fetch(`${API}/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, algorithm: algo, traffic }),
      });
      const data = await res.json();
      setResult(data);
      fetchHistory();
      setActiveTab("map");
    } catch (e) {
      setError("Backend unreachable. Make sure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    await fetch(`${API}/history`, { method: "DELETE" });
    setHistory([]);
  };

  const currentStep = result?.search_steps?.[stepIdx];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      color: "#000000",
      fontFamily: "Inter, sans-serif",
      display: "flex",
      fontWeight: "800",
      flexDirection: "column",
    }}>
      {/* ── Header ── */}
      <header style={{
        borderBottom: "1px solid #0d2440",
        padding: "14px 28px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "#ffffff",
        backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ fontSize: 22, marginRight: 4 }}>🗺</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#00d4ff", letterSpacing: 2 }}>
            SMART CITY NAV AGENT
          </div>
          <div style={{ fontSize: 9, color: "#333", letterSpacing: 3, marginTop: 1 }}>
            BFS · DFS · A* PATHFINDING SYSTEM
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {["map", "steps", "history"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "5px 14px",
                background: activeTab === tab ? "#00d4ff22" : "transparent",
                border: `1px solid ${activeTab === tab ? "#00d4ff" : "#0d2440"}`,
                color: activeTab === tab ? "#00d4ff" : "#333",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                transition: "all 0.2s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, gap: 0 }}>
        {/* ── Left Panel: Controls ── */}
        <aside style={{
          width: 260,
          minWidth: 260,
          borderRight: "1px solid #0d2440",
          padding: "20px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          background: "#ffffff",
        }}>
          {/* Route Selection */}
          <section
            background="#ffffff">
            <SectionLabel>ROUTE SETUP</SectionLabel>
            <NodeField
              label="START" value={start}
              active={selecting === "start"}
              color="#21bd0c"
              onSelect={() => setSelecting(selecting === "start" ? null : "start")}
              onClear={() => setStart("")}
              onChange={setStart}
            />
            <div style={{ height: 8 }} />
            <NodeField
              label="END" value={end}
              active={selecting === "end"}
              color="#c24010"
              onSelect={() => setSelecting(selecting === "end" ? null : "end")}
              onClear={() => setEnd("")}
              onChange={setEnd}
            />
            {selecting && (
              <div style={{
                marginTop: 8, padding: "6px 10px",
                background: "#ffffff", border: "1px solid #00d4ff44",
                borderRadius: 4, fontSize: 9, color: "#00d4ff", letterSpacing: 1,
              }}>
                ▶ CLICK A NODE ON MAP TO SET {selecting.toUpperCase()}
              </div>
            )}
          </section>

          {/* Algorithm */}
          <section>
            <SectionLabel>ALGORITHM</SectionLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {["bfs", "dfs", "astar"].map(a => (
                <button
                  key={a}
                  onClick={() => setAlgo(a)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    background: algo === a ? ALGO_COLOR[a] + "22" : "transparent",
                    border: `1px solid ${algo === a ? ALGO_COLOR[a] : "#0d2440"}`,
                    color: algo === a ? ALGO_COLOR[a] : "#333",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 9,
                    fontFamily: "'Courier New', monospace",
                    fontWeight: algo === a ? "bold" : "normal",
                    letterSpacing: 1,
                    transition: "all 0.2s",
                  }}
                >
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 9, color: "#555", lineHeight: 1.5 }}>
              {algo === "bfs" && "Breadth-First: shortest hops, explores level by level."}
              {algo === "dfs" && "Depth-First: deep dive, low memory, not optimal."}
              {algo === "astar" && "A*: optimal with heuristic, best for weighted maps."}
            </div>
          </section>

          {/* Traffic */}
          <section>
            <SectionLabel>TRAFFIC CONDITIONS</SectionLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {["low", "medium", "high"].map(t => (
                <button
                  key={t}
                  onClick={() => setTraffic(t)}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    background: traffic === t ? TRAFFIC_COLOR[t] + "22" : "transparent",
                    border: `1px solid ${traffic === t ? TRAFFIC_COLOR[t] : "#0d2440"}`,
                    color: traffic === t ? TRAFFIC_COLOR[t] : "#333",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 9,
                    fontFamily: "'Courier New', monospace",
                    letterSpacing: 1,
                    transition: "all 0.2s",
                  }}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          {/* Find Route */}
          <button
            onClick={navigate}
            disabled={loading || !start || !end}
            style={{
              padding: "12px",
              background: loading ? "#0a1d33" : start && end ? "#00d4ff" : "#ffffff",
              border: `1px solid ${start && end ? "#00d4ff" : "#0d2440"}`,
              color: loading ? "#333" : start && end ? "#001122" : "#333",
              borderRadius: 6,
              cursor: start && end && !loading ? "pointer" : "not-allowed",
              fontSize: 11,
              fontFamily: "'Courier New', monospace",
              fontWeight: "bold",
              letterSpacing: 2,
              transition: "all 0.2s",
            }}
          >
            {loading ? "SEARCHING..." : "▶ FIND ROUTE"}
          </button>

          {error && (
            <div style={{
              padding: "8px 10px", background: "#ff6b6b11",
              border: "1px solid #ff6b6b44", borderRadius: 4,
              fontSize: 9, color: "#ff6b6b",
            }}>{error}</div>
          )}

          {/* Result summary */}
          {result && (
            <div style={{
              padding: "12px",
              background: result.success ? "#00d4ff08" : "#ff6b6b08",
              border: `1px solid ${result.success ? "#00d4ff22" : "#ff6b6b22"}`,
              borderRadius: 6,
              fontSize: 9,
              lineHeight: 2,
            }}>
              <div style={{ color: result.success ? "#7cff6b" : "#ff6b6b", fontWeight: "bold", marginBottom: 4 }}>
                {result.success ? "✓ PATH FOUND" : "✗ NO PATH"}
              </div>
              {result.success && <>
                <Row k="DISTANCE" v={`${result.total_distance} km`} />
                <Row k="EST. TIME" v={`${result.estimated_time} min`} />
                <Row k="STOPS" v={result.path.length} />
                <Row k="EXPLORED" v={result.explored_nodes} />
                <div style={{ marginTop: 8, color: "#00d4ff", fontSize: 8 }}>
                  {result.path.join(" → ")}
                </div>
              </>}
            </div>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* MAP TAB */}
          {activeTab === "map" && (
            <div style={{ flex: 1, padding: 20, overflow: "auto" }}>
              <div style={{
                background: "#ffffff",
                border: "1px solid #0d2440",
                borderRadius: 8,
                padding: 16,
                maxWidth: 520,
                margin: "0 auto",
              }}>
                <div style={{
                  fontSize: 9, color: "#333", letterSpacing: 2, marginBottom: 12,
                  display: "flex", gap: 20,
                }}>
                  <span>S = START</span>
                  <span>E = END</span>
                  <span style={{ color: "#00d4ff" }}>━ ROUTE</span>
                  <span style={{ color: "#2a4a7a" }}>▲ EXPLORED</span>
                </div>
                <CityMap
                  start={start} end={end}
                  result={result}
                  onSelectNode={handleNodeClick}
                  selecting={!!selecting}
                />
              </div>

              {/* Node grid (for quick select on mobile) */}
              <div style={{ marginTop: 16, maxWidth: 520, margin: "16px auto 0" }}>
                <div style={{ fontSize: 9, color: "#333", letterSpacing: 2, marginBottom: 8 }}>
                  QUICK SELECT NODES
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {NODE_LIST.map(name => (
                    <button
                      key={name}
                      onClick={() => handleNodeClick(name)}
                      style={{
                        padding: "4px 10px",
                        background: name === start ? "#7cff6b22" : name === end ? "#ff6b6b22" : "#ffffff",
                        border: `1px solid ${name === start ? "#7cff6b" : name === end ? "#ff6b6b" : "#0d2440"}`,
                        color: name === start ? "#7cff6b" : name === end ? "#ff6b6b" : "#444",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 9,
                        fontFamily: "'Courier New', monospace",
                        letterSpacing: 0.5,
                        transition: "all 0.15s",
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEPS TAB */}
          {activeTab === "steps" && (
            <div style={{ flex: 1, padding: 20, overflow: "auto" }}>
              {!result ? (
                <EmptyState msg="Run a search to see step-by-step algorithm trace." />
              ) : (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
                    background: "#ffffff", border: "1px solid #0d2440",
                    borderRadius: 6, padding: "10px 14px",
                  }}>
                    <span style={{ fontSize: 9, color: "#333", letterSpacing: 1 }}>
                      STEP {stepIdx + 1} / {result.search_steps.length}
                    </span>
                    <input
                      type="range" min={0} max={result.search_steps.length - 1}
                      value={stepIdx}
                      onChange={e => setStepIdx(+e.target.value)}
                      style={{ flex: 1, accentColor: ALGO_COLOR[algo] }}
                    />
                    <button
                      onClick={() => setStepIdx(0)}
                      style={{ ...miniBtn, marginRight: 2 }}
                    >⟨⟨</button>
                    <button
                      onClick={() => setStepIdx(v => Math.max(0, v - 1))}
                      style={miniBtn}
                    >‹</button>
                    <button
                      onClick={() => setStepIdx(v => Math.min(result.search_steps.length - 1, v + 1))}
                      style={miniBtn}
                    >›</button>
                    <button
                      onClick={() => setStepIdx(result.search_steps.length - 1)}
                      style={miniBtn}
                    >⟩⟩</button>
                  </div>

                  {currentStep && (
                    <div style={{
                      background: "#ffffff", border: `1px solid ${ALGO_COLOR[algo]}44`,
                      borderRadius: 8, padding: 16, marginBottom: 16,
                    }}>
                      <div style={{
                        color: ALGO_COLOR[algo], fontSize: 11, fontWeight: "bold",
                        letterSpacing: 1, marginBottom: 12,
                      }}>
                        STEP {currentStep.step}: {currentStep.action}
                      </div>
                      <Row k="CURRENT NODE" v={currentStep.current} color="#00d4ff" />
                      {currentStep.g_cost !== null && currentStep.g_cost !== undefined && (
                        <>
                          <Row k="g(n) ACTUAL COST" v={currentStep.g_cost} />
                          <Row k="h(n) HEURISTIC" v={currentStep.h_cost} />
                          <Row k="f(n) = g + h" v={currentStep.f_cost} color="#7cff6b" />
                        </>
                      )}
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 9, color: "#333", letterSpacing: 1, marginBottom: 4 }}>
                          FRONTIER ({currentStep.frontier.length})
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {currentStep.frontier.length === 0
                            ? <span style={{ fontSize: 9, color: "#1a3050" }}>empty</span>
                            : currentStep.frontier.map((n, i) => (
                              <span key={i} style={{
                                padding: "2px 7px", background: "#0a2040",
                                border: "1px solid #1a4060",
                                borderRadius: 3, fontSize: 9, color: "#4a90c0",
                              }}>{n}</span>
                            ))}
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 9, color: "#333", letterSpacing: 1, marginBottom: 4 }}>
                          VISITED ({currentStep.visited.length})
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {currentStep.visited.map((n, i) => (
                            <span key={i} style={{
                              padding: "2px 7px", background: "#ffffff",
                              border: "1px solid #0d2a3a",
                              borderRadius: 3, fontSize: 9, color: "#2a5070",
                            }}>{n}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full steps list */}
                  <div style={{ fontSize: 9, color: "#333", letterSpacing: 1, marginBottom: 8 }}>
                    ALL STEPS
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {result.search_steps.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => setStepIdx(i)}
                        style={{
                          padding: "7px 12px",
                          background: i === stepIdx ? ALGO_COLOR[algo] + "18" : "#06111e",
                          border: `1px solid ${i === stepIdx ? ALGO_COLOR[algo] + "66" : "#0d2440"}`,
                          borderRadius: 4, cursor: "pointer",
                          display: "flex", gap: 12, alignItems: "center",
                          fontSize: 9, transition: "background 0.15s",
                        }}
                      >
                        <span style={{ color: "#333", minWidth: 22 }}>#{s.step}</span>
                        <span style={{ color: ALGO_COLOR[algo], minWidth: 130 }}>{s.action}</span>
                        <span style={{ color: "#00d4ff" }}>→ {s.current}</span>
                        {s.f_cost !== null && s.f_cost !== undefined && (
                          <span style={{ marginLeft: "auto", color: "#7cff6b" }}>f={s.f_cost}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div style={{ flex: 1, padding: 20, overflow: "auto" }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 16,
              }}>
                <div style={{ fontSize: 9, color: "#333", letterSpacing: 2 }}>
                  SEARCH HISTORY ({history.length})
                </div>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    style={{
                      padding: "4px 12px", background: "transparent",
                      border: "1px solid #ff6b6b44", color: "#ff6b6b",
                      borderRadius: 4, cursor: "pointer", fontSize: 9,
                      fontFamily: "'Courier New', monospace", letterSpacing: 1,
                    }}
                  >
                    CLEAR ALL
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <EmptyState msg="No searches yet. Find a route to build history." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.map(h => (
                    <div
                      key={h.id}
                      style={{
                        padding: "12px 14px",
                        background: "#ffffff",
                        border: `1px solid ${h.success ? "#0d2440" : "#ff6b6b22"}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 9, padding: "2px 8px",
                          background: ALGO_COLOR[h.algorithm.toLowerCase()] + "22",
                          border: `1px solid ${ALGO_COLOR[h.algorithm.toLowerCase()]}44`,
                          color: ALGO_COLOR[h.algorithm.toLowerCase()],
                          borderRadius: 3, letterSpacing: 1,
                        }}>{h.algorithm}</span>
                        <span style={{
                          fontSize: 9, padding: "2px 8px",
                          background: TRAFFIC_COLOR[h.traffic] + "22",
                          border: `1px solid ${TRAFFIC_COLOR[h.traffic]}44`,
                          color: TRAFFIC_COLOR[h.traffic],
                          borderRadius: 3,
                        }}>{h.traffic?.toUpperCase()} TRAFFIC</span>
                        <span style={{ marginLeft: "auto", fontSize: 9, color: "#333" }}>
                          {h.timestamp}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "#4a80aa", marginBottom: 6 }}>
                        <span style={{ color: "#7cff6b" }}>{h.start}</span>
                        <span style={{ color: "#333", margin: "0 8px" }}>→</span>
                        <span style={{ color: "#ff6b6b" }}>{h.end}</span>
                      </div>
                      {h.success ? (
                        <div style={{ display: "flex", gap: 16, fontSize: 9, color: "#333" }}>
                          <span>{h.distance} km</span>
                          <span>{h.time_min} min</span>
                          <span>{h.explored} nodes explored</span>
                          <span style={{ marginLeft: "auto", color: "#555", fontSize: 8 }}>
                            {h.path.join(" → ")}
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 9, color: "#ff6b6b" }}>No path found</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────────
const miniBtn = {
  padding: "3px 8px",
  background: "transparent",
  border: "1px solid #0d2440",
  color: "#444",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "'Courier New', monospace",
};

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 8, color: "#333", letterSpacing: 2.5,
      marginBottom: 8, paddingBottom: 4,
      borderBottom: "1px solid #0d2440",
    }}>
      {children}
    </div>
  );
}

function Row({ k, v, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, lineHeight: 2 }}>
      <span style={{ color: "#333" }}>{k}</span>
      <span style={{ color: color || "#111" }}>{v}</span>
    </div>
  );
}

function NodeField({ label, value, active, color, onSelect, onClear, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: "#333", letterSpacing: 1.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={onSelect}
          style={{
            padding: "6px 8px",
            background: active ? color + "22" : "transparent",
            border: `1px solid ${active ? color : "#0d2440"}`,
            color: active ? color : "#333",
            borderRadius: 4, cursor: "pointer", fontSize: 9,
            fontFamily: "'Courier New', monospace",
            whiteSpace: "nowrap",
          }}
        >
          {active ? "▶ picking" : "📍 pick"}
        </button>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, padding: "6px 8px",
            background: "#ffffff",
            border: `1px solid ${value ? color + "66" : "#0d2440"}`,
            color: value ? color : "#333",
            borderRadius: 4, fontSize: 9,
            fontFamily: "'Courier New', monospace",
            outline: "none",
          }}
        >
          <option value="">-- select --</option>
          {Object.keys(NODES).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {value && (
          <button
            onClick={onClear}
            style={{
              padding: "6px 8px", background: "transparent",
              border: "1px solid #0d2440", color: "#333",
              borderRadius: 4, cursor: "pointer", fontSize: 11,
              fontFamily: "'Courier New', monospace",
            }}
          >×</button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: 200, color: "#1a3050", fontSize: 11, letterSpacing: 1,
      border: "1px dashed #0d2440", borderRadius: 8,
    }}>
      {msg}
    </div>
  );
}