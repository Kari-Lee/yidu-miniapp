import { createRequire } from "node:module";

global.wx = {
  getStorageSync() {
    return [];
  },
  setStorageSync() {},
};

const require = createRequire(import.meta.url);
const Prompt = require("../miniprogram/utils/misreadPrompt");
const Quality = require("../miniprogram/utils/misreadQuality");

const cases = [
  { mode: "person", source: "怎么办\n我喜欢上你了" },
  { mode: "person", source: "炒粉干被油溅到了" },
  { mode: "person", source: "我是世界上最厉害的人" },
  { mode: "person", source: "你就是想太多" },
  { mode: "person", source: "我就是嘴硬" },
  { mode: "person", source: "在吗" },
  { mode: "crush", source: "你喜欢我啊" },
  { mode: "crush", source: "你想我吗" },
  { mode: "crush", source: "跟哪个女的约会去了" },
  { mode: "crush", source: "看得我也想结婚了" },
];

function assertClean(result, mode, label, recent = []) {
  const issues = Quality.inspect(result, mode, [], recent);
  if (issues.length) {
    throw new Error(`${label}: ${issues.join("；")}`);
  }
}

cases.forEach((item, index) => {
  const result =
    Prompt.getPreset(item.source, item.mode, index + 1, []) ||
    Prompt.getFallback(item.source, item.mode, index + 1, []);
  assertClean(result, item.mode, `${item.mode}:${item.source}`);
});

const first = Prompt.getFallback("你好", "person", 7, []);
const recent = first.replies.map((item) => ({
  mode: "person",
  weapon: item.type,
  text: item.text,
}));
const repeatedResult = {
  safe: true,
  mode: "person",
  source: "你好",
  replies: [
    first.replies[0],
    { type: "无关通知", text: "取件通知：您的包裹已到驿站，请凭取件码于今晚九点前领取。生鲜、冷藏及超长件不提供隔夜保管。", warning: "预警：可能收到一个问号" },
    { type: "低调凡尔赛", text: "刚买的鸡蛋是30枚装，送到以后发现有31枚。我已经数了三遍，目前不准备声张。", warning: "预警：可能让对话安静三秒" },
  ],
};
const duplicateIssues = Quality.inspect(repeatedResult, "person", [], recent);
if (!duplicateIssues.includes("与最近同模式回答过于相似")) {
  throw new Error("recent duplicate was not detected");
}

const second = Prompt.getFallback("你好", "person", 7, recent);
assertClean(second, "person", "person fallback avoids recent replies", recent);

process.stdout.write("misread local checks passed\n");
