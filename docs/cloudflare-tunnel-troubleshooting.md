# Cloudflare Tunnel troubleshooting (c4.zots.ca)

This document describes a production incident where **https://c4.zots.ca** returned a Cloudflare **502 / host error**, even though the Connect Four container appeared to be running.

## Symptoms

- Browser shows a Cloudflare error page (502 Bad Gateway / host error).
- `curl -I https://c4.zots.ca/` returns `HTTP/2 502`.
- `podman ps` shows `connect4-bwc` as **Up**.
- `podman logs connect4-bwc` shows `Server started. Listening on port 9001`.

## Root cause

The app was healthy **inside** the container, but **host port 9001 was not accepting connections**.

Podman uses **pasta** to publish container ports. In this failure mode:

1. The container process listens on port 9001 inside its network namespace.
2. Podman's port map (`0.0.0.0:9001->9001/tcp`) is present in `podman port`, but **nothing is listening on the host**.
3. `curl http://127.0.0.1:9001/` on the host returns **connection refused**.
4. Cloudflare Tunnel (`cloudflared`) forwards `c4.zots.ca` to `http://192.168.100.14:9001` and logs:

   ```text
   Unable to reach the origin service ... dial tcp 192.168.100.14:9001: connect: connection refused
   ```

This often happens after a container was stopped uncleanly (for example SIGKILL during `podman stop`) or when the container was started manually without a managed restart path. The container can look "running" while port forwarding is stale.

### Quick diagnosis

```bash
# Should return 200 — if this fails, Cloudflare will fail too
curl -I http://127.0.0.1:9001/

# Compare with in-container health
podman exec connect4-bwc wget -qO- http://127.0.0.1:9001/ | head

# Check cloudflared logs
podman logs cloudflared-tunnel --tail 20
```

If the in-container check works but the host check fails, port forwarding is broken.

## Fix

Recreate the container so Podman re-establishes port publishing:

```bash
./scripts/connect4-podman.sh repair
```

Or a full rebuild + reinstall:

```bash
./scripts/connect4-podman.sh deploy
```

Manual equivalent:

```bash
systemctl --user stop connect4-bwc.service
podman rm -f connect4-bwc
systemctl --user start connect4-bwc.service
curl -I http://127.0.0.1:9001/
```

## Persistence across reboots

Do **not** rely on a one-off `podman run` command. Use the included **Podman Quadlet** unit:

| File                            | Purpose                                                          |
| ------------------------------- | ---------------------------------------------------------------- |
| `deploy/connect4-bwc.container` | systemd Quadlet definition (port 9001, env vars, restart policy) |
| `scripts/connect4-podman.sh`    | Build, install, health check, and repair helper                  |

### First-time setup

```bash
./scripts/connect4-podman.sh deploy
```

This will:

1. Build `localhost/connect4-bwc:latest`
2. Install the Quadlet to `~/.config/containers/systemd/connect4-bwc.container`
3. Enable and start `connect4-bwc.service` (user systemd)
4. Verify HTTP works both inside the container and on the host

### Boot behavior

On this machine, user lingering and Podman restart are already enabled:

- `loginctl show-user $USER -p Linger` → `yes`
- `systemctl --user is-enabled podman-restart.service` → `enabled`

The Quadlet uses `Restart=always`, so systemd recreates the container on failure and after reboot.

### Cloudflare Tunnel

`cloudflared` is configured separately (see `~/.config/containers/systemd/cloudflared.container`) and forwards public traffic to the host LAN address on port **9001**. The tunnel does not need changes when repairing Connect Four — only the origin port must be reachable.

## Ongoing health checks

```bash
./scripts/connect4-podman.sh health
./scripts/connect4-podman.sh status
```

If `health` reports container OK but host failed, run `repair` before checking `https://c4.zots.ca` again.
