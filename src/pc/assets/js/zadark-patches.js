/*
  ZaDark – Zalo Dark Mode
  Made by Quaric

  Ported from NexAlloy-XES (an LSPosed module that patches Zalo for Android) to
  Zalo PC, for the features that have a PC equivalent.

  WHY THIS FILE RUNS IN THE PAGE WORLD
  ------------------------------------
  Zalo PC's renderer runs with `contextIsolation: true`, `sandbox: false` and
  `nodeIntegration: false`. Its preload (`preload-render.js`) exposes only a
  contextBridge facade ($zenv, $zapp, $zdb, $zsqlitebw, ...) which has no access to
  the application's module registry. So a patch that needs to reach application
  logic cannot live in a preload or the main process — it has to be a plain
  <script> in the renderer's page world. That is what zadark-pc.js injects.

  HOW WE REACH APPLICATION CODE
  -----------------------------
  The renderer is a webpack 4 bundle. One synthetic
  `window.webpackJsonp.push([[],[{ID: factory}],[[ID, chunkId]]])` call hands us the
  real `__webpack_require__`, and from there `req.m` (factory map), `req.c`
  (instantiated cache) and `req(id)` (invoke a factory). This works both before the
  runtime boots (the runtime replays the pre-existing array) and after it boots
  (push is then webpack's own chunk handler). See docs/zalo-pc-internals.md.

  Module ids ("afi+", "SJqJ", "NDmK", ...) are webpack build artefacts that change
  on every Zalo release, so nothing here ever matches an id. Modules are located by
  stable shapes — export names, prototype method names, own property names — and
  every step is guarded, so a Zalo update degrades to "the feature silently does
  nothing" instead of breaking the chat window.
*/
(function () {
  'use strict'

  const LOG_PREFIX = '[ZaDark]'

  // Mirrors ZADARK_ENABLED_* in zadark.js. Read live on every call so toggling a
  // switch takes effect without waiting for the "restart Zalo" toast.
  const KEY_ORIGINAL_PHOTO = '@ZaDark:ENABLED_ORIGINAL_PHOTO'
  const KEY_KEEP_UNSENT = '@ZaDark:ENABLED_KEEP_UNSENT'
  const KEY_KEEP_EXPIRED_MEDIA = '@ZaDark:ENABLED_KEEP_EXPIRED_MEDIA'

  const debug = (...args) => {
    if (typeof window.__ZADARK_DEBUG__ === 'undefined' || window.__ZADARK_DEBUG__) {
      console.log(LOG_PREFIX, ...args)
    }
  }

  const readFlag = (key) => {
    try {
      return window.localStorage.getItem(key) === 'true'
    } catch (e) {
      return false
    }
  }

  /* ------------------------------------------------------------------ *
   * webpack access
   * ------------------------------------------------------------------ */

  // Chunk id 35 is the "render" chunk — the one the runtime bootstrap itself
  // belongs to (the runtime's `n={35:0}` map). Any id already known to the
  // runtime is accepted; if a future build drops 35 the capture simply fails and
  // every patch stays inactive.
  const RENDER_CHUNK_ID = 35
  const CAPTURE_FACTORY_ID = '__ZADARK_WEBPACK_CAPTURE__'

  let req = null

  const captureWebpackRequire = () => {
    try {
      const stack = (window.webpackJsonp = window.webpackJsonp || [])
      const push = stack.push
      if (typeof push !== 'function') return

      push.call(stack, [
        [],
        {
          [CAPTURE_FACTORY_ID]: function (module, exports, __webpack_require__) {
            req = __webpack_require__
          }
        },
        [[CAPTURE_FACTORY_ID, RENDER_CHUNK_ID]]
      ])

      // Future lazy chunks arrive through this same push, so observing it lets us
      // re-run the module sweep exactly when new factories are registered.
      stack.push = function () {
        const result = push.apply(this, arguments)
        scheduleSweep()
        return result
      }
    } catch (e) {
      debug('webpack capture failed', e)
    }
  }

  /* ------------------------------------------------------------------ *
   * patch registry
   * ------------------------------------------------------------------ */

  const patches = []
  // Ids already examined once.
  const scannedIds = new Set()
  // Ids whose matched patch has not applied yet; only these are examined again.
  const retryIds = new Set()
  // Attempts spent per (patch, id), so a duplicate or decoy match can never starve the
  // real module while one whose dependencies are still in flight gets a few more sweeps.
  const attempts = new Map()

  const MAX_ATTEMPTS_PER_ID = 12

  /**
   * @param {string} name    for diagnostics
   * @param {(source: string) => boolean} match  stable-shape test on a factory body
   * @param {(id: string) => void} apply         hook, throws to request a retry
   */
  const register = (name, match, apply) => {
    patches.push({ name, match, apply, applied: false })
  }

  const pendingPatches = () => patches.filter((patch) => !patch.applied)

  const attemptKey = (patch, id) => patch.name + '\u0000' + id
  const attemptCount = (patch, id) => attempts.get(attemptKey(patch, id)) || 0

  const sweep = () => {
    if (!req) return

    const factories = req.m || {}
    if (!pendingPatches().length) return stopPolling()

    for (const id in factories) {
      if (scannedIds.has(id) && !retryIds.has(id)) continue
      scannedIds.add(id)

      let source
      try {
        source = String(factories[id])
      } catch (e) {
        continue
      }

      let stillPending = false

      for (const patch of patches) {
        if (patch.applied) continue
        if (attemptCount(patch, id) >= MAX_ATTEMPTS_PER_ID) continue

        let matched = false
        try {
          matched = patch.match(source) === true
        } catch (e) {
          matched = false
        }
        if (!matched) continue

        // Count the attempt before applying, so a hook that throws cannot loop.
        const spent = attemptCount(patch, id) + 1
        attempts.set(attemptKey(patch, id), spent)

        try {
          patch.apply(id)
          patch.applied = true
          debug('patched', patch.name)
        } catch (e) {
          if (spent === 1) debug('deferred', patch.name, e && e.message)
          if (spent < MAX_ATTEMPTS_PER_ID) stillPending = true
        }
      }

      if (stillPending) retryIds.add(id)
      else retryIds.delete(id)

      if (!pendingPatches().length) return
    }

    if (!pendingPatches().length) stopPolling()
  }

  let sweepTimer = null
  const scheduleSweep = () => {
    if (sweepTimer) return
    sweepTimer = window.setTimeout(() => {
      sweepTimer = null
      sweep()
    }, 50)
  }

  let pollTimer = null
  const startPolling = () => {
    const startedAt = Date.now()
    pollTimer = window.setInterval(() => {
      sweep()
      if (!pendingPatches().length) {
        stopPolling()
        return
      }
      // Back off once the application has finished booting: everything that is
      // going to load has loaded well before this.
      if (Date.now() - startedAt > 120000) {
        window.clearInterval(pollTimer)
        pollTimer = window.setInterval(() => {
          sweep()
          if (!pendingPatches().length) stopPolling()
        }, 10000)
      }
    }, 2000)
  }
  const stopPolling = () => {
    if (pollTimer) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
  }

  /* ------------------------------------------------------------------ *
   * helpers shared by the patches
   * ------------------------------------------------------------------ */

  /** The module object a factory produces, or throws so the sweep retries later. */
  const requireModule = (id) => {
    const module = req(id)
    if (!module) throw new Error('module ' + id + ' produced no exports')
    return module
  }

  /* ------------------------------------------------------------------ *
   * Feature: send photos at original quality
   * Ported from NexAlloy-XES media/PreferOriginalPhotoQualityPatch.kt
   *
   * On PC the whole feature is gated by ONE method:
   *
   *   getCurrentPhotoResolutionMode () {
   *     return this.config.enable_upload_original &&
   *            CloudConfigv2.getInstance().isPaidUser()
   *       ? PHOTO_RESOLUTION_MODE.ORIGINAL
   *       : PHOTO_RESOLUTION_MODE.HD
   *   }
   *
   * with `PHOTO_RESOLUTION_MODE = { HD: 0, ORIGINAL: 1 }`. Forcing it to ORIGINAL
   * makes every downstream gate open by itself: the send path stops encoding JXL,
   * getSendPhotoConfig() returns the 30000x30000 / 100MB original limits instead of
   * the 2560x2560 / 5MB HD ones, the forward path's _shouldDowngradeOriginal()
   * early-returns false, and the uploader picks the `/photo_original/` endpoint.
   *
   * The forward path additionally reads two raw config flags outside that method
   * (`free_user_can_reupload_original`, and `keep_original_param_when_forward` when
   * it decides whether to strip `is_original`), so those are pinned too. Server
   * settings replace the whole `file_photo_limit` object when they arrive, so the
   * pin is installed as an accessor on the settings object rather than as a
   * one-shot mutation.
   * ------------------------------------------------------------------ */

  const PHOTO_RESOLUTION_MODE_ORIGINAL = 1

  register(
    'original-photo-quality/mode',
    // The DEFINITION, not the bare name: `getCurrentPhotoResolutionMode` also appears
    // at three call sites and inside a ~170KB caller module, so matching the name alone
    // would pick the wrong module. This exact definition occurs once in the bundle.
    (source) => source.indexOf('getCurrentPhotoResolutionMode(){return this.config.enable_upload_original') !== -1,
    (id) => {
      const module = requireModule(id)
      const Uploader = module.PhotoMessageUploader || (module.default && module.default.PhotoMessageUploader)
      if (!Uploader || !Uploader.prototype) throw new Error('PhotoMessageUploader export missing')

      const proto = Uploader.prototype
      const original = proto.getCurrentPhotoResolutionMode
      if (typeof original !== 'function') throw new Error('getCurrentPhotoResolutionMode is not a method')

      proto.getCurrentPhotoResolutionMode = function () {
        if (!readFlag(KEY_ORIGINAL_PHOTO)) return original.apply(this, arguments)
        return PHOTO_RESOLUTION_MODE_ORIGINAL
      }
    }
  )

  const ORIGINAL_QUALITY_FLAGS = [
    'enable_upload_original',
    'free_user_can_reupload_original',
    'keep_original_param_when_forward'
  ]

  register(
    'original-photo-quality/config',
    // The settings singleton is the only module that both reads the local default
    // (`DEFAULT_SEND_PHOTO_CONFIG`) and exposes the live `file_photo_limit`; other
    // modules merely consume the property.
    (source) => source.indexOf('DEFAULT_SEND_PHOTO_CONFIG') !== -1 && source.indexOf('file_photo_limit') !== -1,
    (id) => {
      const module = requireModule(id)
      const settings = module.default
      if (!settings || typeof settings !== 'object') throw new Error('default export missing')
      if (!Object.prototype.hasOwnProperty.call(settings, 'file_photo_limit')) {
        throw new Error('not the settings module')
      }

      let current = settings.file_photo_limit

      const pin = (limit) => {
        if (limit && typeof limit === 'object' && readFlag(KEY_ORIGINAL_PHOTO)) {
          for (const flag of ORIGINAL_QUALITY_FLAGS) {
            try {
              limit[flag] = 1
            } catch (e) {}
          }
        }
        return limit
      }

      try {
        Object.defineProperty(settings, 'file_photo_limit', {
          configurable: true,
          enumerable: true,
          get () {
            return pin(current)
          },
          set (value) {
            current = value
          }
        })
      } catch (e) {
        // Frozen settings object: fall back to a one-shot pin. The periodic sweep
        // re-pins it when the server overwrites the config later.
        pin(settings.file_photo_limit)
      }

      pin(settings.file_photo_limit)
    }
  )

  /* ------------------------------------------------------------------ *
   * boot
   * ------------------------------------------------------------------ */

  captureWebpackRequire()

  if (req) {
    sweep()
  }

  window.addEventListener('load', sweep)
  startPolling()

  window.ZaDarkPatches = {
    sweep,
    status: () =>
      patches.map((patch) => ({
        name: patch.name,
        applied: patch.applied
      }))
  }
})()
