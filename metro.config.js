const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// drizzle-kit migrations are .sql files bundled into the app.
config.resolver.sourceExts.push('sql');

module.exports = config;
