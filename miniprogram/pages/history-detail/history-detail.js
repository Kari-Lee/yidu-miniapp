var H = require('../../utils/history')
var Format = require('../../utils/format')

Page({
  data: {
    statusBarHeight: 0,
    record: null,
    res: null
  },

  onLoad: function(options) {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight })
    this.loadRecord(options && options.id)
  },

  loadRecord: function(id) {
    var record = H.getRecord(id)
    this.setData({ record: record, res: record && record.result || null })
  },

  goBack: function() {
    wx.navigateBack()
  },

  copyRecord: function() {
    if (!this.data.record) return
    wx.setClipboardData({ data: Format.record(this.data.record) })
  },

  deleteRecord: function() {
    var record = this.data.record
    if (!record) return
    wx.showModal({
      title: '删除记录',
      content: '只删除这条本机历史记录。',
      confirmColor: '#E17055',
      success: function(r) {
        if (!r.confirm) return
        H.removeRecord(record.id)
        wx.navigateBack()
      }
    })
  },

  profileParams: function(record) {
    if (!record.profileId) return ''
    return 'profileId=' + encodeURIComponent(record.profileId) +
      '&profileName=' + encodeURIComponent(record.profileName || '')
  },

  reAnalyze: function() {
    var record = this.data.record
    if (!record) return
    var params = this.profileParams(record)
    var joiner = params ? '?' + params : ''
    if (record.kind === 'quiz') {
      wx.navigateTo({ url: '/pages/quiz/quiz' })
    } else if (record.kind === 'diagnose') {
      wx.navigateTo({ url: '/pages/diagnose/diagnose' + joiner })
    } else if (record.kind === 'translate') {
      wx.navigateTo({ url: '/pages/translate/translate' })
    } else if (record.kind === 'check') {
      wx.navigateTo({ url: '/pages/check/check' + joiner })
    } else if (record.kind === 'predict') {
      wx.navigateTo({ url: '/pages/predict/predict' + joiner })
    }
  }
})
