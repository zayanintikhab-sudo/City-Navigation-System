# 🗺 Smart City Navigation Agent

An AI mini-project showcasing **BFS**, **DFS**, and **A\*** pathfinding on a dummy city graph.

---

## Project Structure

```
smart-city/
├── backend/
│   ├── main.py          ← FastAPI backend (algorithms + goal-based agent)
│   └── requirements.txt
└── frontend/
    ├── public/index.html
    ├── src/
│   │   ├── index.js
│   │   └── App.jsx      ← Full React UI (map + controls + history)
    └── package.json
```

---

## Setup & Run

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be live at: `http://localhost:8000`  
Swagger docs at: `http://localhost:8000/docs`

### 2. Frontend (React)

```bash
cd frontend
npm install
npm start
```

React dev server at: `http://localhost:3000`

---

## Features

### Algorithms (Goal-Based Agent)
| Algorithm | Strategy | Optimal? | Memory |
|-----------|----------|----------|--------|
| **BFS** | Level-by-level expansion | ✓ (unweighted) | High |
| **DFS** | Deep-first exploration | ✗ | Low |
| **A\*** | f(n) = g(n) + h(n) heuristic | ✓ (weighted) | Medium |

### City Map (13 nodes, 21 edges)
- Airport, Highway Hub, North Park, University
- Tech District, Central Station, Hospital, Market Square
- Business Hub, Old Town, Residential East, Residential West, Port Area

### Traffic Conditions
- **Low** (1.0×) → free flow
- **Medium** (1.6×) → congested
- **High** (2.5×) → heavy traffic — affects A\* path cost and travel time

### History System
- Every search is saved server-side (last 20)
- View: algorithm used, traffic level, path, distance, time, nodes explored
- Clearable via button or `DELETE /history`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/navigate` | Run pathfinding |
| GET | `/history` | Retrieve search history |
| DELETE | `/history` | Clear history |
| GET | `/graph` | Get city graph data |
| GET | `/health` | Health check |

### Sample Request

```json
POST /navigate
{
  "start": "Airport",
  "end": "Port Area",
  "algorithm": "astar",
  "traffic": "medium"
}
```

---

## Goal-Based Agent Design

The backend implements a **goal-based agent**:
- **Percepts**: start node, end node, traffic level
- **Goal**: reach the destination node
- **Actions**: move to adjacent nodes
- **State**: frontier (open), visited (closed), came_from (history)
- **Performance measure**: minimise total weighted path cost

A\* uses Euclidean distance between grid coordinates as the admissible heuristic `h(n)`.