"""
HACCP AI 报告生成模块
使用 DeepSeek API，参考菊粉HACCP模版，根据用户问卷答案生成完整HACCP计划书
"""

import json
import os
from pathlib import Path

from openai import OpenAI

# 项目根目录（backend 的上一级）
PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = PROJECT_ROOT / "菊粉生产企业HACCP计划书模版.md"

def _load_api_key():
    """从环境变量或 .env 文件读取 API Key"""
    key = os.environ.get("DEEPSEEK_API_KEY", "")
    if key:
        return key
    # fallback: 从 backend 目录下的 .env 文件读取
    env_file = Path(__file__).resolve().parent / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DEEPSEEK_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""

DEEPSEEK_API_KEY = _load_api_key()
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"

REQUIRED_SECTIONS = [
    "aiReport",
    "hazardAnalysis",
    "ccp",
    "criticalLimits",
    "monitoring",
    "correctiveActions",
    "verification",
    "recordKeeping",
]


def load_template_markdown() -> str:
    """读取参考模板"""
    if not TEMPLATE_PATH.exists():
        return ""
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        return f.read()


def build_system_prompt(template_md: str, language: str) -> str:
    """构建系统提示词，包含模板参考和输出格式要求"""
    lang_name = "Chinese (zh)" if language == "zh" else "English (en)"

    schema = """{
  "aiReport": {"zh": "...", "en": "..."},
  "hazardAnalysis": {
    "title": {"zh": "危害分析", "en": "Hazard Analysis"},
    "content": {
      "zh": "<h3>危害分析工作表</h3><table>...</table>",
      "en": "<h3>Hazard Analysis Worksheet</h3><table>...</table>"
    }
  },
  "ccp": {
    "title": {"zh": "关键控制点（CCP）", "en": "Critical Control Points (CCP)"},
    "content": {"zh": "...", "en": "..."}
  },
  "criticalLimits": {
    "title": {"zh": "关键限值", "en": "Critical Limits"},
    "content": {"zh": "...", "en": "..."}
  },
  "monitoring": {
    "title": {"zh": "监控程序", "en": "Monitoring Procedures"},
    "content": {"zh": "...", "en": "..."}
  },
  "correctiveActions": {
    "title": {"zh": "纠正措施", "en": "Corrective Actions"},
    "content": {"zh": "...", "en": "..."}
  },
  "verification": {
    "title": {"zh": "验证程序", "en": "Verification Procedures"},
    "content": {"zh": "...", "en": "..."}
  },
  "recordKeeping": {
    "title": {"zh": "记录保存", "en": "Record Keeping"},
    "content": {"zh": "...", "en": "..."}
  }
}"""

    prompt = f"""You are a senior food safety expert specializing in HACCP plan development following Codex Alimentarius and GB 14881 principles.

Below is a reference template showing the standard structure of a HACCP plan for a food production enterprise.
Use it ONLY as a format/structure reference. You MUST fill in all sections with content derived from the user's actual questionnaire answers, NOT the template's example data. If certain hazards or CCPs from the template do not apply to the user's product, omit them.

--- REFERENCE TEMPLATE START ---
{template_md}
--- REFERENCE TEMPLATE END ---

You MUST respond with valid JSON only, no markdown fences, no explanations. The JSON must have exactly this structure:

{schema}

Rules for each section:

1. **aiReport**: A detailed production process description in paragraph form (like a narrative flow), describing each step, its purpose, key equipment and parameters. Base this ENTIRELY on the user's flowchart steps (each step name, description, ingredients, and parameters). Write it as continuous prose like the "步骤2：生产流程" in the reference template — one flowing paragraph that covers all steps from raw material receiving to finished product storage. Do NOT write a generic summary. Bilingual (zh + en).

2. **hazardAnalysis**: HTML table with columns: 工艺步骤/Process Step | 潜在危害/Potential Hazard | 类别 B/C/P | 风险等级 High/Med/Low | 控制措施/Control Measure. Base this on the user's actual process steps.

3. **ccp**: HTML table with columns: CCP编号 | 工艺步骤 | 显著危害 | 判定依据. Only include steps that are true CCPs based on the user's process.

4. **criticalLimits**: HTML table with columns: CCP | 关键限值 | 来源/依据. For each CCP identified above.

5. **monitoring**: HTML table with columns: CCP | 监控对象 | 监控方法 | 监控频率 | 监控人员.

6. **correctiveActions**: HTML table with columns: CCP | 偏离情况 | 纠正措施 | 责任人.

7. **verification**: HTML table with columns: 验证项目 | 验证方法 | 频率 | 责任人.

8. **recordKeeping**: HTML table with columns: 记录名称 | 内容 | 保存期限 | 保管部门.

CRITICAL RULES:
- ALL content fields must contain valid HTML (use <h3>, <p>, <table>, <thead>, <tbody>, <tr>, <th>, <td>)
- Generate content in BOTH zh (Chinese) and en (English) for every section
- The PRIMARY language for generation quality is: {lang_name}
- Do NOT copy the template's example data (inulin/菊粉 production). Only use the user's actual product and process
- If the user provided few details, generate reasonable but generic content based on what IS provided
- Each content string must be a complete, standalone HTML fragment
- Return raw JSON only, no ```json fences, no extra text"""
    return prompt


