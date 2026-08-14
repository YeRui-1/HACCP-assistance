import base64
import hashlib
import hmac
import json
import os
import pathlib
import random
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta

# 确保能找到 backend 目录下的模块
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

# 加载 .env 文件
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# DeepSeek 配置（请将下面的密钥替换为你自己的 DeepSeek API Key）
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "sk-your-deepseek-api-key-here")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# 管理员密码（从 .env 读取，默认 admin123）
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

from fastapi import FastAPI, HTTPException, Depends
from typing import List
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
    create_user,
    get_user_by_username,
    get_user_by_id,
    create_plan,
    get_plan,
    list_plans,
    update_plan,
    delete_plan,
    get_draft,
    save_draft,
)

app = FastAPI(title="HACCP AI 助手后端")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT 配置
JWT_SECRET = "haccp-secret-key-2026"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

security = HTTPBearer(auto_error=False)


# ===== JWT 工具函数（使用标准库实现 HMAC-SHA256）=====

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _base64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += '=' * padding
    return base64.urlsafe_b64decode(s)


def create_jwt(user_id: int, username: str, role: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": int((datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
    }
    header_b64 = _base64url_encode(json.dumps(header, separators=(',', ':')).encode())
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(',', ':')).encode())
    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = _base64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_jwt(token: str) -> dict | None:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts

        # 验证签名
        signing_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
        actual_sig = _base64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        # 解析 payload
        payload = json.loads(_base64url_decode(payload_b64))

        # 检查过期
        exp = payload.get("exp", 0)
        if exp < datetime.utcnow().timestamp():
            return None

        return payload
    except Exception:
        return None


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict | None:
    """从请求头解析 JWT，返回当前用户信息（不含密码）"""
    if credentials is None:
        return None
    payload = decode_jwt(credentials.credentials)
    if payload is None:
        return None
    user = get_user_by_id(payload["user_id"])
    return user


# ===== Pydantic models =====

class GenerateReportRequest(BaseModel):
    start_date: str
    end_date: str


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


class RegisterRequest(BaseModel):
    username: str
    company_name: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class CreatePlanRequest(BaseModel):
    plan_name: str = ""
    product_name: str = ""
    company_name: str = ""
    content: dict = {}


class UpdatePlanRequest(BaseModel):
    plan_name: str | None = None
    product_name: str | None = None
    company_name: str | None = None
    content: dict | None = None


class FillFromTextRequest(BaseModel):
    text: str


class ProductHazardsRequest(BaseModel):
    product_name: str = ""
    raw_materials: str = ""
    additives: str = ""
    intended_use: str = ""
    process_description: str = ""


class RawMaterialHazardsRequest(BaseModel):
    materials: List[str]


class GenerateFlowchartRequest(BaseModel):
    product_name: str = ""
    raw_materials: str = ""
    process_description: str = ""
    storage_condition: str = ""
    additional_info: str = ""


class CcpJudgmentRequest(BaseModel):
    product_name: str = ""
    raw_materials: str = ""
    process_description: str = ""
    steps: list = []  # List of {stepName, operationMethod, parameters, equipmentName}


# ===== 演示数据 API（必须在所有路由之前注册）=====
DEMO_FULL_FILE = pathlib.Path(__file__).resolve().parent.parent / "data" / "demo_inulin_full.json"

@app.get("/api-demo-full")
async def api_get_demo_full():
    try:
        if DEMO_FULL_FILE.exists():
            with open(DEMO_FULL_FILE, "r", encoding="utf-8") as f:
                return {"ok": True, "data": json.load(f)}
        return {"ok": True, "data": {}}
    except Exception as e:
        raise HTTPException(500, f"读取失败: {str(e)}")

@app.put("/api-demo-full")
async def api_save_demo_full(body: dict):
    try:
        data = body.get("data", body)
        DEMO_FULL_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(DEMO_FULL_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"ok": True, "message": "保存成功"}
    except Exception as e:
        raise HTTPException(500, f"保存失败: {str(e)}")

# ===== 用户认证接口 =====

@app.post("/api/auth/register")
async def api_register(req: RegisterRequest):
    if len(req.username) < 2 or len(req.username) > 50:
        raise HTTPException(status_code=400, detail="用户名长度应在 2-50 之间")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少 6 位")
    if not req.company_name.strip():
        raise HTTPException(status_code=400, detail="企业名称不能为空")

    existing = get_user_by_username(req.username)
    if existing:
        raise HTTPException(status_code=409, detail="用户名已存在")

    password_hash = hash_password(req.password)
    user = create_user(req.username.strip(), req.company_name.strip(), password_hash)
    if user is None:
        raise HTTPException(status_code=500, detail="注册失败")

    token = create_jwt(user["id"], user["username"], user["role"])
    return {"ok": True, "user": user, "token": token}


@app.post("/api/auth/login")
async def api_login(req: LoginRequest):
    user = get_user_by_username(req.username)
    if user is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if user["password_hash"] != hash_password(req.password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_jwt(user["id"], user["username"], user["role"])
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return {"ok": True, "user": safe_user, "token": token}


@app.get("/api/auth/me")
async def api_me(user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="未登录或 token 已过期")
    return {"user": user}


# ===== 管理员验证（密码存后端，不再写死在前端）=====

class AdminVerifyRequest(BaseModel):
    password: str = ""


@app.post("/api/admin/verify")
async def api_admin_verify(req: AdminVerifyRequest):
    return {"ok": bool(req.password) and req.password == ADMIN_PASSWORD}


# ===== 问卷草稿（登录用户自动保存）=====

class DraftSaveRequest(BaseModel):
    data: dict


@app.get("/api/drafts/{name}")
async def api_get_draft(name: str, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="未登录")
    draft = get_draft(user["id"], name)
    return {"ok": True, "draft": draft}


@app.put("/api/drafts/{name}")
async def api_save_draft(name: str, req: DraftSaveRequest, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="未登录")
    draft = save_draft(user["id"], name, req.data)
    return {"ok": True, "draft": draft}


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


# ===== AI 填表接口 =====

FILL_PROMPT = """你是一位专业的HACCP体系审核专家。请根据用户提供的产品/企业文本内容，从中提取出HACCP问卷所需的信息。

请严格按照以下JSON格式返回结果（只返回JSON，不要任何额外文字）。所有文本字段必须使用双语格式（中文|||英文）：

{
  "companyName": "企业名称（如未找到则留空字符串）",
  "deptName": "制定部门（如未找到则留空）",
  "haccpTeam": [{"name": "姓名", "dept": "部门", "position": "职位", "role": "职责"}],
  "auditor": "审核人员（如未找到则留空）",
  "productName": "产品名称（如未找到则留空）",
  "rawMaterials": "主要原料，不同原料用逗号分隔",
  "additives": "添加剂，不同添加剂用逗号分隔",
  "productPH": "产品PH值（如未找到则留空）",
  "waterActivity": "水分活度（如未找到则留空）",
  "intendedUse": "预期用途描述",
  "storageCondition": "储存条件",
  "packagingMethod": "包装方式",
  "targetConsumer": "目标消费者",
  "shelfLife": "保质期",
  "formula": [{"material": "原料名", "dosage": "用量", "func": "作用"}],
  "processSteps": [{"stepName": "步骤名称", "operationMethod": "操作方法", "parameters": "参数", "controlPoint": "控制点", "equipmentName": "设备名称"}],
  "execStandard": "执行标准（可选gb/industry/enterprise/international）",
  "criticalLimits": "关键限制说明",
  "hazardBio": [{"desc": "危害描述", "severity": "高/中/低", "likelihood": "高/中/低", "control": "控制措施"}],
  "hazardChem": [{"desc": "危害描述", "severity": "高/中/低", "likelihood": "高/中/低", "control": "控制措施"}],
  "hazardPhys": [{"desc": "危害描述", "severity": "高/中/低", "likelihood": "高/中/低", "control": "控制措施"}],
  "monitoring": [{"ccp": "关键控制点", "object": "监控对象", "method": "监控方法", "frequency": "监控频率", "personnel": "监控人员", "remark": "备注"}],
  "correctiveActions": [{"ccp": "关键控制点", "cl": "关键限值", "corrective": "纠偏措施", "verification": "验证", "record": "记录"}],
  "recordPeriod": "记录保存期限",
  "recordFormat": "记录格式要求"
}

注意：
1. 如果文本中明确提到了某个字段，请提取出来；如果未提到，相关字段留空字符串或空数组。
2. 对于haccpTeam、formula、processSteps、hazardBio/Chem/Phys、monitoring、correctiveActions等数组字段，如果文本中有相关信息就填充，没有就返回空数组。
3. 所有字段都必须包含在返回的JSON中，不要遗漏任何字段。"""


HAZARD_PROMPT = """你是一位专业的HACCP危害分析专家。请根据用户提供的产品信息，分析该产品可能存在的生物、化学、物理危害。

请严格按照以下JSON格式返回结果（只返回JSON，不要任何额外文字）。desc和control字段必须使用双语格式（中文|||英文）：

{
  "hazardBio": [
    {"desc": "沙门氏菌污染风险|||Salmonella contamination risk", "severity": "高", "likelihood": "中", "control": "充分加热至中心温度≥75℃|||Heat thoroughly to core temperature ≥75°C"}
  ],
  "hazardChem": [
    {"desc": "农药残留（有机磷类）|||Pesticide residues (organophosphates)", "severity": "高", "likelihood": "低", "control": "原料验收查验检测报告|||Verify supplier test reports at receiving"}
  ],
  "hazardPhys": [
    {"desc": "金属异物（设备磨损碎片）|||Metal fragments (equipment wear)", "severity": "中", "likelihood": "中", "control": "金属检测仪在线检测|||Online metal detector inspection"}
  ]
}

要求：
1. hazardBio 至少列出 2-3 项该产品类型最常见的生物危害（如沙门氏菌、大肠杆菌、霉菌等）
2. hazardChem 至少列出 2-3 项该产品类型最常见的化学危害（如农药残留、重金属、添加剂滥用等）
3. hazardPhys 至少列出 1-2 项该产品类型最常见的物理危害（如金属异物、玻璃碎片、砂石等）
4. severity 和 likelihood 要根据该产品类型的风险水平给出合理的评估（值只能是"高/中/低"）
5. control 要给出具体可行的控制措施
6. desc 和 control 字段必须使用双语格式（中文|||英文）
7. 所有字段都必须包含在返回的JSON中"""


@app.post("/api/ai/product-hazards")
async def api_ai_product_hazards(req: ProductHazardsRequest):
    """根据产品信息AI推荐常见危害"""
    user_info = f"产品名称：{req.product_name}\n原料：{req.raw_materials}\n添加剂：{req.additives}\n预期用途：{req.intended_use}\n工艺描述：{req.process_description}"
    if not req.product_name and not req.raw_materials:
        # 如果没有任何信息，返回通用的常见危害
        return _mock_product_hazards("通用食品")

    # 如果 API Key 是默认值，返回 mock 数据
    if DEEPSEEK_API_KEY == "sk-your-deepseek-api-key-here" or not DEEPSEEK_API_KEY:
        return _mock_product_hazards(req.product_name or (req.raw_materials.split("、")[0] if "、" in req.raw_materials else req.raw_materials))

    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": HAZARD_PROMPT},
            {"role": "user", "content": f"请分析以下产品的潜在危害：\n\n{user_info}"}
        ],
        "temperature": 0.3,
        "max_tokens": 2048,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
    }

    try:
        json_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        http_req = urllib.request.Request(
            DEEPSEEK_API_URL,
            data=json_data,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(http_req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]

        cleaned = content.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines)

        parsed = json.loads(cleaned)
        return {"ok": True, "data": parsed}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


