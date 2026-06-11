module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Note: the reanimated/worklets babel plugin is added automatically by
    // babel-preset-expo (SDK 56) when react-native-worklets is installed.
  };
};