def build_user_prompt(answers: dict, template: dict, flowcharts: dict, language: str) -> str:
    """将用户问卷答案转换为结构化文本提示词"""
    sections_text = []

    if template and template.get("sections"):
        for section in template["sections"]:
            if section.get("isFlowchart"):
                continue  # 流程图单独处理
            title = section.get("title", "")
            questions = section.get("questions", [])
            if not questions:
                continue
            sections_text.append(f"\n### {title}")
            for i, q in enumerate(questions, 1):
                qid = q.get("id", "")
                qtitle = q.get("title", "")
                qtype = q.get("type", "text")
                val = answers.get(qid, "")

                if qtype == "table" and isinstance(val, list) and len(val) > 0:
                    cols = q.get("options", [])
                    sections_text.append(f"- Q: {qtitle}")
                    for ri, row in enumerate(val):
                        if isinstance(row, list) and any(c for c in row):
                            cells = []
                            for ci, c in enumerate(row):
                                col_name = cols[ci] if ci < len(cols) else f"Col{ci+1}"
                                cells.append(f"{col_name}: {c}" if c else f"{col_name}: (empty)")
                            sections_text.append(f"  Row {ri+1}: {' | '.join(cells)}")
                elif qtype == "checkbox" and isinstance(val, list):
                    sections_text.append(f"- Q: {qtitle}: {', '.join(val) if val else '(none)'}")
                elif qtype == "radio" or qtype == "select":
                    sections_text.append(f"- Q: {qtitle}: {val if val else '(not selected)'}")
                else:
                    sections_text.append(f"- Q: {qtitle}: {val if val else '(empty)'}")

    # 流程图数据
    if flowcharts:
        for fc_id, steps in flowcharts.items():
            if not steps:
                continue
            sections_text.append(f"\n### 生产流程图 / Process Flow Chart")
            for si, step in enumerate(steps, 1):
                name = step.get("name", f"Step {si}")
                desc = step.get("description", "")
                cp = step.get("controlPoint", "")
                equip = step.get("equipment", "")
                sections_text.append(f"\nStep {si}: {name}")
                if desc:
                    sections_text.append(f"  Description: {desc}")
                if cp:
                    sections_text.append(f"  Control Point: {cp}")
                if equip:
                    sections_text.append(f"  Equipment: {equip}")
                # 原料
                ings = step.get("ingredients", [])
                if ings and any(ing.get("name") for ing in ings):
                    ing_list = []
                    for ing in ings:
                        if ing.get("name"):
                            ing_list.append(f"{ing['name']} ({ing.get('amount', '')}, {ing.get('purpose', '')})")
                    if ing_list:
                        sections_text.append(f"  Ingredients: {'; '.join(ing_list)}")
                # 参数
                params = step.get("parameters", [])
                if params and any(p.get("name") for p in params):
                    param_list = []
                    for p in params:
                        if p.get("name"):
                            param_list.append(f"{p['name']}={p.get('value', '')}{p.get('unit', '')}")
                    if param_list:
                        sections_text.append(f"  Parameters: {'; '.join(param_list)}")

    user_data = "\n".join(sections_text) if sections_text else "(No questionnaire answers provided)"

    lang_name = "Chinese" if language == "zh" else "English"
    return f"""## User's Product and Process Information

Please generate a complete HACCP plan based on the following information provided by the user. The primary language should be {lang_name}.

{user_data}
"""


def call_deepseek(system_prompt: str, user_prompt: str) -> dict:
    """调用 DeepSeek API 生成报告"""
    client = OpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
    )
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=8192,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content
    # DeepSeek may still wrap in fences despite response_format; strip if needed
    raw = raw.strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    if raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    return json.loads(raw.strip())


def _empty_section(key: str) -> dict:
    """生成缺失章节的占位内容"""
    titles = {
        "aiReport": "AI 分析报告",
        "hazardAnalysis": "危害分析",
        "ccp": "关键控制点（CCP）",
        "criticalLimits": "关键限值",
        "monitoring": "监控程序",
        "correctiveActions": "纠正措施",
        "verification": "验证程序",
        "recordKeeping": "记录保存",
    }
    en_titles = {
        "aiReport": "AI Analysis Report",
        "hazardAnalysis": "Hazard Analysis",
        "ccp": "Critical Control Points (CCP)",
        "criticalLimits": "Critical Limits",
        "monitoring": "Monitoring Procedures",
        "correctiveActions": "Corrective Actions",
        "verification": "Verification Procedures",
        "recordKeeping": "Record Keeping",
    }
    title = titles.get(key, key)
    en_title = en_titles.get(key, key)
    if key == "aiReport":
        return {"zh": "(未能生成)", "en": "(Failed to generate)"}
    return {
        "title": {"zh": title, "en": en_title},
        "content": {
            "zh": "<p>(AI 未能生成此章节)</p>",
            "en": "<p>(AI failed to generate this section)</p>",
        },
    }


def validate_response(data: dict) -> dict:
    """校验 AI 返回包含所有必需章节，缺失的补占位"""
    for key in REQUIRED_SECTIONS:
        if key not in data:
            data[key] = _empty_section(key)
            continue
        section = data[key]
        if key == "aiReport":
            if not isinstance(section, dict):
                data[key] = _empty_section(key)
            else:
                if "zh" not in section:
                    section["zh"] = ""
                if "en" not in section:
                    section["en"] = ""
        else:
            if not isinstance(section, dict):
                data[key] = _empty_section(key)
                continue
            if not isinstance(section.get("title"), dict):
                section["title"] = _empty_section(key)["title"]
            if not isinstance(section.get("content"), dict):
                section["content"] = _empty_section(key)["content"]
            # 确保 bilingual
            for lang in ("zh", "en"):
                if lang not in section["title"]:
                    section["title"][lang] = _empty_section(key)["title"][lang]
                if lang not in section["content"]:
                    section["content"][lang] = ""
    return data
