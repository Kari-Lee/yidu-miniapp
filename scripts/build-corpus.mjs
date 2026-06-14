/**
 * 已读乱回 · 离线语料生成器
 *
 * 吃一个场景模板列表 → 批量生成候选 → 跑本地 inspect 质检 →
 * 按回复去重累积 → 输出一份可入库的语料 JSON。
 *
 * 用法：
 *   node scripts/build-corpus.mjs                 # 线上 API 批量生成（要网、要钱）
 *   node scripts/build-corpus.mjs --offline       # 只收割 preset/fallback（免费、零网络，用于播种/验证）
 *   node scripts/build-corpus.mjs boast flat       # 只跑指定场景 id
 *
 * 环境变量：
 *   MISREAD_OFFLINE=1            等价于 --offline
 *   MISREAD_ROUNDS=3            每个场景调用模型的轮数（API 模式）
 *   MISREAD_CORPUS_OUT=路径     语料输出文件（默认 corpus/misread-corpus.json）
 *   MISREAD_API_URL=...        生成接口（默认 https://www.yidu.click/api/chat）
 *
 * 注意：本脚本是「离线」指它不在用户请求时跑、把昂贵的生成挪到线下；
 * API 模式仍然会调用大模型并产生费用。只读消费现有接口，不改动任何线上代码。
 */

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Prompt = require("../miniprogram/utils/misreadPrompt");
const Quality = require("../miniprogram/utils/misreadQuality");

global.wx = {
  getStorageSync() { return []; },
  setStorageSync() {},
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const OFFLINE = process.env.MISREAD_OFFLINE === "1" || args.includes("--offline");
const ROUNDS = Number(process.env.MISREAD_ROUNDS || 3);
const API_URL = process.env.MISREAD_API_URL || "https://www.yidu.click/api/chat";
const OUT = resolve(ROOT, process.env.MISREAD_CORPUS_OUT || "corpus/misread-corpus.json");
const REJECTS = resolve(ROOT, "corpus/misread-rejects.jsonl");
const scenarioFilter = new Set(args.filter((a) => !a.startsWith("--")));

// ── 场景模板列表（随手往里加，这就是语料库的「题型蓝图」）──────────────
const SCENARIOS = [
  // 表白 / 心动推进
  { id: "confession", mode: "person", source: "怎么办\n我喜欢上你了" },
  { id: "crush-confession", mode: "crush", source: "怎么办\n我喜欢上你了" },
  { id: "crush-joke", mode: "crush", source: "你喜欢我啊" },
  { id: "crush-test", mode: "crush", source: "你想我吗" },
  { id: "crush-jealous", mode: "crush", source: "跟哪个女的约会去了" },
  { id: "crush-ignore", mode: "crush", source: "你怎么不回我消息" },
  { id: "crush-live-line", mode: "crush", source: "什么猪头都有对象，很多女的真的不挑" },
  { id: "crush-marriage", mode: "crush", source: "看得我也想结婚了" },
  { id: "crush-care", mode: "crush", source: "记得吃饭，别老熬夜" },
  // 吹牛 / 凡尔赛 / 清醒人设
  { id: "best", mode: "person", source: "我是世界上最厉害的人" },
  { id: "smartest", mode: "person", source: "我这个人吧，就是看得比较透" },
  { id: "humble-brag", mode: "person", source: "唉，长得好看也是一种烦恼" },
  { id: "awake", mode: "person", source: "我早就看清这个世界了" },
  // 嘴硬 / 损友互呛
  { id: "hard-mouth", mode: "person", source: "我就是嘴硬怎么了" },
  { id: "overthink", mode: "person", source: "你就是想太多" },
  { id: "grudge", mode: "person", source: "这事我记你一辈子" },
  { id: "whatever", mode: "person", source: "随便你吧，我无所谓" },
  { id: "suspicious", mode: "person", source: "你是不是有什么事瞒着我" },
  // 情绪 / 抱怨 / 求安慰
  { id: "care", mode: "person", source: "我好心疼你" },
  { id: "tired", mode: "person", source: "我今天真的好累" },
  { id: "sad", mode: "person", source: "我感觉我最近什么都做不好" },
  { id: "complain", mode: "person", source: "我老板又给我加活了，烦死了" },
  { id: "lonely", mode: "person", source: "怎么感觉大家都有人陪，就我一个人" },
  // 鸡汤 / 大道理
  { id: "quote", mode: "person", source: "不要花那么多时间难过，要花更多时间快乐" },
  { id: "preachy", mode: "person", source: "人还是要靠自己，谁都指望不上" },
  // 控制 / 作 / 整活
  { id: "control", mode: "person", source: "我要控制你" },
  { id: "report", mode: "person", source: "以后你去哪都要跟我报备" },
  { id: "already-joking", mode: "person", source: "我宣布我是秦始皇" },
  { id: "crazy", mode: "person", source: "啊啊啊我要发疯了" },
  // 日常小破事
  { id: "oil", mode: "person", source: "炒粉干被油溅到了" },
  { id: "spilled", mode: "person", source: "刚买的奶茶洒了一半" },
  { id: "stuck", mode: "person", source: "堵车堵得我想下车走" },
  { id: "sleepy", mode: "person", source: "困死了但是还得上班" },
  // 零把手 / 问候
  { id: "weather", mode: "person", source: "今天天气不错" },
  { id: "you-there", mode: "person", source: "在吗" },
  { id: "good-night", mode: "person", source: "晚安" },
  { id: "ate", mode: "person", source: "吃饭了吗" },
  { id: "what-doing", mode: "person", source: "在干嘛呢" },
  // 关系试探 / 冷淡
  { id: "fading", mode: "person", source: "我感觉我们最近有点淡了" },
  { id: "miss-test", mode: "person", source: "你想我吗" },
  { id: "late-reply", mode: "person", source: "回晚安倒是快，别的不理我" },
];

// ── 工具 ─────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

async function generateViaModel(testCase) {
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
      clientMeta: { task: "misread-corpus" },
    }),
    signal: AbortSignal.timeout(115000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 160)}`);
  return parseResponse(text);
}

function compactKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：""''（）《》【】,.!?;:'"()\[\]{}<>~`·…—_-]/g, "");
}

