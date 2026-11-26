// Build native code for arm64-v8a only. Both target phones (S23 Ultra, OnePlus 7) are arm64,
// so skipping armeabi-v7a, x86 and x86_64 cuts native compile time by roughly 75% (DECISIONS D32).
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'reactNativeArchitectures';
const VALUE = 'arm64-v8a';

module.exports = function withArm64Only(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
    cfg.modResults.push({ type: 'property', key: KEY, value: VALUE });
    return cfg;
  });
};
