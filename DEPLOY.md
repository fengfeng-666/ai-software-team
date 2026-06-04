# 🚀 部署指南 - Railway

## 第一步：注册 Railway

1. 访问 https://railway.app/
2. 点击 **"Start a New Project"**
3. 用 GitHub 账号登录

## 第二步：上传代码到 GitHub

```bash
# 1. 初始化 Git
git init
git add .
git commit -m "Initial commit"

# 2. 在 GitHub 创建新仓库（不要勾选 README）
# 访问 https://github.com/new

# 3. 推送代码
git remote add origin https://github.com/你的用户名/auto-gen-team.git
git push -u origin main
```

## 第三步：部署到 Railway

1. Railway 点击 **"New Project"**
2. 选择 **"Deploy from GitHub Repo"**
3. 选择你刚创建的仓库
4. 点击 **"Deploy Now"**

## 第四步：配置环境变量

1. 在 Railway 项目中点击你的服务
2. 点击 **"Variables"** 标签
3. 添加以下变量：

| 变量名 | 值 |
|--------|-----|
| `LLM_MODEL_ID` | 你的模型ID |
| `LLM_API_KEY` | 你的API密钥 |
| `LLM_BASE_URL` | 你的API地址 |

## 第五步：获取部署域名

1. 点击 **"Settings"** 标签
2. 找到 **"Public Networking"**
3. 点击 **"Generate Domain"**
4. 复制生成的域名（类似 `xxx.up.railway.app`）

## 第六步：配置小程序

修改 `miniprogram/app.js`：

```js
App({
  globalData: {
    // 改成你的 Railway 域名
    baseUrl: 'https://xxx.up.railway.app'
  }
})
```

## 第七步：微信公众平台配置

1. 登录 https://mp.weixin.qq.com/
2. 开发管理 → 服务器域名
3. **request 合法域名** 添加：`https://xxx.up.railway.app`

## 第八步：上传小程序

1. 微信开发者工具 → 点击 **"上传"**
2. 版本号填 `1.0.0`
3. 登录公众平台 → 版本管理 → 提交审核

---

## 💡 常见问题

### Q: Railway 免费额度够用吗？
A: 每月 500 小时 + $5 额度，测试足够。正式上线建议升级。

### Q: 部署失败怎么办？
A: 检查 Logs 标签，通常是依赖安装失败或环境变量问题。

### Q: 访问很慢怎么办？
A: Railway 服务器在国外，可以考虑：
- 升级付费版选择亚洲区域
- 或改用国内云服务（阿里云/腾讯云）
