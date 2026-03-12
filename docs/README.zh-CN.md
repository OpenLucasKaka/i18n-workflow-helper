# I18n Workflow Helper

[English README](../README.md)

一个面向 JavaScript / TypeScript / React / Vue 项目的 VS Code i18n 工作流插件。

它的重点不是翻译，而是解决开发过程里的 i18n 管理问题：

- 提取硬编码文案
- 扫描代码和 locale 文件里的 i18n 问题
- 导入 locale 文件前先看 diff
- 在 VS Code 里管理语言文件和 locale 目录

## 功能

- 选中文案后提取成 i18n key，并把代码替换成 `t('key')`
- 自动写入 locale value，并给其他语言补空结构
- 扫描硬编码文案、缺失 key、未使用 key、结构不一致
- 导入 `json / jsonc` 时先打开 diff 预览，再决定是否应用
- 导出单语言或全部语言的 JSON 文件
- 从已配置语言里设置默认语言
- 为已有国际化项目设置 locale 目录
- 在 Explorer 视图中查看问题和语言文件

## 安装

```bash
code --install-extension i18n-workflow-helper-0.1.0.vsix
```

开发模式：

```bash
npm install
npm run build
```

然后在 VS Code 里打开本项目，按 `F5` 即可。

## 配置

```json
{
  "i18nWorkflow.localeDir": "src/locales",
  "i18nWorkflow.defaultLanguage": "en",
  "i18nWorkflow.languages": ["en", "zh-CN"],
  "i18nWorkflow.functionName": "t",
  "i18nWorkflow.include": ["src/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,vue}"],
  "i18nWorkflow.exclude": ["**/node_modules/**", "**/dist/**"]
}
```

推荐优先使用：

- `i18n: Set Default Language`
- `i18n: Set Locale Directory`

## 命令

- `i18n: Extract Selected Text`
- `i18n: Scan Workspace`
- `i18n: Export Locale JSON Files`
- `i18n: Import Locale JSON File`
- `i18n: Apply Pending Import`
- `i18n: Discard Pending Import`
- `i18n: Set Default Language`
- `i18n: Set Locale Directory`

## 快速上手

1. 先设置 locale 目录和默认语言。
2. 在受支持的代码文件里选中文案，执行 `i18n: Extract Selected Text`。
3. 执行 `i18n: Scan Workspace`，在 Explorer 里查看问题和语言文件。
4. 执行 `i18n: Import Locale JSON File`，先看 diff，再决定是否应用。

硬编码文案也支持 Quick Fix：

- 点击小灯泡
- 或按 `Cmd + .`
- 选择 `Extract to i18n key`

## 支持范围

- 源码文件：`js`、`jsx`、`ts`、`tsx`、`mjs`、`cjs`、`mts`、`cts`、`vue`
- locale 文件：`json`、`jsonc`
- i18n 调用形式：`t('key')`
- Vue SFC：`template`、`script`、`script setup`

## 说明

- 插件不做自动翻译。
- 复杂 AST 场景当前还没有全部覆盖。
- 插件市场图标通过 `package.json` 顶层 `icon` 字段配置。

## 版本说明

### 0.1.0

第一版已支持文案提取、工作区扫描、locale 导入 diff 预览、locale 导出、默认语言设置、locale 目录设置，以及 Vue 支持。
