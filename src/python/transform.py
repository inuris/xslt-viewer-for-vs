import sys
import json
import os

try:
    from lxml import etree
except ImportError:
    sys.stderr.write("Error: lxml is not installed in your Python environment.\n")
    sys.stderr.write("Please run: pip install lxml\n")
    sys.exit(1)

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

        # Parse XML
        parser = etree.XMLParser(recover=True)
        xml_doc = etree.fromstring(xml_content.encode('utf-8'), parser=parser)

        # Parse XSLT
        xslt_doc = etree.fromstring(xslt_content.encode('utf-8'), parser=parser)
        transform = etree.XSLT(xslt_doc)

        # Transform
        result_tree = transform(xml_doc)
        
        # Output Binary
        # Use stdout.buffer to write raw bytes directly to the pipe.
        # This avoids UnicodeEncodeErrors when Python tries to encode the output as text.
        sys.stdout.buffer.write(bytes(result_tree))

    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)

if __name__ == "__main__":
    transform()
