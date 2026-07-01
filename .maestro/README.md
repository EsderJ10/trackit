# Maestro E2E smoke suite

Device-level flows that exercise TrackIt's **native/routed blind spot** — the
things the headless Vitest suites can't reach: Expo SQLite on a real device,
the migration-seeded exercise library, Expo Router navigation, file export via
`expo-sharing`, and the auth gate. They run against an **installed APK** on an
Android emulator or physical device.

> These complement, not replace, the Vitest suites:
>
> - **`pnpm test`** (unit + integration) — pure logic + the real migrations/DB
>   layer, headless, fast, runs on every push. See `tests/integration/`.
> - **Maestro (this dir)** — the same app on a real engine + UI, run in the
>   `e2e` CI job on an emulator, or locally before a release.

## Flows

| File                 | What it covers                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `smoke.yaml`         | Fresh install → onboarding → log a freestyle workout → session in History |
| `backup-export.yaml` | Onboard → Settings → Export backup (DB serialise + share sheet, no crash) |

Selectors target the app's existing **`accessibilityLabel`s and visible text** —
the codebase ships **no `testID`s** by convention (it has 100+ accessibility
labels instead, which Maestro matches via its `text` selector). If UI copy
changes, update the strings in the flows.

## The `appId`

The flows default to **`com.anonymous.trackit`** — what `expo prebuild` derives
from the `slug` because `android.package` isn't pinned in `app.json`. Confirm
the installed package with:

```bash
adb shell pm list packages | grep trackit
```

If it differs (e.g. you later set `android.package`), override per-run without
editing the flows:

```bash
maestro test -e APP_ID=com.your.package .maestro/
```

> Pinning `android.package` in `app.json` is recommended for a stable store /
> E2E identity (Expo otherwise derives it from the slug).

## Running locally

1. Install Maestro: `curl -fsSL https://get.maestro.mobile.dev | bash`
2. Start an Android emulator (or plug in a device with USB debugging).
3. Build + install the app:
   - dev build / release APK: `make apk` then
     `adb install -r build-output/trackit.apk`, **or**
   - the flows also work against a dev client / Expo Go running the app.
4. Run a single flow or the whole suite:
   ```bash
   maestro test .maestro/smoke.yaml      # one flow
   maestro test .maestro/                # every flow in the dir
   maestro test --include-tags smoke .maestro/
   ```

## CI

The `e2e` GitHub Actions job (`.github/workflows/e2e.yml`) builds the APK, boots
an Android emulator, and runs `maestro test .maestro/`. It's a **separate,
heavier job** from the fast headless `ci` workflow so a slow emulator never
blocks the unit/integration signal.

## Status / caveats

- Authored against the **current UI copy**; the strings are real (extracted from
  the screens) but the flows have **not yet been executed on a device from this
  environment** — the first emulator/CI run is their first validation and may
  surface selector tweaks (e.g. a scroll needed before a tap, an alert whose
  wording shifted). Treat the initial `e2e` run as the commissioning pass.
- The **share sheet** (`backup-export.yaml`) is OEM system UI; we assert only
  that export doesn't crash. A full backup **round-trip** (export → wipe →
  import → data intact) and **biometric/PIN** unlock aren't automated here —
  verify them manually on a device before a release.
