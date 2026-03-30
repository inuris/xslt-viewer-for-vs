---
applyTo: "**/python/**/*.py"
---

# Python transform.py

- **Contract:** stdin = one JSON object `{ "xmlContent": string, "xsltContent": string }`. stdout = raw bytes of transformation result (e.g. HTML). stderr = errors; exit code 1 on failure.
- Use `lxml.etree` for XML/XSLT parse and transform. Require `lxml`; print clear error to stderr if missing.
- On Windows, use `sys.stdin.reconfigure(encoding='utf-8')` when available for pipe robustness.
- MSXSL compatibility: replace `urn:schemas-microsoft-com:xslt` with `http://exslt.org/common` in XSLT before parsing.
- Any change to the JSON schema or output format must be reflected in `src/extension.ts` and in `AI_CONTEXT.md`.