def _mock_product_hazards(product_type: str) -> dict:
    """根据产品类型返回模拟的危害数据"""
    product_lower = product_type.lower()

    # 饮料/果汁/乳制品类
    if any(kw in product_lower for kw in ["饮料", "果汁", "乳", "牛奶", "酸奶", "奶"]):
        data = {
            "hazardBio": [
                {"desc": "沙门氏菌污染|||Salmonella contamination", "severity": "高", "likelihood": "中", "control": "原料验收严格把关，充分杀菌处理（中心温度≥85℃保持15s以上）|||Strict raw material inspection, thorough sterilization (core temp ≥85°C for ≥15s)"},
                {"desc": "大肠杆菌群超标|||Coliform bacteria exceeding limits", "severity": "高", "likelihood": "中", "control": "严格卫生控制，定时清洗消毒生产线|||Strict hygiene control, regular cleaning and disinfection of production line"},
                {"desc": "霉菌和酵母菌繁殖|||Mold and yeast growth", "severity": "中", "likelihood": "中", "control": "控制灌装环境洁净度，无菌灌装|||Control filling environment cleanliness, aseptic filling"},
            ],
            "hazardChem": [
                {"desc": "农药残留（有机磷、拟除虫菊酯等）|||Pesticide residues (organophosphates, pyrethroids, etc.)", "severity": "高", "likelihood": "低", "control": "原料验收时查验农药残留检测报告|||Verify pesticide residue test reports at receiving"},
                {"desc": "重金属污染（铅、砷、汞）|||Heavy metal contamination (Pb, As, Hg)", "severity": "高", "likelihood": "低", "control": "定期对原料进行重金属检测，符合GB 2762|||Periodic heavy metal testing per GB 2762"},
                {"desc": "食品添加剂超量使用（防腐剂、色素等）|||Excessive food additives (preservatives, colorants, etc.)", "severity": "中", "likelihood": "低", "control": "严格按GB 2760标准控制添加量，建立配料复核制度|||Strictly control dosage per GB 2760, establish ingredient verification system"},
            ],
            "hazardPhys": [
                {"desc": "玻璃碎片（容器破损）|||Glass fragments (container breakage)", "severity": "高", "likelihood": "低", "control": "灯检工序检查，建立玻璃制品管理制度|||Light inspection process, establish glassware management system"},
                {"desc": "金属异物（设备磨损碎片）|||Metal fragments (equipment wear)", "severity": "中", "likelihood": "中", "control": "配备金属检测仪，定期检查设备磨损情况|||Install metal detectors, regularly check equipment wear"},
            ],
        }
    # 肉制品/水产类
    elif any(kw in product_lower for kw in ["肉", "鱼", "水产", "海鲜", "虾", "蟹"]):
        data = {
            "hazardBio": [
                {"desc": "沙门氏菌污染|||Salmonella contamination", "severity": "高", "likelihood": "高", "control": "原料冷链控制（中心温度≤4℃），充分加热至中心温度≥75℃|||Cold chain control (core temp ≤4°C), heat thoroughly to core temp ≥75°C"},
                {"desc": "李斯特菌污染", "severity": "高", "likelihood": "中", "control": "严格冷链管理，热处理后防止交叉污染|||Strict cold chain management, prevent cross-contamination after heat treatment"},
                {"desc": "大肠杆菌O157:H7", "severity": "高", "likelihood": "中", "control": "原料来源管控，充分加热杀菌|||Raw material source control, thorough heat sterilization"},
            ],
            "hazardChem": [
                {"desc": "兽药残留（抗生素、激素）|||Veterinary drug residues (antibiotics, hormones)", "severity": "高", "likelihood": "中", "control": "查验供应商兽药残留检测报告，定期抽检|||Verify supplier veterinary drug residue reports, periodic spot checks"},
                {"desc": "亚硝酸盐超标（腌制剂使用不当）|||Excessive nitrite (improper curing agent use)", "severity": "高", "likelihood": "低", "control": "严格按GB 2760控制亚硝酸盐使用量|||Strictly control nitrite usage per GB 2760"},
                {"desc": "生物胺（组胺）超标|||Biogenic amines (histamine) exceeding limits", "severity": "中", "likelihood": "低", "control": "控制原料新鲜度，冷链运输储存|||Control raw material freshness, cold chain transport and storage"},
            ],
            "hazardPhys": [
                {"desc": "碎骨残留|||Bone fragments", "severity": "中", "likelihood": "中", "control": "修割工序去除碎骨，配备X光异物检测|||Remove bone fragments during trimming, install X-ray inspection"},
                {"desc": "金属碎片（设备刀片磨损）", "severity": "中", "likelihood": "中", "control": "金属检测仪在线检测，定期维护刀具设备|||Online metal detector inspection, regular blade maintenance"},
            ],
        }
    # 烘焙/糕点/面食类
    elif any(kw in product_lower for kw in ["面包", "蛋糕", "糕点", "饼干", "面粉", "面", "烘焙"]):
        data = {
            "hazardBio": [
                {"desc": "霉菌污染（黄曲霉等产毒霉菌）|||Mold contamination (aflatoxin-producing molds)", "severity": "高", "likelihood": "中", "control": "原料验收控制水分，储存环境湿度≤60%|||Control moisture at receiving, storage humidity ≤60%"},
                {"desc": "金黄色葡萄球菌（操作人员污染）|||Staphylococcus aureus (personnel contamination)", "severity": "中", "likelihood": "中", "control": "严格人员卫生管理，手部消毒|||Strict personnel hygiene, hand sanitization"},
                {"desc": "沙门氏菌（蛋液污染）|||Salmonella (egg liquid contamination)", "severity": "高", "likelihood": "低", "control": "使用灭菌蛋液/巴氏杀菌蛋液|||Use sterilized/pasteurized egg liquid"},
            ],
            "hazardChem": [
                {"desc": "食品添加剂超量（防腐剂、膨松剂、色素）|||Excessive food additives (preservatives, leavening agents, colorants)", "severity": "中", "likelihood": "低", "control": "严格按GB 2760标准控制，建立双人复核制度|||Strict GB 2760 compliance, dual-person verification system"},
                {"desc": "丙烯酰胺（高温烘烤产生）|||Acrylamide (from high-temperature baking)", "severity": "中", "likelihood": "中", "control": "控制烘烤温度≤200℃，避免过度烘烤|||Control baking temp ≤200°C, avoid over-baking"},
                {"desc": "重金属污染（原料带入）", "severity": "中", "likelihood": "低", "control": "原料供应商审核，定期检测"},
            ],
            "hazardPhys": [
                {"desc": "金属异物（设备刮片、筛网破损）|||Metal fragments (scraper/screen damage)", "severity": "中", "likelihood": "中", "control": "筛网定期检查，配备金属检测仪|||Regular screen inspection, install metal detectors"},
                {"desc": "砂石/硬质颗粒（原料带入）|||Stones/hard particles (from raw materials)", "severity": "中", "likelihood": "低", "control": "原料过筛处理，磁选除杂|||Raw material sieving, magnetic separation"},
            ],
        }
    # 罐头/腌制品/酱料类
    elif any(kw in product_lower for kw in ["罐头", "腌制", "酱", "调味", "泡菜", "发酵"]):
        data = {
            "hazardBio": [
                {"desc": "肉毒杆菌（低酸罐头）|||Clostridium botulinum (low-acid canned food)", "severity": "高", "likelihood": "低", "control": "杀菌釜充分杀菌（F0≥3min），监控中心温度和时间|||Thorough autoclave sterilization (F0≥3min), monitor core temp and time"},
                {"desc": "乳酸菌超标（发酵控制不当）|||Lactic acid bacteria exceeding limits (improper fermentation control)", "severity": "低", "likelihood": "中", "control": "控制发酵温度和时间，定期检测酸度|||Control fermentation temp and time, periodic acidity testing"},
                {"desc": "霉菌和酵母菌（密封不良）|||Mold and yeast (poor sealing)", "severity": "中", "likelihood": "低", "control": "确保密封完整，定期检查包装气密性|||Ensure seal integrity, periodic packaging leak testing"},
            ],
            "hazardChem": [
                {"desc": "亚硝酸盐超标", "severity": "高", "likelihood": "中", "control": "控制腌制时间（≥20天充分分解），定期检测亚硝酸盐含量|||Control curing time (≥20 days for full decomposition), periodic nitrite testing"},
                {"desc": "防腐剂超量使用", "severity": "中", "likelihood": "低", "control": "严格按GB 2760控制，建立添加记录台账"},
                {"desc": "重金属溶出（包装容器迁移）|||Heavy metal migration (from packaging containers)", "severity": "中", "likelihood": "低", "control": "使用食品级包装材料，定期检测迁移量|||Use food-grade packaging, periodic migration testing"},
            ],
            "hazardPhys": [
                {"desc": "金属异物（设备磨损）", "severity": "中", "likelihood": "低", "control": "金属检测仪检测，定期维护设备"},
                {"desc": "玻璃/陶瓷碎片（容器破损）", "severity": "高", "likelihood": "低", "control": "灯检工序，建立容器验收标准"},
            ],
        }
    # 冷冻食品类
    elif any(kw in product_lower for kw in ["冷冻", "速冻", "冰", "冰淇淋"]):
        data = {
            "hazardBio": [
                {"desc": "李斯特菌（耐低温）|||Listeria monocytogenes (cold-tolerant)", "severity": "高", "likelihood": "中", "control": "原料控制，加工环境温度≤12℃，生产后迅速冷冻|||Raw material control, processing temp ≤12°C, rapid freezing after production"},
                {"desc": "沙门氏菌（原料带入）", "severity": "高", "likelihood": "低", "control": "原料验收把关，预处理充分清洗|||Strict receiving inspection, thorough pre-washing"},
                {"desc": "金黄色葡萄球菌（操作污染）", "severity": "中", "likelihood": "中", "control": "严格人员卫生，冷链不断链|||Strict personnel hygiene, unbroken cold chain"},
            ],
            "hazardChem": [
                {"desc": "兽药/农药残留（原料带入）", "severity": "高", "likelihood": "低", "control": "供应商审核和原料检测报告查验"},
                {"desc": "添加剂（乳化剂、稳定剂）超量|||Excessive additives (emulsifiers, stabilizers)", "severity": "中", "likelihood": "低", "control": "按GB 2760控制，精确称量设备|||Control per GB 2760, precision weighing equipment"},
            ],
            "hazardPhys": [
                {"desc": "金属异物（设备刀片磨损）", "severity": "中", "likelihood": "中", "control": "金属检测仪在线检测，设备定期维护"},
                {"desc": "塑料碎片（包装材料）|||Plastic fragments (packaging materials)", "severity": "中", "likelihood": "低", "control": "包装材料验收，生产区域工具管理|||Packaging material inspection, tool management in production area"},
            ],
        }
    # 通用/其他食品
    else:
        data = {
            "hazardBio": [
                {"desc": "沙门氏菌", "severity": "高", "likelihood": "中", "control": "充分加热处理（中心温度≥75℃），防止交叉污染|||Thorough heat treatment (core temp ≥75°C), prevent cross-contamination"},
                {"desc": "大肠杆菌群超标|||Coliform bacteria exceeding limits", "severity": "中", "likelihood": "中", "control": "严格卫生控制，定时清洗消毒生产设备"},
                {"desc": "霉菌和酵母菌繁殖|||Mold and yeast growth", "severity": "中", "likelihood": "低", "control": "控制储存环境温湿度，确保包装密封性|||Control storage temp/humidity, ensure packaging seal integrity"},
            ],
            "hazardChem": [
                {"desc": "农药残留（种植原料带入）|||Pesticide residues (from agricultural raw materials)", "severity": "高", "likelihood": "低", "control": "原料验收查验检测报告，供应商资质审核"},
                {"desc": "重金属污染（铅、砷、镉）|||Heavy metal contamination (Pb, As, Cd)", "severity": "高", "likelihood": "低", "control": "定期原料检测，符合GB 2762标准|||Periodic raw material testing per GB 2762"},
                {"desc": "食品添加剂超量/非法添加|||Excessive/illegal food additive use", "severity": "中", "likelihood": "低", "control": "严格按GB 2760标准控制，建立配料复核制度"},
            ],
            "hazardPhys": [
                {"desc": "金属异物（设备磨损碎片）|||Metal fragments (equipment wear)", "severity": "中", "likelihood": "中", "control": "配备金属检测仪，定期检查维护设备"},
                {"desc": "砂石/杂质（原料带入）", "severity": "中", "likelihood": "低", "control": "原料清洗和过筛处理，磁选除杂|||Raw material washing and sieving, magnetic separation"},
            ],
        }

    return {"ok": True, "data": data}


# ===== 原料危害数据库查询 =====

