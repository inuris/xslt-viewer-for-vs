# XML/XSLT Formatter Rules (alignment with standards)

This document summarizes the formatter’s content-whitespace rules and how they align with XML/XPath and common practice.

## Standard definitions (XML 1.0 / XPath)

- **Whitespace** is exactly four characters ([XML 2.10](https://www.w3.org/TR/xml/#sec-white-space), production S):
  - `#x9`  (tab, `\t`)
  - `#xA`  (line feed, `\n`)
  - `#xD`  (carriage return, `\r`)
  - `#x20` (space)

- **Non‑breaking space** (`&#160;` / U+00A0) is **not** whitespace in XML. It must be preserved and must not be trimmed or collapsed.

- **normalize-space()** (XPath/XSLT): strips leading/trailing whitespace and **replaces** any run of the four whitespace characters with a single space (`#x20`). It does **not** remove whitespace; it normalizes to space.

- **Attribute value normalization** (XML 1.0): each of the four whitespace characters is replaced by a space; leading/trailing whitespace is stripped.

## Formatter rules (content)

| Rule | Current behavior | Standard / practice |
|------|------------------|---------------------|
| **Whitespace set** | Only these four: `\t` `\n` `\r` and space (and form feed/vertical tab for robustness). | Matches XML’s four; we treat only these as “whitespace” for trim/collapse. |
| **&#160; (U+00A0)** | Never trimmed or collapsed; preserved. | Matches XML (not whitespace). |
| **Other non-ASCII invisible spaces** | Preserved (not trimmed/collapsed by formatter). | Formatter only normalizes ASCII whitespace to avoid accidental semantic changes. |
| **Newline in content** | Replaced with a single space. | Matches normalization (LF/CR → space). |
| **Tab in content** | **Replace with space** (spec‑aligned). Alternative: *remove* (previous behavior). | XML/XPath normalize to space; “remove” is non‑standard. |
| **Whitespace‑only text between tags** | Collapsed to a single space + newline (to avoid many blank lines). | Common for pretty‑printers; preserves one space between inline elements. |
| **Inside tags** | Newlines in tag source collapsed to one space; quoted attribute values unchanged; &#160; preserved. | Aligns with “one line per tag” and safe attribute handling. |
| **Opening-tag attributes** | Attributes are emitted on the same line as the opening tag (outside-quote whitespace collapsed). | Matches compact XML formatter expectation for readable one-line tag headers. |
| **XML comments** | Comment body whitespace/newlines collapsed to single spaces (e.g. `<!-- fix new -->`). | Treated like compact tag text for readability while preserving comment meaning. |
| **`<style>` blocks** | If a `<style>` element only contains text, inner content is formatted as CSS (one declaration per line) but comments/strings preserved. | Matches typical HTML/CSS formatters. |
| **`<script>` blocks** | Content inside `<script>...</script>` is passed through **unchanged**; only the `<script>` and `</script>` tags are re-indented. | Avoids breaking JavaScript strings or logic embedded in the page. |

## Conflict and choice

- **Tab in content**: The XML/XPath rule is to **replace** tab with space (like `normalize-space()`). The formatter was previously **removing** tabs. Replacing with space is the default now for general compatibility; if you prefer **removing** tabs in content, that can be restored.

## References

- XML 1.0 (Fifth Edition), 2.10 White Space Handling, production S.
- XPath 1.0/2.0: `normalize-space()`.
- Many XML pretty‑printers: respect `xml:space="preserve"`, inline elements on one line, collapse insignificant whitespace.
