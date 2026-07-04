var SEEN_KEY = 'yidu_seen_release_v1'

// 每次发布功能更新时，把新版本放在数组最前面并更换 id。
var RELEASES = [
  {
    id: '2026-07-04-weekly-report',
    date: '2026.07.04',
    kicker: 'YIDU UPDATE · 07.04',
    title: '关系档案开始写周报了。',
    summary: '同一个 Ta 的分析会汇总成七日关系报告，看趋势，不只看一句话。',
    items: [
      '关系档案新增七日关系周报',
      '满 3 条记录后生成阶段结论、行动反馈和下周建议',
      '周报支持分享，只分享结论，不带聊天内容'
    ],
    actionLabel: '去看关系档案',
    actionUrl: '/pages/profiles/profiles'
  },
  {
    id: '2026-06-15-misread-repeat',
    date: '2026.06.15',
    kicker: 'YIDU UPDATE · 06.15',
    title: '这次不是换皮，是少复读。',
    summary: '已读乱回现在更会换脑回路，不会换句话又端上同一盘。',
    items: [
      '不同问题会主动避开近期用过的回复',
      '扩充抽象通知、低调凡尔赛和说明书文案',
      '连续换一批时，也会避开相同句式和包袱'
    ],
    actionLabel: '去试试',
    actionUrl: '/pages/misread/misread'
  }
]

function getLatest() {
  return RELEASES.length ? RELEASES[0] : null
}

function getAll() {
  return RELEASES.slice()
}

function getSeenId() {
  try {
    return String(wx.getStorageSync(SEEN_KEY) || '')
  } catch (e) {
    return ''
  }
}

function shouldShowLatest() {
  var latest = getLatest()
  return !!(latest && latest.id !== getSeenId())
}

function markSeen(id) {
  if (!id) return
  try { wx.setStorageSync(SEEN_KEY, id) } catch (e) {}
}

module.exports = {
  getLatest: getLatest,
  getAll: getAll,
  shouldShowLatest: shouldShowLatest,
  markSeen: markSeen
}
