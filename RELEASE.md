# Mayhempedia Windows release checklist

Public installers must be signed. Do not publish an installer produced by `npm run dist:unsigned`.

Keep the public website pointed at the latest signed release. The repository may
carry the next package version before its installer exists; update the website
download URL only after the signed artifact has passed the smoke test below.

1. Update `package.json` and `package-lock.json` to the next semantic version.
2. Commit the release-ready source, then create the matching tag, for example `v0.1.2`.
3. Configure a real Windows code-signing certificate through `WIN_CSC_LINK` (or `CSC_LINK`) and its password. The certificate subject becomes the publisher Windows shows to players.
4. Run `npm run dist`. It refuses to build a public release without a signing identity and verifies the finished installer signature.
5. Upload only the signed setup `.exe`, `.blockmap`, and `latest.yml` to the matching GitHub Release.
6. Install the release on a separate Windows account, confirm the publisher is correct, launch the app, connect the League Client, open the overlay, and test update detection.
7. Mark that entry as `released` in `data/release-notes.json`, then run `npm run release:publish-check`. It verifies the packaged version, website homepage, public Updates page, and analytics version are identical.
8. Deploy the `site/` folder, then open the homepage and Updates page once in a browser as the final smoke test.

For temporary internal QA only, use `npm run dist:unsigned`. Treat it as a private artifact, not a community download.
