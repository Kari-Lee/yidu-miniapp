var API = require('../../utils/api')
var ChatImages = require('../../utils/chatImages')
var H = require('../../utils/history')
var Share = require('../../utils/share')
var ProfileContext = require('../../utils/profileContext')
var Prompt = require('../../utils/misreadPrompt')
var Quality = require('../../utils/misreadQuality')

var PLACEHOLDERS = [
  '我是世界上最厉害的人',
  '在吗',
  '你想我吗？',
  '我最近真的想开了',
  '炒粉干被油溅到了'
]
var LOADING_MESSAGES = ['正在认真地读歪……', '正在假装没看懂……']

function safeDecode(value) {
  try { return decodeURIComponent(value || '') } catch (e) { return value || '' }
}

function hasInput(text, imgs) {
  return !!((text || '').trim() || (imgs && imgs.length))
}

function normalizeWarning(value) {
  value = String(value || 'Ta可能会停顿三秒').trim()
  var explanationMarkers = [
    '制造', '反差', '甜藏', '暗藏', '实则', '语气',
    '把抽象', '转成具体', '炸点', '创作', '阅读失败'
  ]
  var explainsMethod = explanationMarkers.some(function(marker) {
    return value.indexOf(marker) !== -1
  })
  var predictsMind = /(假装|偷偷|反而|觉得你|被反将|压力转移|太老实|收藏|拉黑|翻白眼)/
  if (explainsMethod || predictsMind.test(value)) return '预警：Ta可能会停顿三秒'
  return value.indexOf('预警：') === 0 ? value : '预警：' + value
}

function normalizeResult(raw, fallbackSource, mode) {
  raw = raw || {}
  var safe = raw.safe !== false && !raw.safety_message
  var source = String(raw.source || fallbackSource || '聊天截图').trim()
  if (!safe) {
    return {
      safe: false,
      mode: mode,
      source: source,
      safety_message: raw.safety_message || '对方好像不是在发疯，是真的不太好。这条建议认真回。',
      serious_reply: raw.serious_reply || ''
    }
  }

  var list = raw.replies || raw.candidates || raw.options || []
  if (!Array.isArray(list) && raw.text) list = String(raw.text).split(/\n+/)
  list = (Array.isArray(list) ? list : []).map(function(item) {
    if (typeof item === 'string') {
      return { type: '阅读失败', text: item.trim(), warning: '预警：Ta可能会停顿三秒' }
    }
    item = item || {}
    return {
      type: String(item.type || item.weapon || item.label || '阅读失败').trim(),
      text: String(item.text || item.reply || item.content || '').trim(),
      warning: normalizeWarning(item.warning || item.risk || item.consequence)
    }
  }).filter(function(item) {
    return item.text
  }).slice(0, 3)

  if (list.length !== 3) throw new Error('这批回复没生成完整，请再试一次')
  return { safe: true, mode: mode, source: source, replies: list }
}

function modeFromRelation(relation) {
  return relation === '暧昧对象' || relation === '伴侣' ? 'crush' : 'person'
}

