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

## Add sample QR as Image
Add a placeholder QR code link to vnpt-invoice.com.vn

```xml
<img style="width:110px;" src="data:image/png;base64,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"/>
```

---

## Update STT by TChat
Add XML condition to hide STT when TChat = 4 (Ghi chu)

```xml
<xsl:choose>
    <xsl:when test="TChat != 4">
        <xsl:choose>
            <xsl:when test="TTKhac/TTin[TTruong='Remark']/DLieu = '.'">&#160;</xsl:when>
            <xsl:when test="TTKhac/TTin[TTruong='Remark']/DLieu != ''">
                <xsl:value-of select="TTKhac/TTin[TTruong='Remark']/DLieu" />
            </xsl:when>
            <xsl:otherwise>
                <xsl:variable name="stt">
                    <xsl:number level="any" count="HHDVu[TChat!=4][ThTien!=0]" format="1"/>
                </xsl:variable>
                <xsl:choose>
                    <xsl:when test="$stt = 0 or $stt = ''">&#160;</xsl:when>
                    <xsl:otherwise>
                        <xsl:value-of select="$stt" />
                    </xsl:otherwise>
                </xsl:choose>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:when>
    <xsl:otherwise>&#160;</xsl:otherwise>
</xsl:choose>
```

---

## Line break by delimiter
Add line break by custom delimiter like `;`

```xml
<!-- Linebreak template -->
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

<!-- Linebreak call -->
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

## Fix MST (label type)
Update condition to display 10-14 characters

```xml
<xsl:choose>
    <xsl:when test="string-length(//NNT/MST)=14">
        <label>-</label>
        <label class="input-code" maxlength="1" style="margin-right:0px;">
            <xsl:value-of select="substring(//NNT/MST,12,1)" />
        </label>
        <label class="input-code" maxlength="1" style="margin-right:0px;">
            <xsl:value-of select="substring(//NNT/MST,13,1)" />
        </label>
        <label class="input-code" maxlength="1" style="margin-right:0px;">
            <xsl:value-of select="substring(//NNT/MST,14,1)" />
        </label>
    </xsl:when>
    <xsl:otherwise>
        <xsl:if test="substring(//NNT/MST,11,1) !=''">
            <label class="input-code" maxlength="1" style="margin-right:0px;">
                <xsl:value-of select="substring(//NNT/MST,11,1)" />
            </label>
        </xsl:if>
        <xsl:if test="substring(//NNT/MST,12,1) !=''">
            <label class="input-code" maxlength="1" style="margin-right:0px;">
                <xsl:value-of select="substring(//NNT/MST,12,1)" />
            </label>
        </xsl:if>
        <xsl:if test="substring(//NNT/MST,13,1) !=''">
            <label class="input-code" maxlength="1" style="margin-right:0px;">
                <xsl:value-of select="substring(//NNT/MST,13,1)" />
            </label>
        </xsl:if>
    </xsl:otherwise>
</xsl:choose>
```

---

## Add Replacement/Adjustment Invoice block
Add a block for replacement or adjustment invoices

```xml
<!-- Replacement/Adjustment template -->
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

<!-- Replacement/Adjustment call -->
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
</xsl:choose>
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

---

## Auto font-size when large string
Change font-size of 'Ten san pham' when string length > 120 and > 200

```xml
<xsl:attribute name="style">
    <xsl:choose>
        <xsl:when test="string-length(THHDVu) &gt; 200">font-size: 13px; line-height: 1.2;</xsl:when>
        <xsl:when test="string-length(THHDVu) &gt; 120">font-size: 14px; line-height: 1.2;</xsl:when>
        <xsl:otherwise>font-size: 15px; line-height: 1.3;</xsl:otherwise>
    </xsl:choose>
</xsl:attribute>
<xsl:value-of select="THHDVu" />
```

---

## Convert Number to Vietnamese Words
Convert a number into a Vietnamese text string (Đọc số tiền bằng tiếng Việt)

