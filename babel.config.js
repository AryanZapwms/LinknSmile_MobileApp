// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      // Release bundles: remove console.log/info/debug so nothing about users,
      // carts or requests ends up in device logs. console.warn and
      // console.error stay (they feed crash reports).
      production: {
        plugins: [['transform-remove-console', { exclude: ['error', 'warn'] }]],
      },
    },
  };
};
