# My Bus (Alexa skill)

Say "Alexa, next bus" and Alexa tells you the next few (default: 3) **direct** buses from your stop to your destination in Berlin (BVG/VBB), as "in N minutes" with realtime delays included.

Supported locales: `ja-JP` (invocation name: マイバス) and `en-US` (invocation name: my bus).
Data source: [`v6.bvg.transport.rest`](https://v6.bvg.transport.rest) (community-run, no API key).

## Project layout
```
src/              TypeScript sources (config / bvgClient / speech / handlers / index)
test/             Jest unit tests
lambda/           Deployed to Alexa-hosted (index.js -> dist/; build output is committed)
skill-package/    skill.json and ja-JP / en-US interaction models
scripts/smoke.js  Live check against the real API
```

## Configuration
Stop IDs are **not** stored in the repository. Provide them in one of two ways:

1. Environment variables `FROM_STOP_ID`, `TO_STOP_ID` and optionally `BUS_COUNT` (e.g. on your own AWS Lambda)
2. A git-ignored file `lambda/stops.json` (needed for Alexa-hosted, which has no environment variables):
   ```sh
   cp lambda/stops.example.json lambda/stops.json   # then edit the IDs
   ```

| Key | Env var | Required | Default | Description |
|---|---|---|---|---|
| `fromId` | `FROM_STOP_ID` | yes | - | Origin stop ID |
| `toId` | `TO_STOP_ID` | yes | - | Destination stop ID |
| `count` | `BUS_COUNT` | no | `3` | Number of buses to announce (1-10) |

Environment variables take precedence over `stops.json`.

Find stop IDs with:
```sh
curl "https://v6.bvg.transport.rest/locations?query=Alexanderplatz&results=3"
```

## Development
```sh
npm install
npm test          # unit tests
npm run build     # src -> lambda/dist
npm run smoke     # prints the ja/en speech using the real API (needs stop IDs)
```

## Deploy (Alexa-hosted)
1. In the [Alexa developer console](https://developer.amazon.com/alexa/console/ask), create a skill:
   Custom model, **Alexa-hosted (Node.js)**, start from scratch, primary locale Japanese; then add English (US).
2. Paste `skill-package/interactionModels/custom/ja-JP.json` / `en-US.json` into each locale's JSON editor, save and build.
3. Run `npm run build` and upload the contents of `lambda/` (`index.js`, `package.json`, `dist/`, **`stops.json`**) via the Code tab, or push them to the Alexa-hosted git repository.
   Note: `stops.json` is git-ignored here, so it must be added explicitly to the Alexa-hosted repository (that repository is private).
4. Enable testing in the Test tab and try "open my bus" / 「マイバスを開いて」.

## Deploy with ask-cli (git push)
One-time setup:
```sh
npm i -g ask-cli
ask configure                                   # log in with your Amazon developer account
ask init --hosted-skill-id <skill-id>           # clones the private Alexa-hosted repository
export HOSTED_REPO_DIR=/path/to/that/clone      # e.g. in ~/.zshrc (keep personal paths out of this repo)
```

Each deploy:
```sh
npm run deploy                 # test, build, copy lambda/ files, commit and push
npm run deploy -- --dry-run    # show what would change, then restore the clone
```
The script copies `index.js`, `package.json`, `stops.json` and `dist/` into the clone's `lambda/` and never touches its `skill-package/`. `stops.json` is committed only to the private Alexa-hosted repository.

## Routine ("Alexa, next bus")
A custom skill cannot be launched by "next bus" alone. Create a Routine in the Alexa app:
- When: voice, "next bus" (or 「次のバス」)
- Action: Custom, "open my bus" (or 「マイバスを開いて」)

## Notes
- The API's `direction` filter is reliable: every returned trip was verified (via `/trips/{id}`) to stop at the target after the origin, even when its final destination name is different (loop lines, lines continuing beyond the target). Do not filter by destination name.
- Cancelled trips are excluded, results are sorted by realtime departure (`when`), and the HTTP timeout is 3 seconds.
