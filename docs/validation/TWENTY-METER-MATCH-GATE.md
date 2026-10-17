# How the 20 m match gate is calculated

Used when cross-checking TSM LiDAR/NDHM building heights against Microsoft Global ML Building Footprints.

## Formula

Let each building be represented by its **footprint centroid**.

For TSM building \(i\) with centroid \(C_i\) and height \(h_i^{\\mathrm{TSM}}\):

1. **Nearest neighbor** over Microsoft centroids \(\{C_j\}\):

\[
j^\\* = \\arg\\min_j \\; d(C_i, C_j)
\]

2. **Gate**:

\[
\\text{match}(i) =
\\begin{cases}
\\text{true}  & \\text{if } d(C_i, C_{j^\\*}) \\le 20\\ \\mathrm{m} \\\\
\\text{false} & \\text{otherwise}
\\end{cases}
\]

3. **Height residual** (matched and both heights valid, e.g. \(h > 0\)):

\[
\\Delta h_i = \\left| h_i^{\\mathrm{TSM}} - h_{j^\\*}^{\\mathrm{MS}} \\right|
\]

4. **Statistics** over matched set \(M\):

\[
\\begin{aligned}
\\text{match rate} &= |M| / N_{\\mathrm{sample}} \\\\
\\text{median }|\\Delta h| &= \\mathrm{median}_{i \\in M}(\\Delta h_i) \\\\
\\text{within 2 m} &= \\frac{|\\{ i \\in M : \\Delta h_i \\le 2 \\}|}{|M|}
\\end{aligned}
\]

With \(N_{\\mathrm{sample}} = 1000\), \(|M| = 240\) → **24%** match rate; median \(|\\Delta h| = 0.92\\,\\mathrm{m}\).

## Pseudocode

```python
def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dp/2)**2 + cos(p1)*cos(p2)*sin(dl/2)**2
    return 2 * R * asin(sqrt(a))

GATE_M = 20.0
matched = []
for tsm in tsm_buildings:  # sample of 1000
    best_d, best_ms = inf, None
    for ms in microsoft_buildings:
        d = haversine_m(tsm.lat, tsm.lon, ms.lat, ms.lon)
        if d < best_d:
            best_d, best_ms = d, ms
    if best_d <= GATE_M and tsm.height > 0 and best_ms.height > 0:
        matched.append(abs(tsm.height - best_ms.height))

match_rate = len(matched) / 1000
median_dh = median(matched)
```

## Why 20 m

- Same-building centroids often differ by a few meters between ML and LiDAR inventories.
- Beyond ~20–30 m, the nearest polygon is increasingly a **neighbor**, not the same structure.
- The gate is a **pairing rule**, not a height accuracy metric. Accuracy is computed **after** pairing.

## Authority

DERIVED / screening only. Does not create survey or regulatory structure heights.
