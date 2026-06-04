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


class GenerateFlowchartRequest(BaseModel):
    product_name: str = ""
    raw_materials: str = ""
    process_description: str = ""
    storage_condition: str = ""
    additional_info: str = ""


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


FLOWCHART_PROMPT = """你是一位专业的食品生产工艺工程师。请根据用户提供的产品信息，设计一份详细、合理、符合HACCP标准的生产工艺流程图步骤。

请严格按照以下JSON格式返回结果（只返回JSON，不要任何额外文字）：

{
  "steps": [
    {
      "stepName": "步骤名称",
      "operationMethod": "具体操作方法",
      "parameters": "工艺参数（如温度、时间、转速等）",
      "controlPoint": "控制点/关键控制点说明，如果是CCP则标注CCP-X",
      "equipmentName": "使用的设备名称"
    }
  ]
}

要求：
1. 步骤应涵盖从原料接收到成品入库/出厂的完整过程
2. 每个步骤的工艺参数要具体、可操作
3. 根据HACCP原则标注关键控制点（CCP）
4. 步骤数量：5-10个
5. 每一步的操作方法要详细
6. 返回的JSON中steps数组不能为空"""


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
            {"stepName": "原料验收", "operationMethod": "检查供应商检测报告，核对原料批次、生产日期，感官检查", "parameters": "温度≤25℃", "controlPoint": "CCP-1 原料接收", "equipmentName": ""},
            {"stepName": "预处理", "operationMethod": "原料清洗、去皮、去核，按配方称量", "parameters": "清洗水温≤30℃，时间≥2min", "controlPoint": "", "equipmentName": "清洗机、称量设备"},
            {"stepName": "调配混料", "operationMethod": "按配方将原料、辅料、添加剂投入调配罐，搅拌均匀", "parameters": "转速150-200rpm，搅拌时间15-20min，温度≤10℃", "controlPoint": "", "equipmentName": "调配罐、搅拌器"},
            {"stepName": "均质", "operationMethod": "将混合液通过均质机处理，使组织均匀细腻", "parameters": "均质压力20-30MPa，温度60-70℃", "controlPoint": "", "equipmentName": "均质机"},
            {"stepName": "杀菌", "operationMethod": "采用超高温瞬时杀菌（UHT）或巴氏杀菌", "parameters": "UHT:136-140℃，4-6s；巴氏:85-95℃，15-30s", "controlPoint": "CCP-2 杀菌工序", "equipmentName": "板式换热器/UHT杀菌机"},
            {"stepName": "无菌灌装", "operationMethod": "在无菌环境下灌装至洁净包装容器，封口", "parameters": "灌装温度≤30℃，环境洁净度万级", "controlPoint": "CCP-3 灌装工序", "equipmentName": "无菌灌装机"},
            {"stepName": "灯检", "operationMethod": "通过灯检设备检查产品外观、密封性、异物", "parameters": "光照强度≥1000lux，传送速度≤10m/min", "controlPoint": "", "equipmentName": "灯检机"},
            {"stepName": "喷码/包装", "operationMethod": "瓶身喷印生产日期、批号，装盒/装箱", "parameters": "喷码清晰可辨，包装严密", "controlPoint": "", "equipmentName": "喷码机、包装机"},
            {"stepName": "成品检验", "operationMethod": "按标准抽样进行微生物、理化、感官检验", "parameters": "抽样比例≥3‰，检验标准GB/T 27306", "controlPoint": "", "equipmentName": "实验室设备"},
            {"stepName": "入库/出厂", "operationMethod": "检验合格品入库，不合格品隔离处理", "parameters": "库温≤25℃，湿度≤65%", "controlPoint": "", "equipmentName": "叉车"},
        ]
    elif "肉" in product or "鱼" in product or "水产" in product:
        steps = [
            {"stepName": "原料验收", "operationMethod": "检查原料肉/水产的检疫证明、新鲜度、中心温度", "parameters": "中心温度≤4℃，pH值5.8-6.2", "controlPoint": "CCP-1 原料接收", "equipmentName": ""},
            {"stepName": "解冻/清洗", "operationMethod": "自然解冻或流动水解冻，去除不可食部分，清水漂洗", "parameters": "解冻温度≤15℃（水冷），清洗水温≤10℃", "controlPoint": "", "equipmentName": "解冻槽、清洗槽"},
            {"stepName": "修割/切分", "operationMethod": "去除筋膜、淤血、碎骨，按规格切分成型", "parameters": "环境温度≤12℃，切分厚度均匀±2mm", "controlPoint": "", "equipmentName": "切肉机、刀具"},
            {"stepName": "腌制/调味", "operationMethod": "按配方添加腌料、香辛料，真空滚揉或静置腌制", "parameters": "腌制温度0-4℃，滚揉时间30-60min", "controlPoint": "", "equipmentName": "真空滚揉机"},
            {"stepName": "热处理", "operationMethod": "蒸煮/油炸/烘烤至中心温度达标", "parameters": "中心温度≥75℃，时间≥30s", "controlPoint": "CCP-2 热处理工序", "equipmentName": "蒸煮柜/油炸线/烤箱"},
            {"stepName": "冷却", "operationMethod": "产品快速冷却至包装温度", "parameters": "中心温度降至≤10℃，冷却时间≤60min", "controlPoint": "", "equipmentName": "速冷装置/冷却间"},
            {"stepName": "金属检测", "operationMethod": "产品通过金属检测仪，检测金属异物", "parameters": "Fe≥1.5mm，SUS≥2.0mm", "controlPoint": "CCP-3 金属检测", "equipmentName": "金属检测仪"},
            {"stepName": "气调/真空包装", "operationMethod": "在包装机内充入保护气体或抽真空后封口", "parameters": "残氧量≤1%，封口温度140-160℃", "controlPoint": "", "equipmentName": "气调包装机/真空包装机"},
            {"stepName": "二次杀菌（可选）", "operationMethod": "包装后巴氏杀菌，延长保质期", "parameters": "中心温度80-85℃，保持10-15min", "controlPoint": "", "equipmentName": "杀菌釜"},
            {"stepName": "入库冷藏", "operationMethod": "快速入冷库，温度监控记录", "parameters": "库温0-4℃（冷藏）/ -18℃（冷冻）", "controlPoint": "", "equipmentName": "冷库"},
        ]
    else:
        steps = [
            {"stepName": "原料验收", "operationMethod": f"检查{raw_materials}的供应商检测报告、合格证明及感官质量", "parameters": "温度≤25℃，湿度≤65%", "controlPoint": "CCP-1 原料接收", "equipmentName": ""},
            {"stepName": "预处理/清洗", "operationMethod": "对原料进行分选、清洗、去皮/去壳等预处理", "parameters": "清洗水温≤30℃，清洗时间≥3min", "controlPoint": "", "equipmentName": "清洗槽/分选机"},
            {"stepName": "称量/配料", "operationMethod": "按配方精确称量各原料、辅料和添加剂", "parameters": "称量精度±1g，复核检验", "controlPoint": "", "equipmentName": "电子秤、配料罐"},
            {"stepName": "混合/搅拌", "operationMethod": "将各物料投入混合设备，搅拌均匀", "parameters": "搅拌转速120-180rpm，时间10-20min", "controlPoint": "", "equipmentName": "混合机/搅拌机"},
            {"stepName": "成型/加工", "operationMethod": "根据产品特性进行成型、挤压、切割等加工", "parameters": "成型温度25-35℃，压力0.2-0.5MPa", "controlPoint": "", "equipmentName": "成型机/模具"},
            {"stepName": "杀菌/热处理", "operationMethod": "根据产品特性选择杀菌方式，确保微生物安全", "parameters": "中心温度≥85℃，保持时间≥15s", "controlPoint": "CCP-2 杀菌工序", "equipmentName": "杀菌釜/隧道式杀菌机"},
            {"stepName": "金属检测/异物检测", "operationMethod": "产品通过金属检测仪，检测并剔除含金属异物的产品", "parameters": "Fe≥1.0mm，SUS≥1.5mm", "controlPoint": "CCP-3 金属检测", "equipmentName": "金属检测仪"},
            {"stepName": "内包装", "operationMethod": "在洁净环境中按规格进行内包装，密封", "parameters": "环境洁净度万级，封口温度130-150℃", "controlPoint": "", "equipmentName": "包装机"},
            {"stepName": "外包装/喷码", "operationMethod": "装箱、喷印生产日期、批号、追溯码", "parameters": "喷码清晰，标识完整", "controlPoint": "", "equipmentName": "喷码机、封箱机"},
            {"stepName": "成品检验入库", "operationMethod": "按标准抽样检验，合格品入库，不合格品隔离", "parameters": "抽样比例≥5‰，检验按产品执行标准", "controlPoint": "", "equipmentName": "实验室设备"},
        ]

    return {"ok": True, "data": {"steps": steps}}


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