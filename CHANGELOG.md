# Changelog

## 0.1.3

- Reduce VSIX size from 8.0 MB to 2.53 MB by trimming non-runtime files and compressing the logo asset.
- Fix `Extract Selected Text` failing with `Overlapping edit` when updating workspace settings.

## 0.1.2

- Include `typescript` in runtime dependencies so the extension can activate after VSIX installation.
- Fix command availability issues caused by activation failure.

## 0.1.1

- Fix extension packaging and activation reliability.
- Move the view into Explorer instead of using a separate Activity Bar icon.

## 0.1.0

- Extract selected TSX text into i18n keys and update locale files.
- Scan hardcoded text, missing keys, unused keys, and locale structure mismatches.
- Show scan results and locale files in the sidebar.
- Export locale JSON files and import locale files with diff preview before apply.
- Configure default language and locale directory from commands.
