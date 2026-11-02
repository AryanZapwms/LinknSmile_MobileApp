// app.config.js
// Extends app.json (the static config stays there).
//
// Sentry: the JS SDK reports crashes as soon as EXPO_PUBLIC_SENTRY_DSN is set.
// The build plugin below additionally uploads source maps, so stack traces are
// readable. It needs credentials, and without them it fails the native build,
// so it is only enabled when all three are present in the build environment
// (EAS → Environment variables / secrets):
//
//   SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
//
// Android push: google-services.json is not in the repo. GOOGLE_SERVICES_JSON
// is an EAS file variable, so on EAS it holds the path to the file. An Android
// build made without it has no Firebase config and cannot get a push token.
module.exports = ({ config }) => {
  const organization = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const plugins = [...(config.plugins ?? [])];

  if (organization && project && process.env.SENTRY_AUTH_TOKEN) {
    plugins.push(['@sentry/react-native/expo', { organization, project }]);
  }

  return {
    ...config,
    plugins,
    android: { ...config.android, ...(googleServicesFile && { googleServicesFile }) },
  };
};
