// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxRuntime: 'automatic' }],
      'expo-router/babel' // only if still on legacy; else remove this line
    ],
    plugins: []
  };
};
