import sys
import json
import os

try:
    from lxml import etree
except ImportError:
    sys.stderr.write(f"Error: lxml is not installed in the current Python environment: {sys.executable}\n")
    sys.stderr.write("Please run: pip install lxml (or configure 'xslt-viewer.pythonPath' in VS Code settings)\n")
    sys.exit(1)

def _format_error_log(title, error_log):
    """Format an lxml error log into a multi-line message with line/column info."""
    lines = [title + ":"]
    for entry in error_log:
        loc = f"line {entry.line}"
        if entry.column:
            loc += f", column {entry.column}"
        lines.append(f"  [{loc}] {entry.message}")
    return "\n".join(lines)


def _parse_xml_with_diagnostics(content_bytes):
    """Parse XML strictly first (to get precise syntax-error diagnostics with line
    numbers), then fall back to a recovering parser so minor real-world XML quirks
    don't block the transformation. Returns (doc, strict_syntax_errors_or_None)."""
    try:
        strict_parser = etree.XMLParser(recover=False)
        doc = etree.fromstring(content_bytes, parser=strict_parser)
        return doc, None
    except etree.XMLSyntaxError as e:
        strict_errors = list(e.error_log)

    recover_parser = etree.XMLParser(recover=True)
    doc = etree.fromstring(content_bytes, parser=recover_parser)
    return doc, strict_errors


def transform():
    try:
        # Increase robustness for Windows pipes
        if sys.platform == "win32" and hasattr(sys.stdin, "reconfigure"):
            sys.stdin.reconfigure(encoding='utf-8')

        # Read JSON from stdin
        input_data = sys.stdin.read()
        if not input_data:
            raise ValueError("No input data received")

        data = json.loads(input_data)
        xml_content = data.get('xmlContent')
        xslt_content = data.get('xsltContent')

        if not xml_content or not xslt_content:
            raise ValueError("Missing xmlContent or xsltContent")

        # Compatibility Patch: Map MSXSL namespace to EXSLT
        if "urn:schemas-microsoft-com:xslt" in xslt_content:
            xslt_content = xslt_content.replace("urn:schemas-microsoft-com:xslt", "http://exslt.org/common")

        # Parse XML data (source document). Real-world XML data can be messy, so we
        # recover when possible, but still surface strict-parse diagnostics if useful.
        xml_doc, _xml_syntax_errors = _parse_xml_with_diagnostics(xml_content.encode('utf-8'))

        # Parse XSLT. Keep track of any strict-parse syntax errors (e.g. malformed
        # comments/tags) even if a recovering parse succeeds, so that if XSLT
        # compilation later fails with a vague libxslt message, we can point at the
        # real underlying line/column.
        xslt_doc, xslt_syntax_errors = _parse_xml_with_diagnostics(xslt_content.encode('utf-8'))

        try:
            transform = etree.XSLT(xslt_doc)
        except etree.XSLTParseError as e:
            msg = _format_error_log("XSLT compile error", e.error_log) if e.error_log else f"XSLT compile error: {e}"
            if xslt_syntax_errors:
                msg += "\n\n" + _format_error_log(
                    "Likely root cause - the XSLT file has malformed XML at", xslt_syntax_errors
                )
            raise RuntimeError(msg)

        # Transform
        try:
            result_tree = transform(xml_doc)
        except etree.XSLTApplyError as e:
            msg = _format_error_log("XSLT transform error", transform.error_log) if transform.error_log else f"XSLT transform error: {e}"
            raise RuntimeError(msg)

        # Output Binary
        # Use stdout.buffer to write raw bytes directly to the pipe.
        # This avoids UnicodeEncodeErrors when Python tries to encode the output as text.
        sys.stdout.buffer.write(bytes(result_tree))

    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)

if __name__ == "__main__":
    transform()
