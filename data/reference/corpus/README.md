# Original source regression corpus

Repository owner confirmed Public and explicitly authorized storing project source samples on 25/11/2026. Keep the four original files in `data/reference/` byte-identical. Add only project files covered by authorization; exclude unrelated files, secrets and personal data. No automatic upload from the offline app.

- Store each accessible authorized original using a unique stable name (source type, cutoff, original name, short SHA); do not overwrite, edit, normalize, or reconstruct. Deduplicate by SHA-256.
- Register each source in `../SOURCE_CORPUS.json` with path under this folder, SHA-256, Git blob SHA-1, size_bytes, type, sheet, cutoff and evidence, manualDate if necessary, unitCount, projectRowCount when relevant, expectedColumns and independently checked goldenSums. Never generate golden expected values with the importer under test.
- Run `tools/verify_reference_files.py` and `tests/source-corpus.spec.ts` as part of existing CI. Additional sources are test-only, not embedded in the offline HTML.
- `pendingOriginals` lists five original filenames located in Library metadata but not accessible as raw bytes. They are **not** committed or tested. Replace pending entry only when actual original is obtained and verified. Do not represent the generated report workbook as a source.
