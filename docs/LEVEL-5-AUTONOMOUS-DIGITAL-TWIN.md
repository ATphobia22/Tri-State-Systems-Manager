# TSM Level 5 Autonomous Digital Twin — Production Architecture

## Scope

TSM implements a bounded Level 5 control-plane architecture as an evidence-first autonomy system. The production default is S2 Prescribed Agency: observe -> fuse -> predict -> propose -> human approval. Physical actuation is disabled by default.

This distinction is intentional. TSM may simulate and prepare infrastructure actions, but it must not silently convert a prediction into a regulatory determination or an uncontrolled physical command.

## Implemented control loop

1. Observe — accept timestamped sensor observations with quality and freshness bounds.
2. Fuse — combine current observations using quality-weighted robust fusion; stale observations are rejected.
3. Predict — run bounded forward projections for up to 168 hours. The API default is 72 hours.
4. Propose — produce a tamper-evident proposal with scenario, forecast, confidence, action candidates, and governance state.
5. Approve — an authenticated TSM operator explicitly approves a proposal with a reason.
6. Execute — reviewer-authorized execution is a separate gate. Production defaults to disabled; a physical actuator requires a dedicated reviewed adapter and explicit allow-listing.
7. Audit — proposals and approvals are persisted under .data with restrictive permissions and HMAC approval records.

## Safety envelope

- TSM_AUTONOMY_KILL_SWITCH=true blocks execution immediately.
- TSM_AUTONOMY_EXECUTION_ENABLED defaults to false.
- TSM_ACTUATOR_MODE defaults to disabled.
- Generic arbitrary-URL HTTP actuation is prohibited.
- Action types must be explicitly allow-listed.
- Simulation/demo outputs remain is_simulation_demo=true.
- Regulatory filing, Evidence Ledger publication, FEMA/LOMA/LOMR submission, and jurisdiction-affecting decisions remain outside autonomous execution.
- No browser access token is exposed; OIDC remains server-managed through the existing BFF.

## API

### Status

GET /api/autonomy/status

Returns the current autonomy envelope, kill-switch state, actuator mode, and counts.

### Evaluate

POST /api/autonomy/evaluate

Authenticated tsm-operator role. Request example:

    {
      "telemetry": [
        {
          "sensor_id": "usgs-03378500",
          "metric": "stage_ft",
          "observed_at": "2026-09-27T18:00:00Z",
          "value": 4.4,
          "unit": "ft",
          "quality": 1,
          "source_authority": "USGS"
        }
      ],
      "scenario": "river_stage_rise",
      "horizon_hours": 72,
      "threshold": 5
    }

The response is a PENDING_HUMAN_APPROVAL proposal.

### Proposals

GET /api/autonomy/proposals

Returns recent proposals.

### Approve

POST /api/autonomy/proposals/{proposalId}/approve

Authenticated tsm-operator. Requires a reason of at least 10 characters.

### Execute

POST /api/autonomy/proposals/{proposalId}/execute

Authenticated tsm-reviewer. Execution remains fail-closed until an explicitly reviewed actuator adapter is installed, allow-listed, and enabled.

## Visual and 3D integration boundary

The existing TSM open-world renderer remains the presentation plane:

- OGC 3D Tiles, PMTiles, and MVT transport where configured.
- MapLibre, Three.js, and WebGPU presentation.
- Dynamic terrain, imagery, flood layers, and cinematic camera systems.
- Gaussian splats are presentation/reference assets only and never authoritative geometry.
- PBR/weather effects are visual state derived from observations, not engineering evidence.
- Micro-climate and radar fields remain observational/model layers with provenance.
- Building LoD, road networks, and satellite cascades retain source and license metadata.

The autonomy plane never treats a visual asset as a control authority.

## Operational maturity

This implementation makes the architecture Level-5-ready, not a claim that TSM currently has unrestricted Level 5 physical control of municipal infrastructure. Actual physical integration requires individually reviewed actuator adapters, identity, network segmentation, command acknowledgements, safe-state behavior, rate limits, rollback semantics, and agency authorization.

## Acceptance gates

- JavaScript and TypeScript parse gates pass.
- Level 5 contract tests pass.
- Schema validation passes.
- Existing Open World Twin validation remains green.
- Railway API starts only after OIDC bootstrap verification.
- Railway /ready is green only after OIDC configuration is complete.
- GitHub Pages deployment verifies both the generated page URL and the production API /ready endpoint.
