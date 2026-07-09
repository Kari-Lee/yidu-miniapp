var D = require('../../utils/data')
var Profiles = require('../../utils/profiles')
var H = require('../../utils/history')
var Share = require('../../utils/share')
var ProfileContext = require('../../utils/profileContext')
var Weekly = require('../../utils/weeklyReport')

var EMPTY_FORM = { name: '', relation: '暧昧对象', type: '', note: '' }

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
}

function hasPendingFollowup(records) {
  return records.some(function(record) {
    return record.feedback && record.feedback.action === 'sent' && !record.feedback.response
  })
}

function buildProfileStatus(profile, records) {
  var report = Weekly.build(profile, records)
  var streakPrefix = report.streak ? report.streakText + ' · ' : ''
  if (hasPendingFollowup(records)) {
    return {
      tone: 'warn',
      label: '等待反馈',
      text: streakPrefix + '有已发消息还没标记 Ta 的回应',
      action: '去补反馈'
    }
  }
  if (report.ready) {
    return {
      tone: 'ready',
      label: '周报已生成',
      text: streakPrefix + report.verdict,
      action: '查看周报'
    }
  }
  if (report.total > 0) {
    return {
      tone: 'progress',
      label: report.total + '/' + report.target,
      text: streakPrefix + report.milestone.title + '，还差 ' + report.needed + ' 天',
      action: '继续补材料'
    }
  }
  return {
    tone: 'empty',
    label: '未开始',
    text: '先留第一条记录，后面才能看趋势',
    action: '开始分析'
  }
}

Page({
  data: {
    statusBarHeight: 0,
    profiles: [],
    showForm: false,
    editingId: '',
    form: Object.assign({}, EMPTY_FORM),
    relationOptions: ['暧昧对象', '伴侣', '前任', '相亲对象', '同事', '朋友'],
    typeOptions: [
      { key:'', emoji:'❔', label:'未知', color:'#8395A7', bg:'#F8FAFB' },
      { key:'avoidant', emoji:'🧊', label:'回避型', color:'#0984E3', bg:'rgba(9,132,227,0.08)' },
      { key:'anxious', emoji:'🔥', label:'焦虑型', color:'#E17055', bg:'rgba(225,112,85,0.08)' },
      { key:'secure', emoji:'🌿', label:'安全型', color:'#00B894', bg:'rgba(0,184,148,0.08)' },
      { key:'disorganized', emoji:'🌀', label:'混乱型', color:'#6C5CE7', bg:'rgba(108,92,231,0.08)' },
    ]
  },

  onLoad: function(options) {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight })
    this.loadProfiles()
    if (options && options.editId) {
      this.openEditor(safeDecode(options.editId))
    }
  },

  onShow: function() {
    this.loadProfiles()
  },

  goBack: function() { wx.navigateBack() },

  loadProfiles: function() {
    var profiles = Profiles.getProfiles().map(function(profile) {
      var latest = H.getLatestByProfile(profile.id)
      var records = H.getRecordsByProfile(profile.id)
      return Object.assign({}, profile, {
        latest: latest,
        status: buildProfileStatus(profile, records)
      })
    })
    this.setData({ profiles: profiles })
  },

  toggleForm: function() {
    if (this.data.showForm) {
      this.resetForm()
      return
    }
    this.setData({ showForm: true, editingId: '', form: Object.assign({}, EMPTY_FORM) })
  },

  onNameInput: function(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onNoteInput: function(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  pickRelation: function(e) {
    this.setData({ 'form.relation': e.currentTarget.dataset.relation })
  },

  pickType: function(e) {
    this.setData({ 'form.type': e.currentTarget.dataset.key })
  },

  resetForm: function() {
    this.setData({ form: Object.assign({}, EMPTY_FORM), showForm: false, editingId: '' })
  },

  saveProfile: function() {
    var form = this.data.form
    var name = form.name.trim()
    if (!name) {
      wx.showToast({ title: '先给Ta起个名字', icon: 'none' })
      return
    }
    var ti = D.TI[form.type]
    var payload = {
      name: name,
      relation: form.relation,
      type: form.type,
      typeLabel: ti ? ti.label : '未知',
      note: form.note.trim()
    }
    if (this.data.editingId) {
      Profiles.updateProfile(this.data.editingId, payload)
    } else {
      Profiles.addProfile(payload)
    }
    this.resetForm()
    this.loadProfiles()
  },

  findProfile: function(id) {
    return this.data.profiles.filter(function(item) { return item.id === id })[0]
  },

  openEditor: function(id) {
    var profile = this.findProfile(id)
    if (!profile) return
    this.setData({
      showForm: true,
      editingId: profile.id,
      form: {
        name: profile.name || '',
        relation: profile.relation || '暧昧对象',
        type: profile.type || '',
        note: profile.note || ''
      }
    })
  },

  editProfile: function(e) {
    this.openEditor(e.currentTarget.dataset.id)
  },

  goDetail: function(e) {
    wx.navigateTo({ url: '/pages/profile-detail/profile-detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) })
  },

  goDiagnose: function(e) {
    var profile = this.findProfile(e.currentTarget.dataset.id)
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: '/pages/diagnose/diagnose?' + ProfileContext.query(profile) })
  },

  goPredict: function(e) {
    var profile = this.findProfile(e.currentTarget.dataset.id)
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: '/pages/predict/predict?' + ProfileContext.query(profile) })
  },

  goCheck: function(e) {
    var profile = this.findProfile(e.currentTarget.dataset.id)
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: '/pages/check/check?pType=' + (profile.type || '') + '&' + ProfileContext.query(profile) })
  },

  deleteProfile: function(e) {
    var id = e.currentTarget.dataset.id
    var self = this
    wx.showModal({
      title: '删除档案',
      content: '只删除本机档案，不影响历史记录。',
      confirmColor: '#E17055',
      success: function(r) {
        if (!r.confirm) return
        Profiles.removeProfile(id)
        self.loadProfiles()
      }
    })
  },

  onShareAppMessage: function() {
    return Share.profiles()
  }
})
