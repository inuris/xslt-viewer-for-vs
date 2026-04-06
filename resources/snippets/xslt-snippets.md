# XSLT Snippets

Edit the snippets below. Use `##` for the label, an optional detail line, then a fenced code block (`` ```xml `` or `` ```xsl ``) so the IDE highlights the tag.

---

## XSLT Debug Invoice
Add Debug snippet: Show all XML tags
```xml
<!-- DEBUG MODE -->
<!-- Ten Nguoi Mua = debug -->
<xsl:if test="(//TTChung/SHDon=0 and (//NMua/HVTNMHang='debug' or //NMua/HVTNNHang='debug')) or (//TTChung/SCTu=0 and //NNT/Ten='debug')">
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

## Add blank image as Background
Add url(data:image/gif;base64,...)

```xml
url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)
```

---

## Add blank image as Image
Add "data:image/gif;base64,..."

```xml
data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7
```


---

## Update STT by TChat
Add XML condition to hide STT when TChat = 4 (Ghi chu)

```xml
<xsl:choose>
    <xsl:when test="TChat = 1">
        <xsl:number level="any" count="HHDVu[TChat=1]" format="1"/>
    </xsl:when>
    <xsl:when test="TChat = 4">&#160;</xsl:when>
    <xsl:when test="TTKhac/TTin[TTruong='Remark']/DLieu = '.'">
        &#160;
    </xsl:when>
    <xsl:when test="TTKhac/TTin[TTruong='Remark']/DLieu != ''">
        <xsl:value-of select="TTKhac/TTin[TTruong='Remark']/DLieu" />
    </xsl:when>
    <xsl:otherwise>
        <xsl:value-of select="STT" />
    </xsl:otherwise>
</xsl:choose>
```

---

## Line break by delimiter
Add line break by custom delimiter like `;`

```xml
<!-- Template define -->
<xsl:template name="linebreak">
    <xsl:param name="text" />
    <xsl:param name="delimiter" select="';'" />
    <xsl:choose>
        <xsl:when test="contains($text, $delimiter)">
            <xsl:value-of select="substring-before($text, $delimiter)" />
            <br />
            <!-- recursive call -->
            <xsl:call-template name="linebreak">
                <xsl:with-param name="text" select="substring-after($text, $delimiter)" />
            </xsl:call-template>
        </xsl:when>
        <xsl:otherwise>
            <xsl:value-of select="$text" />
        </xsl:otherwise>
    </xsl:choose>
</xsl:template>

<!-- Template call -->
<xsl:call-template name="linebreak">
    <xsl:with-param name="text" select="THHDVu" />
</xsl:call-template>
```

---

## Fix MST (span type)
Update condition to display 10-14 characters

```xml
<xsl:choose>
    <xsl:when test="string-length(//NNT/MST)=14">
        <span style="margin-top: 5px;">-</span>
        <span class="number">
            <xsl:value-of select="substring(//NNT/MST,12,1)" />
        </span>
        <span class="number">
            <xsl:value-of select="substring(//NNT/MST,13,1)" />
        </span>
        <span class="number">
            <xsl:value-of select="substring(//NNT/MST,14,1)" />
        </span>
    </xsl:when>
    <xsl:otherwise>
        <xsl:if test="substring(//NNT/MST,11,1) !=''">
            <span class="number">
                <xsl:value-of select="substring(//NNT/MST,11,1)" />
            </span>
        </xsl:if>
        <xsl:if test="substring(//NNT/MST,12,1) !=''">
            <span class="number">
                <xsl:value-of select="substring(//NNT/MST,12,1)" />
            </span>
        </xsl:if>
        <xsl:if test="substring(//NNT/MST,13,1) !=''">
            <span class="number">
                <xsl:value-of select="substring(//NNT/MST,13,1)" />
            </span>
        </xsl:if>
    </xsl:otherwise>
