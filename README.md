# I18n Workflow Helper

[中文文档](./docs/README.zh-CN.md)

I18n Workflow Helper is a VS Code extension for React / TSX projects.

It focuses on i18n workflow management instead of translation itself:

- extract hardcoded text into locale keys
- scan i18n problems in code and locale files
- preview locale import changes with diff before applying them
- manage locale directories and language files inside VS Code

## What It Solves

- Hardcoded copy left in code
- Inconsistent i18n key naming
- Missing keys, unused keys, and locale mismatches
- Locale files drifting out of sync
- Too much switching between code and locale files
- Hard onboarding for projects that already have i18n

## Main Features

### Extract Text

- Select text inside TSX
- Extract it into an i18n key
- Replace code with `t('your.key')`
- Write locale values automatically
- Sync locale structure to other languages
- Detect text language and warn when it does not match the current default language

### Scan I18n Issues

Run `i18n: Scan Workspace` to detect:

- hardcoded text
- missing locale keys
- unused locale keys
- locale structure mismatches

Results are shown in the sidebar and support click-to-jump for code issues.

### Import / Export Locale Files

- Export one language or all configured languages as JSON
- Import `json` / `jsonc` locale files by language
- Open a diff preview before applying import changes
- Apply or discard the pending import explicitly

### Locale Management

- Set the default language from configured languages
- Set the locale directory from a folder picker
- Show the active locale directory and locale files in the sidebar

## Supported Scope

- React / TSX
- locale files: `json` / `jsonc`
- translation function pattern: `t('key')`

## Installation

### Install VSIX Locally

```bash
code --install-extension i18n-workflow-helper-0.1.0.vsix
```

### Run In Development Mode

```bash
npm install
npm run build
```

Then open this project in VS Code and press `F5` to launch the Extension Development Host.

## Configuration

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

## Recommended Setup

Instead of editing settings manually, use these commands first:

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

## Quick Usage

### Extract Text

1. Open a `.tsx` file
2. Select a string literal or JSX text
3. Run `i18n: Extract Selected Text`
4. Enter the key

### Scan Issues

1. Run `i18n: Scan Workspace`
2. Open the `i18n` activity bar view
3. Inspect `Problems` and `Locale Files`

### Import With Diff

1. Run `i18n: Import Locale JSON File`
2. Choose the target language
3. Choose the import file
4. Review the diff preview
5. Apply with `i18n: Apply Pending Import`

## Demo Flow

Recommended flow for a short product demo video:

1. Set locale directory
2. Set default language
3. Extract text from TSX
4. Show locale update
5. Run workspace scan
6. Open a problem from the sidebar
7. Import a locale file and show the diff preview

## Notes

- React / TSX only in `0.1.0`
- No automatic translation
- Complex AST cases are not fully covered yet

## Marketplace Icon

The Marketplace icon is configured by the top-level `icon` field in `package.json`, for example:

```json
{
  "icon": "media/icon.png"
}
```

Important:

- use a PNG file, not SVG
- keep it in the repository, usually under `media/`
- recommended size: `128x128` or larger

This is different from the Activity Bar icon used by the tree view container.

## Release Notes

### 0.1.0

Initial release with text extraction, workspace scan, locale import diff preview, locale export, default language setup, and locale directory setup.
