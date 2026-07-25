# Code signing policy

This policy applies to every public Mayhempedia Windows installer.

## Release rule

Mayhempedia publishes only an installer built by the repository's trusted GitHub
Actions release workflow, signed with a valid code-signing identity, and verified
before it is uploaded to a public release.

Unsigned artifacts are allowed only for local development and private QA. They
must not be uploaded as public community downloads.

## Roles

- **Author:** a maintainer who prepares a release change in the Mayhempedia
  repository.
- **Reviewer:** a maintainer who reviews contributions from non-maintainers
  before they merge into `main`.
- **Approver:** the `boxsbraindump` GitHub repository owner, who approves each
  signing request and public release.

Everyone with write access to the repository or signing service must use
multi-factor authentication.

## Build and approval

1. A versioned source commit is reviewed and tagged as `vX.Y.Z`.
2. The trusted GitHub Actions workflow builds the Windows release candidate from
   that source only.
3. The approver checks the version, release notes, and generated artifact before
   approving a signing request.
4. The finished installer signature is verified on Windows before publication.
5. Only the signed installer and its matching release metadata are published.

## Privacy and user safety

Mayhempedia does not silently transmit player data. See the public
[privacy policy](https://mayhempedia.com/privacy.html) for the app's local-first
data handling and display-only game integration.

## SignPath Foundation

Mayhempedia has applied for open-source code signing. If accepted, the public
release policy will state: "Free code signing provided by SignPath.io, certificate by SignPath Foundation." Until then, no public installer is represented as signed.

## Reporting a signing concern

Open a GitHub issue with the release version, file name, and the concern:
https://github.com/boxsbraindump/Mayhempedia/issues
