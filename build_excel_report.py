"""
Build academic-style Excel report from HACCP consumer survey CSV.
Generates embedded charts with publication-ready formatting — fully English.
"""
import csv
from openpyxl import Workbook
from openpyxl.styles import (
    Font, Alignment, Border, Side, PatternFill
)
from openpyxl.chart import BarChart, DoughnutChart, Reference
from openpyxl.chart.series import DataPoint, SeriesLabel
from openpyxl.chart.label import DataLabelList
from openpyxl.utils import get_column_letter

CSV_PATH = 'c:/Users/2968560269/Downloads/26414228_202607270024555139.csv'
OUTPUT_PATH = 'd:/HACCP assistance/HACCP_Survey_Analysis.xlsx'
N = 152

# ── Academic palette (print-friendly, greyscale-compatible) ──
C = {
    'navy':    '1B3A5C',
    'blue':    '2E6B9E',
    'sky':     '7CB5D8',
    'crimson': '8B1A2B',
    'red':     'C0392B',
    'rust':    'D4784A',
    'forest':  '1A6B4A',
    'green':   '27AE60',
    'mint':    '55B89A',
    'charcoal':'4A4A4A',
    'gray':    '888888',
    'silver':  'CCCCCC',
    'ice':     'EBF0F5',
    'gold':    'E8B830',
    'white':   'FFFFFF',
}

# ── Reusable styles ──
THIN = Border(
    left=Side('thin', C['silver']), right=Side('thin', C['silver']),
    top=Side('thin', C['silver']), bottom=Side('thin', C['silver']),
)
BOTTOM = Border(bottom=Side('medium', C['navy']))

def stylize(ws):
    """Set default column widths for all sheets."""
    pass  # handled per-sheet

TITLE   = Font(name='Calibri', size=15, bold=True, color=C['navy'])
H1      = Font(name='Calibri', size=13, bold=True, color=C['navy'])
H2      = Font(name='Calibri', size=11, bold=True, color=C['blue'])
BODY    = Font(name='Calibri', size=10, color=C['charcoal'])
BODY_B  = Font(name='Calibri', size=10, bold=True, color=C['charcoal'])
SMALL   = Font(name='Calibri', size=9, color=C['gray'])
WHITE_B = Font(name='Calibri', size=10, bold=True, color=C['white'])
HFILL   = PatternFill(start_color=C['navy'], end_color=C['navy'], fill_type='solid')
SFILL   = PatternFill(start_color='F2F6FA', end_color='F2F6FA', fill_type='solid')
LFILL   = PatternFill(start_color=C['ice'], end_color=C['ice'], fill_type='solid')
CENTER  = Alignment(horizontal='center', vertical='center', wrap_text=True)
LEFT    = Alignment(horizontal='left', vertical='center', wrap_text=True)

def pct(cnt): return round(cnt / N * 100, 1)

def cell(ws, row, col, value, font=BODY, fill=None, align=LEFT, border=None, nf=None):
    c = ws.cell(row=row, column=col, value=value)
    c.font = font; c.alignment = align
    if fill: c.fill = fill
    if border: c.border = border
    if nf: c.number_format = nf
    return c

# ===================================================================
# LOAD & PARSE
# ===================================================================
with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    headers = next(reader)
    rows = list(reader)

# Q6 (col 10) — Brand preference
q6 = [
    ("Prefer well-known large brands (safer, easier recourse)",       94, pct(94)),
    ("Accept SME/local brands if hygienic & well-reviewed",           43, pct(43)),
    ("Scale-agnostic; only examine ingredients & expiry date",        15, pct(15)),
]

# Q7 (col 11) — Trust in handwritten labels
q7 = [
    ("Somewhat skeptical",   89, pct(89)),
    ("Fully trust",          29, pct(29)),
    ("Distrustful",          25, pct(25)),
    ("Never pay attention",   9, pct(9)),
]

