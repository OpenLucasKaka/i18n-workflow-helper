# 别再让 i18n 拖垮开发效率了：我做了一个真正服务开发流程的 VS Code 插件

做过国际化的前端团队，基本都踩过同一批坑。

不是不会接 i18n，而是这件事一旦进入日常开发，体验往往会迅速变差：

- 页面赶着上线，代码里先塞中文，想着“回头再提”
- 文案要抽 key，得手改代码、手改 locale、再补其他语言文件
- 项目越做越久，硬编码越来越多，没人知道哪里没提干净
- 某个 key 在代码里用了，locale 里没配，线上才炸
- 多语言文件长期漂移，`en.json`、`zh-CN.json`、`ja.json` 结构越走越散
- 外部同学给了一份翻译 JSON，不敢直接覆盖，只能人肉比对

真正折磨开发者的，从来不是“我知不知道什么是国际化”，而是：

**i18n 这套流程太碎、太手工、太容易漏。**

所以我做了一个开源项目：[I18n Workflow Helper](https://github.com/OpenLucasKaka/i18n-workflow-helper)。

它不是翻译平台，也不是大而全的 i18n framework。  
它专门解决一件事：

**把开发者每天最烦的 i18n 脏活、重复活，尽量压缩到 VS Code 里一次完成。**

## 开发者在 i18n 上，真正痛的是什么

很多工具都在强调“支持多语言”，但开发现场的问题通常不是“能不能做”，而是“做起来到底有多烦”。

### 1. 抽一段文案，要改三四个地方

你看到一段：

```tsx
<button>立即支付</button>
```

正常流程通常是：

1. 想一个 key
2. 把代码改成 `t('checkout.payNow')`
3. 去默认语言文件补 value
4. 去其他语言文件补空结构或者占位
5. 确认有没有写错路径、写错层级、写错文件名

这种操作做一次不难，但一周做几十次，就是纯消耗。

### 2. 项目做久了，没人知道哪里还埋着硬编码

最常见的情况不是“团队不重视国际化”，而是：

- 紧急需求先上
- 新同学没形成习惯
- Review 只盯业务逻辑，没精力逐行扫文案

最后就变成：

**仓库里明明接了 i18n，但硬编码还是遍地开花。**

### 3. locale 文件越来越乱，缺 key、废 key、结构漂移同时存在

随着版本迭代，locale 文件常见三种问题会一起出现：

- 代码里引用了 key，但默认语言里没有
- 默认语言里有 key，但代码里已经没人用了
- 非默认语言和默认语言结构不一致

这些问题最烦的点在于，它们平时不一定报错，但会持续制造隐性成本。

### 4. 外部翻译内容导入时，开发者最怕“误覆盖”

翻译同学、运营、外包或者别的系统经常会给你一份 JSON。  
你最想知道的不是“能不能导入”，而是：

- 哪些 key 是新增的
- 哪些 value 被改了
- 会不会把现有内容直接冲掉

如果没有 diff 预览，导入就是一种赌博。

## I18n Workflow Helper 提供了什么

这个插件的思路很简单：

**不重新发明 i18n 运行时，只把开发阶段最烦的流程打通。**

它当前主要面向：

- JavaScript
- TypeScript
- React
- Vue

支持的核心能力包括：

### 1. 选中文案，直接提取成 i18n key

你在代码里选中一段文案后，可以直接执行：

`i18n: Extract Selected Text`

插件会做几件事：

- 把选中文案替换成 `t('key')`
- 自动写入默认语言的 locale value
- 给其他语言文件同步补齐空结构
- key 已存在且 value 不同，会先提示你冲突

对开发者来说，这意味着“抽文案”不再是一次多文件手工操作。
5
### 2. 扫描整个工作区，把 i18n 问题直接揪出来

执行：

`i18n: Scan Workspace`

插件会扫描出这些问题：

- hardcoded text
- missing locale key
- unused key
- locale mismatch

而且结果会直接展示在 VS Code Explorer 里，不用来回切终端和编辑器。

这件事很重要，因为它把“靠人记得查”变成了“工具主动给你抓”。

### 3. 导入 locale 文件前先看 diff，再决定要不要应用

这是我很看重的一点。

执行：

`i18n: Import Locale JSON File`

插件不会直接把文件写进去，而是先生成导入预览，告诉你：

- 哪些 key 是 `added`
- 哪些 key 是 `updated`
- 最终文件会变成什么样

确认后再 `Apply Import`，不满意就 `Discard Preview`。

相比“直接覆盖”，这更符合真实团队协作场景。

### 4. 在 VS Code 里直接管理 locale 目录和语言文件

插件支持：

- 设置默认语言
- 设置 locale 目录
- 导出单语言或全部语言 JSON
- 在 Explorer 中查看 locale 文件和 key 数量

也就是说，它不只是一个“提取按钮”，而是一套更完整的 i18n workflow 辅助工具。

## 它和别的工具相比，优势在哪里

我不想把它包装成“万能国际化方案”，它的优势其实很明确：

### 1. 它解决的是开发流程，不是概念层功能

很多方案关注 runtime、翻译平台、词条管理平台。  
这些当然重要，但开发者每天最先碰到的痛点往往是：

- 文案怎么快速抽出来
- 哪些地方漏了
- locale 文件怎么安全同步

I18n Workflow Helper 直接对准这几个动作。

### 2. 它把多个分散动作，压缩到编辑器内闭环

以前你要在：

- 代码文件
- locale 文件
- diff 工具
- 终端脚本

之间来回切。

现在大部分日常动作可以在 VS Code 内完成，这就是效率差距。

### 3. 它对现有项目更友好，不要求你重建技术栈

这个插件不是要求你换 i18n framework。  
它默认围绕 `t('key')` 这种常见调用方式工作，更适合已经在跑的项目逐步接入。

如果你的项目已经有 locale 目录和语言文件，也可以直接配置后使用。

### 4. 它优先处理“出错前的预防”

真正贵的不是修一个 key，而是：

- 漏提导致线上展示错误
- 导入覆盖导致内容回退
- 多语言结构漂移导致后续维护成本爆炸

扫描、结构同步、导入 diff 预览，本质上都在做这件事：

**把问题拦在提交前，而不是等事故出现。**

## 简单用法：3 分钟跑起来

### 1. 安装

当前可以直接安装 VSIX：

```bash
code --install-extension i18n-workflow-helper-0.1.3.vsix
```

### 2. 配置

在 VS Code 里配置：

```json
{
  "i18nWorkflow.localeDir": "src/locales",
  "i18nWorkflow.defaultLanguage": "en",
  "i18nWorkflow.languages": ["en", "zh-CN"],
  "i18nWorkflow.functionName": "t",
  "i18nWorkflow.include": [
    "src/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,vue}",
    "app/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,vue}",
    "pages/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,vue}",
    "components/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,vue}"
  ],
  "i18nWorkflow.exclude": ["**/node_modules/**", "**/dist/**"]
}
```

推荐先执行两个命令：

- `i18n: Set Default Language`
- `i18n: Set Locale Directory`

### 3. 日常工作流

最常用的动作其实就四个：

1. 选中文案，执行 `i18n: Extract Selected Text`
2. 写完需求后，执行 `i18n: Scan Workspace`
3. 收到翻译 JSON，执行 `i18n: Import Locale JSON File`
4. 确认 diff 没问题后，执行 `i18n: Apply Pending Import`

如果你在代码里看到硬编码，也可以直接用 Quick Fix：

- 点击灯泡
- 或按 `Cmd + .`
- 选择 `Extract to i18n key`

## 这个项目适合谁

如果你符合下面任意一种情况，这个插件就值得试一下：

- 你的团队在做 React / Vue 多语言项目
- 仓库里已经有 i18n，但流程还很手工
- 你想治理硬编码文案，但不想推倒重来
- 你经常要处理 locale 文件同步、导入、校验这些杂活

如果你期待的是“自动翻译一切”的产品，这个项目不是为那个目标设计的。  
但如果你想要一个**真正减少开发阻力**的 i18n workflow 工具，它会更对路。

## 开源地址

GitHub:

https://github.com/OpenLucasKaka/i18n-workflow-helper

如果你也被 i18n 流程折腾过，欢迎提 issue、提 PR，或者直接拿去在项目里试。  
我更关心的不是“功能列表看起来多不多”，而是：

**它有没有真的帮开发者少做一点重复劳动。**
