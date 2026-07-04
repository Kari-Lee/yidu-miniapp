var D = require('../../utils/data')
var Profiles = require('../../utils/profiles')
var H = require('../../utils/history')
var Share = require('../../utils/share')
var ProfileContext = require('../../utils/profileContext')
var Weekly = require('../../utils/weeklyReport')

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
}

function findProfile(id) {
  return Profiles.getProfiles().filter(function(item) {
    return item.id === id
  })[0] || null
}

function buildTodayPlan(profile, latest, records) {
  var count = records ? records.length : 0
  if (!latest) {
    return {
      kicker: 'TODAY · NEW FILE',
      title: '先给这段关系打个底',
      copy: '还没有 ' + profile.name + ' 的分析记录。先上传一段聊天或补一句背景，后面每次判断才不会从零开始。',
      action: 'diagnose',
      actionLabel: '上传聊天截图'
    }
  }
  if (latest.kind === 'translate') {
    return {
      kicker: 'TODAY · SUBTEXT',
      title: '别只审 Ta，一会儿还得回',
      copy: '最近一次在翻译 Ta 的潜台词。今天更适合把分析落到下一句话，别在一句话里反复上诉。',
      action: 'reply',
      actionLabel: '帮我回一句'
    }
  }
  if (latest.kind === 'check') {
    return {
      kicker: 'TODAY · SEND OR NOT',
      title: latest.feedback && latest.feedback.action === 'sent' ? '发都发了，看后续反应' : '今天继续先过一遍风险',
      copy: latest.feedback && latest.feedback.action === 'sent'
        ? '上次你标记已经发出。今天重点不是复盘勇气，是看 Ta 回得像人，还是像自动回复。'
        : '最近一次在纠结发不发。今天如果又想发，先让已读拦一下，别让情绪替你点发送。',
      action: latest.feedback && latest.feedback.action === 'sent' ? 'translate' : 'check',
      actionLabel: latest.feedback && latest.feedback.action === 'sent' ? '翻译 Ta 的回复' : '我这句能不能发'
    }
  }
  if (latest.kind === 'reply' || latest.kind === 'misread') {
    return {
      kicker: 'TODAY · AFTER REPLY',
      title: '上一句已经有了，今天看能不能发',
      copy: '最近一次生成了回复。真正的闭环是发之前再过一遍风险，别让好笑变成事故。',
      action: 'check',
      actionLabel: '检查发送风险'
    }
  }
  if (latest.kind === 'predict') {
    return {
      kicker: 'TODAY · FORECAST',
      title: '预测看完了，今天看动作',
      copy: '关系走向不是靠盯着预测刷新出来的。今天更适合检查一句具体要发的话。',
      action: 'check',
      actionLabel: '我这句能不能发'
    }
  }
  return {
    kicker: count > 2 ? 'TODAY · FILE #' + count : 'TODAY · RELATION',
    title: '今天先别急着发',
    copy: '把和 ' + profile.name + ' 有关的话、截图或想法丢进来，结果会自动归进这个档案。',
    action: 'translate',
    actionLabel: 'Ta 这句话什么意思'
  }
}

Page({
  data: {
    statusBarHeight: 0,
    id: '',
    profile: null,
    records: [],
    latest: null,
    hasRecords: false,
    todayPlan: null,
    weeklyReport: null,
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
      hasRecords: records.length > 0,
      todayPlan: profile ? buildTodayPlan(profile, records[0] || null, records) : null,
      weeklyReport: profile ? Weekly.build(profile, records) : null,
      typeInfo: profile && D.TI[profile.type] || this.data.emptyType
    })
  },

  goBack: function() {
    wx.navigateBack()
  },

  openWeeklyReport: function() {
    var profile = this.data.profile
    if (!profile) return
    wx.navigateTo({ url: '/pages/weekly-report/weekly-report?id=' + encodeURIComponent(profile.id) })
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

  goMisread: function() {
    var profile = this.data.profile
    if (!profile) return
    var mode = profile.relation === '暧昧对象' || profile.relation === '伴侣' ? 'crush' : 'person'
    this.touchAndGo('/pages/misread/misread?mode=' + mode +
      '&profileRelation=' + encodeURIComponent(profile.relation || '') +
      '&' + ProfileContext.query(profile))
  },

  goCheck: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/check/check?pType=' + (profile.type || '') + '&' + ProfileContext.query(profile))
  },

  goTranslate: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/translate/translate?' + ProfileContext.query(profile))
  },

  goTodayAction: function() {
    var plan = this.data.todayPlan
    if (!plan) return
    if (plan.action === 'diagnose') this.goDiagnose()
    else if (plan.action === 'check') this.goCheck()
    else if (plan.action === 'reply') this.goReply()
    else if (plan.action === 'predict') this.goPredict()
    else if (plan.action === 'misread') this.goMisread()
    else this.goTranslate()
  },

  goReply: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/check/check?mode=reply&pType=' + (profile.type || '') + '&' + ProfileContext.query(profile))
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