# Q22 (cols 44–48) — Multi-select concerns, sorted desc
q22_labels = [
    "Record falsification (post-hoc\nmodification of production data)",
    "Human negligence (fatigue-induced\nmonitoring lapses by staff)",
    "Regulatory blind spots (lack of\nequipment & QC personnel in SMEs)",
    "Scheme lag (expert-designed plans\ncannot cover all contingencies)",
    "Facility lag (over-reliance on\nmanual observation, no automation)",
]
q22_counts = [sum(1 for r in rows if r[i].strip()) for i in range(44, 49)]
q22 = sorted(zip(q22_labels, q22_counts, [pct(c) for c in q22_counts]), key=lambda x: x[1], reverse=True)

# Q23 (col 49) — AI SME vs large brand
q23 = [
    ("Firmly choose AI-monitored SME",         18, pct(18)),
    ("Tend to choose AI-monitored SME",        67, pct(67)),
    ("Neutral / Wait-and-see",                 36, pct(36)),
    ("Tend to choose traditional large brand", 26, pct(26)),
    ("Firmly choose traditional large brand",   5, pct(5)),
]

# Q25 (col 52) — Premium willingness
q25 = [
    ("Willing to pay ~5% premium",                   80, pct(80)),
    ("Price is no object, as long as safe",          32, pct(32)),
    ("Unwilling to pay any premium",                 22, pct(22)),
    ("Willing to pay 10–15% premium",                18, pct(18)),
]

# ===================================================================
# BUILD WORKBOOK
# ===================================================================
wb = Workbook()

def write_table(ws, start_row, title, headers, rows_data, note=None):
    """Write a formatted frequency table. Returns next available row."""
    r = start_row
    cell(ws, r, 2, title, font=H2)
    r += 1
    # header
    for ci, h in enumerate(headers):
        cell(ws, r, 2+ci, h, font=WHITE_B, fill=HFILL, align=CENTER, border=THIN)
    r += 1
    for di, row in enumerate(rows_data):
        bg = SFILL if di % 2 == 0 else None
        cell(ws, r, 2, row[0], font=BODY, fill=bg, align=LEFT, border=THIN)
        cell(ws, r, 3, row[1], font=BODY, fill=bg, align=CENTER, border=THIN)
        cell(ws, r, 4, row[2]/100, font=BODY, fill=bg, align=CENTER, border=THIN, nf='0.0%')
        r += 1
    if note:
        cell(ws, r, 2, note, font=SMALL)
        r += 1
    return r + 2

# ==================== SHEET 1: COVER & ABSTRACT ====================
ws0 = wb.active
ws0.title = "Cover & Abstract"
ws0.sheet_properties.tabColor = C['navy']
for col_letter, w in [('A',3),('B',95)]:
    ws0.column_dimensions[col_letter].width = w

rr = 2
cell(ws0, rr, 2, "Consumer Trust in AI-Enhanced Food Safety Management:", font=TITLE); rr += 1
cell(ws0, rr, 2, "Evidence from a Survey on HACCP Implementation in SMEs", font=TITLE); rr += 1
cell(ws0, rr, 2, f"Survey Date: July 2026  |  Sample: N = {N}  |  Platform: Wenjuanxing  |  Language: Bilingual (CN/EN)", font=SMALL); rr += 2
cell(ws0, rr, 2, "Abstract", font=H1, fill=None, border=BOTTOM); rr += 2

