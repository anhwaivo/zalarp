# Zalo PC renderer internals — verified reference

Zalo PC version: **26.10.20** (`C:/Users/vohoa/AppData/Local/Programs/Zalo/Zalo-26.10.20`).
All facts below were read out of `resources/app.asar` (`app/` prefix) for that build.

## 1. Boot chain

`package.json` → `main: bootstrap.js` →
1. `libs/perf-tracing/runtime` (copies `global.performance` onto `process`)
2. `main-dist/migration`
3. `main-dist/main`  ← main process

`main.js` creates the login window (`chat.html` / `child.html`) with:

```js
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: false,
  partition: 'persist:zalo',
  preload: path.join(__dirname, 'preload-render.js')
}
```

There is **no `worldId` / `setPreloads` call anywhere** in `main.js`. So Zalo never
installs a second isolated world: `preload-render.js` runs in the *same* isolated
world that Chromium gives every preload for that context.

## 2. Renderer page

`app/pc-dist/index.html` is a plain page with an inline CSP and this script order
(only the tail matters):

```html
<script src="lazy/default-login-startup-main-startup-shared-worker-znotification...js"></script>
<script src="lazy/vendors-login-startup-main-startup-shared-worker...js"></script>
<script src="render.f32c58b63b6f4273a8a4.js"></script>
```

`render.*.js` is the **webpack 4 runtime chunk** (`__ZaBUNDLENAME__ = 'render'`).
It starts with the bare `__SCRIPT_TYPE__="renderer",function(e){...}({...})` form,
its public path is empty, and it boots with:

```js
var d = this.webpackJsonp = this.webpackJsonp || [], u = d.push.bind(d);
d.push = t;
d = d.slice();
for (var c = 0; c < d.length; c++) t(d[c]);
var s = u;
i.push([13, 5, 10, 2, 8, 13]);   // then a() -> executes module 13 = JUsI
```

`JUsI` requires `iGh7`, `dUtG`, then `ej0K` and `lDvZ`, and finally
`Promise.all([a.e(0), a.e(4), a.e(11), a.e(16), a.e(41), a.e(1), a.e(3), a.e(9),
a.e(7), a.e(14), a.e(15), a.e(30)]).then(a.bind(null, '3OF5'))` — i.e. the whole
app (login → main startup) is lazily **chunk**-loaded after the runtime boots.