def _load_raw_material_hazards() -> list:
    """加载原料危害数据库"""
    db_path = PROJECT_ROOT / "data" / "raw_material_hazards.json"
    if not db_path.exists():
        return []
    try:
        with open(db_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


_STANDARDS_CACHE = None
def _load_standards() -> list:
    """加载 GB 国家标准知识库（双语）"""
    global _STANDARDS_CACHE
    if _STANDARDS_CACHE is not None:
        return _STANDARDS_CACHE
    std_path = PROJECT_ROOT / "data" / "standards.json"
    if not std_path.exists():
        _STANDARDS_CACHE = []
        return _STANDARDS_CACHE
    try:
        with open(std_path, "r", encoding="utf-8") as f:
            _STANDARDS_CACHE = json.load(f)
    except Exception:
        _STANDARDS_CACHE = []
    return _STANDARDS_CACHE


def _pick_standards_for(ccp_names: list, product_name: str = "") -> list:
    """根据 CCP 步骤名与产品名，从标准库中挑选相关标准（按 applyKeywords 匹配）"""
    standards = _load_standards()
    if not standards:
        return []
    if not ccp_names:
        return standards
    haystack = " ".join([product_name] + ccp_names).lower()
    picked = []
    for std in standards:
        kws = std.get("applyKeywords", [])
        if any(kw and kw.lower() in haystack for kw in kws):
            picked.append(std)
    # 若无关键词命中，返回全部（通用参考）
    return picked if picked else standards


@app.get("/api/standards")
async def api_standards():
    """返回 GB 国家标准知识库（可选 ?q= 关键词过滤）"""
    return {"ok": True, "standards": _load_standards()}


def _ai_match_materials(user_materials: list, db: list) -> list:
    """使用 DeepSeek AI 将用户输入的原料名语义匹配到数据库中的原料名（批量处理）"""
    db_names = [entry["material"] for entry in db]
    db_names_str = "\n".join(f"- {name}" for name in db_names)
    user_materials_str = "\n".join(f"- {m}" for m in user_materials)

    # 如果未配置 API Key，用简单的关键词模糊匹配
    if DEEPSEEK_API_KEY == "sk-your-deepseek-api-key-here" or not DEEPSEEK_API_KEY:
        return _fuzzy_match_materials(user_materials, db_names)

    prompt = MATERIAL_MATCH_PROMPT.replace("__DATABASE_MATERIALS__", db_names_str).replace("__USER_MATERIALS__", user_materials_str)

    # 先尝试 AI 批量匹配
    try:
        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"请匹配以下 {len(user_materials)} 种原料"}
            ],
            "temperature": 0.1,
            "max_tokens": 512,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        }
        json_data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        http_req = urllib.request.Request(
            DEEPSEEK_API_URL,
            data=json_data_bytes,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(http_req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"].strip()

        # 清理返回内容
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines)

        ai_result = json.loads(content)
        matches = ai_result.get("matches", [])
        # 验证并返回
        valid_results = []
        for match in matches:
            matched_name = match.get("matched_name", "").strip()
            user_input = match.get("user_input", "")
            if matched_name and matched_name in db_names:
                valid_results.append({"user_input": user_input, "matched_name": matched_name})
            else:
                # AI返回无效值，降级到模糊匹配
                fuzzy = _fuzzy_match_one(user_input, db_names)
                valid_results.append({"user_input": user_input, "matched_name": fuzzy or ""})
        return valid_results
    except Exception:
        # API 异常时降级到模糊匹配
        return _fuzzy_match_materials(user_materials, db_names)


def _fuzzy_match_materials(user_materials: list, db_names: list) -> list:
    """无 AI 时的简单关键词匹配"""
    results = []
    for m in user_materials:
        matched = _fuzzy_match_one(m, db_names)
        results.append({"user_input": m, "matched_name": matched or ""})
    return results


def _fuzzy_match_one(user_name: str, db_names: list) -> str | None:
    """对单个原料做简单模糊匹配：纯汉字子串包含、去除后缀匹配"""
    un = user_name.strip().lower()
    if not un:
        return None

    # 1. 纯汉字部分子串匹配（"菊芋粉"的字串"菊芋"能匹配数据库中的"菊芋"）
    import re
    chinese_chars = re.findall(r'[一-鿿]+', user_name)
    chinese_core = ''.join(chinese_chars) if chinese_chars else un

    for db_name in db_names:
        db_lower = db_name.strip().lower()
        if db_lower == un:
            return db_name
        # 子串包含
        if len(chinese_core) >= 2 and chinese_core in db_lower:
            return db_name
        if len(db_lower) >= 2 and db_lower in chinese_core:
            return db_name

    # 2. 去掉常见后缀再试（"粉"、"汁"、"提取物"等）
    suffixes = ["粉", "汁", "液", "油", "提取物", "浓缩物", "干", "鲜", "冻"]
    stripped = chinese_core
    for suffix in suffixes:
        if stripped.endswith(suffix) and len(stripped) - len(suffix) >= 1:
            stripped = stripped[:-len(suffix)]
    if stripped != chinese_core and len(stripped) >= 1:
        for db_name in db_names:
            db_lower = db_name.strip().lower()
            if stripped in db_lower or db_lower in stripped:
                return db_name

    return None


@app.post("/api/ai/raw-material-hazards")
async def api_raw_material_hazards(req: RawMaterialHazardsRequest):
    """根据原料名称列表查询对应的危害分析数据，精确匹配失败时用AI语义匹配"""
    if not req.materials:
        raise HTTPException(status_code=400, detail="原料列表不能为空")

    db = _load_raw_material_hazards()
    if not db:
        raise HTTPException(status_code=500, detail="原料危害数据库加载失败")

    # 第一步：精确匹配
    results = []
    unmatched = []
    for material in req.materials:
        m = material.strip()
        if not m:
            continue
        found = False
        m_lower = m.lower()
        for entry in db:
            # 精确匹配：材料名或其别名（支持中英文，大小写不敏感）
            aliases = [str(a).strip().lower() for a in entry.get("aliases", [])]
            if entry["material"].lower() == m_lower or m_lower in aliases:
                results.append(entry)
                found = True
                break
        if not found:
            unmatched.append(m)

    # 第二步：对未匹配的原料用 AI 做语义匹配
    ai_matched = []   # 记录哪些是AI匹配的
    if unmatched:
        # 先收集已精确匹配到的原料名，用于去重
        exact_matched_names = {entry["material"] for entry in results}
        ai_matches = _ai_match_materials(unmatched, db)
        for item in ai_matches:
            user_input = item["user_input"]
            matched_name = item["matched_name"]
            if matched_name:
                # 记录AI匹配关系（用于从未匹配列表中移除）
                ai_matched.append({"user_input": user_input, "matched_name": matched_name})
                # 去重：如果该原料已通过精确匹配获取，不重复添加
                if matched_name in exact_matched_names:
                    continue
                # 从数据库中取对应数据
                for entry in db:
                    if entry["material"] == matched_name:
                        entry_copy = dict(entry)
                        entry_copy["_ai_matched"] = True
                        entry_copy["_user_input"] = user_input
                        results.append(entry_copy)
                        exact_matched_names.add(matched_name)
                        break
            else:
                # AI也找不到匹配，保留在unmatched但标记AI已尝试
                pass

        # 重新计算unmatched：原来的unmatched中AI也没匹配到的
        still_unmatched = []
        for m in unmatched:
            if not any(am["user_input"] == m for am in ai_matched):
                still_unmatched.append(m)
        unmatched = still_unmatched

    return {
        "ok": True,
        "data": {
            "matched": results,
            "unmatched": unmatched,
            "ai_matched": ai_matched,
            "summary": f"匹配到 {len(results)} 种原料的危害数据（其中AI匹配 {len(ai_matched)} 种），{len(unmatched)} 种原料未匹配"
        }
    }


@app.post("/api/ai/fill-from-text")
async def api_ai_fill_from_text(req: FillFromTextRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="文本内容不能为空")

    # 如果 API Key 是默认值，返回 mock 数据（方便开发测试）
    if DEEPSEEK_API_KEY == "sk-your-deepseek-api-key-here" or not DEEPSEEK_API_KEY:
        return _mock_fill_from_text(req.text)

    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": FILL_PROMPT},
            {"role": "user", "content": f"请从以下文本中提取HACCP问卷信息：\n\n{req.text}"}
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
    }

    try:
        json_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        http_req = urllib.request.Request(
            DEEPSEEK_API_URL,
            data=json_data,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(http_req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]

        # 清理返回内容：可能包含 ```json 标记
        cleaned = content.strip()
        if cleaned.startswith("```"):
            # 移除 ```json / ``` 标记
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines)

        parsed = json.loads(cleaned)
        return {"ok": True, "data": parsed}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


def _mock_fill_from_text(text: str) -> dict:
    """当未配置真实 API Key 时，提供模拟数据"""
    text_lower = text.lower()
    data = {
        "companyName": "",
        "deptName": "品控部|||QC Department",
        "haccpTeam": [
            {"name": "张工", "dept": "品控部|||QC Department", "position": "主管|||Supervisor", "role": "组长|||Team Leader"},
            {"name": "李工", "dept": "生产部", "position": "主任|||Director", "role": "副组长|||Deputy Leader"},
        ],
        "auditor": "王审核员",
        "productName": "",
        "rawMaterials": "",
        "additives": "",
        "productPH": "",
        "waterActivity": "",
        "intendedUse": "",
        "storageCondition": "",
        "packagingMethod": "",
        "targetConsumer": "",
        "shelfLife": "",
        "formula": [],
        "processSteps": [],
        "execStandard": "gb",
        "criticalLimits": "",
        "hazardBio": [
            {"desc": "微生物污染|||Microbial contamination", "severity": "高", "likelihood": "中", "control": "严格卫生控制|||Strict hygiene control"}
        ],
        "hazardChem": [
            {"desc": "化学残留|||Chemical residues", "severity": "中", "likelihood": "低", "control": "原料检测|||Raw material testing"}
        ],
        "hazardPhys": [
            {"desc": "异物混入|||Foreign object contamination", "severity": "中", "likelihood": "中", "control": "金属检测|||Metal detection"}
        ],
        "monitoring": [],
        "correctiveActions": [],
        "recordPeriod": "2年|||2 years",
        "recordFormat": "电子版+纸质版|||Electronic + paper copies",
    }

    # 简单关键词提取
    # 企业名称
    m = re.search(r'(?:企业名称|公司名称|企业)[：:]\s*([^\n，。,\.]+)', text)
    if m: data["companyName"] = m.group(1).strip()
    # 产品名称
    m = re.search(r'(?:产品名称|产品名|产品)[：:]\s*([^\n，。,\.]+)', text)
    if m: data["productName"] = m.group(1).strip()
    # 原料
    m = re.search(r'(?:原料|原材料)[：:]\s*([^\n。]+)', text)
    if m: data["rawMaterials"] = m.group(1).strip()
    # 储存条件
    m = re.search(r'(?:储存条件|贮藏条件|存储条件)[：:]\s*([^\n。]+)', text)
    if m: data["storageCondition"] = m.group(1).strip()
    # 保质期
    m = re.search(r'(?:保质期|保存期)[：:]\s*([^\n。]+)', text)
    if m: data["shelfLife"] = m.group(1).strip()

    return {"ok": True, "data": data}


FLOWCHART_PROMPT = """你是一位专业的食品生产工艺工程师。请根据用户提供的产品信息，设计一份详细、合理、符合HACCP标准的生产工艺流程图步骤。

请严格按照以下JSON格式返回结果（只返回JSON，不要任何额外文字）。所有文本字段必须使用双语格式（中文|||英文）：

{
  "steps": [
    {
      "stepName": "原料验收|||Raw Material Receiving",
      "operationMethod": "检查供应商检测报告，核对原料批次、感官检查|||Check supplier test reports, verify batch numbers, sensory inspection",
      "parameters": "温度≤25℃，湿度≤65%|||Temperature ≤25°C, Humidity ≤65%",
      "controlPoint": "CCP-1 原料接收|||CCP-1 Receiving",
      "equipmentName": "称量设备|||Weighing equipment"
    }
  ]
}

要求：
1. 步骤应涵盖从原料接收到成品入库/出厂的完整过程
2. 每个步骤的工艺参数要具体、可操作
3. 根据HACCP原则标注关键控制点（CCP）
4. 步骤数量：5-10个
5. 每一步的操作方法要详细
6. 所有文本字段必须包含双语（中文|||英文），stepName、operationMethod、parameters、controlPoint、equipmentName都需要
7. 返回的JSON中steps数组不能为空"""


CCP_JUDGMENT_PROMPT = """你是一位专业的HACCP危害分析与关键控制点（CCP）判定专家。请根据Codex Alimentarius CCP决策树，对用户提供的每个加工步骤，分析其中的生物危害、化学危害和物理危害，并给出CCP判定结果。

请严格按照以下JSON格式返回结果（只返回JSON，不要任何额外文字）：

{
  "judgments": [
    {
      "stepIndex": 0,
      "stepName": "步骤名称",
      "hazards": {
        "bio": {
          "hazardDesc": "致病菌污染风险（沙门氏菌、大肠杆菌等）|||Pathogenic bacteria contamination risk (Salmonella, E. coli, etc.)",
          "q1": "是",
          "q2": "是",
          "q2_need": null,
          "q3": "否",
          "q4": "是",
          "q5": "否",
          "isCCP": true,
          "reasoning": "该步骤存在生物危害（致病菌污染风险），已有温度控制措施（Q2=是），但该步骤并非专门设计用于消除危害（Q3=否），且后续无杀菌工序可消除该危害（Q5=否），故判定为CCP。|||This step has biological hazard (pathogen risk). Temperature controls exist (Q2=Yes) but are not specifically designed to eliminate hazards (Q3=No). No subsequent sterilization step (Q5=No), therefore it is a CCP."
        },
        "chem": {
          "hazardDesc": "农药残留、重金属超标风险|||Pesticide residue and heavy metal contamination risk",
          "q1": "是",
          "q2": "是",
          "q2_need": null,
          "q3": "否",
          "q4": "否",
          "q5": null,
          "isCCP": false,
          "reasoning": "该步骤存在化学危害，有控制措施（Q2=是），但该步骤不会导致化学危害升高至不可接受水平（Q4=否），故判定为非CCP。|||This step has chemical hazards. Controls exist (Q2=Yes), but this step does not increase chemical hazards to unacceptable levels (Q4=No), therefore NOT a CCP."
        },
        "phys": {
          "hazardDesc": "金属碎片混入风险（设备磨损）|||Metal fragment contamination risk (equipment wear)",
          "q1": "是",
          "q2": "是",
          "q2_need": null,
          "q3": "是",
          "q4": null,
          "q5": null,
          "isCCP": true,
          "reasoning": "该步骤存在物理危害，该步骤专门设计用于消除物理危害（Q3=是），故判定为CCP。|||This step has physical hazards. It is specifically designed to eliminate physical hazards (Q3=Yes), therefore it is a CCP."
        }
      }
    }
  ]
}

Codex CCP决策树规则（请严格遵循）：
Q1: 该加工步骤是否存在该类型危害？ → 否=非CCP（isCCP=false），是=继续Q2
Q2: 是否存在针对已识别危害的控制措施？ → 是=继续Q3，否=继续Q2_need子判断
Q2_need（子判断，仅Q2=否时填写）: 是否有必要在此步骤进行安全控制？ → 是=需修改步骤/工艺/产品后再判定（isCCP="modify"），否=非CCP（isCCP=false）
Q3: 该步骤是否经过专门设计，可消除危害或将其发生的可能性降低至可接受水平？ → 是=CCP（isCCP=true），否=继续Q4
Q4: 该步骤是否会发生污染，或污染水平升高至不可接受的程度？ → 否=非CCP（isCCP=false），是=继续Q5
Q5: 后续步骤或操作是否会消除该危害，或将其降低至可接受水平？ → 是=非CCP（isCCP=false，后续步骤可消除），否=CCP（isCCP=true，后续无法消除）

重要要求：
1. 每个步骤都必须对bio/chem/phys三类危害分别进行独立判定（共3个判定/步骤）
2. q1-q5字段值只能是字符串"是"或"否"；q2_need仅在q2="否"时填写"是"或"否"，其他情况下为null
3. isCCP: true=是CCP, false=不是CCP, "modify"=需修改后重新评估（仅当q2_need="是"时）
4. reasoning字段必须使用双语格式：中文判定理由后加|||再加英文翻译。例如："该步骤存在生物危害，热处理可消除（Q3=是），判定为CCP。|||This step has biological hazards. Heat treatment eliminates them (Q3=Yes), determined as CCP."
5. hazardDesc字段必须使用双语格式：中文危害描述后加|||再加英文翻译。例如："沙门氏菌污染风险|||Salmonella contamination risk"
6. 如果某个步骤明显不存在某种危害（如包装步骤通常无生物危害），Q1可以判定为"否"，此时q2-q5均设为null，isCCP=false
7. 对于通用食品加工流程，请基于食品行业HACCP通用知识进行合理判断
8. 返回的judgments数组长度必须等于步骤数，stepIndex从0开始递增
9. 杀菌/热处理/灭菌/蒸煮类步骤通常Q3=是（专门设计消除生物危害），应判定为CCP
10. 金属检测/X光/异物检测类步骤通常Q3=是（专门设计消除物理危害），应判定为CCP"""



