# Cesium ion hosted assets in TSM

TSM can stream a selected 3D Tiles asset from [Cesium ion](https://ion.cesium.com/assets) through the existing self-hosted CesiumJS runtime. This is an alternative to Google Photorealistic 3D Tiles and does not require Google Maps Platform billing.

## Configure the viewer

The application route is `/ion-assets`. It uses the configured asset ID and token at build time:

- `VITE_CESIUM_ION_ASSET_ID`: numeric asset ID from the Cesium ion assets dashboard.
- `VITE_CESIUM_ION_ACCESS_TOKEN`: dedicated read-only access token for that asset.

Set both values in the deployment build environment and rebuild. Vite `VITE_` values are embedded in the public browser bundle; they are not server-side secrets. Use a token scoped to only the selected asset, with the `assets:read` scope and URL restrictions for the deployed origin. Never use a token with write permissions in a browser client. Do not commit tokens to source control.

The viewer shows a configuration prompt when either value is absent. The existing `/terrain-3d` USGS 3DEP-derived terrain view remains independent and does not require a Cesium ion token.

## Cost and eligibility

Cesium currently lists a free Community plan for eligible individual, personal/non-commercial projects, with published quotas (including 10 GB storage and 15 GB/month streaming at the time this documentation was prepared). Quotas and terms can change. Check the live [Cesium ion pricing](https://cesium.com/platform/cesium-ion/pricing/) and [content usage guide](https://cesium.com/learn/ion/content-usage-and-attribution-guide/) before production use. Government projects, funded work, commercial use, or quota overages may require a paid plan; do not assume the free tier applies to operational government deployment.

## Security and provenance

- The CSP allows the Cesium ion API and asset hosts needed for streaming.
- Asset IDs and tokens are not hard-coded into the source.
- Use a per-application, read-only, asset-restricted token with allowed-URL restrictions.
- Monitor ion storage and streaming quotas; add operational alerts before public release.
- Retain the asset's attribution and source metadata in the product UI.
- Ion-hosted visual assets are not automatically authoritative survey control, authoritative LiDAR, or a FEMA regulatory determination.
- Do not scrape or bulk-mirror hosted tile payloads. Stream assets according to the provider's terms.

## Acceptance checklist

- [ ] Configure an eligible Cesium ion account and confirm the asset's license/usage terms.
- [ ] Set the asset ID and restricted read-only token as deployment build variables.
- [ ] Confirm the deployed URL is allowed by the token and the asset streams without authorization errors.
- [ ] Confirm attribution is visible for the selected asset.
- [ ] Confirm `/terrain-3d` still works without ion configuration.
- [ ] Verify quotas, attribution, and source provenance before operational use.

## Official references

- [Cesium ion assets](https://ion.cesium.com/assets)
- [Cesium ion pricing](https://cesium.com/platform/cesium-ion/pricing/)
- [Access-token security guidance](https://cesium.com/learn/ion/cesium-ion-access-tokens/)
- [Cesium ion content usage guide](https://cesium.com/learn/ion/content-usage-and-attribution-guide/)
- [CesiumJS API documentation](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html)
