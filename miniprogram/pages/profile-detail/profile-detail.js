var D = require('../../utils/data')
var Profiles = require('../../utils/profiles')
var H = require('../../utils/history')
var Share = require('../../utils/share')

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
}

function findProfile(id) {
  return Profiles.getProfiles().filter(function(item) {
    return item.id === id
  })[0] || null
}

Page({
  data: {
    statusBarHeight: 0,
    id: '',
    profile: null,
    records: [],
    latest: null,
    typeInfo: null,
    emptyType: { label: '未知', emoji: '❔', color: '#8395A7', desc: '还没定性，先别急着给Ta判刑' }
  },

  onLoad: function(options) {
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      id: options && options.id ? safeDecode(options.id) : ''
    })
  },

  onShow: function() {
    this.loadProfile()
  },

  loadProfile: function() {
    var profile = findProfile(this.data.id)
    var records = profile ? H.getRecordsByProfile(profile.id) : []
    this.setData({
      profile: profile,
      records: records,
      latest: records[0] || null,
      typeInfo: profile && D.TI[profile.type] || this.data.emptyType
    })
  },

  goBack: function() {
    wx.navigateBack()
  },

  profileContext: function() {
    var profile = this.data.profile
    if (!profile) return ''
    return [
      '关系档案：' + profile.name,
      '关系：' + profile.relation,
      'Ta的疑似依恋类型：' + (profile.typeLabel || '未知'),
      profile.note ? '备注：' + profile.note : '',
      this.data.latest ? '最近一次分析：' + this.data.latest.kindLabel + '，' + this.data.latest.summary : ''
    ].filter(Boolean).join('\n')
  },

  profileParams: function() {
    var profile = this.data.profile
    if (!profile) return ''
    return 'profileId=' + encodeURIComponent(profile.id) +
      '&profileName=' + encodeURIComponent(profile.name)
  },

  touchAndGo: function(url) {
    var profile = this.data.profile
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: url })
  },

  goDiagnose: function() {
    var params = this.profileParams()
    this.touchAndGo('/pages/diagnose/diagnose?ctx=' + encodeURIComponent(this.profileContext()) + '&' + params)
  },

  goCheck: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/check/check?pType=' + (profile.type || '') + '&' + this.profileParams())
  },

  goPredict: function() {
    var params = this.profileParams()
    this.touchAndGo('/pages/predict/predict?ctx=' + encodeURIComponent(this.profileContext()) + '&' + params)
  },

  goEdit: function() {
    var profile = this.data.profile
    if (!profile) return
    wx.navigateTo({ url: '/pages/profiles/profiles?editId=' + encodeURIComponent(profile.id) })
  },

  openHistory: function(e) {
    wx.navigateTo({ url: '/pages/history-detail/history-detail?id=' + e.currentTarget.dataset.id })
  },

  onShareAppMessage: function() {
    return Share.profiles()
  }
})