abstract = (
    "This report presents findings from a consumer survey (N = 152) examining attitudes toward food safety "
    "management in small and medium-sized enterprises (SMEs), specifically focusing on the perceived value of "
    "AI-assisted HACCP (Hazard Analysis and Critical Control Points) systems. Three dimensions are analysed: "
    "(1) the trust gap between established brands and smaller producers relying on manual record-keeping, "
    "(2) consumer pain points regarding current HACCP implementation in SMEs, and (3) market acceptance of "
    "AI-monitored food safety and willingness to pay a safety premium. Results reveal a pronounced trust deficit "
    "for handwritten safety labels, with 75.0% of respondents expressing doubt or skepticism. Record falsification "
    "(78.3%) and human negligence (66.4%) are identified as the top-ranked concerns — both are precisely the "
    "weaknesses that a tamper-proof, AI-driven electronic logging and 24/7 monitoring system is designed to "
    "eliminate. Notably, 55.9% of respondents lean toward purchasing from an AI-monitored SME over a traditional "
    "large brand, and 64.5% are willing to pay a premium for AI + HACCP certified products, validating the "
    "commercial viability of AI-HACCP integration for small food manufacturers."
)
cell(ws0, rr, 2, abstract, font=BODY, align=LEFT)
for ro in range(rr, rr+11):
    ws0.row_dimensions[ro].height = 17

rr += 12
cell(ws0, rr, 2, "Key Findings", font=H1, border=BOTTOM); rr += 2
findings = [
    ("Trust Deficit.",
     "61.8% habitually choose large brands for daily foods; 75.0% distrust or are skeptical of handwritten "
     "hygiene labels from small producers — a gap that AI-based tamper-proof records can bridge."),
    ("Top Fears Match AI Strengths.",
     "Record falsification (78.3%) and human negligence (66.4%) rank first and second among consumer concerns — "
     "both directly addressed by immutable electronic logging and 24/7 automated AI monitoring."),
    ("AI Acceptance Outweighs Brand Loyalty.",
     "55.9% prefer an AI-monitored SME product over a traditionally managed large brand; only 20.4% prefer "
     "the large brand, suggesting AI certification can offset the brand-size disadvantage."),
    ("Monetizable Premium.",
     "64.5% are willing to pay extra for AI + HACCP certified products; 11.8% accept a 10–15% price premium, "
     "and an additional 52.6% accept ~5%, indicating a viable pricing uplift for certified SMEs."),
]
for title, desc in findings:
    cell(ws0, rr, 2, f"▸ {title}", font=BODY_B); rr += 1
    cell(ws0, rr, 2, f"   {desc}", font=BODY, align=LEFT); rr += 2

# ==================== SHEET 2: DATA TABLES ====================
ws1 = wb.create_sheet("Data Tables")
ws1.sheet_properties.tabColor = C['blue']
for col_letter, w in [('A',4),('B',52),('C',12),('D',12)]:
    ws1.column_dimensions[col_letter].width = w

r = 2
cell(ws1, r, 2, "Appendix: Frequency Tables for All Reported Questions", font=H1, border=BOTTOM)
r += 2

r = write_table(ws1, r,
    "Table 1. Q6 — Brand Preference When Purchasing Daily Foods",
    ["Response", "n", "%"],
    q6,
    "Q6: 'When buying daily foods (meat, condiments, snacks), if two similarly priced brands are available, which do you choose?'"
)
r = write_table(ws1, r,
    "Table 2. Q7 — Trust in Handwritten Hygiene Labels on Bulk/Small-Factory Foods",
    ["Response", "n", "%"],
    q7,
    "Q7: 'How much do you trust handwritten date labels or \"Passed Hygiene Inspection\" marks on bulk/small-factory foods?'"
)
r = write_table(ws1, r,
    "Table 3. Q22 — Most Worrying Food Safety Issues in HACCP-Operating SMEs (Multi-Select)",
    ["Concern", "n", "%"],
    q22,
    "Q22: 'Which food safety issues worry you most about SMEs that have implemented HACCP?' Multiple selections allowed."
)
r = write_table(ws1, r,
    "Table 4. Q23 — Purchase Preference: Large Brand vs. AI-Monitored SME Inulin Drink",
    ["Response", "n", "%"],
    q23,
    "Q23: Option A = well-known large brand (manual management, periodic sampling). Option B = AI-monitored SME with HACCP certification and transparent consumer data access."
)
r = write_table(ws1, r,
    "Table 5. Q25 — Willingness to Pay a Premium for AI + HACCP Certification",
    ["Response", "n", "%"],
    q25,
    "Q25: 'How much extra would you pay for a prebiotic product with real-time AI monitoring + HACCP certification, versus a cheaper alternative without these standards?'"
)

