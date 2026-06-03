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
  }
})
