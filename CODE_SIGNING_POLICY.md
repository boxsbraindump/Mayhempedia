# Code signing and release policy

This policy applies to every public Mayhempedia Windows installer.

## Current public beta status

Mayhempedia 0.1.2 is an **unsigned public beta**. Windows may display an
“Unknown publisher” warning until a code-signing certificate is available.
The warning must never be hidden or described as a signature.

Download the installer only from the official
[Mayhempedia website](https://mayhempedia.com) or its matching
[GitHub Release](https://github.com/boxsbraindump/Mayhempedia/releases).
Each release publishes its version, source reference, and SHA-256 checksum so
testers can verify the downloaded file before running it.

## Release rule

1. A versioned source commit is reviewed and tagged as `vX.Y.Z`.
2. The Windows installer is built from that repository source.
3. The matching GitHub Release contains the installer, release notes, and its
   SHA-256 checksum.
4. The official website links only to that exact GitHub Release asset.
5. A tester smoke-checks the release before it is announced.

## Roles

- **Author:** a maintainer who prepares a release change in the Mayhempedia
  repository.
- **Reviewer:** a maintainer who reviews contributions from non-maintainers
  before they merge into `main`.
- **Release approver:** the `boxsbraindump` GitHub repository owner, who checks
  the version, release notes, asset name, and checksum before announcement.

Everyone with write access to the repository or signing service must use
multi-factor authentication.

## Privacy and user safety

Mayhempedia does not silently transmit player data. See the public
[privacy policy](https://mayhempedia.com/privacy.html) for the app's local-first
data handling and display-only game integration.

## Future code signing

Mayhempedia has applied for open-source code signing through SignPath
Foundation. If accepted, releases will state: Free code signing provided by SignPath.io, certificate by SignPath Foundation. The release workflow will then verify the final Windows signature before publishing.

## Reporting a release concern

Open a GitHub issue with the release version, file name, checksum, and the
concern: https://github.com/boxsbraindump/Mayhempedia/issues
