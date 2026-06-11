const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle's Expo migrations import the generated `.sql` files as source modules.
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './global.css' });
