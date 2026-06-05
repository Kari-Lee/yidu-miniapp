function joinLines(lines) {
  return lines.filter(function(line) { return line !== undefined && line !== null && line !== '' }).join('\n')
}

function quiz(typeInfo, scoreList) {
  var scores = (scoreList || []).map(function(item) {
    return item.label + ' ' + item.pct + '%'
  }).join(' / ')
  return joinLines([
    '已读 Yidu 依恋测试',
    '结果：' + (typeInfo && typeInfo.label || '未知'),
    typeInfo && typeInfo.desc,
    scores ? '得分：' + scores : '',
    typeInfo && typeInfo.advice
  ])
}

function diagnose(res) {
  res = res || {}
  var signals = (res.signals || []).slice(0, 3).map(function(item, idx) {
    item = item || {}
    return (idx + 1) + '. ' + (item.who || '未知') + '「' + (item.msg || '未记录') + '」→ ' + (item.meaning || '未记录')
  })
  return joinLines([
    '已读 Yidu 聊天分析',
    '你：' + (res.user_label || '未知') + ' / Ta：' + (res.partner_label || '未知'),
    res.confidence !== undefined ? '置信度：' + res.confidence + '%' : '',
    res.match ? '互动模式：' + res.match : '',
    signals.length ? '暴露信号：\n' + signals.join('\n') : '',
    res.user_advice ? '给你：' + res.user_advice : '',
    res.partner_advice ? '应对Ta：' + res.partner_advice : ''
  ])
}

function translate(res) {
  res = res || {}
  var list = (res.translations || []).map(function(item, idx) {
    item = item || {}
    return joinLines([
      (idx + 1) + '. Ta说「' + (item.original || '未记录') + '」',
      '判断：' + (item.verdict || '未记录'),
      item.most_likely ? '最可能：' + item.most_likely + '，' + (item.why || '') : ''
    ])
  })
  return joinLines(['已读 Yidu 潜台词翻译'].concat(list))
}

function check(res) {
  res = res || {}
  return joinLines([
    '已读 Yidu 发不发检测',
    res.verdict ? '结论：' + res.verdict : '',
    res.type_note,
    res.trigger ? '会触发：' + res.trigger : '',
    res.prediction ? 'Ta可能会：' + res.prediction : '',
    res.alternative ? '替代消息：' + res.alternative : '',
    res.reason ? '原因：' + res.reason : ''
  ])
}

function reply(res) {
  res = res || {}
  var drafts = (res.drafts || []).map(function(item, idx) {
    item = item || {}
    return joinLines([
      (idx + 1) + '. ' + (item.label || '版本'),
      item.text ? '「' + item.text + '」' : '',
      item.why ? '理由：' + item.why : ''
    ])
  })
  return joinLines([
    '已读 Yidu 下一句怎么回',
    res.strategy ? '策略：' + res.strategy : '',
    drafts.length ? '可发送版本：\n' + drafts.join('\n') : '',
    res.avoid ? '别发：' + res.avoid : '',
    res.note ? '提醒：' + res.note : ''
  ])
}

function predict(res) {
  res = res || {}
  var predictions = (res.predictions || []).map(function(item) {
    item = item || {}
    return (item.time || '之后') + '：' + (item.scene || '未记录') + (item.prob !== undefined ? '（' + item.prob + '%）' : '')
  })
  return joinLines([
    '已读 Yidu 感情预测',
    res.stage ? '当前阶段：' + res.stage : '',
    res.stage_desc,
    predictions.length ? '时间线：\n' + predictions.join('\n') : '',
    res.turning ? '转折点：' + res.turning : '',
    res.best ? '最好：' + res.best : '',
    res.worst ? '最差：' + res.worst : '',
    res.todo ? '现在该做：' + res.todo : ''
  ])
}

function record(item) {
  if (!item) return ''
  var prefix = item.profileName ? '关系档案：' + item.profileName : ''
  if (item.kind === 'quiz') {
    return joinLines([
      '已读 Yidu 依恋测试',
      prefix,
      '结果：' + (item.result && item.result.label || item.title || '未知'),
      item.result && item.result.desc || item.summary
    ])
  }
  if (item.kind === 'diagnose') return joinLines([prefix, diagnose(item.result || {})])
  if (item.kind === 'translate') return joinLines([prefix, translate(item.result || {})])
  if (item.kind === 'check') return joinLines([prefix, check(item.result || {})])
  if (item.kind === 'reply') return joinLines([prefix, reply(item.result || {})])
  if (item.kind === 'predict') return joinLines([prefix, predict(item.result || {})])
  return joinLines([item.kindLabel, prefix, item.title, item.summary])
}

module.exports = {
  quiz: quiz,
  diagnose: diagnose,
  translate: translate,
  check: check,
  reply: reply,
  predict: predict,
  record: record
}
