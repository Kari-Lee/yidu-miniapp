var HOME_PATH = '/pages/index/index'

function page(title, path) {
  return {
    title: title,
    path: path || HOME_PATH
  }
}

function home() {
  return page('已读 Yidu：把聊天记录翻译成人话', HOME_PATH)
}

function quiz(label) {
  return page(label ? '我测出了' + label + '。有些话，测试比前任诚实' : '24题测出你的依恋人格，看完别急着嘴硬', '/pages/quiz/quiz')
}

function diagnose() {
  return page('上传聊天记录，看看你们到底在拉扯什么', '/pages/diagnose/diagnose')
}

function translate() {
  return page('Ta这句话到底什么意思？让已读翻译一下', '/pages/translate/translate')
}

function check(verdict) {
  return page(verdict ? '这条消息：' + verdict : '想发的消息，先让已读拦一下', '/pages/check/check')
}

function predict(stage) {
  return page(stage ? '这段关系现在像是：' + stage : '让已读预测一下这段关系走向', '/pages/predict/predict')
}

function misread(source) {
  return page(source ? 'Ta说「' + source.slice(0, 18) + '」？我帮你乱回' : '不知道回什么，就回点好笑的', '/pages/misread/misread')
}

function profiles() {
  return page('给每个Ta建个关系档案，别混着分析', '/pages/profiles/profiles')
}

function weeklyReport(profile, report) {
  var name = profile && profile.name ? profile.name : '这段关系'
  var title = report && report.ready
    ? '我和' + name + '的七日关系趋势：' + report.verdict
    : '我正在记录' + name + '的七日关系趋势'
  var path = profile && profile.id
    ? '/pages/weekly-report/weekly-report?id=' + encodeURIComponent(profile.id)
    : '/pages/profiles/profiles'
  return page(title, path)
}

module.exports = {
  home: home,
  quiz: quiz,
  diagnose: diagnose,
  translate: translate,
  check: check,
  misread: misread,
  predict: predict,
  profiles: profiles,
  weeklyReport: weeklyReport
}
