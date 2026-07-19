<div align="center">
  <img src="assets/logo.png" alt="mcping logo" width="128" />
  <h1>mcping</h1>
  <p><em>Let MCP servers ping you</em></p>
</div>

mcping is a daemon that connects to one or more
[MCP](https://modelcontextprotocol.io) servers over Streamable HTTP and surfaces
the notifications they send you.

> [!NOTE]
> Available on macOS only, for now.

## Usage

Download the app from the
[latest release](https://github.com/ilbertt/mcping/releases/latest), open it, and
connect to your favorite MCP servers.

## How it works

MCP servers can send arbitrary
[notifications](https://modelcontextprotocol.io/specification/2025-11-25/basic/index#notifications)
to clients that support receiving them. mcping keeps a connection open to each
server you add and turns every notification it receives into a native push
notification from your OS.
