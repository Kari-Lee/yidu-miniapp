App({
  globalData: {
    // 你的后端地址，负责中转千问API
    apiBaseUrl: 'https://www.yidu.click/api',
    // 分析结果（跨页面传递）
    analysisResult: null,
    statusBarHeight: 0
  },
  onLaunch: function() {
    var info = wx.getSystemInfoSync()
    this.globalData.statusBarHeight = info.statusBarHeight || 20
    this.setupUpdateManager()
  },
  setupUpdateManager: function() {
    if (!wx.getUpdateManager) return
    var manager = wx.getUpdateManager()
    manager.onUpdateReady(function() {
      wx.showModal({
        title: '新版本已经到了',
        content: '更新已经下载完成，重新打开就能用。',
        confirmText: '立即重启',
        cancelText: '稍后',
        confirmColor: '#2D2F33',
        success: function(result) {
          if (result.confirm) manager.applyUpdate()
        }
      })
    })
    manager.onUpdateFailed(function() {
      wx.showToast({
        title: '更新没下载好，下次打开再试',
        icon: 'none'
      })
    })
  }
})
