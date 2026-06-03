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
  return page(label ? '我测出是' + label + '，你也来试试' : '3分钟测出你的依恋类型', '/pages/quiz/quiz')
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

function profiles() {
  return page('给每个Ta建个关系档案，别混着分析', '/pages/profiles/profiles')
}

module.exports = {
  home: home,
  quiz: quiz,
  diagnose: diagnose,
  translate: translate,
  check: check,
  predict: predict,
  profiles: profiles
}
