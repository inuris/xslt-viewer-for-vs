# XSLT Snippets

Edit the snippets below. Use `##` for the label, an optional detail line, then a fenced code block (`` ```xml `` or `` ```xsl ``) so the IDE highlights the tag.

---

## xsl:stylesheet boilerplate
Minimal XSLT stylesheet shell.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <xsl:output method="html" indent="yes"/>

    <xsl:template match="/">
        <!-- TODO: implement transformation -->
    </xsl:template>

</xsl:stylesheet>
```

---

## xsl:template match="/"
Root template matching document root.

```xml
<xsl:template match="/">
    <!-- TODO: implement root template -->
</xsl:template>
```

---

## xsl:for-each over nodes
Loop over a set of nodes.

```xml
<xsl:for-each select="items/item">
    <!-- TODO: output each item -->
</xsl:for-each>
```

---

## xsl:value-of
Output text content of a node.

```xml
<xsl:value-of select=""/>
```

---

## xsl:if
Conditional block.

```xml
<xsl:if test="">
    
</xsl:if>
```
