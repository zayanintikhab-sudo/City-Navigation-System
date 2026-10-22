from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import heapq
from collections import deque
import time
import math

app = FastAPI(title="Smart City Navigation Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── City Graph (matches frontend map) ───────────────────────────────────────
# Edges: (neighbor, base_distance_km)
CITY_GRAPH = {
    "Airport":       [("Highway Hub", 3.2), ("North Park", 4.1)],
    "Highway Hub":   [("Airport", 3.2), ("Tech District", 2.8), ("Central Station", 3.5)],
    "North Park":    [("Airport", 4.1), ("University", 2.3), ("Central Station", 3.0)],
    "University":    [("North Park", 2.3), ("Hospital", 1.8), ("Market Square", 3.1)],
    "Tech District": [("Highway Hub", 2.8), ("Central Station", 2.1), ("Business Hub", 2.5)],
    "Central Station": [("Highway Hub", 3.5), ("North Park", 3.0), ("Tech District", 2.1),
                        ("Market Square", 1.9), ("Old Town", 2.4)],
    "Hospital":      [("University", 1.8), ("Market Square", 2.0), ("Residential East", 2.5)],
    "Market Square": [("University", 3.1), ("Hospital", 2.0), ("Central Station", 1.9),
                      ("Old Town", 1.5), ("Port Area", 3.8)],
    "Business Hub":  [("Tech District", 2.5), ("Old Town", 2.2), ("Port Area", 3.0)],
    "Old Town":      [("Central Station", 2.4), ("Market Square", 1.5), ("Business Hub", 2.2),
                      ("Residential West", 2.0)],
    "Residential East": [("Hospital", 2.5), ("Port Area", 2.8)],
    "Residential West": [("Old Town", 2.0), ("Port Area", 3.2)],
    "Port Area":     [("Market Square", 3.8), ("Business Hub", 3.0),
                      ("Residential East", 2.8), ("Residential West", 3.2)],
}

# Node coordinates for heuristic (x, y in abstract grid units)
NODE_COORDS = {
    "Airport":          (1, 0),
    "Highway Hub":      (2, 1),
    "North Park":       (0, 2),
    "University":       (0, 3),
    "Tech District":    (3, 2),
    "Central Station":  (2, 3),
    "Hospital":         (1, 4),
    "Market Square":    (2, 4),
    "Business Hub":     (4, 3),
    "Old Town":         (3, 4),
    "Residential East": (2, 5),
    "Residential West": (3, 5),
    "Port Area":        (3, 6),
}

# Traffic multipliers (1.0 = free flow, 2.5 = heavy)
TRAFFIC_CONDITIONS = {
    "low":    1.0,
    "medium": 1.6,
    "high":   2.5,
}

# ─── Models ──────────────────────────────────────────────────────────────────
class NavigationRequest(BaseModel):
    start: str
    end: str
    algorithm: str  # "bfs", "dfs", "astar"
    traffic: Optional[str] = "low"  # "low", "medium", "high"

class SearchStep(BaseModel):
    step: int
    action: str
    current: str
    frontier: list
    visited: list
    g_cost: Optional[float] = None
    h_cost: Optional[float] = None
    f_cost: Optional[float] = None

class NavigationResult(BaseModel):
    path: list
    total_distance: float
    estimated_time: float
    algorithm: str
    explored_nodes: int
    search_steps: list
    all_explored: list
    success: bool
    message: str

# ─── History Store ────────────────────────────────────────────────────────────
search_history: list = []

# ─── Helpers ─────────────────────────────────────────────────────────────────
def heuristic(a: str, b: str) -> float:
    """Euclidean distance heuristic between two nodes."""
    ax, ay = NODE_COORDS[a]
    bx, by = NODE_COORDS[b]
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)

def effective_cost(u: str, v: str, base_dist: float, traffic: str) -> float:
    """Apply traffic multiplier to edge weight."""
    return base_dist * TRAFFIC_CONDITIONS.get(traffic, 1.0)

def reconstruct_path(came_from: dict, start: str, end: str):
    path = []
    current = end
    while current != start:
        path.append(current)
        current = came_from[current]
    path.append(start)
    path.reverse()
    return path

def path_total_cost(path: list, traffic: str) -> float:
    total = 0.0
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        for nb, dist in CITY_GRAPH[u]:
            if nb == v:
                total += effective_cost(u, v, dist, traffic)
                break
    return round(total, 2)

