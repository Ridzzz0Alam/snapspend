// Point Gradle at a CMake whose bundled ninja (>= 1.12) supports Windows long paths (DECISIONS D35).
// The SDK default CMake 3.22.1 ships ninja 1.10.2, which fails with "mkdir(...): No such file or
// directory" on Reanimated's deep C++ object paths. Writes `cmake.dir` into android/local.properties
// (machine-specific, never committed) only if that CMake is installed in the local Android SDK.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';

function sdkRoot() {
  if (process.env.ANDROID_HOME) return process.env.ANDROID_HOME;
  if (process.env.ANDROID_SDK_ROOT) return process.env.ANDROID_SDK_ROOT;
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
  }
  return path.join(os.homedir(), 'Android', 'Sdk');
}

module.exports = function withCmakeDir(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const cmakeDir = path.join(sdkRoot(), 'cmake', CMAKE_VERSION);
      if (!fs.existsSync(cmakeDir)) return cfg;

      const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      const lines = fs.existsSync(file)
        ? fs
            .readFileSync(file, 'utf8')
            .split(/\r?\n/)
            .filter((l) => l && !l.startsWith('cmake.dir='))
        : [];
      lines.push(`cmake.dir=${cmakeDir.replace(/\\/g, '/')}`);
      fs.writeFileSync(file, lines.join('\n') + '\n');
      return cfg;
    },
  ]);
};