# ==================== SHEET 3: FIGURE 1 — TRUST GAP ====================
ws2 = wb.create_sheet("Figure 1 - Trust Gap")
ws2.sheet_properties.tabColor = C['sky']
for col_letter, w in [('A',2),('B',16),('C',16),('D',16),('E',16),('F',16),('G',16),('H',16)]:
    ws2.column_dimensions[col_letter].width = w

cell(ws2, 2, 2, "Figure 1. Consumer Trust Gap: Brand Preference vs. Trust in Handwritten Documentation", font=H2)
cell(ws2, 3, 2, "Comparison of habitual purchasing preference (Q6) and trust in manual/handwritten safety labels (Q7). N = 152.", font=SMALL)

# mini data table for chart
labels_row = 5
data_row = 6
q6_short = ["Prefer Large\nBrands", "Accept SME\nBrands", "Scale-Agnostic\n(Ingredients Only)"]
q7_short = ["Somewhat\nSkeptical", "Distrustful", "Fully Trust", "Never\nPay Attention"]
cats_labels = q6_short + q7_short

for ci, lbl in enumerate(cats_labels):
    cell(ws2, labels_row, 3+ci, lbl, font=Font(name='Calibri', size=8, bold=True, color=C['charcoal']),
         fill=LFILL, align=CENTER, border=THIN)

q6_vals = [pct(94), pct(43), pct(15)]
q7_vals = [pct(89), pct(25), pct(29), pct(9)]
all_vals = q6_vals + q7_vals

for ci, val in enumerate(all_vals):
    cell(ws2, data_row, 3+ci, val/100, font=BODY, align=CENTER, border=THIN, nf='0.0%')

# category labels in row below for dual-series reference
cell(ws2, 8, 2, "Q6 Brand Preference", font=Font(name='Calibri', size=8, bold=True, color=C['blue']))
cell(ws2, 9, 2, "Q7 Trust in Handwritten Labels", font=Font(name='Calibri', size=8, bold=True, color=C['crimson']))

# Create chart
chart1 = BarChart()
chart1.type = "col"
chart1.grouping = "clustered"
chart1.title = None
chart1.width = 26
chart1.height = 15

# Series 1 — Q6 (cols 2-4 of data, i.e. C3-E3... actually data row 6, cols 3-5)
data1 = Reference(ws2, min_col=3, max_col=5, min_row=data_row, max_row=data_row)
chart1.add_data(data1, from_rows=True, titles_from_data=False)
chart1.series[0].title = SeriesLabel(v='Q6 Brand Preference')
chart1.series[0].graphicalProperties.solidFill = C['blue']

# Series 2 — Q7 (cols 6-9)
data2 = Reference(ws2, min_col=6, max_col=9, min_row=data_row, max_row=data_row)
chart1.add_data(data2, from_rows=True, titles_from_data=False)
chart1.series[1].title = SeriesLabel(v='Q7 Trust in Handwritten Labels')
chart1.series[1].graphicalProperties.solidFill = C['crimson']

cats_ref = Reference(ws2, min_col=3, max_col=9, min_row=labels_row, max_row=labels_row)
chart1.set_categories(cats_ref)

chart1.y_axis.title = "Percentage of Respondents"
chart1.y_axis.numFmt = '0%'
chart1.y_axis.scaling.min = 0
chart1.y_axis.scaling.max = 0.80
from openpyxl.chart.axis import NumericAxis
chart1.y_axis.majorGridlines = None  # we'll add gridlines later if needed

