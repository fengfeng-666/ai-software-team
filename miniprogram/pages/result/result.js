Page({
  data: {
    // 状态
    isSuccess: true,
    statusText: '开发完成',
    statusDesc: 'AI团队已完成协作任务',

    // 时间线
    timeline: [
      { step: 1, title: '产品经理分析需求', desc: '理解用户需求，制定实现方案', completed: true },
      { step: 2, title: '工程师实现代码', desc: '根据需求编写完整代码', completed: true },
      { step: 3, title: '代码审查员检查', desc: '审查代码质量和最佳实践', completed: true },
      { step: 4, title: '用户代理测试', desc: '验证功能是否符合预期', completed: true }
    ],

    // 对话记录
    conversations: [],

    // 代码
    generatedCode: '',
    codeFileName: 'app.vue',

    // 审查意见
    reviewComments: ''
  },

  onLoad(options) {
    if (options.data) {
      try {
        const data = JSON.parse(decodeURIComponent(options.data))
        this.parseResult(data)
      } catch (error) {
        console.error('解析结果数据失败:', error)
        this.setData({
          isSuccess: false,
          statusText: '数据解析失败',
          statusDesc: '无法解析返回的结果数据'
        })
      }
    }
  },

  // 解析结果数据
  parseResult(data) {
    const { success, messages, error } = data

    if (!success) {
      this.setData({
        isSuccess: false,
        statusText: '开发失败',
        statusDesc: error || 'AI团队协作过程中出现错误'
      })
      return
    }

    // 解析对话记录
    const conversations = this.parseConversations(messages || [])
    const { code, review } = this.extractCodeAndReview(conversations)

    this.setData({
      isSuccess: true,
      statusText: '开发完成',
      statusDesc: 'AI团队已完成协作任务',
      conversations,
      generatedCode: code || '// 未找到生成的代码',
      reviewComments: review || '未找到审查意见'
    })
  },

  // 解析对话记录
  parseConversations(messages) {
    const avatarMap = {
      'ProductManager': '👨‍💼',
      'Engineer': '👨‍💻',
      'CodeReviewer': '🔍',
      'UserProxy': '👤'
    }

    const roleMap = {
      'ProductManager': '产品经理',
      'Engineer': '工程师',
      'CodeReviewer': '代码审查员',
      'UserProxy': '用户代理'
    }

    return messages
      .filter(msg => msg.source && msg.content)
      .map(msg => ({
        name: roleMap[msg.source] || msg.source,
        avatar: avatarMap[msg.source] || '🤖',
        role: roleMap[msg.source] || msg.source,
        content: this.formatContent(msg.content)
      }))
  },

  // 格式化内容
  formatContent(content) {
    if (typeof content === 'string') {
      // 移除 TERMINATE 标记
      return content.replace(/TERMINATE/g, '').trim()
    }
    return JSON.stringify(content, null, 2)
  },

  // 从对话中提取代码和审查意见
  extractCodeAndReview(conversations) {
    let code = ''
    let review = ''

    conversations.forEach(conv => {
      if (conv.name === '工程师' || conv.role === 'Engineer') {
        // 尝试提取代码块
        const codeMatch = conv.content.match(/```[\s\S]*?```/g)
        if (codeMatch) {
          code = codeMatch.map(block =>
            block.replace(/```\w*\n?/g, '').replace(/```$/g, '').trim()
          ).join('\n\n')
        } else if (conv.content.includes('function') || conv.content.includes('const') || conv.content.includes('import')) {
          code = conv.content
        }
      }

      if (conv.name === '代码审查员' || conv.role === 'CodeReviewer') {
        review = conv.content
      }
    })

    return { code, review }
  },

  // 复制代码
  onCopyCode() {
    if (!this.data.generatedCode) return

    wx.setClipboardData({
      data: this.data.generatedCode,
      success: () => {
        wx.showToast({
          title: '代码已复制',
          icon: 'success'
        })
      }
    })
  },

  // 返回首页
  onBackHome() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  },

  // 创建新任务
  onNewTask() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  }
})
