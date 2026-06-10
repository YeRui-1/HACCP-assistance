/**
 * 菊粉生产工艺流程图 - draw.io XML 初始数据
 * 对应原 Mermaid 流程图，两列布局
 */
var INULIN_DRAWIO_XML = '<mxfile host="HACCP-assistance" version="21.0.0">'
  + '<diagram id="inulin-process" name="菊粉生产工艺流程图">'
  + '<mxGraphModel dx="1200" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="900" pageHeight="1000" math="0" shadow="0">'
  + '<root>'
  + '<mxCell id="0"/>'
  + '<mxCell id="1" parent="0"/>'

  // ========== 左列主步骤 ==========
  + '<mxCell id="L1" value="菊芋验收 (CQP-1)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#e8f5e9;strokeColor=#43a047;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="200" y="30" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="L2" value="清洗 (OPRP-1)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#e3f2fd;strokeColor=#1976d2;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="200" y="130" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="L3" value="粉碎 (OPRP-2)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#e3f2fd;strokeColor=#1976d2;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="200" y="230" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="L4" value="匀浆" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#333333;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="200" y="330" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="L5" value="加热加压提取" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#333333;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="200" y="430" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="L6" value="减压浓缩" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#333333;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="200" y="530" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="L7" value="一级膜过滤 (CCP-1)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#fff3e0;strokeColor=#ff9800;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="200" y="630" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="L8" value="脱色 (OPRP-3)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#e3f2fd;strokeColor=#1976d2;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="200" y="730" width="160" height="44" as="geometry"/></mxCell>'

  // ========== 右列主步骤 ==========
  + '<mxCell id="R1" value="脱离子 (OPRP-4)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#e3f2fd;strokeColor=#1976d2;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="570" y="130" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="R2" value="二级膜过滤 (CCP-2)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#fff3e0;strokeColor=#ff9800;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="570" y="230" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="R3" value="醇降" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#333333;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="570" y="330" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="R4" value="干燥 (CCP-3)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#fff3e0;strokeColor=#ff9800;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="570" y="430" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="R5" value="金属检测 (CCP-4)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#fff3e0;strokeColor=#ff9800;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="570" y="530" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="R6" value="包装 (OPRP-5)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#e3f2fd;strokeColor=#1976d2;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="570" y="630" width="160" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="R7" value="成品储存与运输" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#333333;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="570" y="730" width="160" height="44" as="geometry"/></mxCell>'

  // ========== 左列侧边注释节点 ==========
  + '<mxCell id="Li2" value="地下水&#xa;超声波清洗机&#xa;30min、40℃" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=right;verticalAlign=middle;whiteSpace=wrap;overflow=hidden;fontSize=10;" vertex="1" parent="1"><mxGeometry x="20" y="135" width="130" height="44" as="geometry"/></mxCell>'
  + '<mxCell id="Lo2" value="废水" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="400" y="143" width="60" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Li3" value="粉碎机/捣碎机" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=right;verticalAlign=middle;whiteSpace=wrap;fontSize=10;" vertex="1" parent="1"><mxGeometry x="60" y="238" width="100" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Lo3" value="→5mm" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="400" y="238" width="60" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Li4" value="纯净水&#xa;超声波(50~100W;40KHZ)12min" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=right;verticalAlign=middle;whiteSpace=wrap;fontSize=10;" vertex="1" parent="1"><mxGeometry x="20" y="335" width="140" height="36" as="geometry"/></mxCell>'
  + '<mxCell id="Lo5" value="废渣" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="400" y="443" width="60" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Lo6" value="纯水" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="400" y="543" width="60" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Li7" value="搅拌机,絮凝沉淀,滤机" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=right;verticalAlign=middle;whiteSpace=wrap;fontSize=10;" vertex="1" parent="1"><mxGeometry x="40" y="638" width="120" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Lo7" value="蛋白质和纤维素" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=10;" vertex="1" parent="1"><mxGeometry x="400" y="638" width="110" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Li8" value="活性炭" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=right;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="90" y="738" width="70" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Lo8" value="废活性炭" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="400" y="738" width="80" height="28" as="geometry"/></mxCell>'

  // ========== 右列侧边注释节点 ==========
  + '<mxCell id="Ri1" value="交换树脂" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="760" y="138" width="80" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Ro1" value="饱和树脂" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="760" y="152" width="80" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Ro2" value="粗菊粉溶液" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="760" y="238" width="90" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Ri3" value="乙醇" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="490" y="338" width="50" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Ro3" value="沉淀" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="760" y="338" width="50" height="28" as="geometry"/></mxCell>'
  + '<mxCell id="Ri4" value="烘干设备&#xa;120-180℃" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=10;" vertex="1" parent="1"><mxGeometry x="480" y="435" width="70" height="36" as="geometry"/></mxCell>'
  + '<mxCell id="Ro5" value="不合格产品" style="text;html=1;strokeColor=#8e24aa;fillColor=#f3e5f5;align=center;verticalAlign=middle;fontSize=10;" vertex="1" parent="1"><mxGeometry x="760" y="538" width="80" height="28" as="geometry"/></mxCell>'

  // ========== 左列主流程箭头 ==========
  + '<mxCell id="eL1L2" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="L1" target="L2" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL2L3" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="L2" target="L3" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL3L4" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="L3" target="L4" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL4L5" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="L4" target="L5" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL5L6" value="粗提取液" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="L5" target="L6" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL6L7" value="浓缩粗提取液" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="L6" target="L7" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL7L8" value="菊粉溶液" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="L7" target="L8" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'

  // ========== 右列主流程箭头 ==========
  + '<mxCell id="eR1R2" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="R1" target="R2" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR2R3" value="精细菊粉溶液" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="R2" target="R3" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR3R4" value="菊粉溶液" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="R3" target="R4" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR4R5" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="R4" target="R5" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR5R6" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="R5" target="R6" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR6R7" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="R6" target="R7" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'

  // ========== 跨列连接：L8 → R1（菊粉溶液） ==========
  + '<mxCell id="eL8R1" value="菊粉溶液" style="edgeStyle=orthogonalEdgeStyle;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" edge="1" source="L8" target="R1" parent="1">'
  + '<mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="280" y="830"/><mxPoint x="650" y="830"/><mxPoint x="650" y="130"/></Array></mxGeometry>'
  + '</mxCell>'

  // ========== 回流箭头：L6 ← L5（循环提取） ==========
  + '<mxCell id="eLoop56" value="循环提取" style="edgeStyle=orthogonalEdgeStyle;dashed=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;" edge="1" source="L6" target="L5" parent="1">'
  + '<mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="410" y="552"/><mxPoint x="410" y="452"/></Array></mxGeometry>'
  + '</mxCell>'

  // ========== 回流箭头：R2 → R1（脱离子菊粉溶液） ==========
  + '<mxCell id="eLoopR21" value="脱离子菊粉溶液" style="edgeStyle=orthogonalEdgeStyle;dashed=1;exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" source="R2" target="R1" parent="1">'
  + '<mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="510" y="252"/><mxPoint x="510" y="152"/></Array></mxGeometry>'
  + '</mxCell>'

  // ========== 侧边注释箭头（虚线）==========
  + '<mxCell id="eLi2L2" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="Li2" target="L2" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL2Lo2" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="L2" target="Lo2" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eLi3L3" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="Li3" target="L3" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL3Lo3" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="L3" target="Lo3" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eLi4L4" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="Li4" target="L4" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL5Lo5" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="L5" target="Lo5" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL6Lo6" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="L6" target="Lo6" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eLi7L7" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="Li7" target="L7" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL7Lo7" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="L7" target="Lo7" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eLi8L8" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="Li8" target="L8" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eL8Lo8" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="L8" target="Lo8" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eRi1R1" style="dashed=1;exitX=0;exitY=0.5;entryX=1;entryY=0.5;" edge="1" source="Ri1" target="R1" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR1Ro1" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="R1" target="Ro1" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR2Ro2" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="R2" target="Ro2" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eRi3R3" style="dashed=1;exitX=0;exitY=0.5;entryX=1;entryY=0.5;" edge="1" source="Ri3" target="R3" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR3Ro3" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="R3" target="Ro3" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eRi4R4" style="dashed=1;exitX=0;exitY=0.5;entryX=1;entryY=0.5;" edge="1" source="Ri4" target="R4" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'
  + '<mxCell id="eR5Ro5" style="dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" source="R5" target="Ro5" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>'

  + '</root></mxGraphModel></diagram></mxfile>';

if (typeof window !== 'undefined') {
  window.INULIN_DRAWIO_XML = INULIN_DRAWIO_XML;
}
