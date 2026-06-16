# Self-contained Android APK builder for TrackIt.
# Everything (JDK, Android SDK/NDK, pnpm) lives in this image — nothing is
# installed on the host. Invoked via ../docker-compose.yml; see build-apk.sh.
FROM node:24-bookworm

# --- System deps + JDK 17 (required by AGP 8 / RN 0.81) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-17-jdk-headless \
      unzip wget git rsync \
 && rm -rf /var/lib/apt/lists/*

# --- pnpm v11 (repo requires it: reads `nodeLinker: hoisted` from
#     pnpm-workspace.yaml; pnpm <11 ignores that key). Pinned to match the
#     host toolchain. Node 24 base is required — pnpm 11 needs node:sqlite. ---
RUN npm install -g pnpm@11.0.9

# --- Android SDK ---
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

# Bootstrap the command-line tools (this zip only provides sdkmanager; the
# real SDK packages are pulled below).
ARG CMDLINE_TOOLS_VERSION=11076708
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
 && wget -q "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip" -O /tmp/cmdline-tools.zip \
 && unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools \
 && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
 && rm /tmp/cmdline-tools.zip

# Accept licenses up front, then pre-install the packages Expo SDK 54 /
# RN 0.81 needs. NDK + CMake are required because reanimated/worklets compile
# native C++ during the app build. Licenses are accepted, so if Gradle decides
# it needs a slightly different version it can auto-download it unattended.
RUN yes | sdkmanager --licenses > /dev/null \
 && sdkmanager --install \
      "platform-tools" \
      "platforms;android-36" \
      "platforms;android-35" \
      "build-tools;36.0.0" \
      "build-tools;35.0.0" \
      "ndk;27.1.12297006" \
      "cmake;3.22.1" > /dev/null

# Gradle inside a container: no daemon, generous heap.
ENV GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.jvmargs=-Xmx4g"

WORKDIR /app
COPY build-apk.sh /usr/local/bin/build-apk.sh
RUN chmod +x /usr/local/bin/build-apk.sh
ENTRYPOINT ["/usr/local/bin/build-apk.sh"]
