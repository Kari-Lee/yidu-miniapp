var D = require('../../utils/data')
var Profiles = require('../../utils/profiles')
var H = require('../../utils/history')
var Share = require('../../utils/share')

var EMPTY_FORM = { name: '', relation: '暧昧对象', type: '', note: '' }

Page({
  data: {
    statusBarHeight: 0,
    profiles: [],
    showForm: false,
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

  onLoad: function() {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight })
    this.loadProfiles()
  },

  onShow: function() {
    this.loadProfiles()
  },

  goBack: function() { wx.navigateBack() },

  loadProfiles: function() {
    var profiles = Profiles.getProfiles().map(function(profile) {
      var latest = H.getLatestByProfile(profile.id)
      return Object.assign({}, profile, { latest: latest })
    })
    this.setData({ profiles: profiles })
  },

  toggleForm: function() {
    this.setData({ showForm: !this.data.showForm })
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
    this.setData({ form: Object.assign({}, EMPTY_FORM), showForm: false })
  },

  saveProfile: function() {
    var form = this.data.form
    var name = form.name.trim()
    if (!name) {
      wx.showToast({ title: '先给Ta起个名字', icon: 'none' })
      return
    }
    var ti = D.TI[form.type]
    Profiles.addProfile({
      name: name,
      relation: form.relation,
      type: form.type,
      typeLabel: ti ? ti.label : '未知',
      note: form.note.trim()
    })
    this.resetForm()
    this.loadProfiles()
  },

  findProfile: function(id) {
    return this.data.profiles.filter(function(item) { return item.id === id })[0]
  },

  profileContext: function(profile) {
    return [
      '关系档案：' + profile.name,
      '关系：' + profile.relation,
      'Ta的疑似依恋类型：' + (profile.typeLabel || '未知'),
      profile.note ? '备注：' + profile.note : ''
    ].filter(Boolean).join('\n')
  },

  profileParams: function(profile) {
    return 'profileId=' + encodeURIComponent(profile.id) +
      '&profileName=' + encodeURIComponent(profile.name)
  },

  goDiagnose: function(e) {
    var profile = this.findProfile(e.currentTarget.dataset.id)
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: '/pages/diagnose/diagnose?ctx=' + encodeURIComponent(this.profileContext(profile)) + '&' + this.profileParams(profile) })
  },

  goPredict: function(e) {
    var profile = this.findProfile(e.currentTarget.dataset.id)
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: '/pages/predict/predict?ctx=' + encodeURIComponent(this.profileContext(profile)) + '&' + this.profileParams(profile) })
  },

  goCheck: function(e) {
    var profile = this.findProfile(e.currentTarget.dataset.id)
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: '/pages/check/check?pType=' + (profile.type || '') + '&' + this.profileParams(profile) })
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
