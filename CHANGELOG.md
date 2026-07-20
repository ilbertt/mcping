# Changelog

All notable changes to this project are documented in this file.

## [2026.7.20-3] - 2026-07-20

### 🚀 Features

- *(demo)* Add optional --auth apikey|oauth modes (#22)

### 🐛 Bug Fixes

- *(mcping)* Stop reconnecting on terminal auth/404 errors (#26)
- *(demo)* Announce "Client disconnected" when a session drops (#25)
- *(demo)* Friendlier server console output (#24)
- *(mcping)* Simplify server auth options in settings UI (#23)
- *(mcping)* Server card UI — auth fields and Connect/Disconnect visibility (#21)
- *(mcping)* Use full-bleed app icon so macOS stops framing it in gray (#20)

## [2026.7.20-2] - 2026-07-20

### 🚀 Features

- *(mcping)* Support authenticated MCP servers (#15)
- *(mcping)* Open Settings on first launch, drop default localhost server (#16)

### 🚜 Refactor

- *(mcping)* Use placeholders for new-server fields (#18)
- *(mcping)* Restructure src into domain modules and folders (#17)

### ⚙️ Miscellaneous Tasks

- Show build-provenance notice in release body (#14)

## [2026.7.20-1] - 2026-07-20

### 🚀 Features

- *(mcping)* Adopt new logo for app icon and menu-bar glyph (#6)
- *(demo)* Add fixed body to notifications from demo server (#4)
- *(mcping)* Make settings log an accordion with copy button (#2)
- *(demo)* Add a workspace to ping mcping from the terminal (#1)
- *(mcping)* Show native notifications for mcping-protocol push
- *(mcping-protocol)* Add server → client notification contract
- *(mcping)* Support multiple MCP server connections
- *(mcping)* Add an app icon for the packaged bundle
- *(mcping)* Replace placeholder tray icon with a ping glyph
- *(mcping)* Package as a DMG with env-gated signing
- *(mcping)* Lifecycle polish — single instance, login item, clean quit
- *(mcping)* Gate notification actions behind user approval
- *(mcping)* Open the target app from matching notifications
- *(mcping)* Connect to MCP server with live status and reconnect
- *(mcping)* Add settings store, window, and IPC bridge
- *(mcping)* Package the app with electron-builder
- *(mcping)* Scaffold empty macOS menu-bar Electron app

### 🐛 Bug Fixes

- *(mcping)* Detect dead servers and hide Connect when connected (#9)
- *(mcping)* Ad-hoc sign the release so macOS delivers notifications (#3)
- *(mcping)* Show name label next to the tray icon

### 🚜 Refactor

- *(mcping-protocol)* Restructure into notifications/ with root build/parse
- *(mcping)* Type-check build scripts in their own project
- *(typescript-config)* Add a shared node tsconfig
- *(mcping)* Split build (bundle) and release (package) scripts
- *(mcping)* Drop the dead window-all-closed handler
- *(mcping)* Set externalizeDeps explicitly

### 📚 Documentation

- Add notification banner to root README (#8)
- Add Gatekeeper bypass and build-from-source to README (#7)
- Refresh READMEs and make apps/mcping AGENTS-only (#5)
- Update readme

### ⚙️ Miscellaneous Tasks

- Add release workflow to publish DMG on tag push (#12)
- Add CalVer prepare-release workflow (#10)
- *(mcping)* Set the tagline to "Let MCP servers ping you"
- Set up project as mcping
- Remove my-package template package
- Pin Node LTS via .node-version and set up node in prepare action

