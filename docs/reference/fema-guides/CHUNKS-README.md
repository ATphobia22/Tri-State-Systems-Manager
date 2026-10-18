# FEMA Guides — Large File Notice

The following PDF guides are stored locally in this directory but exceed the GitHub API push size limit. They need to be pushed via direct git:

- `rasplot_v3_user-guide.pdf` (3.2 MB)
- `check-ras-user-guide.pdf` (1.5 MB)
- `fema-480-floodplain-management-study-guide.pdf` (10 MB)

## Chunked versions

For easier handling, chunked copies (40MB splits) are in `chunks/`:
- Each file is currently a single chunk (all under 40MB)

## Reassemble

```bash
cd docs/reference/fema-guides/chunks
cat rasplot_v3_user-guide_part_* > ../rasplot_v3_user-guide.pdf
cat check-ras-user-guide_part_* > ../check-ras-user-guide.pdf
cat fema-480-floodplain-management-study-guide_part_* > ../fema-480-floodplain-management-study-guide.pdf
```

## Push via git

```bash
cd ~/workspace/tri-state-review/repo
git add docs/reference/fema-guides/*.pdf
git commit -m "docs: add FEMA RASPLOT, cHECk-RAS, and FEMA 480 guides"
git push origin main
```
