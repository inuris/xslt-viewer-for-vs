# XSLT Snippets

Snippet definitions for **XSLT: Insert Snippet** (right-click in editor → **XSLT Snippets**). Use **`xslt-snippets.md`** so the IDE shows syntax highlighting inside code blocks.

## Format (Markdown)

- Each snippet is a **`##` heading** (label), an optional **detail line**, then a **fenced code block** with `` ```xml `` or `` ```xsl ``. The content inside the block is the snippet body and is highlighted as XML/XSLT in VS Code.
- You can use `` --- `` between snippets for readability (optional).

### Example

    ## xsl:stylesheet boilerplate
    Minimal XSLT stylesheet shell.

    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
        <xsl:template match="/"><!-- TODO --></xsl:template>
    </xsl:stylesheet>
    ```

    ## xsl:template match="/"
    Root template.

    ```xml
    <xsl:template match="/"><!-- TODO --></xsl:template>
    ```

## Custom file location

Set **xslt-viewer.snippetsFile** to your snippet file path (e.g. `my-snippets.md`). Leave empty to use the built-in `src/snippets/xslt-snippets.md`.
