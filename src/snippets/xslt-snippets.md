# XSLT Snippets

Edit the snippets below. Use `##` for the label, an optional detail line, then a fenced code block (`` ```xml `` or `` ```xsl ``) so the IDE highlights the tag.

---

## XSLT Debug Invoice
Add Debug snippet: Show all XML tags
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

## Add NBan/Ten
Add XML tag: Seller name (`NBan/Ten`)

```xml
<xsl:choose>
    <xsl:when test="../../NBan/Ten != ''">
        <xsl:value-of select="../../NBan/Ten"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NBan/MST
Add XML tag: Seller tax code (`NBan/MST`)

```xml
<xsl:choose>
    <xsl:when test="../../NBan/MST != ''">
        <xsl:value-of select="../../NBan/MST"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NBan/DChi
Add XML tag: Seller address (`NBan/DChi`)

```xml
<xsl:choose>
    <xsl:when test="../../NBan/DChi != ''">
        <xsl:value-of select="../../NBan/DChi"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NBan/SDThoai
Add XML tag: Seller phone (`NBan/SDThoai`)

```xml
<xsl:choose>
    <xsl:when test="../../NBan/SDThoai != ''">
        <xsl:value-of select="../../NBan/SDThoai"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NBan/Fax
Add XML tag: Seller fax (`NBan/Fax`)

```xml
<xsl:choose>
    <xsl:when test="../../NBan/Fax != ''">
        <xsl:value-of select="../../NBan/Fax"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NBan/STKNHang
Add XML tag: Seller bank account (`NBan/STKNHang`)

```xml
<xsl:choose>
    <xsl:when test="../../NBan/STKNHang != ''">
        <xsl:value-of select="../../NBan/STKNHang"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NBan/TNHang
Add XML tag: Seller bank name (`NBan/TNHang`)

```xml
<xsl:choose>
    <xsl:when test="../../NBan/TNHang != ''">
        <xsl:value-of select="../../NBan/TNHang"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/SHChieu
Add XML tag: Buyer passport (`NMua/SHChieu`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/SHChieu != ''">
        <xsl:value-of select="../../NMua/SHChieu"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/CCCDan
Add XML tag: Buyer ID card (`NMua/CCCDan`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/CCCDan != ''">
        <xsl:value-of select="../../NMua/CCCDan"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/MDVQHNSach
Add XML tag: Budget Relationship Unit Code (`NMua/MDVQHNSach`)

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

## Add NMua/Ten
Add XML tag: Buyer company name (`NMua/Ten`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/Ten != ''">
        <xsl:value-of select="../../NMua/Ten"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/HVTNMHang
Add XML tag: Buyer full name (`NMua/HVTNMHang`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/HVTNMHang != ''">
        <xsl:value-of select="../../NMua/HVTNMHang"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/MST
Add XML tag: Buyer tax code (`NMua/MST`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/MST != ''">
        <xsl:value-of select="../../NMua/MST"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/DChi
Add XML tag: Buyer address (`NMua/DChi`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/DChi != ''">
        <xsl:value-of select="../../NMua/DChi"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/MKHang
Add XML tag: Buyer code (`NMua/MKHang`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/MKHang != ''">
        <xsl:value-of select="../../NMua/MKHang"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/DCTDTu
Add XML tag: Buyer email (`NMua/DCTDTu`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/DCTDTu != ''">
        <xsl:value-of select="../../NMua/DCTDTu"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```

---

## Add NMua/SDThoai
Add XML tag: Buyer phone (`NMua/SDThoai`)

```xml
<xsl:choose>
    <xsl:when test="../../NMua/SDThoai != ''">
        <xsl:value-of select="../../NMua/SDThoai"/>
    </xsl:when>
    <xsl:otherwise>
        &#160;
    </xsl:otherwise>
</xsl:choose>
```
