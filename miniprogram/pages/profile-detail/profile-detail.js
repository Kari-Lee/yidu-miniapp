var D = require('../../utils/data')
var Profiles = require('../../utils/profiles')
var H = require('../../utils/history')
var Share = require('../../utils/share')
var ProfileContext = require('../../utils/profileContext')

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

  touchAndGo: function(url) {
    var profile = this.data.profile
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: url })
  },

  goDiagnose: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/diagnose/diagnose?' + ProfileContext.query(profile))
  },

  goCheck: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/check/check?pType=' + (profile.type || '') + '&' + ProfileContext.query(profile))
  },

  goPredict: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/predict/predict?' + ProfileContext.query(profile))
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
