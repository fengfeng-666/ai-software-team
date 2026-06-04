const app = getApp()

Page({
  data: {
    tasks: [],
    isLoading: true
  },

  onLoad() {
    this.loadTasks()
  },

  onShow() {
    // 每次显示页面时刷新
    this.loadTasks()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadTasks().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载任务列表
  async loadTasks() {
    this.setData({ isLoading: true })

    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/tasks`,
          method: 'GET',
          timeout: 10000,
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data)
            } else {
              reject(new Error('获取任务列表失败'))
            }
          },
          fail: (err) => {
            reject(new Error('网络请求失败'))
          }
        })
      })

      // 按时间倒序排列（最新的在前面）
      const tasks = (res.tasks || []).reverse()

      this.setData({
        tasks,
        isLoading: false
      })

    } catch (error) {
      console.error('加载任务列表失败:', error)
      this.setData({ isLoading: false })
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    }
  },

  // 刷新
  onRefresh() {
    this.loadTasks()
  },

  // 点击任务
  onTaskClick(e) {
    const task = e.currentTarget.dataset.task

    if (task.status === 'completed') {
      // 跳转到结果页
      const data = {
        success: true,
        messages: task.messages
      }
      wx.navigateTo({
        url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(data))}`
      })
    } else if (task.status === 'running') {
      wx.showToast({
        title: '任务正在运行中',
        icon: 'none'
      })
    } else if (task.status === 'failed') {
      wx.showModal({
        title: '任务失败',
        content: task.error || '任务执行失败',
        showCancel: false
      })
    }
  },

  // 删除任务
  onDelete(e) {
    const taskId = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个任务吗？',
      success: (res) => {
        if (res.confirm) {
          this.deleteTask(taskId)
        }
      }
    })
  },

  // 删除任务请求
  async deleteTask(taskId) {
    try {
      await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/task/${taskId}`,
          method: 'DELETE',
          timeout: 10000,
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data)
            } else {
              reject(new Error('删除失败'))
            }
          },
          fail: () => {
            reject(new Error('网络请求失败'))
          }
        })
      })

      wx.showToast({
        title: '已删除',
        icon: 'success'
      })

      // 刷新列表
      this.loadTasks()

    } catch (error) {
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      })
    }
  },

  // 返回首页
  onGoHome() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  }
})
