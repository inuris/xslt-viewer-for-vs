# XSLT Snippets

Edit the snippets below. Use `##` for the label, an optional detail line, then a fenced code block (`` ```xml `` or `` ```xsl ``) so the IDE highlights the tag.

---

## XSLT Debug Invoice
Add Debug information to XSLT
```xml
<!-- DEBUG MODE -->
<!-- Ten Nguoi Mua = debug -->
<xsl:if test="/HDon/DLHDon/TTChung/SHDon=0 and /HDon/DLHDon/NDHDon/NMua/HVTNMHang='debug'">
    <div id="xmldebug" style="background:#fff3cd;padding:15px;margin:20px;font-family:monospace;font-size:13px;text-align:left;max-width:100%;box-sizing:border-box;">
        <style>
            .dbg-tabs{display:flex;gap:5px;margin-bottom:10px;border-bottom:1px solid #ffeeba;padding-bottom:10px}
            .dbg-btn{background:#856404;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-weight:700}
            .dbg-view{background: #fff;padding:10px;border:1px solid #ffeeba;max-height:600px;overflow-x:hidden;overflow-y:auto;width:100%;box-sizing:border-box;word-break:break-all}
        </style>
        <div class="dbg-tabs">
            <b style="color:#856404;font-size:14px">Debug: XPath View</b>
            <button class="dbg-btn" style="background:#28a745;margin-left:auto" onclick="dl()">Download XML</button>
        </div>
        <div id="xpv" class="dbg-view">
            <xsl:for-each select="//*">
                <div style="border-bottom:1px solid #eee;padding:4px 0;width:100%;box-sizing:border-box">
                    <b style="color:#d63384"><xsl:for-each select="ancestor-or-self::*">/<xsl:value-of select="name()"/></xsl:for-each></b>
                    <xsl:if test="not(*)"> <span style="color:#0d6efd">= <xsl:value-of select="normalize-space(.)"/></span></xsl:if>
                </div>
            </xsl:for-each>
        </div>
        <textarea id="xmlv" style="display:none">&lt;?xml-stylesheet type='text/xsl' href='invoice.xslt' ?&gt;&#xa;<xsl:copy-of select="/*"/></textarea>
        <script>
            function dl(){var v=document.getElementById('xmlv').value,b=new Blob([v],{type:'text/xml'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='invoice.xml';a.click();URL.revokeObjectURL(u)}
        </script>
    </div>
</xsl:if>
<!-- END: DEBUG MODE -->
```

---

## Add XML - MDVQHNSach
Add XML: Ma don vi quan he ngan sach

```xml
<xsl:choose>
    <xsl:when test="../../NMua/MDVQHNSach != ''">
        <xsl:value-of select="../../NMua/MDVQHNSach"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---