MATERIAL_MATCH_PROMPT = """你是一位食品原料数据库管理专家。用户输入了一些食品原料名称，你需要从数据库的原料列表中找到每个输入名称的语义最接近匹配项。

规则：
1. 考虑同义词、简称、别名、学名、俗名等（例："菊芋粉"→"菊芋"，"酒精"→"乙醇"，"碳粉"→"活性炭"，"洋姜"→"菊芋"）
2. 如果某个输入名称确实在数据库中找不到合理匹配，对应值留空字符串 ""
3. 返回JSON格式，不要任何额外文字

数据库中的原料列表：
__DATABASE_MATERIALS__

请严格按照以下JSON格式返回：
{
  "matches": [
    {"user_input": "用户输入的原料名1", "matched_name": "数据库中的原料名或空字符串"},
    {"user_input": "用户输入的原料名2", "matched_name": "数据库中的原料名或空字符串"}
  ]
}

用户输入的原料列表：
__USER_MATERIALS__"""


@app.post("/api/ai/generate-flowchart")
async def api_ai_generate_flowchart(req: GenerateFlowchartRequest):
    """根据产品信息AI生成生产流程图步骤"""

    # 构建用户输入信息
    user_info = f"产品名称：{req.product_name}\n原料：{req.raw_materials}\n工艺描述：{req.process_description}\n储存条件：{req.storage_condition}\n补充信息：{req.additional_info}"
    if not user_info.strip():
        raise HTTPException(status_code=400, detail="请输入产品相关信息")

    # 如果 API Key 是默认值，返回 mock 数据
    if DEEPSEEK_API_KEY == "sk-your-deepseek-api-key-here" or not DEEPSEEK_API_KEY:
        return _mock_generate_flowchart(req)

    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": FLOWCHART_PROMPT},
            {"role": "user", "content": f"请为我设计以下产品的生产工艺流程图步骤：\n\n{user_info}"}
        ],
        "temperature": 0.4,
        "max_tokens": 4096,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
    }

    try:
        json_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        http_req = urllib.request.Request(
            DEEPSEEK_API_URL,
            data=json_data,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(http_req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]

        # 清理返回内容
        cleaned = content.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines)

        parsed = json.loads(cleaned)
        return {"ok": True, "data": parsed}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


def _mock_generate_flowchart(req: GenerateFlowchartRequest) -> dict:
    """当未配置真实 API Key 时，根据产品信息生成模拟流程图"""
    product = req.product_name or "食品"
    raw_materials = req.raw_materials or "主原料、辅料"

    # 根据产品类型生成不同的流程图
    product_lower = product.lower()

    if "饮料" in product or "乳" in product or "果汁" in product:
        steps = [
            {"stepName": "原料验收|||Raw Material Receiving", "operationMethod": "检查供应商检测报告，核对原料批次、生产日期，感官检查|||Check supplier reports, verify batch/lot, production date, sensory inspection", "parameters": "温度≤25℃|||Temperature ≤25°C", "controlPoint": "CCP-1 原料接收|||CCP-1 Receiving", "equipmentName": ""},
            {"stepName": "预处理|||Pre-treatment", "operationMethod": "原料清洗、去皮、去核，按配方称量|||Raw material washing, peeling, pitting, weigh per formula", "parameters": "清洗水温≤30℃，时间≥2min|||Wash water temp ≤30°C, time ≥2min", "controlPoint": "", "equipmentName": "清洗机、称量设备|||Washer, weighing equipment"},
            {"stepName": "调配混料|||Blending/Mixing", "operationMethod": "按配方将原料、辅料、添加剂投入调配罐，搅拌均匀|||Add raw materials, excipients, additives to blending tank per formula, mix thoroughly", "parameters": "转速150-200rpm，搅拌时间15-20min，温度≤10℃|||Speed 150-200rpm, mixing time 15-20min, temp ≤10°C", "controlPoint": "", "equipmentName": "调配罐、搅拌器|||Blending tank, agitator"},
            {"stepName": "均质|||Homogenization", "operationMethod": "将混合液通过均质机处理，使组织均匀细腻|||Pass mixture through homogenizer for uniform texture", "parameters": "均质压力20-30MPa，温度60-70℃|||Homogenization pressure 20-30MPa, temp 60-70°C", "controlPoint": "", "equipmentName": "均质机|||Homogenizer"},
            {"stepName": "杀菌|||Sterilization", "operationMethod": "采用超高温瞬时杀菌（UHT）或巴氏杀菌|||Use UHT or pasteurization", "parameters": "UHT:136-140℃，4-6s；巴氏:85-95℃，15-30s|||UHT: 136-140°C, 4-6s; Pasteurization: 85-95°C, 15-30s", "controlPoint": "CCP-2 杀菌工序|||CCP-2 Sterilization", "equipmentName": "板式换热器/UHT杀菌机|||Plate heat exchanger / UHT sterilizer"},
            {"stepName": "无菌灌装|||Aseptic Filling", "operationMethod": "在无菌环境下灌装至洁净包装容器，封口|||Fill into clean packaging containers in aseptic environment, seal", "parameters": "灌装温度≤30℃，环境洁净度万级|||Filling temp ≤30°C, Class 10,000 cleanroom", "controlPoint": "CCP-3 灌装工序|||CCP-3 Filling", "equipmentName": "无菌灌装机|||Aseptic filling machine"},
            {"stepName": "灯检|||Light Inspection", "operationMethod": "通过灯检设备检查产品外观、密封性、异物|||Inspect product appearance, seal integrity, foreign objects via light inspection", "parameters": "光照强度≥1000lux，传送速度≤10m/min|||Light intensity ≥1000lux, conveyor speed ≤10m/min", "controlPoint": "", "equipmentName": "灯检机|||Light inspection machine"},
            {"stepName": "喷码/包装|||Coding / Packaging", "operationMethod": "瓶身喷印生产日期、批号，装盒/装箱|||Print production date, batch number on bottle; carton/case packing", "parameters": "喷码清晰可辨，包装严密|||Clear coding, tight packaging", "controlPoint": "", "equipmentName": "喷码机、包装机|||Coding machine, packaging machine"},
            {"stepName": "成品检验|||Finished Product Inspection", "operationMethod": "按标准抽样进行微生物、理化、感官检验|||Sample testing per standard for microbiological, chemical, sensory analysis", "parameters": "抽样比例≥3‰，检验标准GB/T 27306|||Sampling rate ≥3‰, per GB/T 27306", "controlPoint": "", "equipmentName": "实验室设备|||Laboratory equipment"},
            {"stepName": "入库/出厂|||Warehousing / Shipping", "operationMethod": "检验合格品入库，不合格品隔离处理|||Store qualified products, isolate and handle non-conforming products", "parameters": "库温≤25℃，湿度≤65%|||Storage temp ≤25°C, humidity ≤65%", "controlPoint": "", "equipmentName": "叉车|||Forklift"},
        ]
    elif "肉" in product or "鱼" in product or "水产" in product:
        steps = [
            {"stepName": "原料验收|||Raw Material Receiving", "operationMethod": "检查原料肉/水产的检疫证明、新鲜度、中心温度|||Inspect quarantine certificate, freshness, core temp of raw meat/seafood", "parameters": "中心温度≤4℃，pH值5.8-6.2|||Core temp ≤4°C, pH 5.8-6.2", "controlPoint": "CCP-1 原料接收|||CCP-1 Receiving", "equipmentName": ""},
            {"stepName": "解冻/清洗|||Thawing / Washing", "operationMethod": "自然解冻或流动水解冻，去除不可食部分，清水漂洗|||Natural or running water thawing, remove inedible parts, rinse", "parameters": "解冻温度≤15℃（水冷），清洗水温≤10℃|||Thawing temp ≤15°C (water), wash water temp ≤10°C", "controlPoint": "", "equipmentName": "解冻槽、清洗槽|||Thawing tank, washing tank"},
            {"stepName": "修割/切分|||Trimming / Cutting", "operationMethod": "去除筋膜、淤血、碎骨，按规格切分成型|||Remove fascia, bruises, bone fragments; cut to specification", "parameters": "环境温度≤12℃，切分厚度均匀±2mm|||Ambient temp ≤12°C, cutting thickness uniform ±2mm", "controlPoint": "", "equipmentName": "切肉机、刀具|||Meat cutter, knives"},
            {"stepName": "腌制/调味|||Marinating / Seasoning", "operationMethod": "按配方添加腌料、香辛料，真空滚揉或静置腌制|||Add marinade and spices per formula; vacuum tumbling or static marination", "parameters": "腌制温度0-4℃，滚揉时间30-60min|||Marinating temp 0-4°C, tumbling time 30-60min", "controlPoint": "", "equipmentName": "真空滚揉机|||Vacuum tumbler"},
            {"stepName": "热处理", "operationMethod": "蒸煮/油炸/烘烤至中心温度达标|||Steam/fry/bake until core temp meets standard", "parameters": "中心温度≥75℃，时间≥30s|||Core temp ≥75°C, time ≥30s", "controlPoint": "CCP-2 热处理工序|||CCP-2 Heat Treatment", "equipmentName": "蒸煮柜/油炸线/烤箱|||Steam cabinet / frying line / oven"},
            {"stepName": "冷却|||Cooling", "operationMethod": "产品快速冷却至包装温度|||Rapid cooling to packaging temperature", "parameters": "中心温度降至≤10℃，冷却时间≤60min|||Core temp reduced to ≤10°C, cooling time ≤60min", "controlPoint": "", "equipmentName": "速冷装置/冷却间|||Rapid cooling unit / cooling room"},
            {"stepName": "金属检测|||Metal detection", "operationMethod": "产品通过金属检测仪，检测金属异物|||Pass products through metal detector to detect metal fragments", "parameters": "Fe≥1.5mm，SUS≥2.0mm|||Fe ≥1.5mm, SUS ≥2.0mm", "controlPoint": "CCP-3 金属检测|||CCP-3 Metal Detection", "equipmentName": "金属检测仪|||Metal detector"},
            {"stepName": "气调/真空包装|||MAP / Vacuum Packaging", "operationMethod": "在包装机内充入保护气体或抽真空后封口|||Fill with protective gas or vacuum and seal in packaging machine", "parameters": "残氧量≤1%，封口温度140-160℃|||Residual O2 ≤1%, sealing temp 140-160°C", "controlPoint": "", "equipmentName": "气调包装机/真空包装机|||MAP machine / vacuum packaging machine"},
            {"stepName": "二次杀菌（可选）|||Secondary Sterilization (Optional)", "operationMethod": "包装后巴氏杀菌，延长保质期|||Post-packaging pasteurization to extend shelf life", "parameters": "中心温度80-85℃，保持10-15min|||Core temp 80-85°C, hold 10-15min", "controlPoint": "", "equipmentName": "杀菌釜|||Autoclave"},
            {"stepName": "入库冷藏|||Cold Storage", "operationMethod": "快速入冷库，温度监控记录|||Quick transfer to cold storage, temperature monitoring and recording", "parameters": "库温0-4℃（冷藏）/ -18℃（冷冻）|||Storage temp 0-4°C (chilled) / -18°C (frozen)", "controlPoint": "", "equipmentName": "冷库|||Cold storage"},
        ]
    else:
        steps = [
            {"stepName": "原料验收|||Raw Material Receiving", "operationMethod": f"检查{raw_materials}的供应商检测报告、合格证明及感官质量", "parameters": "温度≤25℃，湿度≤65%", "controlPoint": "CCP-1 原料接收|||CCP-1 Receiving", "equipmentName": ""},
            {"stepName": "预处理/清洗", "operationMethod": "对原料进行分选、清洗、去皮/去壳等预处理", "parameters": "清洗水温≤30℃，清洗时间≥3min|||Wash water temp ≤30°C, time ≥3min", "controlPoint": "", "equipmentName": "清洗槽/分选机|||Washing tank / sorting machine"},
            {"stepName": "称量/配料|||Weighing / Batching", "operationMethod": "按配方精确称量各原料、辅料和添加剂|||Precisely weigh raw materials, excipients and additives per formula", "parameters": "称量精度±1g，复核检验|||Weighing accuracy ±1g, double-check verification", "controlPoint": "", "equipmentName": "电子秤、配料罐|||Electronic scale, batching tank"},
            {"stepName": "混合/搅拌|||Mixing / Stirring", "operationMethod": "将各物料投入混合设备，搅拌均匀|||Add materials to mixing equipment, stir until uniform", "parameters": "搅拌转速120-180rpm，时间10-20min|||Stirring speed 120-180rpm, time 10-20min", "controlPoint": "", "equipmentName": "混合机/搅拌机|||Mixer / blender"},
            {"stepName": "成型/加工|||Forming / Processing", "operationMethod": "根据产品特性进行成型、挤压、切割等加工|||Form, extrude, cut etc. based on product characteristics", "parameters": "成型温度25-35℃，压力0.2-0.5MPa|||Forming temp 25-35°C, pressure 0.2-0.5MPa", "controlPoint": "", "equipmentName": "成型机/模具|||Forming machine / mold"},
            {"stepName": "杀菌/热处理|||Sterilization / Heat Treatment", "operationMethod": "根据产品特性选择杀菌方式，确保微生物安全|||Select sterilization method based on product characteristics to ensure microbial safety", "parameters": "中心温度≥85℃，保持时间≥15s|||Core temp ≥85°C, hold time ≥15s", "controlPoint": "CCP-2 杀菌工序|||CCP-2 Sterilization", "equipmentName": "杀菌釜/隧道式杀菌机|||Autoclave / tunnel sterilizer"},
            {"stepName": "金属检测/异物检测|||Metal / Foreign Object Detection", "operationMethod": "产品通过金属检测仪，检测并剔除含金属异物的产品|||Pass products through metal detector, detect and reject products with metal fragments", "parameters": "Fe≥1.0mm，SUS≥1.5mm|||Fe ≥1.0mm, SUS ≥1.5mm", "controlPoint": "CCP-3 金属检测|||CCP-3 Metal Detection", "equipmentName": "金属检测仪|||Metal detector"},
            {"stepName": "内包装|||Inner Packaging", "operationMethod": "在洁净环境中按规格进行内包装，密封|||Perform inner packaging to specification in clean environment, seal", "parameters": "环境洁净度万级，封口温度130-150℃|||Class 10,000 cleanroom, sealing temp 130-150°C", "controlPoint": "", "equipmentName": "包装机|||Packaging machine"},
            {"stepName": "外包装/喷码|||Outer Packaging / Coding", "operationMethod": "装箱、喷印生产日期、批号、追溯码|||Carton packing, print production date, batch number, traceability code", "parameters": "喷码清晰，标识完整|||Clear coding, complete labeling", "controlPoint": "", "equipmentName": "喷码机、封箱机|||Coding machine, carton sealer"},
            {"stepName": "成品检验入库|||Finished Product Inspection & Warehousing", "operationMethod": "按标准抽样检验，合格品入库，不合格品隔离|||Sample testing per standard, store qualified products, isolate non-conforming", "parameters": "抽样比例≥5‰，检验按产品执行标准|||Sampling rate ≥5‰, testing per product standard", "controlPoint": "", "equipmentName": "实验室设备|||Laboratory equipment"},
        ]

    return {"ok": True, "data": {"steps": steps}}


