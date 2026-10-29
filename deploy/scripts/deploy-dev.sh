#!/usr/bin/env bash
# Install on the DEVELOPMENT host as root-owned /usr/local/bin/datart-deploy.
# Execute as the unprivileged GitHub Runner user, NOT as root.
set -Eeuo pipefail
umask 027

die() { echo "Datart deploy ERROR: $*" >&2; exit 1; }
log() { echo "Datart deploy: $*"; }

[[ "$EUID" -ne 0 ]] || die "Do not run as root"
[[ "$#" -eq 2 ]] || die "Usage: datart-deploy /absolute/path/datart-server-install.zip <40-char-commit-sha>"

ARCHIVE="$(realpath -- "$1")"
SHA="$2"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || die "Invalid commit SHA"
[[ -f "$ARCHIVE" && -r "$ARCHIVE" ]] || die "Artifact cannot be read"

ROOT=/opt/datart
RELEASES="$ROOT/releases"
SHARED="$ROOT/shared"
SERVICE=datart.service
HEALTH_URL=http://127.0.0.1:8080/api/v1/sys/info
TARGET="$RELEASES/$SHA"
STAGE="$RELEASES/.staging-$SHA-$$"
NEXT_LINK="$ROOT/.next-$SHA-$$"
OLD=""
SWITCHED=0
ASSETS_WRITTEN=0

# Prevent overlapping deploys, including a manual invocation.
exec 9>"$ROOT/.deployment.lock" || die "Cannot write deployment lock"
flock -n 9 || die "Another deployment is running"

current_link() {
  local destination="$1"
  ln -s -- "$destination" "$NEXT_LINK"
  mv -Tf -- "$NEXT_LINK" "$ROOT/current"
}

recover_if_needed() {
  local status="$?"
  trap - EXIT
  if [[ "$status" -ne 0 && ( "$SWITCHED" -eq 1 || "$ASSETS_WRITTEN" -eq 1 ) ]]; then
    log "Deployment failed. Attempting to restore the previous release and assets."
    if [[ -n "$OLD" ]]; then
      if [[ "$SWITCHED" -eq 1 ]]; then
        current_link "$OLD" || true
      fi
      if [[ "$ASSETS_WRITTEN" -eq 1 ]]; then
        rsync -a --no-owner --no-group "$OLD/.frontend-assets/" "$SHARED/static/" || true
      fi
      if [[ "$SWITCHED" -eq 1 ]]; then
        sudo -n /usr/bin/systemctl restart "$SERVICE" || true
      fi
    else
      log "First deployment has no previous release. Manual recovery required."
    fi
  fi
  if [[ -d "$STAGE" ]]; then
    rm -rf -- "$STAGE"
  fi
  if [[ -L "$NEXT_LINK" ]]; then
    rm -- "$NEXT_LINK"
  fi
  exit "$status"
}
trap recover_if_needed EXIT

for required in "$ROOT" "$RELEASES" "$SHARED/config" "$SHARED/static" "$SHARED/logs"; do
  [[ -d "$required" ]] || die "Missing server directory: $required"
done
[[ -f "$SHARED/config/datart.conf" ]] || die "Missing external datart.conf"
[[ -f "$SHARED/config/profiles/application-config.yml" ]] || die "Missing external application-config.yml"
[[ -w "$RELEASES" && -w "$SHARED/static" && -w "$ROOT" ]] || die "Runner lacks release/static permissions"
[[ ! -e "$TARGET" && ! -e "$STAGE" ]] || die "Release already exists; investigate before re-running"
command -v unzip >/dev/null || die "unzip not installed"
command -v rsync >/dev/null || die "rsync not installed"
command -v flock >/dev/null || die "flock not installed"
sudo -n -l /usr/bin/systemctl restart "$SERVICE" >/dev/null || die "Runner has no passwordless permission to restart $SERVICE"
/usr/bin/systemctl cat "$SERVICE" >/dev/null || die "systemd service not installed"

if [[ -L "$ROOT/current" ]]; then
  OLD="$(realpath -- "$ROOT/current")"
  [[ "$OLD" == "$RELEASES/"* && -d "$OLD/.frontend-assets" ]] || die "Existing current release is not managed by this deploy script"
elif [[ -e "$ROOT/current" ]]; then
  die "current exists but is not a symlink; do not overwrite a running installation"
elif /usr/bin/systemctl is-active --quiet "$SERVICE"; then
  die "Service is already running without a managed current link; migrate it manually first"
fi

# The ZIP comes from the trusted-branch hosted build, not a pull request.
# Reject unsafe archive paths and filesystem symlinks before changing current.
unzip -tq "$ARCHIVE" >/dev/null || die "Invalid ZIP archive"
while IFS= read -r entry; do
  case "$entry" in
    /*|../*|*/../*|*'/./'*)
      die "Unsafe ZIP entry: $entry" ;;
  esac
done < <(unzip -Z1 "$ARCHIVE")

mkdir -- "$STAGE"
unzip -q "$ARCHIVE" -d "$STAGE"
if find "$STAGE" -type l -print -quit | grep -q .; then
  die "ZIP must not contain symbolic links"
fi
[[ -d "$STAGE/lib" && -s "$STAGE/static/index.html" ]] || die "Distribution missing lib/ or frontend"
[[ -f "$STAGE/config/profiles/application-config.yml" ]] || die "Distribution missing packaged config"
find "$STAGE/lib" -maxdepth 1 -type f -name '*.jar' -print -quit | grep -q . ||
  die "Distribution lib/ contains no JARs"

# Never install the example credentials/token from the public repository.
mv -- "$STAGE/static" "$STAGE/.frontend-assets"
rm -rf -- "$STAGE/config"
ln -s -- "$SHARED/config" "$STAGE/config"
ln -s -- "$SHARED/static" "$STAGE/static"
ln -s -- "$SHARED/logs" "$STAGE/logs"
mv -- "$STAGE" "$TARGET"

# Preserve uploads and previously hashed frontend assets: NEVER use --delete.
# New frontend entrypoints are copied as part of the release.
ASSETS_WRITTEN=1
rsync -a --no-owner --no-group "$TARGET/.frontend-assets/" "$SHARED/static/"
current_link "$TARGET"
SWITCHED=1
log "Restarting $SERVICE"
sudo -n /usr/bin/systemctl restart "$SERVICE"

READY=0
for attempt in $(seq 1 30); do
  if /usr/bin/systemctl is-active --quiet "$SERVICE" &&
     curl --fail --silent --show-error --max-time 4 "$HEALTH_URL" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
[[ "$READY" -eq 1 ]] || die "Service never passed health check: $HEALTH_URL"
SWITCHED=0
log "Deployment healthy: $SHA"
