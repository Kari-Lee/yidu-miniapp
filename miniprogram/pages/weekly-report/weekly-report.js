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

function buildNextPlan(report) {
  if (!report) return null
  if (!report.ready) {
    return {
      kicker: 'TODAY RECORD',
      title: '记录今天的互动',
      copy: '七日周报按天生成。今天补一条聊天截图、Ta 的原话，或你想发出去的一句话。',
      action: 'diagnose',
      actionLabel: '记录今天的互动'
    }
  }
  if (report.sent && report.weak >= report.sent) {
    return {
      kicker: 'NEXT RECORD',
      title: '先别二连，看看 Ta 下一句',
      copy: '这周主动后的反馈偏弱。下次有回复先翻译潜台词，再决定要不要继续推进。',
      action: 'translate',
      actionLabel: '翻译 Ta 的回复'
    }
  }
  if (report.skipped > report.sent) {
    return {
      kicker: 'NEXT RECORD',
      title: '想发的那句，先过风控',
      copy: '这周克制比推进更多。不是让你硬冲，是把要发的话先降温，再决定发不发。',
      action: 'check',
      actionLabel: '我这句能不能发'
    }
  }
  if (report.replied > report.weak && report.replied > 0) {
    return {
      kicker: 'NEXT RECORD',
      title: '轻推进，别一次性交底',
      copy: '回应质量暂时可看。下一句可以往前走一点，但不要把周报写成遗书发出去。',
      action: 'reply',
      actionLabel: '帮我回一句'
    }
  }
  return {
    kicker: 'NEXT RECORD',
    title: '继续记录一个具体动作',
    copy: '这段关系还没形成稳定趋势。下一次别只记情绪，优先记录 Ta 的真实回复或你的实际动作。',
    action: 'translate',
    actionLabel: 'Ta 这句话什么意思'
  }
}

Page({
  data: {
    statusBarHeight: 0,
    id: '',
    profile: null,
    report: null,
    nextPlan: null,
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
    var report = profile ? Weekly.build(profile, records) : null
    this.setData({
      profile: profile,
      report: report,
      nextPlan: buildNextPlan(report),
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

  goReply: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/check/check?mode=reply&pType=' + (profile.type || '') + '&' + ProfileContext.query(profile))
  },

  goNextPlan: function() {
    var plan = this.data.nextPlan
    if (!plan) return
    if (plan.action === 'diagnose') this.goDiagnose()
    else if (plan.action === 'check') this.goCheck()
    else if (plan.action === 'reply') this.goReply()
    else this.goTranslate()
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
          label: 'TREND',
          title: report.verdict || '关系趋势采样中',
          body: report.trend || '每天记录一点，看清这段关系往哪走。',
          dark: true
        },
        {
          label: 'ADVICE',
          title: report.focus || '继续补样本',
          body: report.advice || '继续记录真实动作，不要只记录情绪波动。'
        },
        {
          label: 'PROGRESS',
          title: '七日 ' + (report.total || 0) + '/7｜三十日 ' + (report.monthTotal || 0) + '/30',
          body: '关系温度：' + (report.latestScore === null ? '采样中' : report.latestScore + '/100')
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
