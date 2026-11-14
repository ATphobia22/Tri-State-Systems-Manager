# Full Jitter + Circuit Breaker (Hydrology)

## Full jitter
`delay = random(0, min(cap, BASE * 2^attempt))` with `BASE=250ms`, `cap=8s`.
Spreads concurrent clients so USGS/NWPS are not hit in lockstep.

## Circuit breaker states
| State | Behavior |
|-------|----------|
| **closed** | Normal traffic |
| **open** | Skip fetcher until cool-down (default 30s) |
| **half_open** | One trial; success → closed, failure → open |

Threshold: 5 consecutive failures per fetcher index.

## Usage
```ts
const usgsBreaker = new CircuitBreaker(5, 30_000);
await fetchStageResilient(siteId, {
  fetchers: [usgsFetch, nwpsFetch],
  breakers: [usgsBreaker, nwpsBreaker],
  useFullJitter: true,
  getSnapshot,
  saveSnapshot,
});
```
