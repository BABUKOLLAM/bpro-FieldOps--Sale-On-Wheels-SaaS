"""FM-07 route optimization: pure algorithm tests for the nearest-
neighbor + 2-opt engine, independent of the Beat/API layer (covered
separately in tests/test_phase2.py)."""

from apps.customers.route_optimization import _nearest_neighbor_order, _two_opt, optimize_order


def test_two_opt_removes_a_known_crossing():
    # A deliberately crossing distance matrix: visiting in index order
    # 0-1-2-3 costs 10+10+10=30, but 0-2-1-3 costs 1+10+1=12 — much
    # shorter, and still starts at 0 (the fixed anchor).
    matrix = [
        [0, 10, 1, 10],
        [10, 0, 10, 1],
        [1, 10, 0, 10],
        [10, 1, 10, 0],
    ]
    assert _two_opt([0, 1, 2, 3], matrix) == [0, 2, 1, 3]


def test_two_opt_never_moves_the_anchor():
    matrix = [
        [0, 10, 1, 10],
        [10, 0, 10, 1],
        [1, 10, 0, 10],
        [10, 1, 10, 0],
    ]
    result = _two_opt([0, 1, 2, 3], matrix)
    assert result[0] == 0


def test_two_opt_is_a_noop_below_four_points():
    matrix = [[0, 5, 5], [5, 0, 5], [5, 5, 0]]
    assert _two_opt([0, 1, 2], matrix) == [0, 1, 2]


def test_nearest_neighbor_order_starts_at_index_zero():
    matrix = [
        [0, 3, 4],
        [3, 0, 5],
        [4, 5, 0],
    ]
    assert _nearest_neighbor_order(3, matrix)[0] == 0


def test_optimize_order_two_opt_improves_on_nearest_neighbor_alone():
    """A 6-point configuration (found by search, verified by brute force)
    where plain nearest-neighbor produces a longer path than the 2-opt
    pass finds — proving the improvement step actually does something,
    not just that the pipeline runs."""
    coords = [
        (2.0412, 1.2828),
        (0.9424, 1.7567),
        (1.3596, 0.8993),
        (2.3831, 2.0970),
        (0.7323, 1.7233),
        (1.5756, 2.6254),
    ]
    points = [(i, lat, lon) for i, (lat, lon) in enumerate(coords)]

    from apps.customers.route_optimization import _distance_matrix

    matrix = _distance_matrix(points)
    nn_only = _nearest_neighbor_order(len(points), matrix)
    nn_length = sum(matrix[nn_only[i]][nn_only[i + 1]] for i in range(len(nn_only) - 1))

    improved = optimize_order(points)
    improved_indices = improved  # optimize_order returns the keys, which are the indices here
    improved_length = sum(
        matrix[improved_indices[i]][improved_indices[i + 1]] for i in range(len(improved_indices) - 1)
    )

    assert improved_length < nn_length
    assert improved[0] == 0  # anchor unchanged


def test_optimize_order_handles_zero_one_two_points():
    assert optimize_order([]) == []
    assert optimize_order([("only", 0.0, 0.0)]) == ["only"]
    assert optimize_order([("a", 0.0, 0.0), ("b", 1.0, 1.0)]) == ["a", "b"]
