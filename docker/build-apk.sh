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
# --max-workers=2 throttles Gradle's parallel tasks; reactNativeArchitectures
# builds a single ABI (arm64-v8a covers virtually all modern phones) instead of
# all four — roughly quarters the native C++ compile work. Together with the
# container caps in docker-compose.yml this keeps peak memory under the limit.
./gradlew assembleRelease \
  --max-workers=2 \
  -PreactNativeArchitectures=arm64-v8a

echo "==> Exporting APK to host…"
mkdir -p "$OUT"
cp app/build/outputs/apk/release/app-release.apk "$OUT/trackit.apk"
# Make the artifact readable/overwritable from the host regardless of UID.
chmod 0666 "$OUT/trackit.apk" || true

echo ""
echo "==> Done!  APK is at  ./build-output/trackit.apk"
echo "    Copy it to any Android phone, tap to install (allow 'unknown sources')."
