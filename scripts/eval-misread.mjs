import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Prompt = require("../miniprogram/utils/misreadPrompt");
const Quality = require("../miniprogram/utils/misreadQuality");

global.wx = {
  getStorageSync() { return []; },
  setStorageSync() {},
};

const API_URL = process.env.MISREAD_API_URL || "https://www.yidu.click/api/chat";
const requested = new Set(process.argv.slice(2));
const cases = [
  { id: "reference", mode: "person", source: "怎么办\n我喜欢上你了" },
  { id: "oil", mode: "person", source: "炒粉干被油溅到了" },
  { id: "best", mode: "person", source: "我是世界上最厉害的人" },
  { id: "overthink", mode: "person", source: "你就是想太多" },
  { id: "care", mode: "person", source: "我好心疼你" },
  { id: "weather", mode: "person", source: "今天天气不错" },
  { id: "quote", mode: "person", source: "不要花那么多时间难过，要花更多时间快乐" },
  { id: "control", mode: "person", source: "我要控制你" },
  { id: "hard-mouth", mode: "person", source: "我就是嘴硬" },
  { id: "crush-joke", mode: "crush", source: "你喜欢我啊" },
  { id: "crush-test", mode: "crush", source: "你想我吗" },
  { id: "crush-jealous", mode: "crush", source: "跟哪个女的约会去了" },
  { id: "crush-live-line", mode: "crush", source: "什么猪头都有对象，很多女的真的不挑" },
  { id: "crush-marriage", mode: "crush", source: "看得我也想结婚了" },
  { id: "crush-confession", mode: "crush", source: "怎么办\n我喜欢上你了" },
];

function parseResponse(value) {
  if (typeof value !== "string") return value;
  let raw = value.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (raw.includes("<think>")) raw = raw.slice(0, raw.indexOf("<think>")).trim();
  raw = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(raw);
  return parsed && parsed.text ? parseResponse(parsed.text) : parsed;
}

function modeLock(mode) {
  return mode === "crush"
    ? "唯一模式：Crush。幽默打底、微量甜，禁止套用人模式。"
    : "唯一模式：人。火力全开地阅读失败，禁止暧昧和关系推进。";
}

async function callAI(testCase) {
  const message = [
    modeLock(testCase.mode),
    `对方消息原文：\n${testCase.source}`,
    `本地路由提示：\n${Prompt.getRouteHint(testCase.source, testCase.mode)}`,
  ].join("\n\n");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: Prompt.getPrompt(testCase.mode, false, testCase.source),
      message,
      clientMeta: { task: "misread" },
    }),
    signal: AbortSignal.timeout(115000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return parseResponse(text);
}

const selected = requested.size ? cases.filter((item) => requested.has(item.id)) : cases;
for (const [index, testCase] of selected.entries()) {
  try {
    const variant = index + 1;
    const preset = Prompt.getPreset(testCase.source, testCase.mode, variant);
    const initial = preset || await callAI(testCase);
    const initialIssues = Quality.inspect(initial, testCase.mode, []);
    const result = initialIssues.length
      ? Prompt.getFallback(initial.source, testCase.mode, variant)
      : initial;
    const issues = Quality.inspect(result, testCase.mode, []);
    process.stdout.write(`${JSON.stringify({
      ...testCase,
      initial,
      initialIssues,
      result,
      issues,
    })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ...testCase, error: error.message })}\n`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1400));
}
