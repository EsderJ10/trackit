module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Inline Drizzle's generated `.sql` migrations as strings so Metro/Babel
      // never tries to parse them as JavaScript.
      ['inline-import', { extensions: ['.sql'] }],
    ],
    // Note: the reanimated/worklets babel plugin is added automatically by
    // babel-preset-expo (SDK 56) when react-native-worklets is installed.
  };
};
