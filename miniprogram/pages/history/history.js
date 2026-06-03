var H = require('../../utils/history')

Page({
  data: {
    statusBarHeight: 0,
    records: []
  },

  onLoad: function() {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight })
  },

  onShow: function() {
    this.setData({ records: H.getRecords() })
  },

  goBack: function() {
    wx.navigateBack()
  },

  clearHistory: function() {
    var self = this
    wx.showModal({
      title: '清空历史',
      content: '本机保存的分析记录会被删除。',
      confirmColor: '#E17055',
      success: function(r) {
        if (!r.confirm) return
        H.clearRecords()
        self.setData({ records: [] })
      }
    })
  }
})
