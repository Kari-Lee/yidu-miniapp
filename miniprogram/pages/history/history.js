var H = require('../../utils/history')
var Share = require('../../utils/share')

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

  openDetail: function(e) {
    wx.navigateTo({ url: '/pages/history-detail/history-detail?id=' + e.currentTarget.dataset.id })
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
  },

  onShareAppMessage: function() {
    return Share.home()
  }
})
