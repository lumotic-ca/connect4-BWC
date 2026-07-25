#!/usr/bin/env bash
# Build, install, and manage the Connect Four BwC Podman container.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
IMAGE="localhost/connect4-bwc:latest"
CONTAINER_NAME="connect4-bwc"
SERVICE_NAME="connect4-bwc.service"
QUADLET_SOURCE="${REPO_ROOT}/deploy/connect4-bwc.container"
QUADLET_DEST="${HOME}/.config/containers/systemd/connect4-bwc.container"
HOST_PORT=9001
HEALTH_URL="http://127.0.0.1:${HOST_PORT}/"

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  build     Build the production image (${IMAGE})
  install   Install the systemd Quadlet unit and enable the service
  start     Start (or restart) the service
  deploy    build + install + start + health check
  health    Verify the app responds inside the container and on the host
  repair    Recreate the container when host port forwarding is broken
  status    Show service and container status

Typical first-time setup:
  $(basename "$0") deploy

If https://c4.zots.ca returns 502 but the container looks running:
  $(basename "$0") repair
EOF
}

require_podman() {
  command -v podman >/dev/null || {
    echo "error: podman is required" >&2
    exit 1
  }
}

build_image() {
  echo "Building ${IMAGE}..."
  podman build -f "${REPO_ROOT}/Dockerfile" -t "${IMAGE}" "${REPO_ROOT}"
}

install_quadlet() {
  mkdir -p "${HOME}/.config/containers/systemd"
  cp "${QUADLET_SOURCE}" "${QUADLET_DEST}"
  echo "Installed Quadlet unit to ${QUADLET_DEST}"
  systemctl --user daemon-reload
  # Quadlet units are generated; WantedBy=default.target in the .container file
  # ensures they start on login/boot when user lingering is enabled.
  if ! systemctl --user enable "${SERVICE_NAME}" 2>/dev/null; then
    echo "Note: ${SERVICE_NAME} is managed by Podman Quadlet (generated unit)."
  fi
}

remove_manual_container() {
  if podman container exists "${CONTAINER_NAME}" 2>/dev/null; then
    if ! systemctl --user is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
      echo "Removing manually created container ${CONTAINER_NAME}..."
      podman rm -f "${CONTAINER_NAME}" >/dev/null
    fi
  fi
}

start_service() {
  remove_manual_container
  systemctl --user restart "${SERVICE_NAME}"
  echo "Started ${SERVICE_NAME}"
}

container_http_ok() {
  podman exec "${CONTAINER_NAME}" wget -qO- "${HEALTH_URL}" >/dev/null 2>&1
}

host_http_ok() {
  curl -sf "${HEALTH_URL}" >/dev/null 2>&1
}

wait_for_health() {
  local attempts="${1:-15}"
  local delay="${2:-1}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if container_http_ok && host_http_ok; then
      return 0
    fi
    sleep "${delay}"
  done
  return 1
}

print_health() {
  local container_status="fail"
  local host_status="fail"

  if container_http_ok; then
    container_status="ok"
  fi
  if host_http_ok; then
    host_status="ok"
  fi

  echo "Container HTTP (${HEALTH_URL} via podman exec): ${container_status}"
  echo "Host HTTP (${HEALTH_URL}): ${host_status}"

  if [[ "${container_status}" == "ok" && "${host_status}" != "ok" ]]; then
    echo
    echo "Host port forwarding is broken. The app runs in the container but port ${HOST_PORT}"
    echo "is not published to the host. Cloudflare Tunnel will return 502 for c4.zots.ca."
    echo "Run: $(basename "$0") repair"
    return 1
  fi

  if [[ "${container_status}" != "ok" ]]; then
    return 1
  fi

  return 0
}

repair() {
  echo "Repairing ${CONTAINER_NAME} (recreate container + port publish)..."
  systemctl --user stop "${SERVICE_NAME}" || true
  podman rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  systemctl --user start "${SERVICE_NAME}"
  if wait_for_health 20 1; then
    echo "Repair succeeded."
    print_health
  else
    echo "Repair finished but health check failed." >&2
    print_health || true
    exit 1
  fi
}

status() {
  systemctl --user status "${SERVICE_NAME}" --no-pager || true
  echo
  podman ps -a --filter "name=${CONTAINER_NAME}" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  echo
  print_health || true
}

deploy() {
  build_image
  install_quadlet
  start_service
  if wait_for_health 20 1; then
    echo "Deploy succeeded."
    print_health
  else
    echo "Deploy finished but health check failed; attempting repair..." >&2
    repair
  fi
}

main() {
  require_podman
  local command="${1:-}"

  case "${command}" in
    build) build_image ;;
    install) install_quadlet ;;
    start) start_service ;;
    deploy) deploy ;;
    health)
      print_health
      ;;
    repair) repair ;;
    status) status ;;
    *)
      usage
      exit "${command:+1}"
      ;;
  esac
}

main "$@"
