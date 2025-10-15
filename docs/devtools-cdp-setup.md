# Chrome DevTools (CDP) Setup

This repo includes a helper to launch Google Chrome with the DevTools Protocol enabled, so you can attach DevTools or CDP clients from your local machine.

## Quick Start (Windows / default)

- Run: `npm run devtools:chrome`
- It starts Chrome headless on port `9222` with an isolated user data dir under `.tmp/chrome-cdp-profile`.
- In another Chrome window, open `chrome://inspect/#devices` and click "Configure"; add `127.0.0.1:9222`. You can then attach to targets.

## Options

- Port: `npm run devtools:chrome -- --port 9333`
- Visible mode: `npm run devtools:chrome -- --no-headless`
- Initial URL: `npm run devtools:chrome -- --url https://example.com`
- Custom profile dir: `npm run devtools:chrome -- --user-data-dir C:/temp/cdp-profile`

Environment variables:

- `CHROME_PATH`: absolute path to the Chrome executable. Set if auto-detection fails.

## Notes

- Headless mode is recommended for automation; attach DevTools from a separate Chrome via `chrome://inspect`.
- If Chrome isn’t found, install Google Chrome or set `CHROME_PATH`.
- You can verify CDP is up by visiting `http://127.0.0.1:9222/json/version` in a browser.

## Using a CDP Client (optional)

To script against CDP, consider libraries like `chrome-remote-interface` or `puppeteer` (install separately):

```bash
npm i -D chrome-remote-interface
```

Example (Node):

```js
const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ host: '127.0.0.1', port: 9222 });
  const { Page, Runtime } = client;
  await Page.enable();
  await Page.navigate({ url: 'https://example.com' });
  await Page.loadEventFired();
  const res = await Runtime.evaluate({ expression: 'document.title' });
  console.log(res.result.value);
  await client.close();
})();
```