chart1.legend.position = 'b'
chart1.legend.overlay = False

ws2.add_chart(chart1, "B11")

# annotation
cell(ws2, 28, 2, "Interpretation: 61.8% of consumers habitually choose large brands, yet 75.0% distrust or doubt handwritten safety", font=SMALL)
cell(ws2, 29, 2, "documentation. This 'trust gap' represents the market opportunity for AI-based tamper-proof record systems.", font=SMALL)

# ==================== SHEET 4: FIGURE 2 — PAIN POINTS ====================
ws3 = wb.create_sheet("Figure 2 - Pain Points")
ws3.sheet_properties.tabColor = C['rust']
for col_letter, w in [('A',2),('B',52),('C',12)]:
    ws3.column_dimensions[col_letter].width = w

cell(ws3, 2, 2, "Figure 2. Consumer Pain Points: Top Food Safety Concerns in HACCP-Operating SMEs", font=H2)
cell(ws3, 3, 2, "Ranked frequency of concerns selected by respondents (multi-select). N = 152. Source: Q22.", font=SMALL)

# Data for chart
for i, (label, cnt, pct_val) in enumerate(q22):
    row = 5 + i
    cell(ws3, row, 2, label, font=BODY, align=LEFT, border=THIN)
    cell(ws3, row, 3, pct_val/100, font=BODY, align=CENTER, border=THIN, nf='0.0%')

# Horizontal bar chart
chart2 = BarChart()
chart2.type = "bar"
chart2.grouping = "clustered"
chart2.title = None
chart2.width = 26
chart2.height = 14

data_ref = Reference(ws3, min_col=3, max_col=3, min_row=5, max_row=9)
cats_ref2 = Reference(ws3, min_col=2, max_col=2, min_row=5, max_row=9)

chart2.add_data(data_ref, titles_from_data=False)
chart2.set_categories(cats_ref2)
chart2.series[0].title = SeriesLabel(v='% of Respondents')
chart2.series[0].graphicalProperties.solidFill = C['red']

# Color each bar differently
bar_colors = [C['crimson'], C['red'], C['rust'], C['blue'], C['sky']]
for i, color in enumerate(bar_colors):
    pt = DataPoint(idx=i)
    pt.graphicalProperties.solidFill = color
    chart2.series[0].data_points.append(pt)

chart2.x_axis.title = "Percentage of Respondents"
chart2.x_axis.numFmt = '0%'
chart2.x_axis.scaling.min = 0
chart2.x_axis.scaling.max = 0.90
chart2.legend.position = 'b'

# Add data labels
chart2.series[0].dLbls = DataLabelList()
chart2.series[0].dLbls.showVal = False
chart2.series[0].dLbls.showPercent = True

ws3.add_chart(chart2, "B12")

cell(ws3, 28, 2, "Interpretation: Record falsification (78.3%) and human negligence (66.4%) are the top two consumer fears — both are", font=SMALL)
cell(ws3, 29, 2, "directly addressed by an AI system featuring tamper-proof electronic logging and 24/7 fatigue-free monitoring.", font=SMALL)

# ==================== SHEET 5: FIGURE 3 — AI ACCEPTANCE ====================
ws4 = wb.create_sheet("Figure 3 - AI Acceptance")
ws4.sheet_properties.tabColor = C['forest']
for col_letter, w in [('A',2),('B',44),('C',16),('D',18)]:
    ws4.column_dimensions[col_letter].width = w

cell(ws4, 2, 2, "Figure 3. Consumer Acceptance of AI-Monitored Food Safety & Willingness to Pay", font=H2)
cell(ws4, 3, 2, "Panel A (left): Purchase preference — AI-monitored SME vs. traditional large brand (Q23). Panel B (right): Premium willingness (Q25). N = 152.", font=SMALL)