```xml
<!-- numberToVietnamese Template -->
<xsl:template name="vn_digitToWord">
	<xsl:param name="d"/>
	<xsl:choose>
		<xsl:when test="$d = 0">không</xsl:when>
		<xsl:when test="$d = 1">một</xsl:when>
		<xsl:when test="$d = 2">hai</xsl:when>
		<xsl:when test="$d = 3">ba</xsl:when>
		<xsl:when test="$d = 4">bốn</xsl:when>
		<xsl:when test="$d = 5">năm</xsl:when>
		<xsl:when test="$d = 6">sáu</xsl:when>
		<xsl:when test="$d = 7">bảy</xsl:when>
		<xsl:when test="$d = 8">tám</xsl:when>
		<xsl:when test="$d = 9">chín</xsl:when>
	</xsl:choose>
</xsl:template>
<!-- Chuyển nhóm 3 chữ số (1-999) sang chữ. needLe='1': thêm "lẻ" khi hàng trăm = 0 và chỉ có hàng đơn vị -->
<xsl:template name="vn_group">
	<xsl:param name="g"/>
	<xsl:param name="needLe" select="'0'"/>
	<xsl:variable name="h" select="floor($g div 100)"/>
	<xsl:variable name="t" select="floor(($g mod 100) div 10)"/>
	<xsl:variable name="u" select="$g mod 10"/>
	<xsl:choose>
		<xsl:when test="$h > 0">
			<xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$h"/></xsl:call-template>
			<xsl:text>&#160;trăm</xsl:text>
			<xsl:choose>
				<xsl:when test="$t = 0 and $u = 0"/>
				<xsl:when test="$t = 0">
					<xsl:text>&#160;lẻ&#160;</xsl:text>
					<xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$u"/></xsl:call-template>
				</xsl:when>
				<xsl:when test="$t = 1">
					<xsl:text>&#160;mười</xsl:text>
					<xsl:choose>
						<xsl:when test="$u = 0"/>
						<xsl:when test="$u = 5"><xsl:text>&#160;lăm</xsl:text></xsl:when>
						<xsl:otherwise><xsl:text>&#160;</xsl:text><xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$u"/></xsl:call-template></xsl:otherwise>
					</xsl:choose>
				</xsl:when>
				<xsl:otherwise>
					<xsl:text>&#160;</xsl:text>
					<xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$t"/></xsl:call-template>
					<xsl:text>&#160;mươi</xsl:text>
					<xsl:choose>
						<xsl:when test="$u = 0"/>
						<xsl:when test="$u = 1"><xsl:text>&#160;mốt</xsl:text></xsl:when>
						<xsl:when test="$u = 5"><xsl:text>&#160;lăm</xsl:text></xsl:when>
						<xsl:otherwise><xsl:text>&#160;</xsl:text><xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$u"/></xsl:call-template></xsl:otherwise>
					</xsl:choose>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:when>
		<xsl:otherwise>
			<!-- h = 0: nhóm dưới 100 -->
			<xsl:choose>
				<xsl:when test="$t = 0 and $u = 0"/>
				<xsl:otherwise>
					<!-- "lẻ" chỉ thêm khi không có hàng chục (t=0) -->
					<xsl:if test="$needLe = '1' and $t = 0"><xsl:text>lẻ&#160;</xsl:text></xsl:if>
					<xsl:choose>
						<xsl:when test="$t = 0">
							<xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$u"/></xsl:call-template>
						</xsl:when>
						<xsl:when test="$t = 1">
							<xsl:text>mười</xsl:text>
							<xsl:choose>
								<xsl:when test="$u = 0"/>
								<xsl:when test="$u = 5"><xsl:text>&#160;lăm</xsl:text></xsl:when>
								<xsl:otherwise><xsl:text>&#160;</xsl:text><xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$u"/></xsl:call-template></xsl:otherwise>
							</xsl:choose>
						</xsl:when>
						<xsl:otherwise>
							<xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$t"/></xsl:call-template>
							<xsl:text>&#160;mươi</xsl:text>
							<xsl:choose>
								<xsl:when test="$u = 0"/>
								<xsl:when test="$u = 1"><xsl:text>&#160;mốt</xsl:text></xsl:when>
								<xsl:when test="$u = 5"><xsl:text>&#160;lăm</xsl:text></xsl:when>
								<xsl:otherwise><xsl:text>&#160;</xsl:text><xsl:call-template name="vn_digitToWord"><xsl:with-param name="d" select="$u"/></xsl:call-template></xsl:otherwise>
							</xsl:choose>
						</xsl:otherwise>
					</xsl:choose>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:otherwise>
	</xsl:choose>
</xsl:template>
<!-- Chuyển số nguyên sang chuỗi tiếng Việt (không có "đồng", không viết hoa) -->
<xsl:template name="vn_convertNumber">
	<xsl:param name="n"/>
	<xsl:variable name="ty"    select="floor($n div 1000000000)"/>
	<xsl:variable name="rem1"  select="$n mod 1000000000"/>
	<xsl:variable name="trieu" select="floor($rem1 div 1000000)"/>
	<xsl:variable name="rem2"  select="$rem1 mod 1000000"/>
	<xsl:variable name="nghin" select="floor($rem2 div 1000)"/>
	<xsl:variable name="donvi" select="$rem2 mod 1000"/>
	<xsl:if test="$ty > 0">
		<xsl:call-template name="vn_group"><xsl:with-param name="g" select="$ty"/><xsl:with-param name="needLe" select="'0'"/></xsl:call-template>
		<xsl:text>&#160;tỷ</xsl:text>
		<xsl:if test="$rem1 > 0"><xsl:text>&#160;</xsl:text></xsl:if>
	</xsl:if>
	<xsl:if test="$trieu > 0">
		<xsl:call-template name="vn_group">
			<xsl:with-param name="g" select="$trieu"/>
			<xsl:with-param name="needLe"><xsl:choose><xsl:when test="$ty > 0 and $trieu &lt; 100">1</xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:with-param>
		</xsl:call-template>
		<xsl:text>&#160;triệu</xsl:text>
		<xsl:if test="$rem2 > 0"><xsl:text>&#160;</xsl:text></xsl:if>
	</xsl:if>
	<xsl:if test="$nghin > 0">
		<xsl:call-template name="vn_group">
			<xsl:with-param name="g" select="$nghin"/>
			<xsl:with-param name="needLe"><xsl:choose><xsl:when test="($ty > 0 or $trieu > 0) and $nghin &lt; 100">1</xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:with-param>
		</xsl:call-template>
		<xsl:text>&#160;nghìn</xsl:text>
		<xsl:if test="$donvi > 0"><xsl:text>&#160;</xsl:text></xsl:if>
	</xsl:if>
	<xsl:if test="$donvi > 0">
		<xsl:call-template name="vn_group">
			<xsl:with-param name="g" select="$donvi"/>
			<xsl:with-param name="needLe"><xsl:choose><xsl:when test="($ty > 0 or $trieu > 0 or $nghin > 0) and $donvi &lt; 100">1</xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:with-param>
		</xsl:call-template>
	</xsl:if>
</xsl:template>
<!-- Gọi template này để đọc số tiền VNĐ bằng chữ (có viết hoa chữ đầu, có " đồng") -->
<!-- Ví dụ: <xsl:call-template name="numberToVietnamese"><xsl:with-param name="amount" select="round(../../../TTChung/TGia * ../../TToan/TgTTTBSo)"/></xsl:call-template> -->
<xsl:template name="numberToVietnamese">
	<xsl:param name="amount"/>
	<xsl:variable name="n" select="floor(number(translate(string($amount), ',', '.')))"/>
	<xsl:choose>
		<xsl:when test="string($n) = 'NaN' or $n = 0">Không đồng</xsl:when>
		<xsl:otherwise>
			<xsl:variable name="absN" select="$n * ($n &gt; 0) - $n * ($n &lt; 0)"/>
			<xsl:variable name="words">
				<xsl:call-template name="vn_convertNumber"><xsl:with-param name="n" select="$absN"/></xsl:call-template>
			</xsl:variable>
			<xsl:variable name="capitalized" select="concat(translate(substring($words,1,1),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ'), substring($words,2))"/>
			<xsl:if test="$n &lt; 0"><xsl:text>(Âm)&#160;</xsl:text></xsl:if>
			<xsl:value-of select="$capitalized"/>
			<xsl:text>&#160;đồng</xsl:text>
		</xsl:otherwise>
	</xsl:choose>
</xsl:template>
<!-- END numberToVietnamese Template -->

<!-- numberToVietnamese Call -->
<xsl:call-template name="numberToVietnamese">
    <xsl:with-param name="amount" select="round(../../TToan/TgTTTBSo)"/>
</xsl:call-template>

```