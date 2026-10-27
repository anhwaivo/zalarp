<div align="center">
  <img src=".github/zadark-icon.png" width="128" alt="ZaLarp" />

  <h1>ZaLarp - ZaDark with more features ig</h1>

  <p>Dark Mode and quality-of-life enhancements for Zalo PC & Web.</p>
</div>

---

## Features

- 🌙 **Dark Mode**: Dark theme support for Zalo PC and Web.
- 🚫 **Block Ads**: Hide Adtima and Zinstant ad banners and elements.
- 👁️ **Anonymous Story View**: View stories without appearing in the viewers list.
- 📸 **Original Quality Photos**: Send uncompressed original photos instead of compressed HD (`Ctrl+8` / `⌘8`).
- 🛑 **Block Message Recall**: Keep unsent/retracted messages visible (`Ctrl+Shift+8` / `⇧⌘8`).
- 🛡️ **Block Telemetry**: Disable Firebase Analytics, Crashlytics, and tracking requests.
- 🔒 **Privacy Controls**: Block typing indicator, delivered receipts, and seen receipts.

## Build (Windows)

Prerequisites: [Node.js](https://nodejs.org/) (v16+).

```bash
# Install dependencies
npm install --legacy-peer-deps

# Build web & PC assets
npx gulp build

# Package Windows executable
npx pkg ./build/pc/index.js --config ./pkg.config.json --targets node16.16.0-win-x64 --output ./dist/windows/zadark.exe
```

On Windows, you can also run `build-windows.cmd` directly.

## License

[Mozilla Public License 2.0 (MPL-2.0)](./LICENSE)
