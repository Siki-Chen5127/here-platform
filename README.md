# HERE 校园安全与心理健康协同管理平台

本目录包含 HERE 的 PC 工作平台和统一后端。学生继续使用移动端 APP；当前 PC 端开放高校辅导员、心理咨询师、心理中心负责人和系统管理员四套独立工作台。

- 辅导员：查看自己负责的学生、预警工单和本人形成的干预档案，并增删改查自己提交的学生工作资料。
- 心理咨询师：查看分配给自己的授权个案、转介工单和本人形成的服务档案，并增删改查自己提交的心理专业资料。
- 心理中心负责人：审核心理专业资料、发布心理知识，并查看中心运行汇总；默认不审核学校行政政策。
- 系统管理员：审核工作人员入驻、管理账号与知识库、配置知识审核范围并查看审计日志，不读取学生个案内容。

心理咨询督导的角色已保留在权限模型中，当前不显示在 PC 端菜单中。

工作人员入驻流程：

```text
自主注册账号
  → 补充手机号、机构、部门、工号、身份证号和任职证明
  → 管理员审核通过 / 退回补充 / 拒绝
  → 审核通过后进入对应工作台
```

已入驻人员可以随时提交个人资料修改申请。旧资料在新申请审核通过前继续有效；身份证号只保存不可逆摘要和末四位，不保存明文。

知识资料工作流：

```text
草稿（投稿人可增删改查）
  → 提交审核
  → 有对应领域权限的人员审核通过 / 退回修改 / 拒绝
  → 审核通过后发布
  → 加入知识图谱处理队列
```

知识资料分为“心理专业”和“学生工作政策”两个领域。心理中心负责人默认只审核心理专业资料；学生工作政策现阶段由管理员管理。已提交和已发布资料不能被投稿人直接修改。图谱处理当前只建立真实任务状态，不伪造节点；后续需要接入文档解析与图谱生成服务。

## 当前架构

```text
学生移动端 ── HTTPS API ──┐
                         ├── FastAPI ── SQL Server (HerePlatform)
工作人员 PC 端 ─ HTTPS API ┘
```

移动端 SQLite 后续只承担缓存、离线队列和设备侧状态，不再保存唯一业务数据。

## 目录

- `backend/`：FastAPI、SQLAlchemy、Alembic、JWT、SQL Server。
- `HERE-PC-Web/`：React 19、Vite、Tailwind CSS、Axios。
- `HERE-PC-Web/src/AppWorkspace.jsx`：四角色工作台、待审核账号入口与页面调度。
- `HERE-PC-Web/src/config/platforms.js`：角色菜单配置及后续角色扩展位。
- `backend/here.db`：旧版 SQLite 数据，只作为迁移来源保留。

## 后端启动

首次安装：

```powershell
cd E:\PROJECT\here\here3-web\backend
E:\anaconda\anaconda3\python.exe -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

当前 `.env` 已配置为本机默认 SQL Server 实例和 `HerePlatform` 数据库。首次建立数据库及表结构：

```powershell
.\.venv\Scripts\python.exe -m scripts.create_sqlserver_database
.\.venv\Scripts\python.exe -m alembic upgrade head
```

启动 API：

```powershell
.\.venv\Scripts\python.exe main.py
```

- API：http://127.0.0.1:8000
- OpenAPI：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/api/v1/health

建立三角色本地演示数据：

```powershell
.\.venv\Scripts\python.exe -m scripts.seed_role_demo
```

本地演示账号：

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 高校辅导员 | `counselor@here.edu` | `Counselor123!` |
| 心理咨询师 | `psychologist@here.edu` | `Psychologist123!` |
| 心理中心负责人 | `director@here.edu` | `Director123!` |
| 系统管理员 | `admin@here.edu` | `ChangeMe123!` |

这些账号仅用于本机开发。部署前必须删除演示账号、关闭 `HERE_BOOTSTRAP_ADMIN`、更换 JWT 密钥并重置管理员密码。

## PC 管理端启动

```powershell
cd E:\PROJECT\here\here3-web\HERE-PC-Web
npm install
npm run dev
```

打开 http://127.0.0.1:5173。登录后系统会根据账号角色自动进入对应工作台。API 地址通过 `VITE_API_URL` 配置，示例见 `HERE-PC-Web/.env.example`。

生产构建：

```powershell
npm run lint
npm run build
```

## 数据迁移

旧版 `backend/here.db` 当前包含演示工单和知识文档。以下命令会将其幂等导入 SQL Server，不会删除或修改旧文件：

```powershell
cd E:\PROJECT\here\here3-web\backend
.\.venv\Scripts\python.exe -m scripts.import_legacy_sqlite
```

## 已实现的后端能力

- 工作人员和学生分离认证。
- scrypt 密码哈希与 JWT 访问令牌。
- 辅导员、心理咨询师、心理中心负责人和管理员四套 PC 工作台。
- 按辅导员学生归属、咨询师个案分配进行数据隔离。
- 工作人员自主注册、资料补充、证明上传及管理员入驻审核。
- 个人资料修改申请及管理员复审，身份证号不落明文。
- 管理员账号启停、知识审核范围配置与操作审计。
- 投稿资料的创建、读取、修改、删除、提交、退回、分领域审核和发布。
- 已发布知识与图谱处理状态分离。
- 心理咨询督导角色扩展位。
- 移动端位置事件和预警上报。
- 预警自动生成处置工单。
- 工单闭环、干预记录和操作审计。
- SQL Server Unicode 中文字段。
- 真实文档上传、文件类型和 20MB 大小限制。
- Alembic 数据库迁移和端到端 API 测试。

## 测试

后端测试使用独立的内存 SQLite，不修改 SQL Server：

```powershell
cd E:\PROJECT\here\here3-web\backend
.\.venv\Scripts\python.exe -m pytest
```

当前阶段尚未完成手机端 API 切换、刷新令牌、登录限流、密码重置、心理中心分配流程、督导流程、真实知识图谱生成服务和正式部署配置。这些是下一批生产化工作。
