# ChatGPT PH1 ownership and collaboration policy

- Read repository root `README.md` -> `AGENTS.md` -> `docs/specs/KTXH_OFFLINE_MASTER_SPEC_V2_2_CURRENT.md` -> `docs/plans/PHASE_1_RESULT_TEMPLATE.md`, in that order. The parent documents override this file.
- Write only in `chatgpt/**` on branch `chatgpt/ph1-20261109`, except the namespaced CI workflow `.github/workflows/chatgpt-ph1.yml` if required. All code changes require local or CI test evidence.
- Never copy, edit or commit the four original source workbooks. They remain shared at `../data/reference/` with `../data/reference/MANIFEST.json` and are the common fixture for all AI collaborators.
- Do not adopt PH2 work until the explicit PH1 gate is proved. No dynamic arbitrary-formula editor, network backend, OAuth, telemetry or CDN.
- Never pass `NO_LOCALITY_RECORD` off as zero projects or no revenue. Never compute average GPMB percentages. M is used only to check project rows against 100*I/D (threshold >0.1 percentage point).
- Local browser policy may prevent a file:// verification in a development environment: record that as `NOT_VERIFIED`, not PASS. Unit/synthetic tests cannot substitute for the three shared source fixtures.
- After code modifications rerun tests on current SHA and update `chatgpt/docs/STATUS.md`. The root `docs/status/PROJECT_STATUS.md` is owned by the project coordinator; leave it unchanged during parallel work and propose integration via PR.
