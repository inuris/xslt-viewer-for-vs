import http.server
import socketserver
import webbrowser
import os
import sys
import json
import mimetypes
from urllib.parse import urlparse, parse_qs

# Fix MIME types for Windows
mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')

# Try to import lxml for server-side rendering
try:
    from lxml import etree
    HAS_LXML = True
except ImportError:
    HAS_LXML = False
    print("Warning: lxml not found. Server-side rendering will be disabled.")

# Configuration
PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    # Explicitly set extensions_map to ensure correct MIME types
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
    })

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        # Handle API requests
        if self.path == '/api/render':
            self.handle_render()
        else:
            # Default behavior for other POSTs (not really used in static server)
            self.send_error(404, "Not Found")

    def handle_render(self):
        if not HAS_LXML:
            self.send_response(501)
            self.end_headers()
            self.wfile.write(b"lxml not installed on server")
            return

        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            xml_content = data.get('xmlContent')
            xslt_content = data.get('xsltContent')
            
            if not xml_content or not xslt_content:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing xmlContent or xsltContent")
                return

            # Compatibility Patch: Map MSXSL namespace to EXSLT to support node-set()
            # Many legacy XSLT files use msxsl:node-set(). lxml supports this via EXSLT.
            # By pointing the MSXSL namespace URI to the EXSLT URI, we map the function calls.
            if "urn:schemas-microsoft-com:xslt" in xslt_content:
                print("Patching MSXSL namespace to enable node-set() support")
                xslt_content = xslt_content.replace("urn:schemas-microsoft-com:xslt", "http://exslt.org/common")

            # Parse XML
            parser = etree.XMLParser(recover=True) # Be lenient
            xml_doc = etree.fromstring(xml_content.encode('utf-8'), parser=parser)
            
            # Parse XSLT
            xslt_doc = etree.fromstring(xslt_content.encode('utf-8'), parser=parser)
            transform = etree.XSLT(xslt_doc)
            
            # Transform
            result_tree = transform(xml_doc)
            
            # Serialize
            # method='html' is important for disable-output-escaping to work for script tags
            html_result = str(result_tree)
            
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(html_result.encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            error_response = {
                "error": str(e),
                "details": [],
                "raw_log": ""
            }

            # Try to get more details from lxml error log if available
            if 'transform' in locals() and hasattr(transform, 'error_log'):
                 log_str = str(transform.error_log)
                 error_response["raw_log"] = log_str
                 
                 # Parse lxml errors
                 for entry in transform.error_log:
                     error_response["details"].append({
                         "message": entry.message,
                         "line": entry.line,
                         "column": entry.column,
                         "level": entry.level_name,
                         "filename": entry.filename
                     })

            print(f"Server-side rendering error: {str(e)}")
            self.wfile.write(json.dumps(error_response).encode('utf-8'))

    def log_message(self, format, *args):
        # Optional: Override to reduce log noise or customize logging
        sys.stderr.write("%s - - [%s] %s\n" %
                         (self.client_address[0],
                          self.log_date_time_string(),
                          format%args))

def run_server():
    # Allow address reuse to prevent "Address already in use" errors on quick restarts
    socketserver.TCPServer.allow_reuse_address = True
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            url = f"http://localhost:{PORT}"
            print(f"\n---------------------------------------")
            print(f" Local Static Server Running")
            print(f" Serving: {DIRECTORY}")
            print(f" URL:     {url}")
            print(f"---------------------------------------")
            print("Press Ctrl+C to stop.\n")
            
            # Open the browser automatically
            webbrowser.open(url)
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped by user.")
    except OSError as e:
        print(f"\nError: Could not start server on port {PORT}.")
        print(f"Reason: {e}")
        print("Try changing the PORT variable in the script.")

if __name__ == "__main__":
    run_server()
