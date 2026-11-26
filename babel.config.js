module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Lets the app import drizzle-kit's generated .sql migrations as strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
