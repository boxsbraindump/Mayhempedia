# Mayhempedia

Mayhempedia is a local-first Windows companion for League of Legends ARAM: Mayhem.
It helps players turn a champion roll into a practical route: augment priorities,
item order, route reasoning, and locally stored match capture.

Official site: https://mayhempedia.com

## What it does

- Browse route files for the full champion roster.
- Read core and alternate augment priorities alongside starter and final items.
- Show a display-only overlay. It does not automate gameplay or make game actions.
- Read local League Client state to recognize champion select.
- Keep settings, custom routes, and optional local match history on the player device.

## What it does not do

- It does not ask for Riot account passwords.
- It does not read League of Legends game memory.
- It does not automate clicks, purchases, champion actions, or augment choices.
- It does not upload match history or desktop usage telemetry.

More detail is available in the [privacy and play-safety note](https://mayhempedia.com/privacy.html).

## Status

Mayhempedia is in closed beta. Product updates and test access news are posted on
the [official Discord](https://discord.gg/V56Yxb4sPm). Public Windows installers
are published only after they have been code signed and verified.

## Development

Requirements: Node.js 22+ and a local League Client installation for end-to-end
LCU testing.

```bash
npm install
npm start
```

`npm start` builds the Electron main process and Vite renderer, then opens the
desktop app. Use `npm run validate` to validate route data and localization.

## Data and attribution

Mayhempedia combines public League client data, CommunityDragon assets, public
ARAM: Mayhem information, and curated route research. It is a fan-made project
and is not endorsed by Riot Games.

## Contributing and feedback

Report product problems or route-data issues through
[GitHub Issues](https://github.com/boxsbraindump/Mayhempedia/issues), or discuss
closed-beta feedback in Discord. Contributions from non-maintainers should use a
pull request so a maintainer can review the change before it reaches `main`.

## Code signing policy

See [CODE_SIGNING_POLICY.md](./CODE_SIGNING_POLICY.md). The policy explains who
may approve a release, how a release is built, and how a public Windows artifact
is verified before distribution.

## License

Mayhempedia is licensed under the [MIT License](./LICENSE).
