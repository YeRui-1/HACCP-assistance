#!/usr/bin/env python3
"""
安全危害分析 i18n 补丁
只改【纯显示文本】，不改【数据值/逻辑判断/option value/比较字符串】
"""
with open('d:/HACCP assistance/js/questionnaire-15min.js', 'rb') as f:
    c = f.read()

def rb(s): return s.encode('utf-8')

# ========== 安全的替换列表 ==========
safe = [
    # ---- 1. 危害分析表格列头（纯显示，不参与逻辑）----
    # 行约 910: <th>加工步骤/原料</th>
    (rb("'加工步骤/原料'"), rb("I18n.t('q.hwColStepMaterial')")),
    # <th>危害类别</th>
    (rb("'危害类别'"), rb("I18n.t('q.hwColHazardCategory')")),
    # <th>识别到的危害</th>
    (rb("'识别到的危害'"), rb("I18n.t('q.hwColIdentifiedHazard')")),
    # <th>控制措施 / 判定依据</th>
    (rb("'控制措施 / 判定依据'"), rb("I18n.t('q.hwColControlJustification')")),
    # <th>是否为CCP</th>
    (rb("'是否为CCP'"), rb("I18n.t('q.hwColIsCCP')")),

    # ---- 2. 危害类型显示标签（分离自逻辑用 key）----
    # 行 920 等处：var label = isZh ? {'B':'生物危害'...} : {'B':'Biological'...}
    # 这是纯显示的 label，不存 localStorage
    (rb("var label = isZh ? ({'B':'生物危害','C':'化学危害','P':'物理危害'}[t]) : ({'B':'Biological','C':'Chemical','P':'Physical'}[t]);"),
     rb("var label = I18n.t(t==='B'?'r15.bioHazard':(t==='C'?'r15.chemHazard':'r15.physHazard'));")),

    # ---- 3. hazardFull 对象 — 拆分为 keys（逻辑用）+ labels（显示用）----
    # 行 602, 776: 这两个地方都有 var hazardFull = ...
    # 方案：改成两套变量
    (rb("var hazardFull = { bio: '生物危害', chem: '化学危害', phys: '物理危害' };"),
     rb("var hazardFullKeys = ['bio','chem','phys']; var hazardFullLabels = { bio: I18n.t('r15.bioHazard'), chem: I18n.t('r15.chemHazard'), phys: I18n.t('r15.physHazard') };")),

    # 行 777: var name = hazardFull[hazardType] || '危害';
    # 需要在上面确认 hazardFull 已经改为 hazardFullLabels
    (rb("var name = hazardFull[hazardType] || '危害';"),
     rb("var name = hazardFullLabels[hazardType] || I18n.t('q.hwHazard');")),

    # ---- 4. Q1 问题模板（纯显示文本，拼接 hazardFullLabels 的结果）----
    # 行 779-783：Q1-Q4 的问题描述
    # 这些是纯显示，没问题
    (rb("'Q1：针对此加工步骤已识别的' + name + '，有控制措施存在吗？'"),
     rb("I18n.t('q.ccpQ1Prefix') + name + I18n.t('q.ccpQ1Suffix')")),
    (rb("'Q1（续）：该步骤上的控制对安全是必要的吗？'"),
     rb("I18n.t('q.ccpQ1Need')")),
    (rb("'Q2：该步骤是否专门设计用于把' + name + '的可能发生消除、降低到可接受水平？'"),
     rb("I18n.t('q.ccpQ2Prefix') + name + I18n.t('q.ccpQ2Suffix')")),
    (rb("'Q3：' + name + '产生的污染是否会超过可接受水平，或增加到不可接受水平？'"),
     rb("I18n.t('q.ccpQ3Prefix') + name + I18n.t('q.ccpQ3Suffix')")),
    (rb("'Q4：后续步骤可否消除' + name + '或将' + name + '的发生降低到可接受水平？'"),
     rb("I18n.t('q.ccpQ4Prefix') + name + I18n.t('q.ccpQ4Suffix')")),

    # ---- 5. 危害评估子步骤内的空数据提示 ----
    (rb("'该步骤暂未识别出显著危害'"), rb("I18n.t('q.hwNoHazard')")),
    (rb("'该材料无显著'"), rb("I18n.t('q.hwNoMaterial')")),
    (rb("'无显著'"), rb("I18n.t('q.hwNoSignificant')")),

    # ---- 6. 严重性/可能性/控制措施的列头 ----
    (rb("'严重性'"), rb("I18n.t('r15.severity')")),
    (rb("'发生可能性'"), rb("I18n.t('r15.likelihood')")),
    # 注意：control 已经在多处用作 key name，只改表格头
    (rb("'控制措施'"), rb("I18n.t('r15.control')")),
]

print(f"共 {len(safe)} 项替换")
applied = 0
for old, new in safe:
    cnt = c.count(old)
    if cnt == 0:
        print(f"  ✗ 未找到（0次）")
        continue
    c = c.replace(old, new)
    applied += 1
    print(f"  ✓ 替换 {cnt} 处")

with open('d:/HACCP assistance/js/questionnaire-15min.js', 'wb') as f:
    f.write(c)

print(f"\n成功应用 {applied}/{len(safe)} 项")
print("然后需要手动在 i18n.js 中添加对应的 key。")
