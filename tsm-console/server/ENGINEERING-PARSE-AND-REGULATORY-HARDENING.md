# TSM Engineering Parse and Regulatory Hardening

## Root-cause findings

The submitted Phase 0.5 artifact mixes three different languages in one logical block: Python/FastAPI, PostgreSQL DDL, and browser HTML/JavaScript. Those sections must remain separate source artifacts. The production repository is a Vite/React + Node ESM application, so the Python endpoint is implemented as a Node engineering module/API route rather than inserted into a TypeScript/JavaScript module.

The existing router also contained CommonJS `require('react-router')` calls inside a browser ESM module. Those calls were replaced with a normal ESM `useLoaderData` import. The previous `build` script masked TypeScript failures with `|| true`; it now fails on TypeScript errors before running Vite.

## Engineering solver boundary

`POST /api/v1/engineering/compensatory-storage` accepts:

- `plan_id`
- `fill_volume_cuft`
- `excavation_volume_cuft`
- `required_ratio`
- optional horizontal/vertical reference metadata

The solver validates finite numeric inputs, calculates required excavation and deficit, and produces a SHA-256 evidence hash. The output explicitly separates model compliance from a regulatory determination; `regulatory_determination` remains `null` until a human-authorized workflow supplies the applicable rule and review.

## Regulatory-source hardening

TSM should not freeze unverified legal thresholds in application logic. Current official-source review supports these evidence entries:

- Indiana DNR states a 0.14 ft cumulative surcharge criterion under the Flood Control Act, while 312 IAC 10-2-3 defines an increase of at least 0.15 ft as adversely affecting floodway efficiency/capacity. These are retained as distinct concepts.
- Illinois 17 Ill. Adm. Code 3700 defines the floodway using a 0.1 ft increase in stage for the cited floodway delineation standard.
- Kentucky 401 KAR 4:060 is verified as the stream-construction regulation, but TSM does not seed an unsupported `0.0000 ft` threshold.

A configurable compensatory-storage ratio such as `1.20x` is therefore treated as an engineering input unless a project-specific authoritative source establishes that value.

## Verification status

Local isolated tests were executed for the compensatory-storage solver and passed. Full repository build/test execution could not be run from this environment because the repository cannot be cloned through the available runtime network path. GitHub file state was re-read after each write.