# ===== AI CCP 判定接口 =====

@app.post("/api/ai/ccp-judgment")
async def api_ai_ccp_judgment(req: CcpJudgmentRequest):
    """根据用户提供的加工步骤，AI自动判定每个步骤的CCP"""
    if not req.steps:
        raise HTTPException(status_code=400, detail="加工步骤不能为空")

    # 构建用户输入
    steps_text = ""
    for i, step in enumerate(req.steps):
        sn = step.get("stepName", "") if isinstance(step, dict) else str(step)
        eq = step.get("equipmentName", "") if isinstance(step, dict) else ""
        om = step.get("operationMethod", "") if isinstance(step, dict) else ""
        pm = step.get("parameters", "") if isinstance(step, dict) else ""
        steps_text += f"步骤{i+1}：{sn}"
        if eq:
            steps_text += f" | 设备：{eq}"
        if om:
            steps_text += f" | 方法：{om}"
        if pm:
            steps_text += f" | 参数：{pm}"
        steps_text += "\n"

    user_input = f"产品名称：{req.product_name}\n原料：{req.raw_materials}\n工艺描述：{req.process_description}\n\n加工步骤：\n{steps_text}"

    # 如果 API Key 是默认值，返回 mock 数据
    if DEEPSEEK_API_KEY == "sk-your-deepseek-api-key-here" or not DEEPSEEK_API_KEY:
        return _mock_ccp_judgment(req)

    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": CCP_JUDGMENT_PROMPT},
            {"role": "user", "content": f"请对以下产品加工流程进行CCP判定：\n\n{user_input}"}
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
    }

    try:
        json_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        http_req = urllib.request.Request(
            DEEPSEEK_API_URL,
            data=json_data,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(http_req, timeout=90) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]

        # 清理返回内容
        cleaned = content.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines)

        parsed = json.loads(cleaned)
        return {"ok": True, "data": parsed}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


def _mock_ccp_judgment(req: CcpJudgmentRequest) -> dict:
    """当未配置真实 API Key 时，基于步骤名关键词启发式判定CCP"""
    judgments = []
    for i, step in enumerate(req.steps):
        sn = (step.get("stepName", "") if isinstance(step, dict) else str(step)).strip()
        if not sn:
            continue
        name_lower = sn.lower()
        om = (step.get("operationMethod", "") if isinstance(step, dict) else "").lower()
        pm = (step.get("parameters", "") if isinstance(step, dict) else "").lower()
        combined = name_lower + om + pm

        # 判定规则 — 关键词匹配只对比中文部分
        def _kw_match(kw, text):
            """匹配关键词：如果含|||则只比中文部分，否则全文匹配"""
            return kw.split("|||")[0] in text if "|||" in kw else kw in text

        is_heat_step = any(_kw_match(kw, combined) for kw in ["杀菌|||Sterilization", "热处理", "蒸煮", "灭菌", "uht", "巴氏", "消毒", "加热"])
        is_metal_step = any(_kw_match(kw, combined) for kw in ["金属检测|||Metal detection", "异物检测", "x光", "磁选", "筛选", "金属探测"])
        is_receiving = any(_kw_match(kw, combined) for kw in ["验收", "接收", "原料"])
        is_cleaning = any(_kw_match(kw, combined) for kw in ["清洗", "清洁", "cip", "消毒"])
        is_cooling = any(_kw_match(kw, combined) for kw in ["冷却|||Cooling", "降温", "冷藏", "冷冻", "速冻"])
        is_packaging = any(_kw_match(kw, combined) for kw in ["包装", "灌装", "封口", "封盖"])
        is_filter = any(_kw_match(kw, combined) for kw in ["过滤", "膜滤", "超滤", "离心", "脱色"])
        is_drying = any(_kw_match(kw, combined) for kw in ["干燥", "烘干", "喷雾", "脱水"])
        is_storage = any(_kw_match(kw, combined) for kw in ["入库", "储存", "仓储", "出厂"])

        def make_bio_hazard():
            if is_heat_step:
                return {"hazardDesc": "致病菌（沙门氏菌、大肠杆菌O157:H7、李斯特菌等）残留|||Pathogenic bacteria (Salmonella, E. coli O157:H7, Listeria, etc.) residual", "q1": "是", "q2": "是", "q2_need": None, "q3": "是", "q4": None, "q5": None, "isCCP": True, "reasoning": "该步骤存在生物危害风险（致病菌污染），加热处理是专门设计用于消除微生物危害的控制措施（Q3=是），故判定为CCP。|||This step has biological hazard risk (pathogen contamination). Heat treatment is specifically designed to eliminate microbial hazards (Q3=Yes), therefore it is a CCP."}
            if is_receiving:
                return {"hazardDesc": "原料可能携带致病菌（沙门氏菌、大肠杆菌等）|||Raw materials may carry pathogens (Salmonella, E. coli, etc.)", "q1": "是", "q2": "是", "q2_need": None, "q3": "否", "q4": "是", "q5": "是", "isCCP": False, "reasoning": "原料可能存在生物危害，有验收控制措施（Q2=是），但验收非专门设计用于消除危害（Q3=否），污染可能在验收环节被发现而非消除（Q4=是），后续加工步骤（如清洗、杀菌）可消除该危害（Q5=是），故判定为非CCP。|||Raw materials may have biological hazards. Receiving inspection controls exist (Q2=Yes) but are not designed to eliminate hazards (Q3=No). Subsequent processing steps (washing, sterilization) eliminate the hazard (Q5=Yes), therefore NOT a CCP."}
            if is_cooling:
                return {"hazardDesc": "冷却过程中温度处于适宜微生物繁殖区间，可能导致微生物增殖|||Cooling temperatures in microbial growth range may cause proliferation", "q1": "是", "q2": "是", "q2_need": None, "q3": "否", "q4": "是", "q5": "否", "isCCP": True, "reasoning": "冷却步骤存在微生物增殖风险，有温度/时间控制措施（Q2=是），但冷却步骤非专门设计用于消除危害（Q3=否），冷却不当会导致污染升高至不可接受水平（Q4=是），后续无杀菌步骤可消除该危害（Q5=否），故判定为CCP。|||Cooling step has microbial growth risk. Temperature/time controls exist (Q2=Yes), but cooling is not designed to eliminate hazards (Q3=No). Improper cooling increases contamination (Q4=Yes). No subsequent sterilization (Q5=No), therefore it is a CCP."}
            if is_cleaning:
                return {"hazardDesc": "清洗不彻底可能导致微生物残留和交叉污染|||Inadequate cleaning may cause microbial residue and cross-contamination", "q1": "是", "q2": "是", "q2_need": None, "q3": "否", "q4": "否", "q5": None, "isCCP": False, "reasoning": "清洗步骤存在生物危害，有操作规范控制（Q2=是），但清洗不当不会使生物危害升高至不可接受水平（Q4=否），后续通常有杀菌工序，故判定为非CCP。|||Cleaning step has biological hazards. Operational controls exist (Q2=Yes), but improper cleaning does not increase hazards to unacceptable levels (Q4=No). Subsequent sterilization typically follows, therefore NOT a CCP."}
            if is_packaging:
                return {"hazardDesc": "无明显生物危害|||No significant biological hazard", "q1": "否", "q2": None, "q2_need": None, "q3": None, "q4": None, "q5": None, "isCCP": False, "reasoning": "包装步骤在洁净环境下进行，无明显生物危害引入风险（Q1=否），故判定为非CCP。|||Packaging is performed in a clean environment. No significant biological hazard introduction risk (Q1=No), therefore NOT a CCP."}
            # default
            return {"hazardDesc": "可能存在的微生物污染风险|||Potential microbial contamination risk", "q1": "是", "q2": "是", "q2_need": None, "q3": "否", "q4": "否", "q5": None, "isCCP": False, "reasoning": "该步骤可能存在生物危害，有基本控制措施（Q2=是），但该步骤不会导致污染升高至不可接受水平（Q4=否），故判定为非CCP。|||This step may have biological hazards. Basic controls exist (Q2=Yes), but this step does not increase contamination to unacceptable levels (Q4=No), therefore NOT a CCP."}

        def make_chem_hazard():
            if is_receiving:
                return {"hazardDesc": "农药残留、重金属（铅、砷、镉）、兽药残留超标|||Pesticide residues, heavy metals (Pb, As, Cd), veterinary drug residues", "q1": "是", "q2": "是", "q2_need": None, "q3": "否", "q4": "否", "q5": None, "isCCP": False, "reasoning": "原料可能存在化学危害，有验收检测控制（Q2=是），但验收步骤不会导致化学危害升高（Q4=否），故判定为非CCP。|||Raw materials may have chemical hazards. Receiving inspection controls exist (Q2=Yes), but receiving does not increase chemical hazard levels (Q4=No), therefore NOT a CCP."}
            if is_filter:
                return {"hazardDesc": "加工助剂残留、化学物质溶出|||Processing aid residues, chemical substance leaching", "q1": "是", "q2": "是", "q2_need": None, "q3": "是", "q4": None, "q5": None, "isCCP": True, "reasoning": "该步骤存在化学危害风险，过滤/脱色步骤专门设计用于去除化学物质（Q3=是），故判定为CCP。|||This step has chemical hazard risk. Filtration/decolorization is specifically designed to remove chemical substances (Q3=Yes), therefore it is a CCP."}
            if is_cleaning:
                return {"hazardDesc": "清洗剂/消毒剂残留|||Cleaning agent/disinfectant residues", "q1": "是", "q2": "是", "q2_need": None, "q3": "否", "q4": "否", "q5": None, "isCCP": False, "reasoning": "可能存在清洗剂残留，有冲洗控制措施（Q2=是），规范操作下不会导致残留超标（Q4=否），故判定为非CCP。|||Cleaning agent residues may exist. Rinsing controls are in place (Q2=Yes). Proper operations prevent excessive residues (Q4=No), therefore NOT a CCP."}
            # default
            return {"hazardDesc": "无明显化学危害|||No significant chemical hazard", "q1": "否", "q2": None, "q2_need": None, "q3": None, "q4": None, "q5": None, "isCCP": False, "reasoning": "该步骤通常不涉及化学危害引入（Q1=否），故判定为非CCP。|||This step typically does not introduce chemical hazards (Q1=No), therefore NOT a CCP."}

        def make_phys_hazard():
            if is_metal_step:
                return {"hazardDesc": "金属碎片（设备磨损、刀片断裂等产生的铁、不锈钢碎片）|||Metal fragments (Fe, SUS from equipment wear, blade breakage)", "q1": "是", "q2": "是", "q2_need": None, "q3": "是", "q4": None, "q5": None, "isCCP": True, "reasoning": "该步骤存在物理危害（金属异物），金属检测/筛选步骤专门设计用于去除金属异物（Q3=是），故判定为CCP。|||This step has physical hazards (metal fragments). Metal detection/screening is specifically designed to remove metal objects (Q3=Yes), therefore it is a CCP."}
            if is_receiving:
                return {"hazardDesc": "原料中可能混入砂石、金属、玻璃等异物|||Raw materials may contain stones, metal, glass and other foreign objects", "q1": "是", "q2": "是", "q2_need": None, "q3": "否", "q4": "否", "q5": None, "isCCP": False, "reasoning": "原料可能携带物理异物，有验收目视检查（Q2=是），但验收不会增加物理危害（Q4=否），故判定为非CCP。|||Raw materials may carry physical foreign objects. Visual inspection exists (Q2=Yes), but receiving does not increase physical hazards (Q4=No), therefore NOT a CCP."}
            if is_packaging:
                return {"hazardDesc": "包装材料碎片、封口不良导致异物侵入|||Packaging material fragments, foreign object intrusion from poor sealing", "q1": "是", "q2": "是", "q2_need": None, "q3": "否", "q4": "否", "q5": None, "isCCP": False, "reasoning": "可能存在包装材料碎片，有目视检查和设备维护控制（Q2=是），风险较低（Q4=否），故判定为非CCP。|||Packaging material fragments may exist. Visual inspection and equipment maintenance controls are in place (Q2=Yes). Risk is low (Q4=No), therefore NOT a CCP."}
            # default
            return {"hazardDesc": "无明显物理危害|||No significant physical hazard", "q1": "否", "q2": None, "q2_need": None, "q3": None, "q4": None, "q5": None, "isCCP": False, "reasoning": "该步骤通常不涉及物理危害引入（Q1=否），故判定为非CCP。|||This step typically does not introduce physical hazards (Q1=No), therefore NOT a CCP."}

        judgments.append({
            "stepIndex": i,
            "stepName": sn,
            "hazards": {
                "bio": make_bio_hazard(),
                "chem": make_chem_hazard(),
                "phys": make_phys_hazard(),
            }
        })

    return {"ok": True, "data": {"judgments": judgments}}


