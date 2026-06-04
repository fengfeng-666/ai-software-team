"""
AutoGen 软件开发团队 - 后端API服务
使用 FastAPI + 后台任务 + 轮询模式
"""

import os
import uuid
import asyncio
from typing import List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager
from collections import defaultdict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 导入 AutoGen 相关模块
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_agentchat.agents import AssistantAgent, UserProxyAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination

# ==================== 数据模型 ====================

class TaskRequest(BaseModel):
    """任务请求模型"""
    task: str

class MessageItem(BaseModel):
    """消息项模型"""
    source: str
    content: str
    timestamp: str = ""

class TaskResponse(BaseModel):
    """任务响应模型"""
    success: bool
    task_id: str = ""
    error: str = ""

class TaskStatus(BaseModel):
    """任务状态模型"""
    task_id: str
    status: str  # pending, running, completed, failed
    progress: int  # 0-100
    current_step: str
    messages: List[MessageItem] = []
    error: str = ""

# ==================== 任务存储 ====================

# 存储任务状态（生产环境应使用 Redis）
tasks: Dict[str, TaskStatus] = {}

# ==================== 智能体创建 ====================

def create_openai_model_client():
    """创建 OpenAI 模型客户端"""
    return OpenAIChatCompletionClient(
        model=os.getenv("LLM_MODEL_ID", "mimo-v2.5-pro"),
        api_key=os.getenv("LLM_API_KEY"),
        base_url=os.getenv("LLM_BASE_URL", "https://token-plan-cn.xiaomimimo.com/v1"),
        model_info={
            "vision": False,
            "function_calling": True,
            "json_output": True,
            "family": "unknown",
            "structured_output": True,
        },
    )

def create_product_manager(model_client):
    """创建产品经理智能体"""
    system_message = """你是一位经验丰富的产品经理，专门负责软件产品的需求分析和项目规划。

你的核心职责包括：
1. **需求分析**：深入理解用户需求，识别核心功能和边界条件
2. **技术规划**：基于需求制定清晰的技术实现路径
3. **风险评估**：识别潜在的技术风险和用户体验问题
4. **协调沟通**：与工程师和其他团队成员进行有效沟通

当接到开发任务时，请按以下结构进行分析：
1. 需求理解与分析
2. 功能模块划分
3. 技术选型建议
4. 实现优先级排序
5. 验收标准定义

请简洁明了地回应，并在分析完成后说"请工程师开始实现"。"""

    return AssistantAgent(
        name="ProductManager",
        model_client=model_client,
        system_message=system_message,
    )

def create_engineer(model_client):
    """创建软件工程师智能体"""
    system_message = """你是一位资深的软件工程师，擅长各种编程语言和框架开发。

你的技术专长包括：
1. **前端开发**：熟练掌握 Vue、React、微信小程序等框架
2. **后端开发**：精通 Python、Node.js、Java 等后端技术
3. **API 集成**：有丰富的第三方 API 集成经验
4. **错误处理**：注重代码的健壮性和异常处理

当收到开发任务时，请：
1. 仔细分析技术需求
2. 选择合适的技术方案
3. 编写完整的代码实现
4. 添加必要的注释和说明
5. 考虑边界情况和异常处理

请提供完整的可运行代码，并在完成后说"请代码审查员检查"。"""

    return AssistantAgent(
        name="Engineer",
        model_client=model_client,
        system_message=system_message,
    )

def create_code_reviewer(model_client):
    """创建代码审查员智能体"""
    system_message = """你是一位经验丰富的代码审查专家，专注于代码质量和最佳实践。

你的审查重点包括：
1. **代码质量**：检查代码的可读性、可维护性和性能
2. **安全性**：识别潜在的安全漏洞和风险点
3. **最佳实践**：确保代码遵循行业标准和最佳实践
4. **错误处理**：验证异常处理的完整性和合理性

审查流程：
1. 仔细阅读和理解代码逻辑
2. 检查代码规范和最佳实践
3. 识别潜在问题和改进点
4. 提供具体的修改建议
5. 评估代码的整体质量

请提供具体的审查意见，完成后说"代码审查完成，请用户代理测试"。"""

    return AssistantAgent(
        name="CodeReviewer",
        model_client=model_client,
        system_message=system_message,
    )

def create_user_proxy(model_client):
    """创建用户代理智能体（自动化版本）"""
    system_message = """你是用户代理，负责最终验证和总结。

你的职责：
1. 回顾团队的协作成果
2. 确认需求是否满足
3. 总结项目交付物
4. 提供简短的验收报告

请简要总结团队的工作成果，然后回复 TERMINATE 结束任务。"""

    return AssistantAgent(
        name="UserProxy",
        model_client=model_client,
        system_message=system_message,
    )

