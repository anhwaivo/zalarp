<div align="center">
  <!-- <img src=".github/zadark-icon.png" width="128" alt="ZaLarp" /> -->

  <h1>ZaLarp - ZaDark with more features ig</h1>

  <p>QOL for zalor, hiện tại chỉ có build windows th :)</p>
</div>

---

## Features

- Giữ toàn bộ tính năng của zadark stock
- Gửi ảnh original mà không cần mua zcloud
- Giữ tin nhắn / hình ảnh người khác đã thu hồi (wip)
- *Comming soon: ảnh không hết hạn

## Build (Windows)

Prerequisites: [Node.js](https://nodejs.org/) (v16+).

```bash
# Install dependencies
npm install --legacy-peer-deps

npx gulp build

npx pkg ./build/pc/index.js --config ./pkg.config.json --targets node16.16.0-win-x64 --output ./dist/windows/zadark.exe
```

On Windows, you can also run `build-windows.cmd` directly.

## License

[Mozilla Public License 2.0 (MPL-2.0)](./LICENSE)