# ===== AI 关键限值 / 监控 / 纠偏 / 验证 =====

CRITICAL_LIMITS_PROMPT = """你是一位专业的HACCP关键限值专家。请根据用户提供的CCP信息和执行标准，为每个CCP给出关键限值建议。

要求：
1. 关键限值仅为AI建议，供HACCP小组参考，最终限值必须由企业依据标准原文和实际工艺确认
2. 有明确法规/标准依据时给出具体、可测量的数值（温度、时间、尺寸、浓度等）并标注依据（如GB 7101-2022、GB 2762-2022等）
3. 若没有合适的标准依据或无法给出可靠数值，limit 字段填写"待定（需企业依据标准原文确认）|||TBD (to be confirmed per standard) "，不要强行编造数值
4. 如果执行标准是国标，优先参考注入的相关国家标准
5. 所有文本字段必须使用双语格式（中文|||英文）

请严格按照以下JSON格式返回（只返回JSON，不要任何额外文字）：
{
  "criticalLimits": "1. **CCP名称|||CCP Name**：\n   - 温度≥85℃|||Temperature ≥85°C\n   - 时间≥15秒|||Time ≥15s\n   - 依据：GB 14881-2013|||Per GB 14881-2013",
  "details": [
    {"ccp": "CCP名称|||CCP Name", "limit": "关键限值|||Critical Limit", "basis": "法规依据|||Regulatory Basis", "rationale": "设置理由|||Rationale"}
  ]
}"""

MONITORING_PROMPT = """你是一位专业的HACCP监控程序专家。请根据用户提供的CCP列表和产品信息，为每个CCP设计科学合理的监控方案。

监控方案应包含：监控对象（测什么）、监控方法（怎么测）、监控频率（多久测一次）、监控人员（谁来测）。

要求：
1. 监控方法应具体可操作（如"在线温度传感器连续监控|||Online temperature sensor continuous monitoring"）
2. 监控频率应根据风险等级合理设置（连续监控/每批次/每日/每周）
3. 监控人员应有明确资质要求
4. 所有文本字段必须使用双语格式（中文|||英文）

请严格按照以下JSON格式返回（只返回JSON，不要任何额外文字）：
{
  "monitoring": [
    {"ccp": "CCP名称|||CCP Name", "object": "监控对象|||Monitoring Object", "method": "监控方法|||Method", "frequency": "监控频率|||Frequency", "personnel": "监控人员|||Personnel", "remark": "备注|||Remarks"}
  ]
}"""

CORRECTIVE_ACTIONS_PROMPT = """你是一位精通HACCP体系的食品安全专家。请依据国际通行的HACCP准则（Codex CAC/RCP 1-1969、GB/T 27341-2009、FDA NACMCF指南）以及用户提供的CCP列表、关键限值和监控信息，为每个CCP制定科学、具体、可落地的纠偏措施。

【标准要求——纠偏措施必须满足三要素】
1. 查明并纠正偏离原因，使CCP恢复受控（FDA要素a；GB/T 27341 7.4.4）
2. 对偏离期间受影响产品进行评估与处置，防止不安全产品进入消费环节（FDA要素b）
3. 明确纠偏责任人并完整记录纠偏过程（FDA要素c）

【各字段编写要求】
1. cl（关键限值）：引用该CCP设定的关键限值具体数值，与本工序监控指标一致
2. personnel（实施人员）：写明执行纠偏的岗位（如"品控专员/生产主任"），紧急处置应由当班有权停线人员执行
3. causeAnalysis（偏离原因）：结合该CCP的工艺特点，列举2~3种最可能的偏离原因（设备故障、操作失误、原料波动、环境因素等），并给出排查顺序
4. productHandling（产品处置）：按"隔离→评估→处置"三步写，处置选项按严重程度分级：可返工/重新加工→降级使用→转作他用→销毁；写明隔离范围（如"报警前后各30分钟产品"）和放行须经HACCP小组批准
5. corrective（纠偏措施）：写出立即采取的具体操作动作（停机、调参、检修、更换部件等），措施必须能消除偏离原因并使CCP恢复受控
6. verification（验证方法）：写明如何验证纠偏有效（复查监控记录、重新检测、校准设备、后续批次跟踪等）
7. record（记录表格）：给出纠偏记录表单名称（如《CCP偏差处理记录》《产品隔离处置记录》）

要求：
1. 内容必须针对具体CCP定制，严禁套用通用模板
2. 每个字段1~2句话，简洁具体、可直接执行
3. 所有文本字段使用双语格式（中文|||英文）
4. 纠偏措施仅为AI建议，供HACCP小组审核参考；若无足够依据，可填"待定|||TBD"，不得编造

请严格按照以下JSON格式返回（只返回JSON，不要任何额外文字）：
{
  "correctiveActions": [
    {"ccp": "CCP名称|||CCP Name", "cl": "关键限值|||Critical Limit", "personnel": "实施人员|||Personnel", "causeAnalysis": "偏离原因|||Cause of Deviation", "productHandling": "产品处置|||Product Handling", "corrective": "纠偏措施|||Corrective Action", "verification": "验证方法|||Verification Method", "record": "记录表格名称|||Record Form Name"}
  ]
}"""

VERIFICATION_PROMPT = """你是一位专业的HACCP验证程序专家。请根据用户提供的CCP列表、监控方案和纠偏措施，制定HACCP计划的验证程序。

验证程序应包含：
1. 验证方法（如何验证HACCP体系有效运行）
2. 验证频率（多久验证一次）
3. 验证人员（谁来负责验证）

验证不同于监控——验证是确认整个HACCP体系是否有效运行，而不是对单个CCP的日常监控。

要求：所有文本字段必须使用双语格式（中文|||英文）。

请严格按照以下JSON格式返回（只返回JSON，不要任何额外文字）：
{
  "verificationMethod": "1. CCP监控记录审核：每批次审核|||1. CCP Monitoring Review: Per batch audit\n2. 设备校准：每季度|||2. Equipment Calibration: Quarterly",
  "verificationFrequency": "每日/每周/每月|||Daily/Weekly/Monthly",
  "verificationPersonnel": "HACCP小组组长|||HACCP Team Leader"
}"""


class CorrectiveActionsRequest(BaseModel):
    product_name: str = ""
    ccp_steps: list = []  # [{stepName, isCCP: true/false}]
    critical_limits: str = ""  # 现有关键限值文本


class VerificationRequest(BaseModel):
    product_name: str = ""
    ccp_steps: list = []
    monitoring: list = []  # [{ccp, object, method, frequency, personnel}]
    corrective_actions: list = []  # [{ccp, cl, corrective, verification, record}]


class MonitoringRequest(BaseModel):
    product_name: str = ""
    ccp_steps: list = []
    process_description: str = ""


class CriticalLimitsRequest(BaseModel):
    product_name: str = ""
    ccp_steps: list = []
    exec_standard: str = "gb"


def _parse_json_robust(text: str) -> dict:
    """容错解析 AI 返回的 JSON：去围栏、提取大括号区间、清理字符串内非法控制字符"""
    content = text.strip()
    # 提取首尾大括号之间的内容（跳过AI可能附加的说明文字）
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end > start:
        content = content[start:end + 1]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # 将字符串内部的非法控制字符（换行/制表符等）替换为空格后再解析
        def _fix_str(m):
            return re.sub(r'[\x00-\x1f\x7f]', ' ', m.group(0))
        repaired = re.sub(r'"[^"\\]*(?:\\.[^"\\]*)*"', _fix_str, content)
        return json.loads(repaired)


def _is_mock_mode() -> bool:
    return DEEPSEEK_API_KEY == "sk-your-deepseek-api-key-here" or not DEEPSEEK_API_KEY


@app.post("/api/ai/critical-limits")
async def api_ai_critical_limits(req: CriticalLimitsRequest):
    """根据CCP列表和执行标准，AI生成关键限值建议"""
    if not req.ccp_steps:
        raise HTTPException(status_code=400, detail="CCP步骤列表不能为空")

    ccp_list = [s for s in req.ccp_steps if s.get("isCCP")]
    if not ccp_list:
        return {"ok": True, "data": {"criticalLimits": "暂无CCP，不需要设置关键限值", "details": []}}

    std_labels = {"gb": "国标（GB）", "industry": "行业标准", "enterprise": "企业标准", "international": "国际标准"}
    std_label = std_labels.get(req.exec_standard, "国标（GB）")

    ccp_text = "\n".join(f"- {s.get('stepName', '')}" for s in ccp_list)

    # 注入相关国家标准知识（仅国标模式；AI据此设置限值，减少幻觉）
    std_context = ""
    if req.exec_standard == "gb":
        picked = _pick_standards_for([s.get("stepName", "") for s in ccp_list], req.product_name or "")
        if picked:
            lines = []
            for std in picked:
                name_zh = std.get("name", "").split("|||")[0]
                limits = std.get("keyLimits") or []
                if limits:
                    lines.append(f"- {std.get('number', '')}《{name_zh}》：{'；'.join(l.split('|||')[0] for l in limits)}")
                else:
                    lines.append(f"- {std.get('number', '')}《{name_zh}》")
            std_context = "\n\n【相关国家标准参考（关键限值必须以此为依据设置）】\n" + "\n".join(lines)

    user_content = f"产品名称：{req.product_name}\n执行标准：{std_label}\n\n确定的CCP：\n{ccp_text}{std_context}\n\n请为以上CCP制定关键限值。"

    if _is_mock_mode():
        limits_text = ""
        details = []
        for s in ccp_list:
            name = s.get("stepName", "").lower()
            # 双语关键词匹配：任一语言段命中即算匹配
            def _kwm(kw, t):
                t = t.lower()
                for part in kw.split("|||"):
                    if part and part.strip().lower() in t:
                        return True
                return False
            basis_keys = []
            if any(_kwm(kw, name) for kw in ["杀菌|||Sterilization", "热处理|||heat treatment", "灭菌|||steriliz", "消毒|||disinfect", "加热|||heat", "cooking", "pasteuriz", "baking", "frying", "boiling"]):
                basis_keys = ["GB 14881-2013"]
                limit = "中心温度≥85℃，保持时间≥15秒|||Core temp ≥85°C, hold ≥15s"
            elif any(_kwm(kw, name) for kw in ["金属检测|||Metal detection", "异物|||foreign", "金属探测|||metal detect", "x光|||x-ray", "metal", "detect", "magnet", "screen", "siev"]):
                basis_keys = ["GB/T 25346-2010"]
                limit = "Fe≤1.5mm，SUS≤2.0mm|||Fe ≤1.5mm, SUS ≤2.0mm"
            elif any(_kwm(kw, name) for kw in ["验收|||receiving", "接收|||receiv", "原料|||raw material", "incoming", "inspection", "acceptance", "material"]):
                basis_keys = ["GB 2763-2021", "GB 2762-2022"]
                limit = "符合GB 2763/2762限量标准|||Comply with GB 2763/2762 limits"
            else:
                limit = "待定|||TBD"
            # 从数据库匹配本 CCP 相关标准，keyLimits 作为建议限值优先采用
            picked = _pick_standards_for([s.get("stepName", "")], req.product_name or "")
            db_limit = ""
            for std in picked:
                for l in (std.get("keyLimits") or []):
                    db_limit += ("；" if db_limit else "") + l
            if db_limit:
                limit = db_limit
                for std in picked:
                    if std.get("keyLimits"):
                        basis_keys.append(std.get("number", ""))
            basis = "、".join(dict.fromkeys(basis_keys)) if basis_keys else "企业内控标准"
            limits_text += f"**{s.get('stepName', '')}（AI建议，需HACCP小组确认）|||{s.get('stepName', '')} (AI suggestion, pending HACCP team confirmation)**：\n   - {limit}\n   - 依据：{basis}\n\n"
            details.append({"ccp": s.get("stepName", ""), "limit": limit, "basis": basis, "rationale": "依据现有标准数据库匹配结果，最终限值需企业依据标准原文和实际工艺确认|||Based on matched standards database; final limits must be confirmed against standard texts and actual process"})
        limits_text = "【AI建议】以下关键限值基于现有标准数据库自动生成，供HACCP小组参考，须经确认后生效。|||[AI SUGGESTION] The critical limits below are auto-generated from the standards database for HACCP team reference and take effect only after confirmation.\n\n" + limits_text
        return {"ok": True, "data": {"criticalLimits": limits_text.strip(), "details": details}}

    try:
        data = _call_deepseek(CRITICAL_LIMITS_PROMPT, user_content, 2048)
        # 统一标注：结果为 AI 建议，需 HACCP 小组确认
        if isinstance(data, dict) and data.get("criticalLimits"):
            data["criticalLimits"] = "【AI建议】以下关键限值为AI生成建议，供HACCP小组参考，须依据标准原文和实际工艺确认后生效。|||[AI SUGGESTION] The critical limits below are AI-generated suggestions for HACCP team reference and take effect only after confirmation against standard texts and actual process.\n\n" + data["criticalLimits"]
        if isinstance(data, dict) and isinstance(data.get("details"), list):
            for d in data["details"]:
                if isinstance(d, dict) and not d.get("rationale"):
                    d["rationale"] = "AI建议值，需企业依据标准原文和实际工艺确认|||AI suggestion; confirm against standard texts and actual process"
        return {"ok": True, "data": data}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/ai/monitoring")