# ─── BFS ─────────────────────────────────────────────────────────────────────
def bfs(start: str, end: str, traffic: str):
    queue = deque([[start]])
    visited = set([start])
    steps = []
    all_explored = []
    step_n = 0

    while queue:
        path = queue.popleft()
        current = path[-1]
        all_explored.append(current)

        steps.append(SearchStep(
            step=step_n,
            action="Dequeue & explore",
            current=current,
            frontier=[p[-1] for p in queue],
            visited=list(visited),
        ))
        step_n += 1

        if current == end:
            return path, steps, all_explored

        for neighbor, _ in CITY_GRAPH.get(current, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(path + [neighbor])

    return None, steps, all_explored

# ─── DFS ─────────────────────────────────────────────────────────────────────
def dfs(start: str, end: str, traffic: str):
    stack = [[start]]
    visited = set()
    steps = []
    all_explored = []
    step_n = 0

    while stack:
        path = stack.pop()
        current = path[-1]

        if current in visited:
            continue
        visited.add(current)
        all_explored.append(current)

        steps.append(SearchStep(
            step=step_n,
            action="Pop & explore",
            current=current,
            frontier=[p[-1] for p in stack],
            visited=list(visited),
        ))
        step_n += 1

        if current == end:
            return path, steps, all_explored

        for neighbor, _ in reversed(CITY_GRAPH.get(current, [])):
            if neighbor not in visited:
                stack.append(path + [neighbor])

    return None, steps, all_explored

# ─── A* ──────────────────────────────────────────────────────────────────────
def astar(start: str, end: str, traffic: str):
    open_set = [(heuristic(start, end), 0.0, start)]
    came_from = {}
    g_score = {start: 0.0}
    steps = []
    all_explored = []
    step_n = 0
    visited = set()

    while open_set:
        f, g, current = heapq.heappop(open_set)

        if current in visited:
            continue
        visited.add(current)
        all_explored.append(current)
        h = heuristic(current, end)

        frontier_nodes = [node for _, _, node in open_set]
        steps.append(SearchStep(
            step=step_n,
            action="Expand best node",
            current=current,
            frontier=frontier_nodes,
            visited=list(visited),
            g_cost=round(g, 2),
            h_cost=round(h, 2),
            f_cost=round(g + h, 2),
        ))
        step_n += 1

        if current == end:
            path = reconstruct_path(came_from, start, end)
            return path, steps, all_explored

        for neighbor, base_dist in CITY_GRAPH.get(current, []):
            if neighbor in visited:
                continue
            tentative_g = g_score[current] + effective_cost(current, neighbor, base_dist, traffic)
            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_new = tentative_g + heuristic(neighbor, end)
                heapq.heappush(open_set, (f_new, tentative_g, neighbor))

    return None, steps, all_explored

# ─── Routes ──────────────────────────────────────────────────────────────────
@app.post("/navigate", response_model=NavigationResult)
def navigate(req: NavigationRequest):
    if req.start not in CITY_GRAPH or req.end not in CITY_GRAPH:
        return NavigationResult(
            path=[], total_distance=0, estimated_time=0,
            algorithm=req.algorithm, explored_nodes=0,
            search_steps=[], all_explored=[], success=False,
            message="Invalid start or end node."
        )

    alg = req.algorithm.lower()
    if alg == "bfs":
        path, steps, explored = bfs(req.start, req.end, req.traffic)
    elif alg == "dfs":
        path, steps, explored = dfs(req.start, req.end, req.traffic)
    elif alg == "astar":
        path, steps, explored = astar(req.start, req.end, req.traffic)
    else:
        return NavigationResult(
            path=[], total_distance=0, estimated_time=0,
            algorithm=req.algorithm, explored_nodes=0,
            search_steps=[], all_explored=[], success=False,
            message="Unknown algorithm. Use bfs, dfs, or astar."
        )

    if path is None:
        result = NavigationResult(
            path=[], total_distance=0, estimated_time=0,
            algorithm=req.algorithm, explored_nodes=len(explored),
            search_steps=[s.dict() for s in steps],
            all_explored=explored, success=False,
            message="No path found."
        )
    else:
        dist = path_total_cost(path, req.traffic)
        speed = 40 / TRAFFIC_CONDITIONS.get(req.traffic, 1.0)  # km/h adjusted
        time_hrs = dist / speed
        result = NavigationResult(
            path=path,
            total_distance=dist,
            estimated_time=round(time_hrs * 60, 1),
            algorithm=req.algorithm,
            explored_nodes=len(explored),
            search_steps=[s.dict() for s in steps],
            all_explored=explored,
            success=True,
            message=f"Path found using {alg.upper()}! {len(path)} stops, {dist} km."
        )

    # Save to history
    search_history.append({
        "id": len(search_history) + 1,
        "timestamp": time.strftime("%H:%M:%S"),
        "start": req.start,
        "end": req.end,
        "algorithm": req.algorithm.upper(),
        "traffic": req.traffic,
        "path": result.path,
        "distance": result.total_distance,
        "time_min": result.estimated_time,
        "explored": result.explored_nodes,
        "success": result.success,
    })

    return result

@app.get("/history")
def get_history():
    return list(reversed(search_history[-20:]))

@app.delete("/history")
def clear_history():
    search_history.clear()
    return {"message": "History cleared."}

@app.get("/graph")
def get_graph():
    return {"nodes": list(CITY_GRAPH.keys()), "edges": CITY_GRAPH, "coords": NODE_COORDS}

@app.get("/health")
def health():
    return {"status": "ok"}