# I18n Workflow Helper

English README file: `README.md`

一个面向 JavaScript / TypeScript / React / Vue 项目的 VS Code i18n 工作流插件。

它的重点不是翻译，而是解决开发过程中最常见的 i18n 管理问题。

## 解决的问题

- 代码里有硬编码文案
- i18n key 命名混乱
- locale 文件缺失、未使用、结构不一致
- 多语言文件不同步
- 开发时需要频繁在代码和 locale 文件之间切换
- 已有国际化项目接入成本高

## 主要功能

### 1. 提取文案

- 选中 TSX 中的文案
- 一键提取成 i18n key
- 自动把代码替换成 `t('your.key')`
- 自动把 key 写入 locale 文件
- 自动同步其他语言文件结构
- 如果识别出的语言和默认语言不一致，会先提示确认

### 2. 扫描问题

执行 `i18n: Scan Workspace` 后可以扫描：

- 硬编码文案
- 缺失 key
- 未使用 key
- 多语言文件结构不一致

结果会显示在侧边栏，并支持点击跳转。

### 3. 导入 / 导出 locale 文件

- 支持导出单语言或全部语言 JSON 文件
- 支持导入 `json / jsonc`
- 导入前自动打开 diff 预览
- 你确认后才真正写入

### 4. locale 管理

- 支持设置默认语言
- 支持设置 locale 目录
- 侧边栏显示当前 locale 目录和语言文件

## 当前支持范围

- JavaScript / TypeScript / React / Vue
- locale 文件：`json` / `jsonc`
- i18n 函数调用形式：`t('key')`
- Vue SFC 支持 `template`、`script`、`script setup`

## 安装

### 本地安装 VSIX

```bash
code --install-extension i18n-workflow-helper-0.1.0.vsix
```

### 开发模式运行

```bash
npm install
npm run build
```

然后在 VS Code 中打开本项目，按 `F5` 启动 Extension Development Host。

## 配置项

```json
{
  "i18nWorkflow.localeDir": "src/locales",
  "i18nWorkflow.defaultLanguage": "en",
  "i18nWorkflow.languages": ["en", "zh-CN"],
  "i18nWorkflow.functionName": "t",
  "i18nWorkflow.include": ["src/**/*.tsx"],
  "i18nWorkflow.exclude": ["**/node_modules/**", "**/dist/**"]
}
```

说明：

- `localeDir`：locale 目录，相对 workspace 根目录
- `defaultLanguage`：默认语言，也是结构同步基准语言
- `languages`：支持的语言列表
- `functionName`：i18n 函数名，默认 `t`
- `include / exclude`：扫描范围

## 推荐使用方式

相比手改 settings，推荐优先使用：

- `i18n: Set Default Language`
- `i18n: Set Locale Directory`

## 使用步骤

### 提取文案

1. 打开 `.tsx` 文件
2. 选中字符串文案或 JSX 文案
3. 执行 `i18n: Extract Selected Text`
4. 输入 i18n key
5. 插件自动替换代码并写入 locale

如果检测到文案语言和 `defaultLanguage` 不一致，插件会提示你：

- 使用识别语言
- 保持默认语言
- 打开设置

### 扫描问题

1. 执行 `i18n: Scan Workspace`
2. 打开左侧 `i18n` 面板
3. 查看 `Problems` 和 `Locale Files`
4. 点击问题项跳转到代码位置

### Quick Fix

当插件识别到硬编码文案时：

- 点击小灯泡
- 或按 `Cmd + .`

会出现：

- `Extract to i18n key`

### 导入 locale 文件

1. 执行 `i18n: Import Locale JSON File`
2. 选择目标语言
3. 选择导入文件
4. 查看 diff 预览
5. 执行 `i18n: Apply Pending Import`

如果不想导入：

- `i18n: Discard Pending Import`

### 导出 locale 文件

1. 执行 `i18n: Export Locale JSON Files`
2. 选择导出单语言或全部语言
3. 选择导出目录

## 命令列表

- `i18n: Extract Selected Text`
- `i18n: Scan Workspace`
- `i18n: Export Locale JSON Files`
- `i18n: Import Locale JSON File`
- `i18n: Apply Pending Import`
- `i18n: Discard Pending Import`
- `i18n: Set Default Language`
- `i18n: Set Locale Directory`

## 侧边栏说明

### Problems

展示扫描出来的问题：

- hardcoded text
- missing key
- unused key
- locale mismatch

### Locale Files

展示：

- 当前 locale 目录
- 当前语言文件列表
- 每个语言文件的 key 数量

## 适合录视频的演示顺序

建议按这个顺序录第一版：

1. 设置 locale 目录
2. 设置默认语言
3. 提取一段文案
4. 展示代码替换和 locale 自动写入
5. 扫描项目问题并从侧边栏跳转
6. 导入 locale 文件并展示 diff 预览

## 插件商城图标

插件商城图标通过 `package.json` 顶层的 `icon` 字段配置，例如：

```json
{
  "icon": "media/icon.png"
}
```

注意：

- 必须使用 PNG，不要用 SVG
- 建议放在 `media/` 目录下
- 建议尺寸至少 `128x128`

它和侧边栏 Activity Bar 的图标不是同一个东西。

## 已知限制

- 当前版本支持 `js`、`jsx`、`ts`、`tsx`、`mjs`、`cjs`、`mts`、`cts`、`vue`
- 当前主要支持 `t('key')`
- 不做自动翻译
- 暂未覆盖所有复杂 AST 场景

## 版本说明

### 0.1.0

第一版已支持：

- 提取文案
- 扫描 i18n 问题
- locale 导入 diff 预览
- locale 导出
- 默认语言设置
- locale 目录设置
