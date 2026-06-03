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
  var signals = (res.signals || []).slice(0, 3).map(function(item, idx) {
    return (idx + 1) + '. ' + item.who + '「' + item.msg + '」→ ' + item.meaning
  })
  return joinLines([
    '已读 Yidu 聊天分析',
    '你：' + res.user_label + ' / Ta：' + res.partner_label,
    '置信度：' + res.confidence + '%',
    '互动模式：' + res.match,
    signals.length ? '暴露信号：\n' + signals.join('\n') : '',
    '给你：' + res.user_advice,
    '应对Ta：' + res.partner_advice
  ])
}

function translate(res) {
  var list = (res.translations || []).map(function(item, idx) {
    return joinLines([
      (idx + 1) + '. Ta说「' + item.original + '」',
      '判断：' + item.verdict,
      '最可能：' + item.most_likely + '，' + item.why
    ])
  })
  return joinLines(['已读 Yidu 潜台词翻译'].concat(list))
}

function check(res) {
  return joinLines([
    '已读 Yidu 发不发检测',
    '结论：' + res.verdict,
    res.type_note,
    '会触发：' + res.trigger,
    'Ta可能会：' + res.prediction,
    '替代消息：' + res.alternative,
    '原因：' + res.reason
  ])
}

function predict(res) {
  var predictions = (res.predictions || []).map(function(item) {
    return item.time + '：' + item.scene + '（' + item.prob + '%）'
  })
  return joinLines([
    '已读 Yidu 感情预测',
    '当前阶段：' + res.stage,
    res.stage_desc,
    predictions.length ? '时间线：\n' + predictions.join('\n') : '',
    '转折点：' + res.turning,
    '最好：' + res.best,
    '最差：' + res.worst,
    '现在该做：' + res.todo
  ])
}

module.exports = {
  quiz: quiz,
  diagnose: diagnose,
  translate: translate,
  check: check,
  predict: predict
}
