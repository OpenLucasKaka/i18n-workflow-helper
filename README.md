# I18n Workflow Helper

[中文文档](./docs/README.zh-CN.md)

<p align="center">
  <img src="./media/logo.png" alt="I18n Workflow Helper Logo" width="160" />
</p>

I18n Workflow Helper is a VS Code extension for JavaScript / TypeScript / React / Vue projects.

It focuses on i18n workflow management instead of translation itself:

- extract hardcoded text into locale keys
- scan i18n issues in code and locale files
- preview locale import changes with diff before applying them
- manage locale directories and language files inside VS Code

## Features

- Extract selected text into an i18n key and replace code with `t('key')`
- Write locale values automatically and sync empty placeholders to other languages
- Detect hardcoded text, missing keys, unused keys, and locale mismatches
- Import `json` / `jsonc` locale files with diff preview before apply
- Export one language or all configured languages as JSON
- Set the default language from configured languages
- Set the locale directory for existing i18n projects
- Show scan results and locale files in the Explorer view

## Installation

```bash
code --install-extension i18n-workflow-helper-0.1.3.vsix
```

For development:

```bash
npm install
npm run build
```

Then open this project in VS Code and press `F5`.

## Configuration

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

Recommended commands:

- `i18n: Set Default Language`
- `i18n: Set Locale Directory`

## Commands

- `i18n: Extract Selected Text`
- `i18n: Scan Workspace`
- `i18n: Export Locale JSON Files`
- `i18n: Import Locale JSON File`
- `i18n: Apply Pending Import`
- `i18n: Discard Pending Import`
- `i18n: Set Default Language`
- `i18n: Set Locale Directory`

## Quick Start

1. Set the locale directory and default language.
2. Select text in a supported source file and run `i18n: Extract Selected Text`.
3. Run `i18n: Scan Workspace` to inspect problems in the Explorer view.
4. Import locale files with `i18n: Import Locale JSON File` and review the diff before applying.

Quick fix is also supported for hardcoded text:

- click the lightbulb
- or press `Cmd + .`
- choose `Extract to i18n key`

## Supported Scope

- source files: `js`, `jsx`, `ts`, `tsx`, `mjs`, `cjs`, `mts`, `cts`, `vue`
- locale files: `json`, `jsonc`
- translation call pattern: `t('key')`
- Vue SFC support: `template`, `script`, `script setup`

## Notes

- The extension does not translate text automatically.
- Complex AST cases are not fully covered yet.
- Marketplace icon is configured with the top-level `icon` field in `package.json`.

## Release Notes

### 0.1.3

Reduced VSIX size and fixed the workspace setting update error during extraction.

### 0.1.2

Fixed VSIX runtime packaging so commands are available after installation.

### 0.1.1

Packaging and activation reliability fixes, plus Explorer view placement.

### 0.1.0

Initial release with text extraction, workspace scan, locale import diff preview, locale export, default language setup, locale directory setup, and Vue support.
