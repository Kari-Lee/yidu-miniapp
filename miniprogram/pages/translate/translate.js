var D = require('../../utils/data')
var API = require('../../utils/api')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var Format = require('../../utils/format')
var Poster = require('../../utils/resultPoster')
var Report = require('../../utils/report')
var MSGS = ["解码潜台词", "翻译真实意图"]

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', err: null,
    hasInput: false, submitting: false, loadingMsg: '', res: null,
    posterSaving: false, posterPath: '',
    colors: ['rgba(225,112,85,0.85)', 'rgba(230,168,23,0.85)', 'rgba(99,110,114,0.85)']
  },
  _timer: null,
  onLoad: function() { this.setData({ statusBarHeight: getApp().globalData.statusBarHeight }) },
  onUnload: function() { this.stopLoading() },
  goBack: function() { wx.navigateBack() },
  stopLoading: function() {
    if (!this._timer) return
    clearInterval(this._timer)
    this._timer = null
  },
  onInput: function(e) { this.setData({ text: e.detail.value, hasInput: !!e.detail.value.trim() }) },
  resetInput: function() {
    this._submitting = false
    this.setData({ step: 'input', text: '', err: null, res: null, hasInput: false, submitting: false, posterSaving: false, posterPath: '' })
  },

  submit: function() {
    if (this._submitting || !this.data.text.trim()) return
    var self = this
    self._submitting = true
    self.stopLoading()
    self.setData({ step: 'loading', err: null, submitting: true, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    API.callAI(D.P.translate, 'Ta说的话：\n' + self.data.text, null, null, {
      onRetry: function() { self.setData({ loadingMsg: '连接波动，正在自动重试' }) },
      clientMeta: { task: 'translate' }
    }).then(function(res) {
      self.stopLoading()
      self._submitting = false
      res = N.normalizeTranslate(res, self.data.text)
      var first = res.translations && res.translations[0]
      H.addRecord({
        kind: 'translate',
        kindLabel: '潜台词',
        title: first ? first.original : '潜台词翻译',
        summary: first ? first.verdict : '已生成潜台词分析',
        input: self.data.text.slice(0, 80),
        result: res
      })
      self.setData({ step: 'result', res: res, submitting: false, posterSaving: false, posterPath: '' })
    }).catch(function(e) {
      self.stopLoading()
      self._submitting = false
      self.setData({ step: 'input', err: e.message || '出错了', submitting: false })
    })
  },

  onShareAppMessage: function() {
    this.reportResultEvent('share')
    var share = Share.translate()
    if (this.data.posterPath) share.imageUrl = this.data.posterPath
    return share
  },

  copyResult: function() {
    if (!this.data.res) return
    var text = Format.translate(this.data.res)
    var self = this
    wx.setClipboardData({
      data: text,
      success: function() { self.reportResultEvent('copy', text) }
    })
  },

  reportResultEvent: function(event, text) {
    if (!this.data.res) return
    var first = this.data.res.translations && this.data.res.translations[0] || {}
    var payload = {
      task: 'translate',
      route: 'result',
      title: first.original || '潜台词翻译',
      summary: first.verdict || first.most_likely || '',
      source: this.data.text,
      text: text || Format.translate(this.data.res)
    }
    if (event === 'copy') Report.reportToolCopy(payload)
    else if (event === 'share') Report.reportToolShare(payload)
    else if (event === 'poster_save') Report.reportPosterSave(payload)
  },

  buildPosterData: function() {
    var first = this.data.res && this.data.res.translations && this.data.res.translations[0] || {}
    var top = first.possibilities && first.possibilities[0] || {}
    return {
      kicker: 'SUBTEXT TRANSLATOR',
      title: '人话版本已经翻译完了',
      subtitle: first.verdict || '一句话不够判断真心，但足够看出语气和试探。',
      accent: '#10A8E8',
      sections: [
        { label: 'TA SAID', title: first.original || this.data.text || 'Ta 的原话', body: first.verdict || '已生成潜台词分析' },
        { label: 'MOST LIKELY', title: first.most_likely || top.meaning || '最可能的意思', body: first.why || top.reason || '看后续行动，比反复审一句话更有用。', dark: true },
        { label: 'NEXT', title: '先观察后续动作', body: '不要把一句话当判决书。真正有用的是 Ta 接下来怎么做。' }
      ],
      footer: '潜台词不是读心术'
    }
  },

  saveResultPoster: function() {
    if (!this.data.res || this.data.posterSaving) return
    var self = this
    self.setData({ posterSaving: true })
    wx.showLoading({ title: '生成结果图中' })
    var task = self.data.posterPath
      ? Promise.resolve(self.data.posterPath)
      : Poster.render(self, '#resultPoster', self.buildPosterData())
    task.then(function(path) {
      self.setData({ posterPath: path })
      return Poster.save(path)
    }).then(function() {
      wx.hideLoading()
      self.setData({ posterSaving: false })
      self.reportResultEvent('poster_save')
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    }).catch(function(err) {
      wx.hideLoading()
      self.setData({ posterSaving: false })
      Poster.handleSaveError(err)
    })
  }
})
