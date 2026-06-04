import base64
import hashlib
import hmac
import json
import os
import random
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta

# DeepSeek 配置（请将下面的密钥替换为你自己的 DeepSeek API Key）
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "sk-your-deepseek-api-key-here")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

from fastapi import FastAPI, HTTPException, Depends
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


class FillFromTextRequest(BaseModel):
    text: str


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

请严格按照以下JSON格式返回结果（只返回JSON，不要任何额外文字）：

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
        "deptName": "品控部",
        "haccpTeam": [
            {"name": "张工", "dept": "品控部", "position": "主管", "role": "组长"},
            {"name": "李工", "dept": "生产部", "position": "主任", "role": "副组长"},
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
            {"desc": "微生物污染", "severity": "高", "likelihood": "中", "control": "严格卫生控制"}
        ],
        "hazardChem": [
            {"desc": "化学残留", "severity": "中", "likelihood": "低", "control": "原料检测"}
        ],
        "hazardPhys": [
            {"desc": "异物混入", "severity": "中", "likelihood": "中", "control": "金属检测"}
        ],
        "monitoring": [],
        "correctiveActions": [],
        "recordPeriod": "2年",
        "recordFormat": "电子版+纸质版",
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