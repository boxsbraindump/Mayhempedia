# Mayhempedia conversion events

The public pages expose a small, privacy-first event contract. Events are inert
by default: GitHub Pages does not send anything unless an analytics provider or
endpoint is explicitly wired in.

## Events

- `landing_view`: a page loaded
- `preview_clicked`: a visitor chose the interactive product preview
- `demo_viewed`: the preview section entered the viewport
- `download_clicked`: a visitor chose a Windows download, with its placement

Every event includes the public release version and page path. No account,
machine, or game data is attached.

## Wiring a provider

The page forwards the same payload to any available `dataLayer`, Zaraz, or
Plausible integration. A first-party endpoint can be enabled by defining
`window.MAYHEMPEDIA_ANALYTICS_ENDPOINT` before `app.js` loads. Leave the value
unset to keep the pages fully quiet.

The next product funnel step is intentionally external to the public pages:
read GitHub Release asset downloads, then add opt-in desktop activation events
for first open, League Client connected, champion detected, and overlay shown.
The app currently does not upload those events.
