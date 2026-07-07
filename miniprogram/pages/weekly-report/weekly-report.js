var Profiles = require('../../utils/profiles')
var H = require('../../utils/history')
var D = require('../../utils/data')
var Weekly = require('../../utils/weeklyReport')
var Share = require('../../utils/share')
var ProfileContext = require('../../utils/profileContext')
var Poster = require('../../utils/resultPoster')

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
    report: null,
    posterSaving: false,
    posterPath: '',
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
    this.loadReport()
  },

  loadReport: function() {
    var profile = findProfile(this.data.id)
    var records = profile ? H.getRecordsByProfile(profile.id) : []
    this.setData({
      profile: profile,
      report: profile ? Weekly.build(profile, records) : null,
      posterPath: '',
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

  goProfile: function() {
    var profile = this.data.profile
    if (!profile) return
    wx.navigateTo({ url: '/pages/profile-detail/profile-detail?id=' + encodeURIComponent(profile.id) })
  },

  goDiagnose: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/diagnose/diagnose?' + ProfileContext.query(profile))
  },

  goTranslate: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/translate/translate?' + ProfileContext.query(profile))
  },

  goCheck: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/check/check?pType=' + (profile.type || '') + '&' + ProfileContext.query(profile))
  },

  openRecord: function(e) {
    wx.navigateTo({ url: '/pages/history-detail/history-detail?id=' + e.currentTarget.dataset.id })
  },

  buildPosterData: function() {
    var profile = this.data.profile || {}
    var report = this.data.report || {}
    return {
      kicker: '7-DAY RELATION REPORT',
      title: report.ready ? report.verdict : report.status,
      subtitle: (profile.name || '这段关系') + '｜' + (report.trend || '关系记录正在采样'),
      footer: '只分享结论，不展示聊天内容',
      sections: [
        {
          label: 'STAGE',
          title: report.status || '采样中',
          body: report.trend || '先补足材料，别急着定性。',
          dark: true
        },
        {
          label: 'NEXT',
          title: report.focus || '继续补样本',
          body: report.advice || '继续记录真实动作，不要只记录情绪波动。'
        },
        {
          label: 'SIGNAL',
          title: '本周主线：' + (report.mainKind || '暂无'),
          body: '记录 ' + (report.total || 0) + ' 条｜已发 ' + (report.sent || 0) + ' 次｜有效回应 ' + (report.replied || 0) + ' 次'
        }
      ]
    }
  },

  saveWeeklyPoster: function() {
    var self = this
    if (this.data.posterSaving || !this.data.report) return
    this.setData({ posterSaving: true })
    wx.showLoading({ title: '生成分享图' })
    var task = this.data.posterPath
      ? Promise.resolve(this.data.posterPath)
      : Poster.render(this, '#weeklyPoster', this.buildPosterData())
    task.then(function(path) {
      self.setData({ posterPath: path })
      return Poster.save(path)
    }).then(function() {
      wx.hideLoading()
      self.setData({ posterSaving: false })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    }).catch(function(err) {
      wx.hideLoading()
      self.setData({ posterSaving: false })
      Poster.handleSaveError(err)
    })
  },

  onShareAppMessage: function() {
    return Share.weeklyReport(this.data.profile, this.data.report)
  },

  onShareTimeline: function() {
    var shared = Share.weeklyReport(this.data.profile, this.data.report)
    return {
      title: shared.title,
      query: this.data.profile ? 'id=' + encodeURIComponent(this.data.profile.id) : ''
    }
  }
})
