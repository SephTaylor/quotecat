// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // If your app uses Reanimated, keep the plugin below. If not, you can remove it.
    plugins: ['react-native-reanimated/plugin'],
  };
};
