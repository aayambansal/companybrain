# CompanyBrain — Chrome extension

Save the current page or a text selection straight into your CompanyBrain
semantic memory. Manifest V3, vanilla HTML/CSS/JS, no build step, no npm
dependencies. Works in Chrome, Edge, and Brave.

```
  ┌──────────────────────────┐
  │ > companybrain     ● ok  │
  │  space   [ default   ▾ ] │
  │  tags    [ ................ ] │
  │  [   Save this page    ] │
  │  [   Save selection    ] │
  └──────────────────────────┘
```

## Load unpacked

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `apps/extension` folder.
4. Pin the CompanyBrain icon to the toolbar (optional).

## Configure

1. Click the icon, then **options** (or right-click the icon → Options).
2. Set:
   - **API URL** — your CompanyBrain server, e.g. `http://localhost:3333`.
   - **API key** — a key starting with `cb_` (create one via the API / dashboard).
   - **Default space** / **Default tags** — optional.
3. Click **Test connection** to verify against `/v1/status`, then **Save**.

## Use

- **Popup** — click the toolbar icon: pick a space, add tags, then
  **Save this page** or **Save selection**.
- **Right-click menu** — on any page: **Save page to CompanyBrain**, or with
  text selected, **Save selection to CompanyBrain**.

A toolbar badge (`OK` / `ERR`) and a desktop notification report the outcome.

Content is extracted client-side with a small readability heuristic (prefer
`<article>`, otherwise the densest text block, with nav/header/footer/script
stripped) and posted to `POST /v1/memories`.

## Permissions

- `activeTab`, `scripting` — read the current tab's content on demand.
- `contextMenus` — the right-click save items.
- `storage` — persist settings in `chrome.storage.sync`.
- `notifications` — save success/failure toasts.
- `host_permissions` (`http://*/*`, `https://*/*`) — reach your self-hosted API
  from any origin without CORS configuration on the server.

## Icons

`icons/icon.svg` is the source. MV3 requires raster icons, so PNGs at
16/32/48/128 are checked in. Regenerate them after editing the SVG:

```sh
./icons/make-icons.sh   # needs rsvg-convert, inkscape, or imagemagick
```
