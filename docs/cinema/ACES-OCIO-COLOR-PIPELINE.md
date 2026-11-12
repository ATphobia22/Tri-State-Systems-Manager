# TSM cinematic color management — ACEScg / OCIO delivery contract

**Status:** production design and acceptance criteria, **not evidence that the existing 2026 community film was rendered in ACEScg**.

## Two media classes, never confuse them

1. **Scene-linear CGI / live-action color:** use a pinned Academy Color Encoding System (ACES) OpenColorIO v2 configuration and ACEScg (AP1 primaries, linear transfer) for rendering, lighting, keying and physically meaningful compositing in floating-point OpenEXR. In a native ACES workflow, require a reviewed OCIO `config.ocio`, documented role `scene_linear=ACEScg`, exact software version, scene-referred image metadata and render receipt.
2. **Scientific data:** depth, velocity, bathymetry, elevation, normal vectors, flood masks, object IDs, geoid offsets and segmentation labels are **data**, not display colors. Mark non-color / raw; do not run ACES color transforms, tone mapping, gamut compression, sharpening, gamma or Rec.709 display looks over scientific channels. Preserve float32 and original units, CRS, vertical datum and checksums in independent evidence files.

## Blender → Natron handoff

### Path A: native linear Rec.709/sRGB OpenEXR

- Blender's usual scene-linear working primaries are Rec.709 / sRGB, unless an explicitly pinned OCIO config says otherwise.
- An OpenEXR render is scene-linear; **Filmic/AgX is a view transform, not an instruction to bake that look into the EXR**. Export linear color with high precision and retain the original primaries as part of the manifest.
- In Natron, configure matching OCIO and transform from the declared linear Rec.709/sRGB colorspace into **ACEScg** before compositing.
- The literal colorspace token varies between OCIO configs; do not hardcode obsolete `Utility - Linear - sRGB` and assume it is in every ACES 2.0 config.

### Path B: native ACEScg OpenEXR

- Install the reviewed ACES OCIO configuration for Blender and Natron, verify `ACEScg` exists, and render EXR frames in scene-linear ACEScg.
- Read into Natron with a **matching input space**; do not apply an extra transform if the EXR is already ACEScg.
- Maintain floating-point EXR intermediates; avoid clipping or display-referred encoding before final output.

For both paths, mixed JPEG/PNG assets must be identified as **display-referred sRGB** if that is what they actually are; convert them using the pinned OCIO config. Do not confuse *sRGB transfer* with *Rec.709 viewing gamma* or declare all EXRs ACEScg regardless of their primaries.

## Output transforms: never replace a display/view transform with a simple gamut conversion

- **SDR:** apply an ACES Output Transform / OCIO `DisplayViewTransform` for the explicitly selected **Rec.709 / BT.1886** (or sRGB) display target. Produce an SDR H.264/H.265 master tagged and QC-tested for the corresponding primaries, transfer and matrix coefficients.
- **HDR10:** use the ACES output view for the selected **Rec.2100 ST2084 PQ** 1000-nit mastering target, 10-bit or better, correct Rec.2020 color signaling, mastering-display and content-light-level metadata informed by measured output. Do not call a file HDR10 because it was merely tagged BT.2020/PQ.
- **RGC:** use a documented, supported ACES/reference gamut compression option only if the selected OCIO view pipeline needs it. ACES 1.3 RGC choices and ACES 2.0 output transforms are *not interchangeable drop-in steps*.
- Inspect luma, chroma, skin/face tones and title safety, legal/data color scales, highlight roll-off and exports in a suitable waveform/vectorscope monitor.

## Existing TSM community movie

The 2026 community film currently originates as a **1280×720, 20 fps, 8-bit display-referred H.264 master**, with AAC audio. A separate **theatrical SDR grade** raises restrained contrast and saturation, retains the original source resolution and duration, and is tagged Rec.709. Neither file is an ACEScg 32-bit float EXR sequence or has a validated HDR10 master. Upscaling cannot restore missing rendered detail.

Do **not** apply a second ACES Output Transform to that SDR file: that would incorrectly treat display-referred video as scene-linear source. Proper ACES finishing requires new CGI footage or original source plates and a measured input display-to-scene inversion workflow.

## Artifact manifest for a true ACES render

```json
{
  "schema": "tsm.cinema.color-delivery.v1",
  "workflow": "scene_linear_acescg",
  "ocio_config_sha256": "<64 measured lowercase hex>",
  "ocio_config_version": "<exact version>",
  "input_space": "ACEScg",
  "working_space": "ACEScg",
  "exr_pixel_type": "FLOAT",
  "exr_compression": "<lossless or explicitly reviewed>",
  "render_frame_receipt_sha256": "<64 measured lowercase hex>",
  "output_display": "Rec.1886 Rec.709",
  "output_view": "<validated view name from pinned OCIO config>",
  "output_codec": "H.264",
  "output_sha256": "<64 measured lowercase hex>",
  "science_pass_treatment": "raw_non_color_no_display_transform"
}
```

All placeholders require real artifact evidence. `ocio_config_sha256` and the EXR pixel/channel metadata must be inspected automatically before claiming an ACES master. Document the software version, monitor/calibration, camera IDT, DRT/ODT and any RGC look in a reproducible manifest.

## Primary references

- [OpenColorIO ACES config releases, including ACES 2.0](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/releases)
- [OpenColorIO configurations and DisplayViewTransform distinction](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/docs/configurations/aces_cg.rst)
- [Blender 4.5 color management](https://docs.blender.org/manual/en/4.5/render/color_management.html)

**Engineering boundary:** a visually impressive cinematic flood layer is illustrative until its water levels, time axis, hydraulics, governing vertical datum and source inputs are independently evidenced. Human review remains final.
