#!/usr/bin/env bash
# Installs the debug APK on the booted emulator, launches it, and waits
# for the app's activity to actually resume before declaring success.
#
# This is a real file rather than an inline `script:` block in the
# workflow YAML because reactivecircus/android-emulator-runner invokes
# each line of a multi-line `script:` input as its own separate `sh -c`
# call (visible as individual `[command]/usr/bin/sh -c ...` log entries
# per line) rather than running the block as one shell script — a
# multi-line `for ... do ... done` loop gets split across invocations
# and fails with "Syntax error: end of file unexpected (expecting
# \"done\")". A single `bash path/to/this/script.sh` line in the
# workflow sidesteps that entirely.
set -euo pipefail

APP_ID="${1:?usage: android-ci-verify-launch.sh <app-id> <apk-path> <artifacts-dir>}"
APK_PATH="${2:?usage: android-ci-verify-launch.sh <app-id> <apk-path> <artifacts-dir>}"
ARTIFACTS_DIR="${3:?usage: android-ci-verify-launch.sh <app-id> <apk-path> <artifacts-dir>}"

mkdir -p "$ARTIFACTS_DIR"

adb reverse tcp:8081 tcp:8081
adb install -r "$APK_PATH"
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1

# A cold debug launch has to download and parse the full JS bundle from
# Metro before the app renders anything real — a flat sleep here
# previously produced a screenshot of the app still at "Bundling 72%..."
# with the emulator's own launcher already ANR'd from load, while the
# step still exited 0 (nothing actually checked readiness). Poll for
# the app actually holding window focus instead, with a generous
# ceiling. mCurrentFocus (from `dumpsys window`) is the standard, stable
# signal for "this app is the one on screen" — an earlier version of
# this check grepped `dumpsys activity activities` for
# "mResumedActivity.*$APP_ID" on one line, which never matched on
# Android 14 even once the app was confirmed (via screenshot) to be
# fully rendered and in the foreground for the entire poll window —
# that field/package pairing doesn't co-occur on a single output line
# in this dumpsys format, a false negative, not the app being slow.
READY=0
for i in $(seq 1 30); do
  sleep 4
  if adb shell dumpsys window 2>/dev/null | grep -q "mCurrentFocus.*${APP_ID}"; then
    READY=1
    sleep 3 # let the resumed activity finish its first paint
    break
  fi
done
echo "App resumed: $READY"

adb exec-out screencap -p > "$ARTIFACTS_DIR/tier2-01-launch.png"
adb logcat -d > "$ARTIFACTS_DIR/logcat.txt"

if [ "$READY" -ne 1 ]; then
  echo "App never reached a resumed foreground state within the timeout — see tier2-01-launch.png and logcat.txt"
  exit 1
fi