</xsl:choose>
```

---

## Add Replacement/Adjustment Invoice block
Add a block for replacement or adjustment invoices

```xml
<!-- Template define -->
<xsl:template name="detectTTHDLQuan">
    <xsl:variable name="pTCHDon">
    <xsl:value-of select="../../../TTChung/TTHDLQuan/TCHDon"/>
    </xsl:variable>
    <xsl:variable name="pGChu">
    <xsl:choose>
        <xsl:when test="$pTCHDon = 1 or $pTCHDon = 2">
        <xsl:choose>
            <xsl:when test="$pTCHDon = 1">
            <xsl:text> Thay thế</xsl:text>
            </xsl:when>
            <xsl:otherwise>
            <xsl:text> Điều chỉnh</xsl:text>
            </xsl:otherwise>
        </xsl:choose>
        </xsl:when>
    </xsl:choose>
    </xsl:variable>
    <xsl:choose>
    <xsl:when test="$pGChu != ''">
        <xsl:variable name="pKHMSHDCLQuan">
        <xsl:value-of select="../../../TTChung/TTHDLQuan/KHMSHDCLQuan"/>
        </xsl:variable>
        <xsl:variable name="pKHHDCLQuan">
        <xsl:value-of select="../../../TTChung/TTHDLQuan/KHHDCLQuan"/>
        </xsl:variable>
        <xsl:variable name="pSHDCLQuan">
        <xsl:value-of select="../../../TTChung/TTHDLQuan/SHDCLQuan"/>
        </xsl:variable>
        <xsl:variable name="pNgay">
        <xsl:value-of select="substring(../../../TTChung/TTHDLQuan/NLHDCLQuan, 9, 2)"/>
        </xsl:variable>
        <xsl:variable name="pThang">
        <xsl:value-of select="substring(../../../TTChung/TTHDLQuan/NLHDCLQuan, 6, 2)"/>
        </xsl:variable>
        <xsl:variable name="pNam">
        <xsl:value-of select="substring(../../../TTChung/TTHDLQuan/NLHDCLQuan, 1, 4)"/>
        </xsl:variable>
        <xsl:value-of select="concat($pGChu, ' cho hóa đơn mẫu số ', $pKHMSHDCLQuan, ' ký hiệu ', $pKHHDCLQuan, ' số ', $pSHDCLQuan, ' ngày ', $pNgay, ' tháng ', $pThang, ' năm ', $pNam)"/>
    </xsl:when>
    </xsl:choose>
</xsl:template>

<!-- Template call -->
<xsl:choose>
    <xsl:when test="../../../TTChung/TTHDLQuan != ''">
        <div style="text-align:center;padding-top:0px;font-size:11px;text-transform:uppercase;font-weight: bold;">
            <xsl:call-template name="detectTTHDLQuan"/>
        </div>
    </xsl:when>
</xsl:choose>
```

---

## Add Signature Block
Add a signature block with signer and signing date

```xml
<xsl:choose>
    <xsl:when test="//MCCQT != '' ">
        <div class="bgimg" style="background:url(data:image/png;base64,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) no-repeat center center; height: 90px">
            <p style="margin-top:3px;margin-bottom:5px;font-size:12px">
                <xsl:value-of select="../../../../image" />
            </p>
            <p style="font-size:12px;margin:3px 0px;">Ký bởi:
                <xsl:value-of select="../../NBan/Ten" />
            </p>
            <p style="margin:0px;">Ký ngày:
                <xsl:choose>
                    <xsl:when test="substring(../../../TTChung/NLap,1,4)!= '1957' and substring(../../../TTChung//NLap,1,4)!= ''">
                        <xsl:value-of select="substring(../../../TTChung//NLap,9,2)" />/
                        <xsl:value-of select="substring(../../../TTChung//NLap,6,2)" />/
                        <xsl:value-of select="concat('20',substring(../../../TTChung//NLap,3,2))" />
                    </xsl:when>
                    <xsl:otherwise>
                    </xsl:otherwise>
                </xsl:choose>
            </p>
        </div>
    </xsl:when>
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