Chunk ids that matter (from the runtime's own maps):

| id | name |
|----|------|
| 1  | `default-login-main-startup-shared-worker-znotification` (hash `aafd08147de6e983b76f`) |
| 30 | `main-startup` (hash `e7df64fe0566d4b30368`) |
| 41 | `vendors-main-startup` |
| 15 | `default-main-startup-shared-worker` |
| 14 | `default-login-startup-main-startup` |

## 3. **The hook that makes everything possible** (verified)

`this.webpackJsonp` is the page world's own global. Because the runtime does
`d.push = t` and replays every entry already in `d`, a script that runs in the
**page world** can hand webpack a chunk and receive the real `__webpack_require__`:

```js
window.webpackJsonp.push([
  [],                                    // chunk ids
  { ZADARK: function (m, e, req) { /* req is the real __webpack_require__ */ } },
  [['ZADARK', 35]]                       // module id, 0 = only execute
])
```

`35` must be in the runtime's `n`/`o` maps (`n = {35: 0}`), and `[id, 0]` means
"execute immediately" (`a()` runs modules whose every dep `=== 0`).

Verified two ways with Node's `vm` against the real `render.f32c58b63b6f4273a8a4.js`
(see `_verify_wp.js`, `_verify_wp2.js` in the workspace root):

* **pre-seed** (push before the runtime evaluates): the `for (c = 0; ...) t(d[c])`
  replay delivers `req`. ✓
* **post-hoc** (push after the runtime booted, which is what ZaDark can actually
  do, since its `<script>` tags are appended to `<body>` after `render.js`):
  `window.webpackJsonp.push` is by then webpack's own `t`, and the push still
  delivers `req`. ✓

The captured function exposes the whole registry:

| property | meaning |
|----------|---------|
| `req.m` | all module **factories** in loaded chunks (`13`, `EXGp`, `JUsI`, `lDvZ`, …) |
| `req.c` | module **cache** of instantiated modules (`req.c[id].exports`) |
| `req.e` | chunk loader `req.e(chunkId)` → Promise |
| `req.p` | public path (`""`) |
| `req(id)` | require a module by id |

`req('lDvZ')` failed in the isolated harness only because its own deps (`0W0H`,
`Fzrl`) live in chunks the harness did not load. That is a harness artefact, not a
limitation of the technique.

### Why this beats the preload idea

Zalo's renderer runs with `contextIsolation: true`. A ZaDark preload shares the
preload world, **not** the page world, and `preload-render.js` does not leak its
webpack registry through `contextBridge` (its exposed surface is
`window.$zenv`, `$zcommon`, `$znode`, `$zwindow`, `$zresource`, `$zlogger`,
`$zupdater`, `$zapp`, `$zdownload`, `$zdb`, `$zsessionManager`, `$zmulti`,
`$zcall`, `$zsqlitebw`, `$zsafeStorage`, `$znetwork`, `$zprotocol`, `$znoti`,
`$zbackup`, `$zinapppayment`, `MetriczGlobal`, … — all coarse app APIs, no modules).
So a preload can never reach `ModuleContainer`, the DI tokens, or the message store.
A **page-world** `<script>` can, via the jsonp replay above.

ZaDark already injects page-world scripts (`zadark-pc.js` `writeIndexFile` appends
`<script src="zadark/js/*.min.js">` to `<body>`), so patches belong there — as a new
module alongside `zadark-ads.js`, **not** as a preload.

## 4. Discovery strategy: signature, never module id

Module ids (`NDmK`, `SJqJ`, `afi+`, `JUsI`, `3OF5`, `Et`, `NC`, `Wt`) are webpack
build artefacts and change on every Zalo release. Patches must find their targets
by **shape**:

1. **Live cache sweep** — walk `req.c`; for each `exports`, inspect the value, its
   `.default`, and each prototype one level deep, looking for a named method or a
   named property. Instantiates nothing.
2. **Deferred sweep** — replace `req.m[id]` with a wrapper that calls the original
   factory, then runs the same inspection on the fresh `exports`. This catches
   modules in chunks that load later (login → main startup happen lazily).
3. **Instance warm-up** — if a target only ever exists as an instance, require the
   module that owns it so `req.c` gets populated, then sweep.

Everything must be wrapped in `try/catch`: a Zalo update must degrade a feature to
"does nothing", never break the app.

## 5. Concrete patch targets discovered so far

### Original quality photos

```js
get config () { return cfg.default.file_photo_limit }

getCurrentPhotoResolutionMode () {
  return this.config.enable_upload_original && CloudConfigv2.getInstance().isPaidUser()
    ? PHOTO_RESOLUTION_MODE.ORIGINAL
    : PHOTO_RESOLUTION_MODE.HD
}
```

* `PHOTO_RESOLUTION_MODE = { HD: 0, ORIGINAL: 1 }`.
* The class is exported from module `afi+` (`priv-photo.js`) as
  `PhotoMessageUploader`, and the DI token `IPhotoMessageProcessorDef` comes from
  module `SJqJ`. Resolved by callers as
  `ModuleContainer.resolve(IPhotoMessageProcessorDef)`.
* Consumers also gate on `Jt.default.file_photo_limit`:
  `{enable_upload_original, free_user_can_reupload_original,
    keep_original_param_when_forward, resolutionLimit:{hd:{…}, original:{…}}}`
  and `getSendPhotoConfig(mode)` switches on the mode.
* Sending with `ORIGINAL` also sets `shouldEncodeJxl = false` and, on E2EE,
  `skipGenThumbForPhotoE2EE = true`. Forwarding an `is_original` message downgrades
  it unless `keep_original_param_when_forward`.
* `_shouldDowngradeOriginal` compares `params.width/height/size` against
  `getSendPhotoConfig(mode).{width,height,size}` and is used when sharing media.

**Patch:** make `getCurrentPhotoResolutionMode()` return `ORIGINAL`. Prefer a
prototype patch on the live `PhotoMessageUploader`; fall back to forcing the
`file_photo_limit` flags. Both are reachable by signature sweep alone.

### Message recall / undo

* `main-startup` gates editing on
  `Date.now() - e.sendDttm < cfg.time_enable_edit_undo_msg` (config module `NDmK`).
* Strings present: `undo_req`, `undo_msg`, `undoDeleteMulti`, `STR_UNDO_MSG`.
* `NDmK` is Zalo's app-config module and also holds `core_conf`
  (`ui_msg_cache_size`, `log_crash`, `enable_block_cache`, `read_clipboard`,
  `read_recent`, `log_action_limit`, `white_list_file`, `downloadQuota`,
  `downloadRespCache{rootFolder:'resp_cache'}`, `db_business{enable:true}`,
  `conversationManager{dbTimeout,dbVerifyTimeout}`) plus `mergeConfig`,
  `$AppConfig`, `ChangeDomain`, `CONFIG_DOMAIN`.

### Media expiry

Messages carry `isExpired` / `isExpiredAll`; `BIG_FILE_EXPIRED` and
`FORWARD_ERR_CODE.EXPIRED` exist in `main-startup`. The gate is a client-side
computation over the message's timestamps, so it is patchable in the renderer.
