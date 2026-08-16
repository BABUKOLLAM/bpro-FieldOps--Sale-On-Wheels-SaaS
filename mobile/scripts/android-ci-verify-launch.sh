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

# mCurrentFocus (from `dumpsys window`) confirms the app's window
# exists and is frontmost, but that happens the instant the Activity is
# created — seconds after launch, while RN's native "Bundling NN%..."
# loading view is still showing and long before Metro has finished
# serving/parsing the JS bundle. A previous attempt screenshotted 3s
# after this signal and caught exactly that: "Bundling 43.1%..." on a
# blank screen. Neither this nor mResumedActivity (tried earlier, never
# matched at all on this Android 14 dumpsys format) measure "finished
# loading" — they measure "a window opened". A real full render
# (WatermelonDB init + JS bundle parse + first paint) was empirically
# observed taking up to ~2 minutes cold in this same CI environment, so
# once the window-focus signal confirms the app launched at all (not
# crashed/backgrounded), wait a generous fixed settle time — grounded in
# that observed duration plus margin — before capturing evidence.
READY=0
for i in $(seq 1 30); do
  sleep 4
  if adb shell dumpsys window 2>/dev/null | grep -q "mCurrentFocus.*${APP_ID}"; then
    READY=1
    break
  fi
done
echo "App window focused: $READY"

if [ "$READY" -eq 1 ]; then
  sleep 100
fi

adb exec-out screencap -p > "$ARTIFACTS_DIR/tier2-01-launch.png"
adb logcat -d > "$ARTIFACTS_DIR/logcat.txt"

if [ "$READY" -ne 1 ]; then
  echo "App never reached a resumed foreground state within the timeout — see tier2-01-launch.png and logcat.txt"
  exit 1
fi
