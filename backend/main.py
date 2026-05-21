import json
import random
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    get_template,
    save_template,
    list_templates_summary,
    create_template,
    update_template,
    delete_template,
    publish_template,
    get_published_template,
    save_report,
    get_report,
    list_reports,
    delete_report,
)
from ai_service import (
    load_template_markdown,
    build_system_prompt,
    build_user_prompt,
    call_deepseek,
    validate_response,
    DEEPSEEK_API_KEY,
)

app = FastAPI(title="HACCP AI 助手后端")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Pydantic models =====

class GenerateReportRequest(BaseModel):
    language: str = "zh"
    answers: dict = {}
    template: dict = {}
    flowcharts: dict = {}


class SaveTemplateRequest(BaseModel):
    name: str = "default"
    content: dict


class CreateTemplateRequest(BaseModel):
    name: str
    description: str = ""
    copy_from_id: int | None = None


class UpdateTemplateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    content: dict | None = None


# ===== 多模板管理接口 =====

@app.get("/api/templates")
async def api_list_templates():
    return {"templates": list_templates_summary()}


@app.get("/api/templates/{template_id}")
async def api_get_template(template_id: int):
    tpl = get_template(template_id)
    if tpl is None:
        raise HTTPException(status_code=404, detail="模板不存在")
    return {"template": tpl}


@app.post("/api/templates")
async def api_create_template(req: CreateTemplateRequest):
    tpl = create_template(req.name, req.description, req.copy_from_id)
    return {"template": tpl}


@app.put("/api/templates/{template_id}")
async def api_update_template(template_id: int, req: UpdateTemplateRequest):
    data = {}
    if req.name is not None:
        data["name"] = req.name
    if req.description is not None:
        data["description"] = req.description
    if req.content is not None:
        data["content"] = req.content
    tpl = update_template(template_id, data)
    if tpl is None:
        raise HTTPException(status_code=404, detail="模板不存在")
    return {"template": tpl}


@app.delete("/api/templates/{template_id}")
async def api_delete_template(template_id: int):
    ok = delete_template(template_id)
    if not ok:
        raise HTTPException(status_code=400, detail="无法删除：模板不存在或已发布")
    return {"ok": True}


@app.post("/api/templates/{template_id}/publish")
async def api_publish_template(template_id: int):
    tpl = publish_template(template_id)
    if tpl is None:
        raise HTTPException(status_code=404, detail="模板不存在")
    return {"template": tpl}


# ===== 兼容旧接口（用户端使用）=====

@app.get("/api/template")
async def api_get_published_template():
    tpl = get_published_template()
    return {"template": tpl}


@app.post("/api/template")
async def api_save_template(req: SaveTemplateRequest):
    """保留兼容：更新 id=1 的模板"""
    tpl = save_template(1, req.name, req.content)
    return {"ok": True, "template": tpl}


# ===== 用量接口（Mock）=====

@app.get("/api/usage")
async def get_usage():
    dates = []
    values = []
    details = []
    rng = random.Random(42)

    base = datetime(2026, 5, 1)
    for i in range(31):
        d = base + timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        dates.append(date_str)
        v = round(rng.random(), 2)
        values.append(v)
        if v > 0.7:
            details.append({
                "date": date_str,
                "models": [{"name": rng.choice(["deepseek-v4-pro", "deepseek-chat"]), "cost": v}],
            })

    details.sort(key=lambda x: x["date"], reverse=True)
    return {"dates": dates, "values": values, "details": details}


# ===== 生成报告接口（AI）=====

@app.post("/api/generate_report")
async def generate_report(req: GenerateReportRequest):
    if not DEEPSEEK_API_KEY:
        raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY not configured")

    template_md = load_template_markdown()
    system_prompt = build_system_prompt(template_md, req.language)
    user_prompt = build_user_prompt(req.answers, req.template, req.flowcharts, req.language)

    try:
        ai_response = call_deepseek(system_prompt, user_prompt)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI API error: {str(e)}")

    validated = validate_response(ai_response)
    return {"plan": validated}


# ===== 报告管理接口 =====

class SaveReportRequest(BaseModel):
    title: str = ""
    template_id: int | None = None
    answers: dict = {}
    flowcharts: dict = {}
    plan: dict = {}
    language: str = "zh"


@app.post("/api/reports")
async def api_save_report(req: SaveReportRequest):
    report = save_report(req.title, req.template_id, req.answers, req.flowcharts, req.plan, req.language)
    return {"report": report}


@app.get("/api/reports")
async def api_list_reports():
    return {"reports": list_reports()}


@app.get("/api/reports/{report_id}")
async def api_get_report(report_id: int):
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    return {"report": report}


@app.delete("/api/reports/{report_id}")
async def api_delete_report(report_id: int):
    ok = delete_report(report_id)
    if not ok:
        raise HTTPException(status_code=404, detail="报告不存在")
    return {"ok": True}