# ==================== 核心业务 ====================

def get_progress_by_source(source: str, total_steps: int) -> tuple:
    """根据智能体名称返回进度和步骤描述"""
    progress_map = {
        "ProductManager": (25, "产品经理正在分析需求..."),
        "Engineer": (50, "工程师正在编写代码..."),
        "CodeReviewer": (75, "代码审查员正在检查..."),
        "UserProxy": (90, "用户代理正在测试..."),
    }
    return progress_map.get(source, (10, "准备中..."))

async def run_team_background(task_id: str, task: str):
    """后台运行 AutoGen 软件开发团队"""
    try:
        # 更新状态为运行中
        tasks[task_id].status = "running"
        tasks[task_id].progress = 5
        tasks[task_id].current_step = "正在初始化团队..."

        # 创建模型客户端
        model_client = create_openai_model_client()

        # 创建智能体团队
        product_manager = create_product_manager(model_client)
        engineer = create_engineer(model_client)
        code_reviewer = create_code_reviewer(model_client)
        user_proxy = create_user_proxy(model_client)

        # 添加终止条件
        termination = TextMentionTermination("TERMINATE")

        # 创建团队聊天 - 每个智能体最多1轮
        team_chat = RoundRobinGroupChat(
            participants=[
                product_manager,
                engineer,
                code_reviewer,
                user_proxy
            ],
            termination_condition=termination,
            max_turns=4,  # 4个智能体各1轮
        )

        tasks[task_id].current_step = "团队已就绪，开始协作..."
        tasks[task_id].progress = 10

        # 运行团队协作并收集结果
        async for event in team_chat.run_stream(task=task):
            if hasattr(event, 'source') and hasattr(event, 'content'):
                now = datetime.now().strftime("%H:%M:%S")
                msg = MessageItem(
                    source=event.source,
                    content=str(event.content),
                    timestamp=now
                )
                tasks[task_id].messages.append(msg)

                # 更新进度
                progress, step = get_progress_by_source(event.source, 4)
                tasks[task_id].progress = progress
                tasks[task_id].current_step = step

        # 完成
        tasks[task_id].status = "completed"
        tasks[task_id].progress = 100
        tasks[task_id].current_step = "任务完成！"

    except Exception as e:
        import traceback
        traceback.print_exc()
        tasks[task_id].status = "failed"
        tasks[task_id].error = str(e)
        tasks[task_id].current_step = f"任务失败: {str(e)}"

# ==================== FastAPI 应用 ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    print("🚀 AutoGen 软件开发团队 API 服务启动中...")
    print("📡 服务地址: http://localhost:8088")
    print("📚 API 文档: http://localhost:8088/docs")
    yield
    print("👋 服务正在关闭...")

app = FastAPI(
    title="AI软件开发团队",
    description="基于 AutoGen 的软件开发团队协作 API（支持后台任务）",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "AI软件开发团队 API v2.0",
        "docs": "/docs",
        "health": "/api/health"
    }

@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "message": "AutoGen 软件开发团队 API 运行正常"
    }

@app.post("/api/run-team", response_model=TaskResponse)
async def run_team_api(request: TaskRequest):
    """
    提交 AI 团队协作任务（异步）

    返回 task_id，然后通过 /api/task/{task_id} 查询进度
    """
    try:
        if not request.task.strip():
            raise HTTPException(status_code=400, detail="任务描述不能为空")

        # 生成任务 ID
        task_id = str(uuid.uuid4())[:8]

        # 初始化任务状态
        tasks[task_id] = TaskStatus(
            task_id=task_id,
            status="pending",
            progress=0,
            current_step="任务已提交，等待处理...",
            messages=[],
            error=""
        )

        # 启动后台任务
        asyncio.create_task(run_team_background(task_id, request.task))

        return TaskResponse(
            success=True,
            task_id=task_id
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/task/{task_id}", response_model=TaskStatus)
async def get_task_status(task_id: str):
    """
    查询任务状态和进度

    - **task_id**: 任务ID
    """
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    return tasks[task_id]

@app.delete("/api/task/{task_id}")
async def delete_task(task_id: str):
    """删除任务"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    del tasks[task_id]
    return {"message": "任务已删除"}

@app.get("/api/tasks")
async def list_tasks():
    """列出所有任务"""
    return {
        "total": len(tasks),
        "tasks": list(tasks.values())
    }

# ==================== 启动入口 ====================

if __name__ == "__main__":
    import uvicorn

    print("🤖 正在启动 AI 软件开发团队服务...")
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8088,
        reload=True,
        log_level="info"
    )