Page({
  data: {
    statusBarHeight: 0,
    step: 'input',
    text: '',
    imgs: [],
    mode: 'person',
    modeHint: '随便乱，后果自负',
    placeholder: PLACEHOLDERS[0],
    hasInput: false,
    submitting: false,
    loadingMsg: LOADING_MESSAGES[0],
    err: '',
    res: null,
    copiedIndex: -1,
    profileId: '',
    profileName: '',
    profileRelation: '',
    ctx: '',
    previousWeapons: []
  },

  _placeholderTimer: null,
  _loadingTimer: null,
  _copyTimer: null,
  _submitting: false,

  onLoad: function(options) {
    options = options || {}
    var profileId = safeDecode(options.profileId)
    var profile = profileId ? ProfileContext.findProfile(profileId) : null
    var relation = profile ? profile.relation : safeDecode(options.profileRelation)
    var mode = options.mode === 'crush' || options.mode === 'person'
      ? options.mode
      : modeFromRelation(relation)
    var text = safeDecode(options.text)
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      text: text,
      hasInput: !!text,
      mode: mode,
      modeHint: mode === 'crush' ? '乱中带甜，点到为止' : '随便乱，后果自负',
      profileId: profileId,
      profileName: profile ? profile.name : safeDecode(options.profileName),
      profileRelation: relation || '',
      ctx: safeDecode(options.ctx)
    })
    this.startPlaceholder()
  },

  onShow: function() {
    if (this.data.step === 'input') this.startPlaceholder()
  },

  onHide: function() {
    this.stopPlaceholder()
  },

  onUnload: function() {
    this.stopPlaceholder()
    this.stopLoading()
    if (this._copyTimer) clearTimeout(this._copyTimer)
  },

  startPlaceholder: function() {
    var self = this
    if (self._placeholderTimer) return
    var index = Math.max(0, PLACEHOLDERS.indexOf(self.data.placeholder))
    self._placeholderTimer = setInterval(function() {
      index = (index + 1) % PLACEHOLDERS.length
      self.setData({ placeholder: PLACEHOLDERS[index] })
    }, 2200)
  },

  stopPlaceholder: function() {
    if (!this._placeholderTimer) return
    clearInterval(this._placeholderTimer)
    this._placeholderTimer = null
  },

  stopLoading: function() {
    if (!this._loadingTimer) return
    clearInterval(this._loadingTimer)
    this._loadingTimer = null
  },

  goBack: function() {
    wx.navigateBack()
  },

  goHomeTab: function(e) {
    var tab = e.currentTarget.dataset.tab || 'tools'
    wx.reLaunch({ url: '/pages/index/index?tab=' + tab })
  },

  onInput: function(e) {
    var text = e.detail.value
    this.setData({ text: text, hasInput: hasInput(text, this.data.imgs) })
  },

  tryExample: function() {
    var text = this.data.placeholder
    this.stopPlaceholder()
    this.setData({ text: text, hasInput: true })
  },

  pickMode: function(e) {
    var mode = e.currentTarget.dataset.mode
    this.setData({
      mode: mode,
      modeHint: mode === 'crush' ? '乱中带甜，点到为止' : '随便乱，后果自负'
    })
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
      success: function(result) {
        var paths = self.data.imgs.map(function(item) {
          return item.originalPath || item.path
        }).concat(result.tempFilePaths)
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
    var index = e.currentTarget.dataset.index
    var urls = this.data.imgs.map(function(item) { return item.path })
    wx.previewImage({ current: urls[index], urls: urls })
  },

  removeImg: function(e) {
    var imgs = this.data.imgs.slice()
    imgs.splice(e.currentTarget.dataset.index, 1)
    this.setData({ imgs: imgs, hasInput: hasInput(this.data.text, imgs) })
  },

  buildMessage: function() {
    var modeLock = this.data.mode === 'crush'
      ? '唯一模式：Crush。必须幽默打底、微量甜，禁止套用“人”模式的攻击和隔离逻辑。'
      : '唯一模式：人。必须火力全开地阅读失败，禁止暧昧、表白和推进关系。'
    var oppositeReplies = Quality.getOppositeReplies(this.data.text, this.data.mode)
    var lines = [
      modeLock,
      this.data.profileName ? '关系档案：' + this.data.profileName + '（' + (this.data.profileRelation || '未知关系') + '）' : '',
      this.data.ctx ? '关系背景：\n' + this.data.ctx : '',
      this.data.text.trim() ? '对方消息原文：\n' + this.data.text.trim() : '请从聊天截图中识别对方最新一条需要回复的消息。',
      '本地路由提示：\n' + Prompt.getRouteHint(this.data.text, this.data.mode),
      this.data.imgs.length ? '请结合所附聊天截图，只生成针对最新消息的回复。' : '',
      this.data.previousWeapons.length ? '上一批已使用武器：' + this.data.previousWeapons.join('、') + '。本批必须换武器。' : '',
      oppositeReplies.length ? '同一句话在另一模式出现过以下回复，本模式禁止复用其句式、包袱和结尾：\n' + oppositeReplies.join('\n') : ''
    ]
    return lines.filter(Boolean).join('\n\n')
  },

  buildRepairMessage: function(result, issues, oppositeReplies) {
    return [
      this.data.mode === 'crush'
        ? '唯一模式：Crush。重新生成时必须体现幽默打底、微量甜，并与 person 模式彻底不同。'
        : '唯一模式：人。重新生成时必须是阅读失败，不能出现任何暧昧或关系推进。',
      '对方消息原文：\n' + result.source,
      this.data.ctx ? '关系背景：\n' + this.data.ctx : '',
      '本地质检判废原因：\n- ' + issues.join('\n- '),
      '首轮草稿如下。没有命中问题的好句必须原样保留；只重写不合格项：\n' + result.replies.map(function(item) {
        return '[' + item.type + '] ' + item.text
      }).join('\n'),
      oppositeReplies.length ? '另一模式已有回复，禁止与它们相似：\n' + oppositeReplies.join('\n') : '',
      '最终仍输出三条。禁止改坏已经合格的句子。'
    ].filter(Boolean).join('\n\n')
  },

  requestResult: function(message, options) {
    var preset = !this.data.imgs.length && !this.data.previousWeapons.length
      ? Prompt.getPreset(this.data.text, this.data.mode)
      : null
    if (preset) return Promise.resolve(preset)
    var prompt = Prompt.getPrompt(this.data.mode, false, this.data.text)
    options.clientMeta = { task: 'misread' }
    return this.data.imgs.length
      ? ChatImages.callAI(prompt, message, this.data.imgs, options)
      : API.callAI(prompt, message, null, null, options)
  },

  reviewResult: function(result, issues) {
    var self = this
    var oppositeReplies = Quality.getOppositeReplies(result.source, self.data.mode)
    self.setData({ loadingMsg: '正在把尬的那句删掉……' })
    return API.callAI(
      Prompt.getReviewPrompt(self.data.mode, result.source),
      self.buildRepairMessage(result, issues, oppositeReplies),
      null,
      null,
      {
        onRetry: function() { self.setData({ loadingMsg: '终审路上拐了个弯……' }) },
        clientMeta: { task: 'misread' }
      }
    ).then(function(raw) {
      var repaired = normalizeResult(raw, result.source, self.data.mode)
      var repairedIssues = Quality.inspect(repaired, self.data.mode, oppositeReplies)
      if (raw && raw.mode && raw.mode !== self.data.mode) repairedIssues.unshift('模型返回了错误模式')
      if (repairedIssues.length) {
        throw new Error('这批回复还是太像普通聊天，已替你拦住，请再试一次')
      }
      return repaired
    })
  },

  submit: function() {
    if (this._submitting || !this.data.hasInput) return
    var self = this
    self._submitting = true
    self.stopPlaceholder()
    self.stopLoading()
    self.setData({
      step: 'loading',
      submitting: true,
      err: '',
      copiedIndex: -1,
      loadingMsg: LOADING_MESSAGES[0]
    })
    var index = 0
    self._loadingTimer = setInterval(function() {
      index = (index + 1) % LOADING_MESSAGES.length
      self.setData({ loadingMsg: LOADING_MESSAGES[index] })
    }, 1200)

    var options = {
      onRetry: function() { self.setData({ loadingMsg: '网络拐了个弯，正在追回来……' }) },
      onStatus: function(message) { self.setData({ loadingMsg: message }) },
      onPrepared: function(imgs) { self.setData({ imgs: imgs }) }
    }
    var message = self.buildMessage()
    var request = self.requestResult(message, options)

    request.then(function(raw) {
      var result = normalizeResult(raw, self.data.text, self.data.mode)
      var recognizedPreset = self.data.imgs.length && !self.data.previousWeapons.length
        ? Prompt.getPreset(result.source, self.data.mode)
        : null
      if (recognizedPreset) result = recognizedPreset
      var oppositeReplies = Quality.getOppositeReplies(result.source, self.data.mode)
      var issues = Quality.inspect(result, self.data.mode, oppositeReplies)
      if (raw && raw.mode && raw.mode !== self.data.mode) issues.unshift('模型返回了错误模式')
      if (!result.safe) return result
      return issues.length ? self.reviewResult(result, issues) : result
    }).then(function(result) {
      var weapons = result.safe ? result.replies.map(function(item) { return item.type }) : []
      if (result.safe) Quality.remember(result.source, self.data.mode, result.replies)
      H.addRecord({
        kind: 'misread',
        kindLabel: '已读乱回',
        title: result.safe ? '给「' + (self.data.mode === 'crush' ? 'Crush' : '人') + '」的乱回' : '建议认真回复',
        summary: result.safe ? result.replies[0].text : result.safety_message,
        input: result.source.slice(0, 120),
        imageCount: self.data.imgs.length,
        mode: self.data.mode,
        profileId: self.data.profileId,
        profileName: self.data.profileName,
        result: result
      })
      self.stopLoading()
      self._submitting = false
      self.setData({
        step: result.safe ? 'result' : 'safety',
        res: result,
        submitting: false,
        previousWeapons: weapons
      })
    }).catch(function(error) {
      self.stopLoading()
      self._submitting = false
      self.setData({
        step: 'input',
        submitting: false,
        err: error.message || '这次没读歪成功，请再试一次'
      })
      self.startPlaceholder()
    })
  },

  copyReply: function(e) {
    var index = e.currentTarget.dataset.index
    var item = this.data.res && this.data.res.replies && this.data.res.replies[index]
    if (!item) return
    var self = this
    wx.setClipboardData({
      data: item.text,
      success: function() {
        self.setData({ copiedIndex: index })
        if (self._copyTimer) clearTimeout(self._copyTimer)
        self._copyTimer = setTimeout(function() {
          self.setData({ copiedIndex: -1 })
        }, 1400)
      }
    })
  },

  refresh: function() {
    this.submit()
  },

  resetInput: function() {
    this._submitting = false
    this.setData({
      step: 'input',
      text: '',
      imgs: [],
      mode: 'person',
      modeHint: '随便乱，后果自负',
      hasInput: false,
      submitting: false,
      err: '',
      res: null,
      copiedIndex: -1,
      profileId: '',
      profileName: '',
      profileRelation: '',
      ctx: ''
    })
    this.startPlaceholder()
  },

  goSeriousReply: function() {
    var source = this.data.res && this.data.res.source || this.data.text
    var task = '对方发来：' + source + '。这条消息可能是真心求助，请生成一条真诚、稳定、不说教的认真回复。'
    var params = [
      'mode=reply',
      'replyTask=' + encodeURIComponent(task),
      this.data.profileId ? 'profileId=' + encodeURIComponent(this.data.profileId) : '',
      this.data.profileName ? 'profileName=' + encodeURIComponent(this.data.profileName) : '',
      this.data.ctx ? 'ctx=' + encodeURIComponent(this.data.ctx) : ''
    ].filter(Boolean).join('&')
    wx.navigateTo({ url: '/pages/check/check?' + params })
  },

  onShareAppMessage: function() {
    return Share.misread(this.data.res && this.data.res.source)
  }
})
