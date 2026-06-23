var D = require('../../utils/data')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var Format = require('../../utils/format')
var ChatImages = require('../../utils/chatImages')
var Poster = require('../../utils/resultPoster')
var Report = require('../../utils/report')
var MSGS = ["扫描关系轨迹", "模拟未来走向"]

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
}

function makeContextTip(name, count) {
  var n = parseInt(count || 0, 10) || 0
  return '已带入' + (name || '这段关系') + '的档案' + (n ? '和' + n + '条历史摘要' : '')
}

function hasInput(text, imgs) {
  return !!((text || '').trim() || (imgs && imgs.length))
}

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', imgs: [], ctx: '', err: null,
    initialCtx: '', profileId: '', profileName: '', profileHistoryCount: 0, contextTip: '',
    ctxEnabled: false, initialCtxEnabled: false, ctxPreviewOpen: false,
    hasInput: false, submitting: false, loadingMsg: '', res: null,
    posterSaving: false, posterPath: '',
    predBgs: ['#FFF5F3', '#FFF9E6', '#F0FFF4']
  },
  _timer: null,
  onLoad: function(options) {
    var profileId = options && options.profileId ? safeDecode(options.profileId) : ''
    var profileName = options && options.profileName ? safeDecode(options.profileName) : ''
    var historyCount = parseInt(options && options.profileHistoryCount || 0, 10) || 0
    var ctx = options && options.ctx ? safeDecode(options.ctx) : ''
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      ctx: ctx,
      initialCtx: ctx,
      ctxEnabled: !!ctx,
      initialCtxEnabled: !!ctx,
      profileId: profileId,
      profileName: profileName,
      profileHistoryCount: historyCount,
      contextTip: profileId && ctx ? makeContextTip(profileName, historyCount) : ''
    })
  },
  onUnload: function() { this.stopLoading() },
  goBack: function() { wx.navigateBack() },
  stopLoading: function() {
    if (!this._timer) return
    clearInterval(this._timer)
    this._timer = null
  },
  onInput: function(e) {
    this.setData({ text: e.detail.value, hasInput: hasInput(e.detail.value, this.data.imgs) })
  },
  chooseImg: function() {
    var self = this
    var remaining = ChatImages.MAX_IMAGES - self.data.imgs.length
    if (remaining <= 0) {
      wx.showToast({ title: '这组截图已经够完整了', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: Math.min(9, remaining),
      sizeType: ['compressed'],
      success: function(r) {
        var paths = self.data.imgs.map(function(item) {
          return item.originalPath || item.path
        }).concat(r.tempFilePaths)
        wx.showLoading({ title: '优化截图中' })
        ChatImages.optimizeImages(paths).then(function(imgs) {
          wx.hideLoading()
          self.setData({ imgs: imgs, hasInput: hasInput(self.data.text, imgs) })
        }).catch(function() {
          wx.hideLoading()
          wx.showToast({ title: '图片处理失败，请重选', icon: 'none' })
        })
      }
    })
  },
  previewImg: function(e) {
    var idx = e.currentTarget.dataset.index
    var urls = this.data.imgs.map(function(item) { return item.path })
    wx.previewImage({ current: urls[idx], urls: urls })
  },
  removeImg: function(e) {
    var idx = e.currentTarget.dataset.index
    var imgs = this.data.imgs.slice()
    imgs.splice(idx, 1)
    this.setData({ imgs: imgs, hasInput: hasInput(this.data.text, imgs) })
  },
  clearImgs: function() {
    this.setData({ imgs: [], hasInput: hasInput(this.data.text, []) })
  },
  onCtxInput: function(e) { this.setData({ ctx: e.detail.value }) },
  toggleCtxEnabled: function(e) { this.setData({ ctxEnabled: e.detail.value }) },
  toggleCtxPreview: function() { this.setData({ ctxPreviewOpen: !this.data.ctxPreviewOpen }) },
  nextStep: function() { if (this.data.hasInput) this.setData({ step: 'context' }) },
  backToInput: function() { this.setData({ step: 'input' }) },
  resetInput: function() {
    this._submitting = false
    this.setData({
      step: 'input',
      text: '',
      imgs: [],
      ctx: this.data.initialCtx,
      ctxEnabled: this.data.initialCtxEnabled,
      ctxPreviewOpen: false,
      err: null,
      res: null,
      submitting: false,
      hasInput: false,
      posterSaving: false,
      posterPath: ''
    })
  },

  submit: function() {
    if (this._submitting) return
    var self = this
    self._submitting = true
    self.stopLoading()
    self.setData({ step: 'loading', err: null, submitting: true, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    var ctx = (!self.data.contextTip || self.data.ctxEnabled) ? self.data.ctx : ''
    var um = (ctx ? '关系背景：' + ctx + '\n\n' : '') +
      (self.data.text.trim()
        ? '聊天记录：\n' + self.data.text
        : '请根据所附聊天截图识别互动内容并预测关系走向。') +
      (self.data.imgs.length ? '\n\n请同时参考所附聊天截图，并按截图顺序理解上下文。' : '')

    ChatImages.callAI(D.P.predict, um, self.data.imgs, {
      onRetry: function() { self.setData({ loadingMsg: '连接波动，正在自动重试' }) },
      onStatus: function(message) { self.setData({ loadingMsg: message }) },
      onPrepared: function(imgs) { self.setData({ imgs: imgs }) }
    }).then(function(res) {
      self.stopLoading()
      self._submitting = false
      res = N.normalizePredict(res)
      H.addRecord({
        kind: 'predict',
        kindLabel: '感情预测',
        title: res.stage || '感情预测',
        summary: res.stage_desc || res.todo || '已生成关系走向预测',
        input: self.data.text.slice(0, 80),
        imageCount: self.data.imgs.length,
        profileId: self.data.profileId,
        profileName: self.data.profileName,
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
    var share = Share.predict(this.data.res && this.data.res.stage)
    if (this.data.posterPath) share.imageUrl = this.data.posterPath
    return share
  },

  goReply: function() {
    var res = this.data.res
    if (!res) return
    var task = [
      '来源：感情预测',
      res.stage ? '当前阶段：' + res.stage : '',
      res.stage_desc ? '阶段描述：' + res.stage_desc : '',
      res.turning ? '转折点：' + res.turning : '',
      res.todo ? '现在该做：' + res.todo : ''
    ].filter(Boolean).join('\n')
    var query = [
      'mode=reply',
      'replyTask=' + encodeURIComponent(task),
      'profileId=' + encodeURIComponent(this.data.profileId || ''),
      'profileName=' + encodeURIComponent(this.data.profileName || ''),
      'profileHistoryCount=' + encodeURIComponent(this.data.profileHistoryCount || 0),
      'ctxEnabled=' + (this.data.ctxEnabled ? '1' : '0'),
      'ctx=' + encodeURIComponent(this.data.ctx || '')
    ].join('&')
    wx.navigateTo({ url: '/pages/check/check?' + query })
  },

  copyResult: function() {
    if (!this.data.res) return
    var text = Format.predict(this.data.res)
    var self = this
    wx.setClipboardData({
      data: text,
      success: function() { self.reportResultEvent('copy', text) }
    })
  },

  reportResultEvent: function(event, text) {
    if (!this.data.res) return
    var res = this.data.res || {}
    var payload = {
      task: 'predict',
      route: 'result',
      title: res.stage || '感情预测',
      summary: res.stage_desc || res.todo || '',
      source: this.data.text,
      text: text || Format.predict(res)
    }
    if (event === 'copy') Report.reportToolCopy(payload)
    else if (event === 'share') Report.reportToolShare(payload)
    else if (event === 'poster_save') Report.reportPosterSave(payload)
  },

  buildPosterData: function() {
    var res = this.data.res || {}
    var first = res.predictions && res.predictions[0] || {}
    var second = res.predictions && res.predictions[1] || {}
    return {
      kicker: 'RELATION FORECAST',
      title: res.stage || '这段关系会走到哪里',
      subtitle: res.stage_desc || '不是算命，是看你们正在重复什么。',
      accent: '#E17055',
      sections: [
        { label: 'CURRENT STAGE', title: res.stage || '当前阶段', body: res.stage_desc || '互动模式正在影响走向。', dark: true },
        { label: first.time || 'NEXT', title: first.prob !== undefined ? '可能性 ' + first.prob + '%' : '下一步走向', body: first.scene || '看你们下一次怎么处理转折点。' },
        { label: second.time || 'TURNING POINT', title: res.turning || '转折点', body: second.scene || res.turning || '关系会被新的选择改写。' },
        { label: 'DO THIS NOW', title: '现在该做', body: res.todo || '别重复同一个坑。' }
      ],
      footer: '关系走向，不是结局通知书'
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
