"""FM-07 route optimization: nearest-neighbor construction followed by a
2-opt local-search improvement pass. Nearest-neighbor alone is fast but
prone to leaving crossing/zig-zag paths where a greedy early choice
strands a later stop far away; 2-opt repeatedly tries reversing a
segment of the route and keeps the reversal whenever it shortens the
total distance, which removes exactly those crossings. This is scored
on straight-line (Haversine) distance and treats the route as an open
path (first stop fixed as the start, no return leg) — not a
capacity/traffic-aware vehicle-routing solver, and not guaranteed to
find the true global optimum (2-opt is a well-known heuristic, not an
exact algorithm), but a real, measurable improvement over either
technique alone."""

from apps.core.geo import haversine_km

MAX_TWO_OPT_PASSES = 50


def _distance_matrix(points):
    n = len(points)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine_km(points[i][1], points[i][2], points[j][1], points[j][2])
            matrix[i][j] = matrix[j][i] = d
    return matrix


def _nearest_neighbor_order(n, matrix):
    if n == 0:
        return []
    visited = [False] * n
    order = [0]
    visited[0] = True
    for _ in range(n - 1):
        current = order[-1]
        nearest = min((j for j in range(n) if not visited[j]), key=lambda j: matrix[current][j])
        order.append(nearest)
        visited[nearest] = True
    return order


def _two_opt(order, matrix, max_passes=MAX_TWO_OPT_PASSES):
    """Standard 2-opt for an open path: index 0 is never moved (it's the
    fixed starting stop), every other pair of edges is tried for a
    distance-improving reversal until a full pass finds no improvement."""
    order = order[:]
    n = len(order)
    if n < 4:
        return order
    improved = True
    passes = 0
    while improved and passes < max_passes:
        improved = False
        passes += 1
        for i in range(1, n - 2):
            for j in range(i + 1, n - 1):
                a, b, c, d = order[i - 1], order[i], order[j], order[j + 1]
                if matrix[a][b] + matrix[c][d] > matrix[a][c] + matrix[b][d] + 1e-9:
                    order[i:j + 1] = list(reversed(order[i:j + 1]))
                    improved = True
    return order


def optimize_order(points):
    """points: a list of (key, lat, lon) tuples, in their current visit
    order — points[0] is kept as the fixed starting stop. Returns the
    keys re-sequenced into an optimized visit order."""
    n = len(points)
    if n <= 2:
        return [p[0] for p in points]
    matrix = _distance_matrix(points)
    order = _nearest_neighbor_order(n, matrix)
    order = _two_opt(order, matrix)
    return [points[i][0] for i in order]
