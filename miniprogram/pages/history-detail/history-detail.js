var H = require('../../utils/history')
var Format = require('../../utils/format')
var D = require('../../utils/data')
var Profiles = require('../../utils/profiles')
var ProfileContext = require('../../utils/profileContext')

Page({
  data: {
    statusBarHeight: 0,
    record: null,
    res: null,
    profileSynced: false
  },

  onLoad: function(options) {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight })
    this.loadRecord(options && options.id)
  },

  loadRecord: function(id) {
    var record = H.getRecord(id)
    this.setData({ record: record, res: record && record.result || null, profileSynced: false })
  },

  goBack: function() {
    wx.navigateBack()
  },

  copyRecord: function() {
    if (!this.data.record) return
    wx.setClipboardData({ data: Format.record(this.data.record) })
  },

  syncPartnerType: function() {
    var record = this.data.record
    var res = this.data.res
    if (!record || !record.profileId || record.kind !== 'diagnose' || !res) return
    var ti = D.TI[res.partner_type]
    if (!ti) {
      wx.showToast({ title: '暂时无法识别类型', icon: 'none' })
      return
    }
    var updated = Profiles.updateProfile(record.profileId, {
      type: res.partner_type,
      typeLabel: res.partner_label || ti.label
    })
    if (!updated) {
      wx.showToast({ title: '档案不存在', icon: 'none' })
      return
    }
    this.setData({ profileSynced: true })
    wx.showToast({ title: '已更新档案', icon: 'success' })
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
    return ProfileContext.queryById(record.profileId, record.profileName || '')
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
      var profile = record.profileId ? ProfileContext.findProfile(record.profileId) : null
      var checkParams = profile && profile.type ? 'pType=' + profile.type + (params ? '&' + params : '') : params
      wx.navigateTo({ url: '/pages/check/check' + (checkParams ? '?' + checkParams : '') })
    } else if (record.kind === 'reply') {
      var task = record.result && record.result.strategy ? '上一版回复策略：' + record.result.strategy : '请重新生成下一句回复。'
      var replyProfile = record.profileId ? ProfileContext.findProfile(record.profileId) : null
      var replyParams = 'mode=reply&replyTask=' + encodeURIComponent(task) +
        (replyProfile && replyProfile.type ? '&pType=' + replyProfile.type : '') +
        (params ? '&' + params : '')
      wx.navigateTo({ url: '/pages/check/check?' + replyParams })
    } else if (record.kind === 'predict') {
      wx.navigateTo({ url: '/pages/predict/predict' + joiner })
    }
  }
})