# --- Panel A: Q23 Doughnut ---
cell(ws4, 5, 2, "Panel A — Q23: Purchase Preference", font=H2)
q23_labels_short = [
    "Firmly choose\nAI-monitored SME",
    "Tend to choose\nAI-monitored SME",
    "Neutral /\nWait-and-see",
    "Tend to choose\nlarge brand",
    "Firmly choose\nlarge brand",
]
q23_colors = [C['forest'], C['green'], C['silver'], C['rust'], C['crimson']]
for i, (label, _, pct_val) in enumerate(q23):
    row = 6 + i
    cell(ws4, row, 2, label, font=BODY, align=LEFT, border=THIN)
    cell(ws4, row, 3, pct_val/100, font=BODY, align=CENTER, border=THIN, nf='0.0%')

doughnut1 = DoughnutChart()
doughnut1.title = None
doughnut1.width = 16
doughnut1.height = 14

data_d1 = Reference(ws4, min_col=3, max_col=3, min_row=6, max_row=10)
cats_d1 = Reference(ws4, min_col=2, max_col=2, min_row=6, max_row=10)
doughnut1.add_data(data_d1, titles_from_data=False)
doughnut1.set_categories(cats_d1)

for i, color in enumerate(q23_colors):
    pt = DataPoint(idx=i)
    pt.graphicalProperties.solidFill = color
    doughnut1.series[0].data_points.append(pt)

doughnut1.series[0].dLbls = DataLabelList()
doughnut1.series[0].dLbls.showPercent = True
doughnut1.series[0].dLbls.showCatName = False
doughnut1.series[0].dLbls.showVal = False

doughnut1.legend.position = 'b'
doughnut1.legend.overlay = False

ws4.add_chart(doughnut1, "D5")

# --- Panel B: Q25 Doughnut ---
cell(ws4, 5, 5, "Panel B — Q25: Premium Willingness", font=H2)
q25_colors = [C['forest'], C['gold'], C['crimson'], C['blue']]
for i, (label, _, pct_val) in enumerate(q25):
    row = 6 + i
    cell(ws4, row, 5, label, font=BODY, align=LEFT, border=THIN)
    cell(ws4, row, 6, pct_val/100, font=BODY, align=CENTER, border=THIN, nf='0.0%')

doughnut2 = DoughnutChart()
doughnut2.title = None
doughnut2.width = 16
doughnut2.height = 14

data_d2 = Reference(ws4, min_col=6, max_col=6, min_row=6, max_row=9)
cats_d2 = Reference(ws4, min_col=5, max_col=5, min_row=6, max_row=9)
doughnut2.add_data(data_d2, titles_from_data=False)
doughnut2.set_categories(cats_d2)

for i, color in enumerate(q25_colors):
    pt = DataPoint(idx=i)
    pt.graphicalProperties.solidFill = color
    doughnut2.series[0].data_points.append(pt)

doughnut2.series[0].dLbls = DataLabelList()
doughnut2.series[0].dLbls.showPercent = True
doughnut2.series[0].dLbls.showCatName = False
doughnut2.series[0].dLbls.showVal = False
doughnut2.legend.position = 'b'

ws4.add_chart(doughnut2, "H5")

# Interpretation notes
cell(ws4, 22, 2,
    "Interpretation (Panel A): 55.9% of consumers lean toward choosing the AI-monitored SME product, versus only "
    "20.4% who prefer the traditional large brand — a ratio of nearly 3:1 in favour of AI certification.", font=SMALL)
cell(ws4, 23, 2,
    "Interpretation (Panel B): 64.5% are willing to pay a premium for AI + HACCP certification. Combined, "
    "these findings demonstrate that AI-enhanced food safety is not merely a regulatory burden but a marketable "
    "value proposition with tangible pricing power for SME food manufacturers.", font=SMALL)

# ==================== SAVE ====================
wb.save(OUTPUT_PATH)
print(f"Saved to {OUTPUT_PATH}")
print(f"   Sheets: {wb.sheetnames}")
