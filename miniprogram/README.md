# AI软件开发团队 - 微信小程序

基于 AutoGen 的软件开发团队协作微信小程序，支持异步任务和实时进度查询。

## ✨ 优化特性

### v2.0 改进（解决生成慢问题）

1. **异步任务模式** - 提交后立即返回，后台处理
2. **实时进度查询** - 每2秒轮询，显示当前进度
3. **减少轮次** - 最大轮次从20减到8，加快完成速度
4. **进度提示** - 显示当前是哪个智能体在工作

## 项目结构

```
miniprogram/
├── app.js                    # 小程序入口
├── app.json                  # 全局配置
├── app.wxss                  # 全局样式
└── pages/
    ├── index/                # 首页 - 任务输入
    │   ├── index.wxml
    │   ├── index.wxss
    │   ├── index.js          # 含轮询逻辑
    │   └── index.json
    └── result/               # 结果页 - 协作展示
        ├── result.wxml
        ├── result.wxss
        ├── result.js
        └── result.json
```

## 运行步骤

### 1. 启动后端服务

```bash
# 安装依赖
pip install -r requirements.txt

# 启动 FastAPI 服务
python server.py
```

服务启动后访问 http://localhost:8088/docs 查看 API 文档

### 2. 配置小程序

1. 打开微信开发者工具
2. 导入 `miniprogram` 目录
3. **重要**：点击"详情" → "本地设置" → 勾选"不校验合法域名"

### 3. 运行小程序

在微信开发者工具中点击编译运行

## API 接口说明

### 提交任务
```
POST /api/run-team
Body: { "task": "任务描述" }
Response: { "success": true, "task_id": "abc123" }
```

### 查询进度
```
GET /api/task/{task_id}
Response: {
  "task_id": "abc123",
  "status": "running",
  "progress": 50,
  "current_step": "工程师正在编写代码...",
  "messages": [...]
}
```

### 状态说明
- `pending`: 等待处理
- `running`: 正在运行
- `completed`: 已完成
- `failed`: 失败

## 性能优化说明

| 优化项 | 原方案 | 新方案 |
|--------|--------|--------|
| 最大轮次 | 20轮 | 8轮 |
| 超时处理 | 同步等待 | 异步轮询 |
| 进度反馈 | 无 | 实时显示 |
| 用户体验 | 等待很久 | 看到进度 |

## 后续优化建议

1. **使用更快的模型** - 如 GPT-3.5-turbo 或 Claude Haiku
2. **流式输出** - 使用 SSE 实时推送消息
3. **任务队列** - 使用 Celery/Redis 管理任务
4. **结果缓存** - 相似任务复用结果