async def api_ai_monitoring(req: MonitoringRequest):
    """根据CCP列表，AI生成监控方案"""
    if not req.ccp_steps:
        raise HTTPException(status_code=400, detail="CCP步骤列表不能为空")

    ccp_list = [s for s in req.ccp_steps if s.get("isCCP")]
    if not ccp_list:
        return {"ok": True, "data": {"monitoring": []}}

    ccp_text = "\n".join(f"- {s.get('stepName', '')}：{s.get('operationMethod', '')} {s.get('parameters', '')}" for s in ccp_list)
    user_content = f"产品名称：{req.product_name}\n工艺描述：{req.process_description}\n\n确定的CCP：\n{ccp_text}\n\n请为以上CCP制定监控方案。"

    if _is_mock_mode():
        monitor = []
        def _kwm(kw, t):
            t = t.lower()
            for part in kw.split("|||"):
                if part and part.strip().lower() in t:
                    return True
            return False
        for s in ccp_list:
            name = s.get("stepName", "").lower()
            if any(_kwm(kw, name) for kw in ["杀菌|||Sterilization", "热处理|||heat treatment", "灭菌|||steriliz", "消毒|||disinfect", "加热|||heat", "cooking", "pasteuriz", "baking", "frying", "boiling"]):
                monitor.append({"ccp": s.get("stepName", ""), "object": "温度、时间|||Temperature, time", "method": "在线温度传感器连续监控|||Online temperature sensor continuous monitoring", "frequency": "每批次实时记录|||Real-time recording per batch", "personnel": "经HACCP培训的品控专员|||HACCP-trained QC specialist", "remark": "温度偏差需≤±1℃|||Temperature deviation ≤±1°C"})
            elif any(_kwm(kw, name) for kw in ["金属检测|||Metal detection", "异物|||foreign", "金属探测|||metal detect", "x光|||x-ray", "metal", "detect", "magnet", "screen", "siev"]):
                monitor.append({"ccp": s.get("stepName", ""), "object": "金属异物", "method": "在线金属检测仪自动检测|||Online metal detector automatic inspection", "frequency": "连续监控|||Continuous monitoring", "personnel": "设备维护人员+品控专员|||Equipment maintenance staff + QC specialist", "remark": "按GB/T 25346-2010执行|||Per GB/T 25346-2010"})
            elif any(_kwm(kw, name) for kw in ["验收|||receiving", "接收|||receiv", "原料|||raw material", "incoming", "inspection", "acceptance", "material"]):
                monitor.append({"ccp": s.get("stepName", ""), "object": "农药残留、重金属", "method": "供应商检测报告+抽检验证|||Supplier test reports + spot check verification", "frequency": "每批次审核", "personnel": "经培训的采购专员|||Trained procurement specialist", "remark": "依据GB 2763-2021、GB 2762-2022|||Per GB 2763-2021, GB 2762-2022"})
            else:
                monitor.append({"ccp": s.get("stepName", ""), "object": "工艺参数|||Process parameters", "method": "在线/人工检测|||Online/manual inspection", "frequency": "按需确定|||Determine as needed", "personnel": "品控人员|||QC personnel", "remark": "依据企业标准|||Per enterprise standard"})
        return {"ok": True, "data": {"monitoring": monitor}}

    try:
        data = _call_deepseek(MONITORING_PROMPT, user_content, 2048)
        return {"ok": True, "data": data}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/ai/corrective-actions")
async def api_ai_corrective_actions(req: CorrectiveActionsRequest):
    """根据CCP列表和关键限值，AI生成纠偏措施"""
    if not req.ccp_steps:
        raise HTTPException(status_code=400, detail="CCP步骤列表不能为空")

    ccp_list = [s for s in req.ccp_steps if s.get("isCCP")]
    if not ccp_list:
        return {"ok": True, "data": {"correctiveActions": []}}

    ccp_text = "\n".join(
        f"- {s.get('stepName', '')}"
        + (f"（危害：{s.get('hazardDesc', '')}" if s.get('hazardDesc') else "")
        + (f"；关键限值：{s.get('criticalLimit', '')}" if s.get('criticalLimit') else "")
        + (f"；监控：{s.get('monitoring', '')}" if s.get('monitoring') else "")
        + (")" if (s.get('hazardDesc') or s.get('criticalLimit') or s.get('monitoring')) else "")
        for s in ccp_list
    )
    user_content = f"产品名称：{req.product_name}\n\n确定的CCP：\n{ccp_text}\n\n已确定的关键限值：\n{req.critical_limits or '暂未设置'}\n\n请为以上CCP制定纠偏措施。"

    if _is_mock_mode():
        actions = []
        # 双语关键词匹配：任一语言段命中即算匹配
        def _kwm(kw, t):
            t = t.lower()
            for part in kw.split("|||"):
                if part and part.strip().lower() in t:
                    return True
            return False
        for s in ccp_list:
            name = s.get("stepName", "").lower()
            if any(_kwm(kw, name) for kw in ["杀菌|||Sterilization", "热处理|||heat treatment", "灭菌|||steriliz", "消毒|||disinfect", "加热|||heat", "cooking", "pasteuriz", "baking", "frying", "boiling"]):
                actions.append({"ccp": s.get("stepName", ""), "cl": "中心温度≥85℃，保持≥15秒|||Core temp ≥85°C, hold ≥15s", "personnel": "当班生产主任 / 品控专员（有权停机）|||Shift production supervisor / QC specialist (authorized to stop line)", "causeAnalysis": "排查顺序：①蒸汽压力或锅炉供汽不足；②温度传感器失准/探头结垢；③操作时间不足或未记录。按此顺序逐一排查并排除|||Troubleshoot in order: ①insufficient steam pressure; ②sensor drift/scale buildup; ③insufficient holding time or missing records", "productHandling": "1) 立即隔离该批次及前后相邻产品；2) 评估杀菌不足范围，抽样做微生物检测；3) 可安全返工的重新杀菌，否则降级/转作他用/销毁；4) 放行须经HACCP小组书面批准|||1) Immediately isolate this batch and adjacent products; 2) Assess scope of under-sterilization, sample for micro testing; 3) Re-sterilize if feasible, otherwise downgrade/re-purpose/destroy; 4) Release only with written HACCP team approval", "corrective": "立即停机排查蒸汽/传感器/操作记录，修复后重新杀菌达标并连续验证2批正常方可恢复生产|||Stop line immediately; check steam, sensor, and records; after repair, re-sterilize to CL and verify 2 consecutive batches before resuming", "verification": "复查温度记录曲线；对返工品抽样检测微生物；校准温度传感器|||Review temperature charts; micro-test reworked product; calibrate temperature sensor", "record": "《杀菌工序温度异常记录表》《产品隔离处置记录》|||Sterilization Deviation Record, Product Isolation & Disposition Record"})
            elif any(_kwm(kw, name) for kw in ["金属检测|||Metal detection", "异物|||foreign", "金属探测|||metal detect", "x光|||x-ray", "metal", "detect", "magnet", "screen", "siev"]):
                actions.append({"ccp": s.get("stepName", ""), "cl": "Fe≤1.5mm，SUS≤2.0mm|||Fe ≤1.5mm, SUS ≤2.0mm", "personnel": "当班品控 / 设备维护员（有权停机）|||Shift QC / equipment maintenance staff (authorized to stop line)", "causeAnalysis": "排查顺序：①检测仪灵敏度漂移或校验失效；②筛网/输送部件破损引入金属；③原料带入金属异物。用标准试块先验证设备|||Troubleshoot in order: ①detector sensitivity drift; ②broken screens/conveyor parts; ③metal from raw materials. Verify detector with test blocks first", "productHandling": "1) 立即停线；2) 隔离自上次合格校验后生产的所有产品；3) 全部重新过检，剔除品隔离评估；4) 无法确认安全的产品降级或销毁|||1) Stop line immediately; 2) Isolate all product since last valid calibration; 3) Re-inspect everything; isolate rejects; 4) Downgrade or destroy if safety cannot be confirmed", "corrective": "停机检修检测仪并重新校验，修复后以标准试块连续通过3次方可复产|||Stop line, service and re-calibrate detector; pass test blocks 3 consecutive times before resuming", "verification": "每小时用标准试块验证检测仪；对重新过检产品确认剔除效果；复核校验记录|||Verify detector hourly with test blocks; confirm rejection of re-inspected product; review calibration records", "record": "《金属检测异常处理记录》《设备校验记录》|||Metal Detection Anomaly Record, Equipment Calibration Record"})
            elif any(_kwm(kw, name) for kw in ["膜滤|||membrane", "过滤|||filtration", "filter", "membrane", "ultrafiltr", "nanofiltr"]):
                actions.append({"ccp": s.get("stepName", ""), "cl": "滤膜孔径4-8mm；滤液澄清|||Membrane pore 4-8 mm; filtrate clear", "personnel": "当班工艺员 / 设备维护员（有权停机）|||Shift process operator / equipment maintenance staff (authorized to stop line)", "causeAnalysis": "排查顺序：①滤膜破损/堵塞导致滤液浑浊；②进料压力或温度异常；③料液含固量过高使膜通量骤降。按此顺序排查|||Troubleshoot in order: ①membrane damage/blockage causing cloudy filtrate; ②abnormal feed pressure or temperature; ③high solids content reducing flux", "productHandling": "1) 立即停线并隔离异常批次；2) 检查滤液浊度评估影响范围；3) 可重新过滤的返工处理，无法确认安全的降级/销毁；4) 放行须经HACCP小组批准|||1) Stop line immediately and quarantine the batch; 2) Check filtrate turbidity to assess impact; 3) Re-filter if feasible, otherwise downgrade/destroy; 4) Release only with HACCP team approval", "corrective": "停机更换/清洗滤膜并校正膜滤参数，试运行确认滤液澄清达标后方可恢复生产|||Stop line, replace/clean membrane and re-calibrate; confirm clear filtrate before resuming", "verification": "检查滤液澄清度与透过率；复核膜通量/压差记录；确认滤膜完整性|||Check filtrate clarity and flux; review throughput/pressure records; verify membrane integrity", "record": "《膜滤工序异常处理记录》《设备维护记录》|||Membrane Filtration Deviation Record, Equipment Maintenance Record"})
            elif any(_kwm(kw, name) for kw in ["干燥|||drying", "烘干|||dryer", "脱水|||dehydrat", "dry", "bake"]):
                actions.append({"ccp": s.get("stepName", ""), "cl": "烘干温度120-180℃；成品水分达标|||Drying at 120-180℃; finished moisture content compliant", "personnel": "当班生产主任 / 设备维护员（有权停机）|||Shift production supervisor / equipment maintenance staff (authorized to stop line)", "causeAnalysis": "排查顺序：①烘干温度波动或加热元件故障；②物料铺层厚度/进料速度不当；③排湿系统失效导致湿度超标。按此顺序排查|||Troubleshoot in order: ①temperature fluctuation or heater fault; ②improper bed thickness/feed rate; ③failed moisture exhaust causing high humidity", "productHandling": "1) 立即隔离该批次；2) 检测水分含量评估影响；3) 水分超标可复烘至达标，严重变色/结块的降级或销毁|||1) Isolate the batch; 2) Test moisture content to assess impact; 3) Re-dry if slightly off; severely discolored/caked product downgraded or destroyed", "corrective": "停机检修加热/排湿系统，调整温度与进料参数，试烘验证水分达标后方可恢复生产|||Stop line, service heater/exhaust; adjust temperature and feed; verify moisture compliant before resuming", "verification": "检测成品水分含量；复核烘干温度曲线；确认设备校准记录|||Test moisture content; review drying temperature curves; confirm equipment calibration records", "record": "《干燥工序异常处理记录》《水分检测记录》|||Drying Deviation Record, Moisture Test Record"})
            elif any(_kwm(kw, name) for kw in ["验收|||receiving", "接收|||receiv", "原料|||raw material", "incoming", "inspection", "acceptance", "material"]):
                actions.append({"ccp": s.get("stepName", ""), "cl": "符合GB 2763/2762限量标准|||Comply with GB 2763/2762 limits", "personnel": "采购专员 / 品控专员|||Procurement specialist / QC specialist", "causeAnalysis": "排查顺序：①供应商质量波动或检验报告失真；②运输储存条件不当（受潮/混装/超期）；③验收标准执行不严。必要时追溯上游供应商|||Troubleshoot in order: ①supplier variability or false COA; ②improper transport/storage; ③loose acceptance practices. Trace back to supplier if needed", "productHandling": "1) 拒收该批次并隔离标记；2) 已接收的关联原料单独存放并评估；3) 启动备用供应商保证供应；4) 向供应商发出整改通知|||1) Reject and quarantine the batch; 2) Segregate and assess related accepted lots; 3) Activate backup suppliers; 4) Issue corrective action notice to supplier", "corrective": "拒收该批原料并通知供应商限期整改，复核供应商资质与检测报告，整改验证合格前暂停其供货资格|||Reject the batch and require supplier corrective action; verify supplier qualification and COA; suspend supply until remediation is verified", "verification": "逐批核查供应商检测报告；定期送第三方抽检；年度供应商审核|||Verify supplier reports per batch; periodic third-party testing; annual supplier audit", "record": "《原料验收不合格记录》《供应商整改通知单》|||Raw Material Rejection Record, Supplier Corrective Action Notice"})
            else:
                actions.append({"ccp": s.get("stepName", ""), "cl": "待定|||TBD", "personnel": "HACCP小组 / 当班工序负责人|||HACCP team / shift process supervisor", "causeAnalysis": "排查顺序：①设备运行参数异常；②操作人员执行偏差；③原料批次波动；④环境条件变化。按人员-设备-原料-环境顺序排查|||Troubleshoot in order: ①equipment parameter drift; ②operator execution error; ③raw material lot variation; ④environmental change", "productHandling": "1) 立即停止异常操作；2) 隔离受影响产品并评估偏离程度；3) 按严重程度选择返工/降级/销毁；4) 处置结果报HACCP小组批准并存档|||1) Stop abnormal operation immediately; 2) Isolate affected product and assess deviation; 3) Rework/downgrade/destroy per severity; 4) Report disposition to HACCP team for approval and archive", "corrective": "查明并消除偏离原因，纠正后连续监控确认CCP恢复受控方可恢复生产|||Identify and eliminate the cause; verify CCP back in control by continuous monitoring before resuming", "verification": "复查纠偏后监控记录，确认关键限值持续满足要求|||Review post-correction monitoring records to confirm CL consistently met", "record": "《CCP偏差处理记录》《产品隔离处置记录》|||CCP Deviation Handling Record, Product Isolation & Disposition Record"})
        return {"ok": True, "data": {"correctiveActions": actions}}

    try:
        data = _call_deepseek(CORRECTIVE_ACTIONS_PROMPT, user_content, 2048)
        return {"ok": True, "data": data}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/ai/verification")
