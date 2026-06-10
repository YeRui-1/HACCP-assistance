import json
import sqlite3
from datetime import datetime

DB_PATH = "./haccp.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL DEFAULT 'default',
            description TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '{}',
            is_published INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            company_name TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()

    # 迁移：补齐旧表缺少的列
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(templates)").fetchall()]
    if "description" not in cols:
        conn.execute("ALTER TABLE templates ADD COLUMN description TEXT NOT NULL DEFAULT ''")
    if "is_published" not in cols:
        conn.execute("ALTER TABLE templates ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0")
        # 已有数据时，第一个模板默认设为发布
        count = conn.execute("SELECT COUNT(*) FROM templates").fetchone()[0]
        if count > 0:
            conn.execute("UPDATE templates SET is_published = 1 WHERE id = 1")

    conn.commit()
    conn.close()


# ===== 基础 CRUD =====

def get_template(template_id: int) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM templates WHERE id = ?", (template_id,)).fetchone()
    conn.close()
    if row is None:
        return None
    return _row_to_dict(row)


def save_template(template_id: int, name: str, content: dict) -> dict:
    now = _now()
    content_json = json.dumps(content, ensure_ascii=False)
    conn = get_conn()
    existing = conn.execute("SELECT id FROM templates WHERE id = ?", (template_id,)).fetchone()
    if existing:
        conn.execute(
            "UPDATE templates SET name = ?, content = ?, updated_at = ? WHERE id = ?",
            (name, content_json, now, template_id),
        )
    else:
        conn.execute(
            "INSERT INTO templates (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (template_id, name, content_json, now, now),
        )
    conn.commit()
    conn.close()
    return get_template(template_id)


# ===== 多模板管理 =====

def list_templates_summary() -> list[dict]:
    """返回模板列表（不含 content）"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, name, description, is_published, created_at, updated_at FROM templates ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "is_published": bool(r["is_published"]),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


def create_template(name: str, description: str = "", copy_from_id: int | None = None) -> dict:
    """创建模板，可选从已有模板复制 content"""
    now = _now()
    content = {}
    if copy_from_id:
        source = get_template(copy_from_id)
        if source:
            content = source["content"]

    content_json = json.dumps(content, ensure_ascii=False)
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO templates (name, description, content, is_published, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
        (name, description, content_json, now, now),
    )
    new_id = cur.lastrowid
    conn.commit()
    conn.close()
    return get_template(new_id)


def update_template(template_id: int, data: dict) -> dict | None:
    """更新模板的 name / description / content（只更新传入的字段）"""
    existing = get_template(template_id)
    if not existing:
        return None

    now = _now()
    name = data.get("name", existing["name"])
    description = data.get("description", existing.get("description", ""))
    if "content" in data:
        content_json = json.dumps(data["content"], ensure_ascii=False)
    else:
        content_json = json.dumps(existing["content"], ensure_ascii=False)

    conn = get_conn()
    conn.execute(
        "UPDATE templates SET name = ?, description = ?, content = ?, updated_at = ? WHERE id = ?",
        (name, description, content_json, now, template_id),
    )
    conn.commit()
    conn.close()
    return get_template(template_id)


def delete_template(template_id: int) -> bool:
    """删除模板。已发布的拒绝删除。返回是否成功"""
    tpl = get_template(template_id)
    if not tpl:
        return False
    if tpl["is_published"]:
        return False
    conn = get_conn()
    conn.execute("DELETE FROM templates WHERE id = ?", (template_id,))
    conn.commit()
    conn.close()
    return True


def publish_template(template_id: int) -> dict | None:
    """设置指定模板为发布状态，取消其他发布"""
    tpl = get_template(template_id)
    if not tpl:
        return None
    conn = get_conn()
    conn.execute("UPDATE templates SET is_published = 0")
    conn.execute("UPDATE templates SET is_published = 1 WHERE id = ?", (template_id,))
    conn.commit()
    conn.close()
    return get_template(template_id)


def get_published_template() -> dict | None:
    """获取当前发布的模板"""
    conn = get_conn()
    row = conn.execute("SELECT * FROM templates WHERE is_published = 1 LIMIT 1").fetchone()
    conn.close()
    if row is None:
        return None
    return _row_to_dict(row)


# ===== 用户操作 =====

def create_user(username: str, company_name: str, password_hash: str, role: str = "user") -> dict | None:
    """创建用户，返回用户信息（不含密码）"""
    now = _now()
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (username, company_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (username, company_name, password_hash, role, now),
        )
        conn.commit()
        user_id = cur.lastrowid
        conn.close()
        return get_user_by_id(user_id)
    except sqlite3.IntegrityError:
        conn.close()
        return None


def get_user_by_username(username: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "company_name": row["company_name"],
        "password_hash": row["password_hash"],
        "role": row["role"],
        "created_at": row["created_at"],
    }


def get_user_by_id(user_id: int) -> dict | None:
    """返回用户信息（不含 password_hash）"""
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "company_name": row["company_name"],
        "role": row["role"],
        "created_at": row["created_at"],
    }


# ===== 工具函数 =====

def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "content": json.loads(row["content"]),
        "is_published": bool(row["is_published"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# 启动时初始化
init_db()
