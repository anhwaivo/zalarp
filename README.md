<div align="center">
  <!-- <img src=".github/zadark-icon.png" width="128" alt="ZaLarp" /> -->

  <h1>ZaLarp - <a href="https://github.com/ncdai/zadark">ZaDark</a> with more features ig</h1>

  <p>QOL for zalor, hiện tại chỉ có build windows th :)</p>
</div>

---
## Features

- Giữ toàn bộ tính năng của zadark stock
- Gửi ảnh original mà không cần mua zcloud
- Giữ tin nhắn / hình ảnh người khác đã thu hồi
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

## Screenshots
<img width="1390" height="691" alt="image" src="https://github.com/user-attachments/assets/6a42a179-6d85-4e8d-ba42-324ead551d86" />
<img width="820" height="706" alt="image" src="https://github.com/user-attachments/assets/83305656-7047-4e97-897f-963e72ff8c33" />


## License

[Mozilla Public License 2.0 (MPL-2.0)](./LICENSE)
