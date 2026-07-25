# Connect Four | Built with Cory (BwC)

Fork of [caleb531/connect-four](https://github.com/caleb531/connect-four), rebranded and maintained by [Built with Cory](https://github.com/lumotic-ca).

_Original copyright 2016-2025 Caleb Evans_  
_BwC modifications copyright 2026 Cory (Built with Cory)_  
_Released under the MIT License_

[![tests](https://github.com/lumotic-ca/connect4-BWC/actions/workflows/tests.yml/badge.svg)](https://github.com/lumotic-ca/connect4-BWC/actions/workflows/tests.yml)

This is a Connect Four app written using HTML5, JavaScript, and Mithril (a
React-like framework). You can play on your phone or computer, with a friend or
against Mr. A.I.

## Run with Podman

Build and run the production container on port 9001:

```bash
podman build -f Dockerfile -t connect4-bwc .
podman run --rm -p 9001:9001 -e PORT=9001 -e NODE_ENV=production -e DISABLE_SSL=1 connect4-bwc
```

Then open `http://localhost:9001`.

### Persistent deployment (recommended)

For a host that survives reboots (for example behind Cloudflare Tunnel at `c4.zots.ca`):

```bash
./scripts/connect4-podman.sh deploy
```

This installs a systemd Quadlet unit, enables `connect4-bwc.service`, and verifies that port 9001 is reachable on the host — not just inside the container.

If the public URL returns 502 while the container looks healthy, see [docs/cloudflare-tunnel-troubleshooting.md](docs/cloudflare-tunnel-troubleshooting.md) and run:

```bash
./scripts/connect4-podman.sh repair
```

## Run the project locally

### 1. Install global dependencies

The project requires Node (>= 24), so make sure you have that installed.

### 2. Install project dependencies

This project uses [pnpm][pnpm] (instead of npm) for package installation and
management. From the cloned project directory, run:

[pnpm]: https://pnpm.io/

```bash
npm install -g pnpm
pnpm install
```

### 3. Serve app locally

To serve the app locally, run:

```bash
pnpm dev
```

You will then be able to view the app at `http://localhost:8080`. Any app files
will be recompiled automatically when you make changes to them (as long as `pnpm dev` is still running).

## Implementation

### User interface

The entire app UI is constructed and managed in JavaScript using
[Mithril][mithril]. Chip transitions are handled by CSS to maximize performance
and smoothness. The grid layout is styled with CSS Flexbox to enable the
stacking of grid elements from the bottom up.

[mithril]: http://mithril.js.org/

### AI Player

The Connect Four AI uses the [minimax][minimax] algorithm with a maximum search
depth of three, combined with [alpha-beta pruning][abp] to reduce the number of
possibilities evaluated.

In the app, the AI player is lovingly referred to as "Mr. A.I.".

[minimax]: https://en.wikipedia.org/wiki/Minimax
[abp]: https://en.wikipedia.org/wiki/Alpha%E2%80%93beta_pruning
