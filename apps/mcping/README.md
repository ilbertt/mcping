# mcping

macOS menu-bar (tray) app built with [Electron](https://www.electronjs.org/) and
[electron-vite](https://electron-vite.org/). Currently an empty shell: a template
tray icon with a Quit menu item, no Dock icon and no window.

## Notes

- **Electron binary:** Electron 42+ no longer downloads its binary via its own
  `postinstall` (a supply-chain hardening change), so this package's `postinstall`
  runs [`install-electron`](https://www.electronjs.org/blog/electron-42-0) to
  provision it on `bun install`.
- **Tray icon:** `resources/iconTemplate.png` (+ `@2x`) is a placeholder — TODO:
  replace with real branding. It is a macOS template image, so it adapts to
  light/dark menu bars automatically.
