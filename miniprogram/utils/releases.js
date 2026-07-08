var SEEN_KEY = 'yidu_seen_release_v1'

// 每次发布功能更新时，把新版本放在数组最前面并更换 id。
var RELEASES = [
  {
    id: '2026-07-08-trend-diary',
    date: '2026.07.08',
    kicker: 'YIDU UPDATE · 07.08',
    title: '关系周报改成每日趋势记录了。',
    summary: '每天记录一次互动，满 7 天生成七日周报；同时开始累计 30 日月报，还能看到关系温度曲线。',
    items: [
      '七日周报按记录天数生成',
      '新增 7 天关系温度曲线',
      '新增 30 日月报长期进度'
    ],
    actionLabel: '去看关系趋势',
    actionUrl: '/pages/profiles/profiles'
  },
  {
    id: '2026-07-08-weekly-next-plan',
    date: '2026.07.08',
    kicker: 'YIDU UPDATE · 07.08',
    title: '周报现在会告诉你下一步干嘛。',
    summary: '七日关系报告不只给结论，会根据这周的记录推荐下一次该补截图、翻译回复，还是先过发不发。',
    items: [
      '周报页新增下一步建议卡',
      '建议会根据已发、没发、回应强弱动态变化',
      '点击建议可直接回到同一个 Ta 的分析流程'
    ],
    actionLabel: '去看周报',
    actionUrl: '/pages/profiles/profiles'
  },
  {
    id: '2026-07-07-profile-followup',
    date: '2026.07.07',
    kicker: 'YIDU UPDATE · 07.07',
    title: '进档案也能补后续了。',
    summary: '打开某个关系档案，如果有已发但没记录回应的消息，可以直接标记 Ta 后来回没回。',
    items: [
      '关系档案详情页新增追问卡',
      '可直接标记：回了、没回、很敷衍',
      '反馈会同步进入七日周报'
    ],
    actionLabel: '去看关系档案',
    actionUrl: '/pages/profiles/profiles'
  },
  {
    id: '2026-07-07-profile-status',
    date: '2026.07.07',
    kicker: 'YIDU UPDATE · 07.07',
    title: '每个关系档案现在会自己亮状态。',
    summary: '档案列表会直接告诉你：谁该补反馈、谁的周报已生成、谁还差几条记录。',
    items: [
      '关系档案列表新增状态条',
      '优先提醒等待反馈的已发消息',
      '可直接看到周报进度和生成状态'
    ],
    actionLabel: '去看关系档案',
    actionUrl: '/pages/profiles/profiles'
  },
  {
    id: '2026-07-07-followup-todo',
    date: '2026.07.07',
    kicker: 'YIDU UPDATE · 07.07',
    title: '发出去之后，别忘了补后续。',
    summary: '首页关系页新增追问待办。你标记“已发”后，可以回来补 Ta 有没有回应。',
    items: [
      '已发但没记录回应时，首页会出现追问待办',
      '可直接标记：回了、没回、很敷衍',
      '反馈会进入关系档案和七日周报'
    ],
    actionLabel: '去看关系页',
    actionUrl: '/pages/index/index?tab=relation'
  },
  {
    id: '2026-07-07-weekly-retention',
    date: '2026.07.07',
    kicker: 'YIDU UPDATE · 07.07',
    title: '这次会提醒你回来补材料。',
    summary: '关系页新增周报进度卡，记录满 7 天后会提示周报已生成，也能保存周报分享图。',
    items: [
      '首页关系页新增七日周报进度卡',
      '记录满 7 天后自动提示周报已生成',
      '周报页新增保存分享图，只展示结论不展示聊天'
    ],
    actionLabel: '去看关系页',
    actionUrl: '/pages/index/index?tab=relation'
  },
  {
    id: '2026-07-04-weekly-report',
    date: '2026.07.04',
    kicker: 'YIDU UPDATE · 07.04',
    title: '关系档案开始写周报了。',
    summary: '同一个 Ta 的分析会汇总成七日关系报告，看趋势，不只看一句话。',
    items: [
      '关系档案新增七日关系周报',
      '记录满 7 天后生成阶段结论、行动反馈和下周建议',
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
