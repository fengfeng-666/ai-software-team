const app = getApp()

Page({
  data: {
    // 表单数据
    projectName: '',
    selectedType: '',
    coreFeatures: '',
    techRequirements: '',
    otherNotes: '',

    // 状态
    isFormValid: false,
    isLoading: false,
    loadingText: '提交中...',
    progress: 0,
    currentTaskId: '',

    // 项目类型选项
    projectTypes: [
      { value: 'web', label: 'Web应用', icon: '🌐' },
      { value: 'miniapp', label: '小程序', icon: '📱' },
      { value: 'api', label: '后端API', icon: '⚡' },
      { value: 'tool', label: '工具脚本', icon: '🔧' },
      { value: 'game', label: '小游戏', icon: '🎮' },
      { value: 'other', label: '其他', icon: '📦' }
    ]
  },

  // 查看任务列表
  onViewTasks() {
    wx.navigateTo({
      url: '/pages/tasks/tasks'
    })
  },

  // 输入事件处理
  onProjectNameInput(e) {
    this.setData({ projectName: e.detail.value })
    this.checkFormValid()
  },

  onTypeSelect(e) {
    const { value } = e.currentTarget.dataset
    this.setData({ selectedType: value })
    this.checkFormValid()
  },

  onCoreFeaturesInput(e) {
    this.setData({ coreFeatures: e.detail.value })
    this.checkFormValid()
  },

  onTechRequirementsInput(e) {
    this.setData({ techRequirements: e.detail.value })
  },

  onOtherNotesInput(e) {
    this.setData({ otherNotes: e.detail.value })
  },

  // 验证表单
  checkFormValid() {
    const { projectName, selectedType, coreFeatures } = this.data
    const isValid = projectName.trim() && selectedType && coreFeatures.trim()
    this.setData({ isFormValid: isValid })
  },

  // 构建任务描述
  buildTask() {
    const { projectName, selectedType, coreFeatures, techRequirements, otherNotes } = this.data
    const typeLabel = this.data.projectTypes.find(t => t.value === selectedType)?.label || selectedType

    let task = `我们需要开发一个${projectName}，类型为${typeLabel}。

核心功能：
${coreFeatures}`

    if (techRequirements.trim()) {
      task += `\n\n技术要求：
${techRequirements}`
    }

    if (otherNotes.trim()) {
      task += `\n\n其他说明：
${otherNotes}`
    }

    task += `\n\n请团队协作完成这个任务，从需求分析到最终实现。`

    return task
  },

  // 提交表单
  async onSubmit() {
    if (!this.data.isFormValid || this.data.isLoading) return

    this.setData({
      isLoading: true,
      loadingText: '正在提交任务...'
    })

    const task = this.buildTask()

    try {
      // 第一步：提交任务，获取 task_id
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/run-team`,
          method: 'POST',
          data: { task },
          header: { 'content-type': 'application/json' },
          timeout: 30000, // 30秒超时（只是提交任务）
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data)
            } else {
              reject(new Error(res.data?.detail || '提交失败'))
            }
          },
          fail: (err) => {
            reject(new Error('网络请求失败，请检查后端服务'))
          }
        })
      })

      if (!res.success || !res.task_id) {
        throw new Error('任务提交失败')
      }

      // 第二步：轮询等待任务完成
      this.setData({
        loadingText: 'AI团队正在协作...',
        progress: 5,
        currentTaskId: res.task_id
      })

      const result = await this.pollTaskStatus(res.task_id)

      // 第三步：跳转到结果页面
      wx.navigateTo({
        url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(result))}`
      })

    } catch (error) {
      console.error('提交失败:', error)
      if (error.message !== '任务已取消') {
        wx.showModal({
          title: '提示',
          content: error.message || '提交失败，请重试',
          showCancel: false
        })
      }
    } finally {
      if (!this._pollCancelled) {
        this.setData({
          isLoading: false,
          progress: 0,
          loadingText: '',
          currentTaskId: ''
        })
      }
    }
  },

  // 轮询任务状态
  pollTaskStatus(taskId) {
    return new Promise((resolve, reject) => {
      let pollCount = 0
      const maxPolls = 300 // 最多轮询300次（约10分钟）
      this._pollCancelled = false

      const poll = () => {
        // 检查是否已取消
        if (this._pollCancelled) {
          reject(new Error('任务已取消'))
          return
        }

        pollCount++

        if (pollCount > maxPolls) {
          reject(new Error('任务超时，请稍后在任务列表中查看结果'))
          return
        }

        wx.request({
          url: `${app.globalData.baseUrl}/api/task/${taskId}`,
          method: 'GET',
          timeout: 10000,
          success: (res) => {
            if (res.statusCode !== 200) {
              setTimeout(poll, 3000)
              return
            }

            const data = res.data

            // 更新进度
            this.setData({
              progress: data.progress || this.data.progress,
              loadingText: data.current_step || '处理中...'
            })

            if (data.status === 'completed') {
              // 任务完成
              this.setData({ progress: 100 })
              resolve({
                success: true,
                messages: data.messages
              })
            } else if (data.status === 'failed') {
              // 任务失败
              reject(new Error(data.error || '任务执行失败'))
            } else {
              // 继续轮询（每2秒一次）
              setTimeout(poll, 2000)
            }
          },
          fail: () => {
            // 网络错误，继续重试
            setTimeout(poll, 3000)
          }
        })
      }

      // 开始轮询
      poll()
    })
  },

  // 取消任务
  onCancel() {
    this._pollCancelled = true

    // 如果有任务ID，通知后端删除任务
    if (this.data.currentTaskId) {
      wx.request({
        url: `${app.globalData.baseUrl}/api/task/${this.data.currentTaskId}`,
        method: 'DELETE'
      })
    }

    this.setData({
      isLoading: false,
      progress: 0,
      loadingText: '',
      currentTaskId: ''
    })

    wx.showToast({
      title: '任务已取消',
      icon: 'none'
    })
  }
})
