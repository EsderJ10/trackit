#!/usr/bin/env bash
# Runs inside the builder container. Copies the (read-only mounted) repo into a
# writable workdir, installs JS deps, generates the native Android project, and
# builds a signed release APK — then exports it to the host via /output.
set -euo pipefail

SRC=/src
WORK=/app
OUT=/output

echo "==> Syncing source into container (excluding host build artifacts)…"
mkdir -p "$WORK"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'android' \
  --exclude 'ios' \
  --exclude 'build-output' \
  "$SRC"/ "$WORK"/

cd "$WORK"

echo "==> Installing JS dependencies (pnpm, frozen lockfile)…"
pnpm install --frozen-lockfile

echo "==> Generating native Android project (expo prebuild)…"
pnpm exec expo prebuild --platform android --no-install

echo "==> Building release APK (gradle assembleRelease)…"
cd android
./gradlew assembleRelease

echo "==> Exporting APK to host…"
mkdir -p "$OUT"
cp app/build/outputs/apk/release/app-release.apk "$OUT/trackit.apk"
# Make the artifact readable/overwritable from the host regardless of UID.
chmod 0666 "$OUT/trackit.apk" || true

echo ""
echo "==> Done!  APK is at  ./build-output/trackit.apk"
echo "    Copy it to any Android phone, tap to install (allow 'unknown sources')."
