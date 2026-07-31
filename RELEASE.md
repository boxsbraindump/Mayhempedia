# Mayhempedia Windows beta release checklist

Every public installer must be traceable to a tagged source release and an
official GitHub Release. Until code signing is approved, the installer is an
unsigned beta and the website must say so plainly.

1. Update `package.json`, `package-lock.json`, `data/release-notes.json`, and
   `site/updates.json` to the same version.
2. Run `npm run validate`, `npm run build`, and `npm run build:renderer`.
3. Build the installer with `npm run dist:unsigned`.
4. Calculate the SHA-256 checksum for the setup `.exe`.
5. Commit the release-ready source and create the matching tag, for example
   `v0.1.2`.
6. Create the matching GitHub Release. Upload only the setup `.exe`, its
   `.blockmap`, `latest.yml`, and a `SHA256SUMS.txt` manifest.
7. Point the website download link to that exact GitHub Release asset and show
   the same checksum.
8. Run `npm run release:publish-check`, deploy the `site/` folder, then perform
   a download and launch smoke test on a separate Windows account.
9. Announce the beta only after the website, GitHub Release, and desktop app
   all show the same version.

Once a signing identity is available, replace `npm run dist:unsigned` with
`npm run dist`, verify the Authenticode signature, and update the public
code-signing status.
