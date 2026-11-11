# Geodetic → ECEF (WGS84)

## Definitions

- **Geodetic:** latitude φ, longitude λ, ellipsoidal height h (relative to WGS84 ellipsoid).
- **ECEF:** Cartesian (X, Y, Z) meters, origin at Earth center, axes fixed to Earth.

## Conversion

With semi-major axis \(a = 6378137\) m and first eccentricity squared \(e^2\):

\[
N(\phi) = \frac{a}{\sqrt{1 - e^2 \sin^2\phi}}
\]

\[
\begin{aligned}
X &= (N + h)\cos\phi\cos\lambda \\
Y &= (N + h)\cos\phi\sin\lambda \\
Z &= \bigl(N(1 - e^2) + h\bigr)\sin\phi
\end{aligned}
\]

## Posey / Bonebank example (h ≈ 120 m)

| Place | φ, λ | ECEF (m) |
|-------|------|----------|
| Bonebank pin | 37.84589°N, 88.00510°W | X≈175551, Y≈−5039981, Z≈3892024 |

## Corrected operational bounds (validator)

| Axis | Min | Max |
|------|-----|-----|
| X | 150000 | 210000 |
| Y | −5060000 | −5000000 |
| Z | 3870000 | 3940000 |

**Note:** X is **positive** near 88°W. Negative-X envelopes are incorrect for this county.

Orthometric (NAVD88) heights require GEOID18/VDatum — do not label ellipsoidal *h* as NAVD88.
