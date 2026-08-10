module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // WatermelonDB's model classes use the legacy (stage-1) decorator syntax
  // for @field/@text/@date/@children (see src/db/models/*.ts) — TypeScript
  // type-checks these fine via tsconfig's experimentalDecorators, but that's
  // a compile-time-only concern; Metro's actual runtime transform needs
  // this plugin too, or every model file fails to bundle with "Support for
  // the experimental syntax 'decorators' isn't currently enabled".
  plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
};