function entryId(mode, reply) {
  const value = mode + ":" + compactKey(reply);
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = (((hash << 5) + hash) ^ value.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function entriesFrom(testCase, result) {
  if (!result || result.safe === false || !Array.isArray(result.replies)) return [];
  const source = result.source || testCase.source;
  const route = Prompt.getRoute(source, testCase.mode);
  return result.replies
    .map((r) => {
      const reply = String((r && r.text) || "").trim();
      if (!reply) return null;
      return {
        id: entryId(testCase.mode, reply),
        scenario: testCase.id,
        route,
        mode: testCase.mode,
        source,
        weapon: String((r && r.type) || "").trim(),
        reply,
        warning: String((r && r.warning) || "").trim(),
        length: reply.length,
        origin: "offline-gen",
        inspectClean: true,
        // score / 排序最终靠真实复制率（copiedCount），现在是占位
        copiedCount: 0,
        servedCount: 0,
      };
    })
    .filter(Boolean);
}

function loadCorpus() {
  const map = new Map();
  if (existsSync(OUT)) {
    try {
      const arr = JSON.parse(readFileSync(OUT, "utf8"));
      if (Array.isArray(arr)) arr.forEach((e) => e && e.id && map.set(e.id, e));
    } catch (e) {
      console.warn("⚠️  已有语料文件解析失败，将重建：", e.message);
    }
  }
  return map;
}

function saveCorpus(map) {
  const arr = Array.from(map.values()).sort((a, b) => {
    if (a.mode !== b.mode) return a.mode < b.mode ? -1 : 1;
    if (a.scenario !== b.scenario) return a.scenario < b.scenario ? -1 : 1;
    return a.length - b.length;
  });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(arr, null, 2) + "\n");
  return arr.length;
}

function logReject(testCase, result, issues) {
  mkdirSync(dirname(REJECTS), { recursive: true });
  appendFileSync(
    REJECTS,
    JSON.stringify({ scenario: testCase.id, mode: testCase.mode, issues, result }) + "\n"
  );
}

// ── 主流程 ───────────────────────────────────────────────────────────
async function main() {
  const corpus = loadCorpus();
  const before = corpus.size;
  let harvested = 0;
  let rejected = 0;

  function ingest(entries) {
    for (const e of entries) {
      const existing = corpus.get(e.id);
      if (existing) {
        existing.harvestCount = (existing.harvestCount || 1) + 1;
      } else {
        e.harvestCount = 1;
        corpus.set(e.id, e);
        harvested++;
      }
    }
  }

  const selected = scenarioFilter.size
    ? SCENARIOS.filter((s) => scenarioFilter.has(s.id))
    : SCENARIOS;

  console.log(
    `模式：${OFFLINE ? "offline（preset/fallback 收割，免费）" : `API（每场景 ${ROUNDS} 轮，调用 ${API_URL}）`}`
  );
  console.log(`场景数：${selected.length}　已有语料：${before} 条\n`);

  for (const sc of selected) {
    const variants = OFFLINE ? Math.max(ROUNDS, 5) : 1;
    let scNew = 0;

    // 第 0 步：收割 preset（免费、人工校准的金句）
    for (let v = 1; v <= variants; v++) {
      const preset = Prompt.getPreset(sc.source, sc.mode, v);
      const result = preset || (OFFLINE ? Prompt.getFallback(sc.source, sc.mode, v) : null);
      if (!result) break; // API 模式且无 preset → 交给下面的模型生成
      const issues = Quality.inspect(result, sc.mode, []);
      if (issues.length) { rejected++; logReject(sc, result, issues); continue; }
      const sizeBefore = corpus.size;
      ingest(entriesFrom(sc, result));
      scNew += corpus.size - sizeBefore;
      if (preset && !OFFLINE) break; // API 模式只取一份 preset，其余靠模型补多样性
    }

    // API 模式：再向模型要若干轮新鲜变体
    if (!OFFLINE) {
      for (let v = 1; v <= ROUNDS; v++) {
        try {
          const result = await generateViaModel(sc);
          const issues = Quality.inspect(result, sc.mode, []);
          if (issues.length) { rejected++; logReject(sc, result, issues); }
          else {
            const sizeBefore = corpus.size;
            ingest(entriesFrom(sc, result));
            scNew += corpus.size - sizeBefore;
          }
        } catch (e) {
          rejected++;
          logReject(sc, { error: e.message }, ["request-error"]);
        }
        await sleep(1400);
      }
    }

    console.log(`  ${sc.id.padEnd(18)} +${scNew}`);
  }

  const total = saveCorpus(corpus);
  console.log(`\n✅ 完成。新增 ${harvested} 条，丢弃 ${rejected} 条，语料库共 ${total} 条 → ${OUT}`);
  if (rejected) console.log(`   被丢弃的批次见 ${REJECTS}`);
}

main();
