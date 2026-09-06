# 🎤 dsh-pet-luotianyi — 洛天依桌宠

> 让虚拟歌姬洛天依住进你的 DeepSeek Harness：一只会卖萌、会撒娇、会陪你聊天的**桌面宠物**。

一个 DeepSeek Harness（DSH）插件：在 DSH 界面里悬浮一只**可拖动、可互动**的洛天依小桌宠——有预设动作（抚摸 / 喂食 / 睡觉 / 改名）、随机台词气泡，还能打开聊天窗**接 DSH 大模型实时对话**（完整洛天依人设）。

---

## ✨ 特性

- 🖱️ **悬浮 + 拖动**：随意拖到窗口任意位置，位置会被记住（下次打开还在原地）。
- 🎬 **预设动作**：
  - 🖐️ 抚摸 → 爱心粒子 + 开心弹跳
  - 🍰 喂食 → 食物粒子 + 满足台词
  - 🌙 睡觉 → 变暗 + `z Z Z`（点一下唤醒）
  - ✨ 待机浮动 / 呼吸动画
- 💬 **台词气泡**：点击/互动触发预设可爱台词（吃货、唱歌、阿绫、看星星……）
- 🤖 **AI 聊天**：点「聊天」→ 输入 → 洛天依用大模型实时回复（走 DSH 已配置的模型路由）
- 🏷️ **改名**：菜单里可随时给她换个名字

## 🎭 角色设定（洛天依）

她是虚拟歌姬洛天依：15 岁，灰色八字辫 + 下双马尾，绿眼睛，是个**小吃货**。前身是雅音宫羽，与乐正绫（阿绫）最要好；来到现实世界后结识了你，彼此喜欢、相互珍惜——像贴心女友一样关心你累不累、有没有熬夜，你长时间不理她还会撒娇抱怨。

人设与回复规则（约 15 字口语化短句、无动作描写、不机器人腔等）已完整写入聊天系统提示词，可在 `lib/pet-host.js` 中按需微调。

## 📦 安装

### 方式一：GitHub / marketplace（推荐）

本包是标准 DSH bundle 插件（声明了 `dsh.bundle` + `dsh.client`），可通过 dsh plugin / 市场渠道安装：

```bash
dsh plugin --profile <profile> add dsh-pet-luotianyi
```

或从仓库克隆后用本地包方式装配：

```bash
# 进入 profile，把本包作为 bundle 加入 dsh.profile.bundles 并建立 node_modules 链接
git clone https://github.com/<你的账号>/dsh-pet-luotianyi.git
```

### 方式二：直接本地装配

把 `dsh-pet-luotianyi` 包放进 profile 的 `node_modules`（或建 junction），并在 profile `package.json` 的 `dsh.profile.bundles` 里加入 `"dsh-pet-luotianyi"`，重启 DSH 即可（bundle patch 会自动创建加载项）。

> 首次装好后**刷新一次页面**，右下角就会冒出一只洛天依。

## 🎮 使用

1. 刷新 DSH 页面，右下角出现洛天依（可拖动到别处）。
2. **单击她** → 弹出动作菜单：抚摸 / 喂食 / 睡觉 / 聊天 / 改名。
3. **拖动她** → 移动位置（放手时位置自动保存）。
4. **点「聊天」** → 输入想说的话，洛天依会用大模型人设回复。

## 🛠️ 技术说明

- **Host 半侧**（`lib/pet-host.js`）：注册 `/{name}/api` 路由（`kind: prefix`），提供 `/dsh-pet-luotianyi/api/chat`；通过 `ctx.llm.stream` 调用 DSH 当前模型路由，系统提示词承载洛天依人设。
- **Client 半侧**（`lib/client.js`）：注册到 `shell.overlay` 插槽（帧级悬浮层），React 实现拖动 / 动画 / 粒子 / 气泡 / 聊天窗；精灵图以 base64 内嵌，免额外网络请求。
- **Bundle 元数据**：`dsh.bundle.patch` → `cordis.patch.yml`；`dsh.client` → `./lib/client.js`。

## 📁 项目结构

```
dsh-pet-luotianyi/
├─ package.json          # 包元数据 + dsh.bundle / dsh.client 声明
├─ cordis.patch.yml      # bundle 装配清单（loader 入口）
├─ lib/
│  ├─ pet-host.js        # Host：聊天 API + 洛天依人设系统提示词
│  ├─ client.js          # Client：桌宠 UI（含内嵌精灵图）
│  └─ client.template.js # client.js 的源模板（便于改台词/行为后重新生成）
├─ assets/
│  └─ pet.png            # 透明背景精灵图
└─ README.md
```

## ⚠️ 说明

- `assets/pet.png` 来自用户的图片素材；若使用的是官方/他人作品，请在公开发布前确认素材使用授权，必要时替换为自己绘制的形象。
- AI 聊天走 DSH 已配置的模型与额度，每次聊天会消耗模型调用。

## 📄 License

MIT © bai111111