async def api_ai_verification(req: VerificationRequest):
    """根据CCP、监控方案和纠偏措施，AI生成验证程序"""
    if not req.ccp_steps:
        raise HTTPException(status_code=400, detail="CCP步骤列表不能为空")

    ccp_list = [s for s in req.ccp_steps if s.get("isCCP")]
    ccp_text = "\n".join(f"- {s.get('stepName', '')}" for s in ccp_list) if ccp_list else "暂无CCP"
    monitor_text = "\n".join(f"- {m.get('ccp', '')}: {m.get('method', '')} ({m.get('frequency', '')})" for m in (req.monitoring or []))
    corrective_text = "\n".join(f"- {c.get('ccp', '')}: {c.get('corrective') or c.get('causeAnalysis') or ''}" for c in (req.corrective_actions or []))
    user_content = f"产品名称：{req.product_name}\n\nCCP列表：\n{ccp_text}\n\n监控方案：\n{monitor_text or '暂无'}\n\n纠偏措施：\n{corrective_text or '暂无'}\n\n请为以上HACCP体系制定验证程序。"

    if _is_mock_mode():
        return {"ok": True, "data": {
            "verificationMethod": "1. **CCP监控记录审核**：每批次生产结束后，由品控主管审核所有CCP监控记录，确认关键限值符合要求。\n2. **纠偏记录回顾**：每周由HACCP小组组长回顾所有纠偏记录，确认纠偏措施有效执行。\n3. **成品抽样检测**：每月对成品进行微生物、理化指标抽样检测，验证HACCP体系有效性。\n4. **设备校准**：每季度对温度传感器、金属检测仪、pH计等CCP相关设备进行校准。\n5. **环境微生物监测**：每季度对生产车间进行环境微生物监测。\n6. **HACCP体系年度复审**：每年由HACCP小组进行完整的体系复审，修订HACCP计划。",
            "verificationFrequency": "每日/每周/每月/每季度/每年（按上述各项分别执行）|||Daily/Weekly/Monthly/Quarterly/Annually (per above items)",
            "verificationPersonnel": "HACCP小组组长、品控主管、QC检验员|||HACCP Team Leader, QC Supervisor, QC Inspector"
        }}

    try:
        data = _call_deepseek(VERIFICATION_PROMPT, user_content, 2048)
        return {"ok": True, "data": data}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


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


# ===== Plans 接口（JWT 保护）=====

@app.get("/api/plans")
async def api_list_plans(user: dict = Depends(get_current_user)):
    """列出当前用户的所有计划（摘要，不含 content）"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    plans = list_plans(user["id"])
    return {"plans": plans}


@app.post("/api/plans")
async def api_create_plan(req: CreatePlanRequest, user: dict = Depends(get_current_user)):
    """创建新计划（保存 HACCP 问卷提交数据）"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    content = req.content if req.content else {}
    product_name = req.product_name or content.get("productName", "")
    company_name = req.company_name or content.get("companyName", "")
    plan_name = req.plan_name or product_name or f"Plan {_now()}"
    plan = create_plan(user["id"], plan_name, product_name, company_name, content)
    return {"ok": True, "plan": plan}


@app.get("/api/plans/{plan_id}")
async def api_get_plan(plan_id: int, user: dict = Depends(get_current_user)):
    """获取单个计划完整数据"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    plan = get_plan(plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="计划不存在")
    if plan["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="无权访问此计划")
    return {"plan": plan}


@app.put("/api/plans/{plan_id}")
async def api_update_plan(plan_id: int, req: UpdatePlanRequest, user: dict = Depends(get_current_user)):
    """更新计划（验证程序、记录等）"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    existing = get_plan(plan_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="计划不存在")
    if existing["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="无权修改此计划")
    data = {}
    if req.plan_name is not None:
        data["plan_name"] = req.plan_name
    if req.product_name is not None:
        data["product_name"] = req.product_name
    if req.company_name is not None:
        data["company_name"] = req.company_name
    if req.content is not None:
        data["content"] = req.content
    plan = update_plan(plan_id, data)
    return {"ok": True, "plan": plan}


@app.delete("/api/plans/{plan_id}")
async def api_delete_plan(plan_id: int, user: dict = Depends(get_current_user)):
    """删除计划"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    existing = get_plan(plan_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="计划不存在")
    if existing["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="无权删除此计划")
    ok = delete_plan(plan_id)
    if not ok:
        raise HTTPException(status_code=400, detail="删除失败")
    return {"ok": True}


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


# ===== 生成报告接口（Mock）=====

@app.post("/api/generate_report")
async def generate_report(req: GenerateReportRequest):
    report = (
        f"在 {req.start_date} 至 {req.end_date} 期间，"
        "本系统依据 HACCP 七项原则对产品全过程进行了危害分析与关键控制点判定。"
        "共识别生物性危害 3 项、化学性危害 2 项、物理性危害 1 项，"
        "确定 CCP 3 个，分别位于原料验收、热处理和金属检测工序。"
        "针对各 CCP 已制定关键限值、监控程序及纠偏措施。"
        "建议企业定期验证 CCP 记录并每年复审 HACCP 计划，"
        "确保体系持续有效运行。"
    )
    return {"report": report}


# ===== 演示数据编辑器 =====
DEMO_DATA_FILE = pathlib.Path(__file__).resolve().parent.parent / "data" / "demo_inulin.json"

@app.get("/api/demo/data")
async def api_get_demo_data():
    """读取演示数据 JSON"""
    try:
        if DEMO_DATA_FILE.exists():
            with open(DEMO_DATA_FILE, "r", encoding="utf-8") as f:
                return {"ok": True, "data": json.load(f)}
        return {"ok": True, "data": {"steps": [], "ccp": [], "leftNotes": [], "rightNotes": [], "rework": []}}
    except Exception as e:
        raise HTTPException(500, f"读取失败: {str(e)}")

@app.put("/api/demo/data")
async def api_save_demo_data(body: dict):
    """保存演示数据 JSON — 按数据类型分流：
    含 processSteps/haccpTeam → 完整 HACCP 计划 (demo_inulin_full.json)
    否则 → 流程图数据 (demo_inulin.json)
    """
    try:
        data = body.get("data", body)
        DEMO_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

        # 判断是完整计划还是流程图数据
        is_full_plan = "processSteps" in data or "haccpTeam" in data or "hazardWorksheet" in data

        if is_full_plan:
            # 完整 HACCP 计划 → 只写完整示例文件
            full_file = pathlib.Path(__file__).resolve().parent.parent / "data" / "demo_inulin_full.json"
            with open(full_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            # 流程图数据 → 只写流程图文件
            with open(DEMO_DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        return {"ok": True, "message": "保存成功"}
    except Exception as e:
        raise HTTPException(500, f"保存失败: {str(e)}")

# ===== 15-min 快速问卷演示数据 =====
DEMO_PROFILE_FILE = pathlib.Path(__file__).resolve().parent.parent / "data" / "demo_profile.json"

# ===== AI 步骤危害匹配（替代本地 mock 数据库）=====
class StepHazardsRequest(BaseModel):
    steps: List[str]
    product_name: str = ""
    raw_materials: str = ""

STEP_HAZARDS_PROMPT = """你是食品安全HACCP专家。请根据给定的生产步骤，为每个步骤识别潜在的生物、化学、物理危害。
要求：
1. 为每个步骤返回危害，类别键为 bio（生物）、chem（化学）、phys（物理）
2. 每类危害包含字段：desc（危害描述）、isSignificant（是否显著危害，布尔值）、basis（判断依据）、control（控制措施）、controlRelation（控制措施与危害的关系）
3. desc、basis、control、controlRelation 必须使用双语格式：中文|||English
4. 某个步骤没有某类危害时，该类别可以省略
5. 只返回JSON，格式：{"data": [{"step": "步骤名", "hazards": {"bio": {...}, "chem": {...}, "phys": {...}}}]}
6. 所有返回的JSON字段都必须完整"""

def _call_deepseek(system_prompt: str, user_content: str, max_tokens: int = 8192) -> dict:
    """调用 DeepSeek 并解析返回的 JSON"""
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
    }
    json_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    http_req = urllib.request.Request(
        DEEPSEEK_API_URL,
        data=json_data,
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(http_req, timeout=90) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    content = result["choices"][0]["message"]["content"].strip()
    if content.startswith("```"):
        lines = content.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines)
    return _parse_json_robust(content)


@app.post("/api/ai/step-hazards")
async def api_ai_step_hazards(req: StepHazardsRequest):
    """根据生产步骤AI匹配危害（双语输出），替代本地 mock 数据库"""
    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY == "sk-your-deepseek-api-key-here":
        raise HTTPException(status_code=503, detail="AI 未配置，请设置 DEEPSEEK_API_KEY")
    user_info = f"产品名称：{req.product_name}\n原料：{req.raw_materials}\n生产步骤：{' → '.join(req.steps)}"
    try:
        parsed = _call_deepseek(STEP_HAZARDS_PROMPT, f"请分析以下产品的每个生产步骤的潜在危害：\n\n{user_info}")
        return {"ok": True, "data": parsed.get("data", []) if isinstance(parsed, dict) else []}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


# ===== AI 批量翻译（中文 → 英文，用于预存数据）=====
class TranslateRequest(BaseModel):
    texts: List[str]
    target: str = "en"

TRANSLATE_PROMPT = """你是专业的食品安全技术翻译。请将给定的每条文本翻译成英语，食品/药品安全术语必须准确。
要求：
1. 返回一个JSON数组，顺序和数量与输入完全一致
2. 某条文本不含中文（或已是英文）时，原样返回
3. 只返回JSON数组，不要任何其他内容"""

@app.post("/api/ai/translate")
async def api_ai_translate(req: TranslateRequest):
    """批量翻译文本（当前仅支持翻译成英文）"""
    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY == "sk-your-deepseek-api-key-here":
        raise HTTPException(status_code=503, detail="AI 未配置，请设置 DEEPSEEK_API_KEY")
    texts = [t for t in (req.texts or []) if isinstance(t, str)]
    if not texts:
        return {"ok": True, "data": []}
    try:
        numbered = [f"{i+1}. {t}" for i, t in enumerate(texts)]
        parsed = _call_deepseek(TRANSLATE_PROMPT, "\n".join(numbered))

        def _clean(s: str) -> str:
            # 去掉 AI 可能回显的序号前缀，如 "1. xxx" / "2、xxx"
            import re as _re
            return _re.sub(r"^\s*\d+[\.、:：]\s*", "", str(s)).strip()

        if isinstance(parsed, list) and len(parsed) == len(texts):
            return {"ok": True, "data": [_clean(x) for x in parsed]}
        # 兼容 AI 返回 key-value 对象
        if isinstance(parsed, dict):
            result = []
            for i, t in enumerate(texts):
                result.append(_clean(parsed.get(str(i + 1)) or parsed.get(t) or t))
            return {"ok": True, "data": result}
        return {"ok": True, "data": texts}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI 返回格式解析失败: {str(e)}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"调用 DeepSeek API 失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.get("/api/demo/profile-data")
async def api_get_demo_profile_data():
    """读取 15-min 快速问卷演示数据 JSON"""
    try:
        if DEMO_PROFILE_FILE.exists():
            with open(DEMO_PROFILE_FILE, "r", encoding="utf-8") as f:
                return {"ok": True, "data": json.load(f)}
        return {"ok": True, "data": None}
    except Exception as e:
        raise HTTPException(500, f"读取失败: {str(e)}")

@app.put("/api/demo/profile-data")
async def api_save_demo_profile_data(body: dict):
    """保存 15-min 快速问卷演示数据 JSON → data/demo_profile.json"""
    try:
        data = body.get("data", body)
        DEMO_PROFILE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(DEMO_PROFILE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"ok": True, "message": "保存成功"}
    except Exception as e:
        raise HTTPException(500, f"保存失败: {str(e)}")

# ===== 静态文件托管（前端页面）=====

# 获取项目根目录（backend 的上一级）
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent

# 挂载静态文件目录
app.mount("/js", StaticFiles(directory=str(PROJECT_ROOT / "js")), name="js")
app.mount("/css", StaticFiles(directory=str(PROJECT_ROOT / "css")), name="css")
app.mount("/data", StaticFiles(directory=str(PROJECT_ROOT / "data")), name="data")


@app.get("/")
async def serve_index():
    index_path = PROJECT_ROOT / "HACCP Assistance.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"error": "index.html not found"}

@app.get("/{filename}")
async def serve_static(filename: str):
    """提供根目录下的静态 HTML 文件（如 flowchart-preview.html 等）"""
    if "/" in filename or "\\" in filename:
        return FileResponse(str(PROJECT_ROOT / "HACCP Assistance.html"))
    file_path = PROJECT_ROOT / filename
    if file_path.exists() and file_path.is_file() and file_path.suffix in (".html", ".json", ".xml", ".png", ".jpg", ".svg", ".ico"):
        return FileResponse(str(file_path))
    return FileResponse(str(PROJECT_ROOT / "HACCP Assistance.html"))
