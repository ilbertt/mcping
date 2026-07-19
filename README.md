<div align="center">
  <img src="assets/banner.gif" alt="A native macOS notification sent from a demo MCP server" width="100%" />
  <h1>
    <img src="assets/logo.png" alt="mcping logo" height="40" align="bottom" />&nbsp;mcping
  </h1>
  <p><em>Let MCP servers ping you</em></p>
</div>

mcping is a daemon that connects to one or more
[MCP](https://modelcontextprotocol.io) servers over Streamable HTTP and surfaces
the notifications they send you.

> [!NOTE]
> Available on macOS only, for now.

## Usage

Download the app from the
[latest release](https://github.com/ilbertt/mcping/releases/latest), drag it to
your Applications folder, open it, and connect to your favorite MCP servers.

> [!NOTE]
> mcping isn't notarized by Apple, so on first launch macOS may say it's
> "damaged and can't be opened." It isn't — macOS just quarantines apps it can't
> verify. Clear the quarantine flag once and open it normally:
>
> ```sh
> xattr -cr /Applications/mcping.app
> ```

## Build from source

Don't want to trust the prebuilt binary? Build your own. You'll need
[Bun](https://bun.sh) and macOS.

```sh
git clone https://github.com/ilbertt/mcping.git
cd mcping
bun install
bun run release
```

The packaged `.app` and `.dmg` land in `apps/mcping/release/`. An app you build
locally isn't quarantined, so it opens without the Gatekeeper prompt above.

## How it works

MCP servers can send arbitrary
[notifications](https://modelcontextprotocol.io/specification/2025-11-25/basic/index#notifications)
to clients that support receiving them. mcping keeps a connection open to each
server you add and turns every notification it receives into a native push
notification from your OS.
