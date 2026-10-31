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
          /* eslint-disable-next-line camelcase */
          [CAPTURE_FACTORY_ID]: function (module, exports, __webpack_require__) {
            req = __webpack_require__ // eslint-disable-line camelcase
          }
        },
        [[CAPTURE_FACTORY_ID, RENDER_CHUNK_ID]]
      ])

      // Future lazy chunks arrive through this same push, so observing it lets us
      // re-run the module sweep exactly when new factories are registered.
      // webpack calls this synchronously after installing a chunk's factories and
      // before any `import()` continuation runs, so factory wraps happen here, while
      // the new modules are guaranteed not to be instantiated yet.
      stack.push = function (chunk) {
        const result = push.apply(this, arguments)
        try {
          wrapFactories(chunk && chunk[1] ? Object.keys(chunk[1]) : null)
        } catch (e) {
          debug('factory wrap failed', e)
        }
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
   * factory wraps
   *
   * webpack 4 defines ES-module exports as non-configurable getters
   * (`__webpack_require__.d`), so `req(id).fn = f` silently does nothing for a
   * named export. A function exported that way can only be replaced while its
   * module is defined: the factory in `req.m` is wrapped so that the `.d` calls it
   * makes install our getter instead. Patching at definition (rather than swapping
   * `module.exports` afterwards) also covers modules that grabbed the exports
   * object early through a circular import.
   * ------------------------------------------------------------------ */

  const factoryPatches = []
  const factoryScannedIds = new Set()

  /**
   * @param {string} name    for diagnostics
   * @param {(source: string) => boolean} match  stable-shape test on a factory body
   * @param {Object<string, (original: Function) => Function>} overrides  by export name
   */
  const registerFactory = (name, match, overrides) => {
    factoryPatches.push({ name, match, overrides, applied: false, error: null })
  }

  const wrapFactory = (id, overrides) => {
    const original = req.m[id]
    req.m[id] = function (module, exports, require) {
      const patchedRequire = function () {
        return require.apply(this, arguments)
      }
      Object.keys(require).forEach((key) => {
        patchedRequire[key] = require[key]
      })
      patchedRequire.d = function (target, name, getter) {
        const override = target === exports && overrides[name]
        if (!override) return require.d.apply(this, arguments)
        let wrapped = null
        return require.d.call(this, target, name, () => wrapped || (wrapped = override(getter())))
      }
      return original.call(this, module, exports, patchedRequire)
    }
  }

  /** Wraps matching factories among `ids` (all known factories when omitted). */
  const wrapFactories = (ids) => {
    if (!req || !req.m) return
    const pending = factoryPatches.filter((patch) => !patch.applied)
    if (!pending.length) return

    for (const id of ids || Object.keys(req.m)) {
      if (factoryScannedIds.has(id) || !req.m[id]) continue
      factoryScannedIds.add(id)

      let source
      try {
        source = String(req.m[id])
      } catch (e) {
        continue
      }

      for (const patch of pending) {
        if (patch.applied) continue
        let matched = false
        try {
          matched = patch.match(source) === true
        } catch (e) {}
        if (!matched) continue

        if (req.c && req.c[id]) {
          // Instantiated before we saw it: its exports are sealed.
          patch.error = 'module ' + id + ' already instantiated'
          debug('too late to wrap', patch.name)
          continue
        }
        wrapFactory(id, patch.overrides)
        patch.applied = true
        patch.error = null
        debug('wrapped', patch.name)
      }
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
   * Feature: block message recall (anti-recall)
   * Prevents others from wiping recalled messages from cache & display
   * ------------------------------------------------------------------ */

  const MAX_SNAPSHOT_ENTRIES = 5000
  const messageSnapshots = new Map()

  const snapshotMessage = (o) => {
    if (!o) return
    const id = o.msgId || o.globalMsgId
    if (!id) return
    const key = String(id)
    if (messageSnapshots.has(key)) return
    if (messageSnapshots.size >= MAX_SNAPSHOT_ENTRIES) {
      const oldestKey = messageSnapshots.keys().next().value
      messageSnapshots.delete(oldestKey)
    }
    let msg = o.message
    if (msg && typeof msg === 'object') {
      try {
        msg = JSON.parse(JSON.stringify(msg))
      } catch (e) {}
    }
    messageSnapshots.set(key, {
      msgType: o.msgType,
      originMsgType: o.originMsgType,
      message: msg,
      e2eeStatus: o.e2eeStatus,
      v: o.v,
      quote: o.quote ? JSON.parse(JSON.stringify(o.quote)) : undefined
    })
  }

  const getSnapshot = (id) => {
    if (!id) return null
    return messageSnapshots.get(String(id)) || null
  }

  const isSentByMe = (m) => {
    if (!m) return false
    return m.fromUid === '0' || m.fromUid === 0 || m.uidFrom === '0' || m.uidFrom === 0
  }

  register(
    'anti-recall/converter',
    (source) => source.indexOf('convertToRecalled(t){') !== -1 && source.indexOf('convertToDelEveryone(') !== -1,
    (id) => {
      const module = requireModule(id)
      const helper = module.default
      if (!helper || typeof helper.convertToRecalled !== 'function') {
        throw new Error('convertToRecalled missing')
      }

      const origRecalled = helper.convertToRecalled
      helper.convertToRecalled = function (t) {
        if (!readFlag(KEY_KEEP_UNSENT) || isSentByMe(t)) {
          return origRecalled.apply(this, arguments)
        }
        snapshotMessage(t)
        const s = getSnapshot(t && (t.msgId || t.globalMsgId))
        if (s && t) {
          t.msgType = s.msgType
          t.originMsgType = s.originMsgType
          t.message = s.message
          t.e2eeStatus = s.e2eeStatus
          t._zadarkRecalled = true
        }
        return t
      }

      const origDelEveryone = helper.convertToDelEveryone
      if (typeof origDelEveryone === 'function') {
        helper.convertToDelEveryone = function (t) {
          if (!readFlag(KEY_KEEP_UNSENT) || isSentByMe(t)) {
            return origDelEveryone.apply(this, arguments)
          }
          snapshotMessage(t)
          const s = getSnapshot(t && (t.msgId || t.globalMsgId))
          if (s && t) {
            t.msgType = s.msgType
            t.originMsgType = s.originMsgType
            t.message = s.message
            t.e2eeStatus = s.e2eeStatus
            t._zadarkRecalled = true
          }
          return t
        }
      }
    }
  )

  register(
    'anti-recall/redux-undo',
    (source) => source.indexOf('mergeUndo(e,t){') !== -1 && source.indexOf('mergeUndoMulti(e,t){') !== -1,
    (id) => {
      const module = requireModule(id)
      const helper = module.b || module.default
      if (!helper || typeof helper.mergeUndo !== 'function') {
        throw new Error('mergeUndo missing')
      }

      const origMergeUndo = helper.mergeUndo
      helper.mergeUndo = function (e, t) {
        if (!readFlag(KEY_KEEP_UNSENT) || isSentByMe(e)) {
          return origMergeUndo.apply(this, arguments)
        }
        snapshotMessage(e)
        const res = origMergeUndo.apply(this, arguments)
        if (res && e) {
          res.msgType = e.msgType
          res.originMsgType = e.originMsgType
          res.message = e.message
          res.e2eeStatus = e.e2eeStatus
          if (e.quote && res.quote) {
            res.quote.cliMsgType = e.quote.cliMsgType
            res.quote.msg = e.quote.msg
          }
          res._zadarkRecalled = true
        }
        return res
      }

      const origMergeUndoMulti = helper.mergeUndoMulti
      if (typeof origMergeUndoMulti === 'function') {
        helper.mergeUndoMulti = function (e, t) {
          if (!readFlag(KEY_KEEP_UNSENT) || isSentByMe(e)) {
            return origMergeUndoMulti.apply(this, arguments)
          }
          snapshotMessage(e)
          const res = origMergeUndoMulti.apply(this, arguments)
          if (res && e) {
            res.msgType = e.msgType
            res.originMsgType = e.originMsgType
            res.message = e.message
            res.e2eeStatus = e.e2eeStatus
            if (e.quote && res.quote) {
              res.quote.cliMsgType = e.quote.cliMsgType
              res.quote.msg = e.quote.msg
            }
            res._zadarkRecalled = true
          }
          return res
        }
      }
    }
  )

  register(
    'anti-recall/cache-undo',
    (source) => source.indexOf('undoMessages(e){') !== -1 && source.indexOf('editContentMessages(e){') !== -1 && source.indexOf('get messageCache()') !== -1,
    (id) => {
      const module = requireModule(id)
      const collector = module.default
      if (!collector || typeof collector.init !== 'function') {
        throw new Error('collector default export missing')
      }

      const hookCache = (cache) => {
        if (!cache) return
        const proto = Object.getPrototypeOf(cache)
        if (!proto || typeof proto.undoMessages !== 'function') return
        if (proto._zadarkHooked) return
        proto._zadarkHooked = true

        const origUndo = proto.undoMessages
        proto.undoMessages = function (e) {
          if (!readFlag(KEY_KEEP_UNSENT)) {
            return origUndo.apply(this, arguments)
          }

          try {
            const items = Object.values(e || {})
            for (let i = 0; i < items.length; i++) {
              const n = items[i]
              if (!n || !n.toUid) continue
              const convCache = this._cache && this._cache.get(n.toUid)
              const list = convCache && convCache.getAllMessagesInCache && convCache.getAllMessagesInCache()
              if (!list) continue
              for (let s = list.length - 1; s >= 0; s--) {
                const m = list[s]
                if (m && (String(m.msgId) === String(n.globalMsgId) || String(m.msgId) === String(n.msgId))) {
                  if (!isSentByMe(m)) {
                    snapshotMessage(m)
                  }
                }
              }
            }
          } catch (err) {
            debug('pre-snapshot undoMessages error', err)
          }

          const res = origUndo.apply(this, arguments)

          try {
            const items = Object.values(e || {})
            for (let i = 0; i < items.length; i++) {
              const n = items[i]
              if (!n || !n.toUid) continue
              const s = getSnapshot(n.globalMsgId) || getSnapshot(n.msgId)
              if (!s) continue
              const convCache = this._cache && this._cache.get(n.toUid)
              const list = convCache && convCache.getAllMessagesInCache && convCache.getAllMessagesInCache()
              if (!list) continue
              for (let k = list.length - 1; k >= 0; k--) {
                const m = list[k]
                if (m && (String(m.msgId) === String(n.globalMsgId) || String(m.msgId) === String(n.msgId))) {
                  if (!isSentByMe(m)) {
                    m.msgType = s.msgType
                    m.originMsgType = s.originMsgType
                    m.message = s.message
                    m.e2eeStatus = s.e2eeStatus
                    m._zadarkRecalled = true
                  }
                }
              }
            }
          } catch (err) {
            debug('post-restore undoMessages error', err)
          }

          return res
        }
      }

      const origInit = collector.init
      collector.init = function (userId) {
        const res = origInit.apply(this, arguments)
        try {
          if (this.messageCache) {
            hookCache(this.messageCache)
          }
        } catch (err) {
          debug('hookCache on init error', err)
        }
        return res
      }

      if (collector.messageCache) {
        hookCache(collector.messageCache)
      }
    }
  )

  /* ------------------------------------------------------------------ *
   * Feature: keep recalled messages across chat switches and restarts
   *
   * The hooks above only patch what is in memory: the recall still reaches the
   * database, the search index and the media cache, so the message comes back
   * recalled once the conversation is reloaded from disk (leave the chat and come
   * back, or restart Zalo).
   *
   * Every incoming message batch — direct, group (a copy with `groupMsgs` moved
   * to `messages`), history and `processLastMessages` — goes through the receive
   * pipeline singleton's `_processChatMessages(batch, ...)`. Dropping incoming
   * `chat.undo` events there means nothing downstream ever sees the recall, so the
   * stored original is never rewritten. The ids of dropped recalls are kept in
   * localStorage so the UI can still mark those messages as recalled.
   *
   * Limit: history that Zalo re-downloads from the server (a fresh login, or
   * scrolling past what is stored locally) arrives already recalled.
   * ------------------------------------------------------------------ */

  const KEY_UNSENT_IDS = '@ZaDark:UNSENT_MSGS'
  const KEY_UNSENT_PEEK = '@ZaDark:KEEP_UNSENT_PEEK'
  const UNSENT_CHANGE_EVENT = '@ZaDark:UNSENT_CHANGE'
  // Keys, not messages: each recalled message uses up to two (global id, client id).
  const MAX_UNSENT_IDS = 10000

  const unsentStore = (() => {
    let cache = null

    const read = () => {
      if (cache) return cache
      try {
        const stored = JSON.parse(window.localStorage.getItem(KEY_UNSENT_IDS) || '{}')
        cache = stored && typeof stored === 'object' ? stored : {}
      } catch (e) {
        cache = {}
      }
      return cache
    }

    const write = (ids) => {
      cache = ids
      try {
        window.localStorage.setItem(KEY_UNSENT_IDS, JSON.stringify(ids))
      } catch (e) {}
    }

    return {
      add (recalls) {
        const ids = Object.assign({}, read())
        const now = Date.now()
        for (const recall of recalls) {
          const content = (recall && recall.content) || {}
          if (content.globalMsgId && String(content.globalMsgId) !== '0') ids['g' + content.globalMsgId] = now
          if (content.cliMsgId) ids['c' + content.cliMsgId] = now
        }

        // Evict the oldest first.
        const keys = Object.keys(ids)
        if (keys.length > MAX_UNSENT_IDS) {
          keys
            .sort((a, b) => ids[a] - ids[b])
            .slice(0, keys.length - MAX_UNSENT_IDS)
            .forEach((key) => delete ids[key])
        }

        write(ids)
        try {
          document.dispatchEvent(new CustomEvent(UNSENT_CHANGE_EVENT))
        } catch (e) {}
      },
      has (globalMsgId, cliMsgId) {
        const ids = read()
        return !!((globalMsgId && ids['g' + globalMsgId]) || (cliMsgId && ids['c' + cliMsgId]))
      },
      count: () => Object.keys(read()).length
    }
  })()

  register(
    'anti-recall/fetcher',
    (source) =>
      /_processChatMessages\(\w+,\w+,\w+,\w+\)\{/.test(source) &&
      /processLastMessages\(\.\.\.\w+\)\{/.test(source) &&
      source.indexOf('"chat.undo"') !== -1,
    (id) => {
      const module = requireModule(id)
      const candidates = [module, module.default]
      for (const key of Object.keys(module)) {
        try {
          candidates.push(module[key])
        } catch (e) {}
      }

      const fetcher = candidates.find(
        (candidate) => candidate && typeof candidate === 'object' && typeof candidate._processChatMessages === 'function'
      )
      if (!fetcher) throw new Error('fetcher export missing')
      if (fetcher._zadarkHooked) return
      fetcher._zadarkHooked = true

      // An own property, so Zalo's internal `this._processChatMessages(...)` calls
      // (group and history batches) land here too.
      const original = fetcher._processChatMessages
      fetcher._processChatMessages = function (batch) {
        try {
          if (batch && Array.isArray(batch.messages) && readFlag(KEY_KEEP_UNSENT)) {
            const kept = []
            const dropped = []
            for (const m of batch.messages) {
              // Incoming recalls only: uidFrom "0" is me, those stay with Zalo.
              if (m && m.msgType === 'chat.undo' && m.content && String(m.uidFrom) !== '0') dropped.push(m)
              else kept.push(m)
            }
            if (dropped.length) {
              // Same object the poll callback hands to its other consumers.
              batch.messages = kept
              unsentStore.add(dropped)
              debug('kept', dropped.length, 'recalled message(s)')
            }
          }
        } catch (err) {
          // Fall through to Zalo's own handling.
          debug('fetcher filter error', err)
        }
        return original.apply(this, arguments)
      }
    }
  )

  /* ------------------------------------------------------------------ *
   * Recalled-message badge
   *
   * A message row is `div.chat-message#bb_msg_id_<cliMsgId>`. Rows whose id is in
   * the store get a red "Đã thu hồi" badge anchored right of the bubble (`.card`).
   * Hovering the badge overlays a Zalo-styled `.card.card--undo` so the user can
   * see how the message looks recalled; nothing in Zalo's data changes.
   * localStorage[KEY_UNSENT_PEEK] = "false" turns the hover overlay off.
   * ------------------------------------------------------------------ */

  const startUnsentBadges = () => {
    const ROW_PREFIX = 'bb_msg_id_'
    const ROW_SELECTOR = '[id^="bb_msg_id_"]'
    const ROW_CLASS = 'zadark-unsent'
    const BADGE_CLASS = 'zadark-unsent-badge'
    const GHOST_CLASS = 'zadark-peek-ghost'
    const CSS =
      '.zadark-unsent-badge{flex:0 0 auto;align-self:center;margin-left:8px;padding:0 8px;border-radius:8px;' +
      'font:500 11px/16px sans-serif;white-space:nowrap;background:#e5484d;color:#fff;opacity:.9;cursor:default;user-select:none;z-index:1}' +
      '.zadark-unsent-badge:hover{opacity:1}'
    // Zalo's own recalled bubble wording (English / Vietnamese), matched on visible
    // text because not every recalled bubble carries `.card--undo`.
    const RECALLED_TEXT = /(message (has been )?recalled|tin nhắn đã (được )?thu hồi)/i

    // Last recalled wording seen on screen, so the overlay matches the UI language.
    let seenRecalledText = ''

    const realNodes = (row, selector) =>
      Array.prototype.filter.call(row.querySelectorAll(selector), (el) => !el.classList.contains(GHOST_CLASS))

    const isRecalledByZalo = (row) => {
      const undo = realNodes(row, '.card--undo')
      if (undo.length) {
        const text = (undo[0].textContent || '').trim()
        if (text) seenRecalledText = text
        return true
      }
      // Our own overlay says "Message recalled": do not read it as Zalo's.
      if (row._zadarkPeek) return false
      const text = (row.textContent || '').replace(/\s+/g, ' ').trim().normalize('NFC')
      // A recalled row is just the phrase (plus maybe a time); long text is a real message.
      if (text.length > 80) return false
      const match = RECALLED_TEXT.exec(text)
      if (!match) return false
      seenRecalledText = match[0].charAt(0).toUpperCase() + match[0].slice(1)
      return true
    }

    const recalledText = () => {
      for (const card of document.querySelectorAll('.card--undo')) {
        if (card.classList.contains(GHOST_CLASS)) continue
        const text = (card.textContent || '').trim()
        if (text) return text
      }
      return seenRecalledText || 'Message recalled'
    }

    const unpeek = (row) => {
      const peek = row._zadarkPeek
      if (!peek) return
      row._zadarkPeek = null
      if (peek.ghost.parentNode) peek.ghost.parentNode.removeChild(peek.ghost)
      peek.bubble.style.visibility = peek.prevVisibility
    }

    const peek = (row) => {
      if (row._zadarkPeek) return
      try {
        if (window.localStorage.getItem(KEY_UNSENT_PEEK) === 'false') return
      } catch (e) {}
      const bubble = realNodes(row, '.card')[0]
      if (!bubble || !bubble.parentNode) return

      const ghost = document.createElement('div')
      ghost.className = 'card card--undo ' + GHOST_CLASS
      ghost.style.position = 'absolute'
      ghost.style.left = bubble.offsetLeft + 'px'
      ghost.style.top = bubble.offsetTop + 'px'
      ghost.style.pointerEvents = 'none'
      const label = document.createElement('span')
      label.textContent = recalledText()
      ghost.appendChild(label)
      bubble.parentNode.insertBefore(ghost, bubble.nextSibling)

      // visibility, not display: the bubble keeps its space so the badge stays under the pointer.
      row._zadarkPeek = { ghost, bubble, prevVisibility: bubble.style.visibility }
      bubble.style.visibility = 'hidden'
    }

    const badgeOf = (row) => row.querySelector('.' + BADGE_CLASS)

    // The hover toolbar (reply / forward / more) appears right of the bubble with
    // unknown markup, so it is found by geometry: probe points right of the bubble
    // and take the right edge of any button-sized element that is not ours. Only the
    // row under the pointer is probed. Returns how far (px) the badge must shift.
    let pointerY = -1
    const toolbarReach = (row, bubble, badge) => {
      if (typeof document.elementsFromPoint !== 'function') return 0
      const rowRect = row.getBoundingClientRect()
      if (pointerY < rowRect.top - 4 || pointerY > rowRect.bottom + 4) return 0

      const rect = bubble.getBoundingClientRect()
      let max = 0
      for (const y of [rect.top + 6, (rect.top + rect.bottom) / 2, rect.bottom - 6]) {
        for (let x = rect.right + 2; x <= rect.right + 260; x += 10) {
          for (const el of document.elementsFromPoint(x, y)) {
            if (el === badge || el.classList.contains(GHOST_CLASS)) continue
            if (bubble.contains(el) || el.contains(bubble) || el.contains(badge)) continue
            const r = el.getBoundingClientRect()
            if (r.width < 8 || r.height < 8 || r.width > 180 || r.height > 70) continue
            if (r.right > max) max = r.right
          }
        }
      }
      return max > rect.right ? max - rect.right : 0
    }

    const place = (row) => {
      const badge = badgeOf(row)
      if (!badge) return
      const bubble = realNodes(row, '.card')[0]
      // Stickers etc. have no bubble: the badge stays a plain flex child of the row.
      if (!bubble || !bubble.parentNode) return

      if (typeof window.ResizeObserver === 'function' && row._zadarkObserved !== bubble) {
        if (row._zadarkResize) row._zadarkResize.disconnect()
        row._zadarkObserved = bubble
        row._zadarkResize = new window.ResizeObserver(() => place(row))
        row._zadarkResize.observe(bubble)
      }

      // Same parent as the bubble, so offsetLeft/offsetTop share a containing block.
      if (badge.parentNode !== bubble.parentNode) bubble.parentNode.insertBefore(badge, bubble.nextSibling)

      const width = bubble.offsetWidth
      const height = bubble.offsetHeight
      if (!width) {
        badge.style.display = 'none'
        return
      }

      // While peeking the badge stays put, or it would slide out from under the pointer.
      const shift = row._zadarkPeek ? row._zadarkShift || 0 : toolbarReach(row, bubble, badge)
      row._zadarkShift = shift

      badge.style.display = ''
      badge.style.position = 'absolute'
      badge.style.margin = '0'
      badge.style.left = bubble.offsetLeft + width + shift + 8 + 'px'
      // Centred, but near the top on tall media.
      badge.style.top = bubble.offsetTop + Math.max(0, Math.min((height - 16) / 2, 16)) + 'px'
    }

    const ensureBadge = (row) => {
      if (!badgeOf(row)) {
        const badge = document.createElement('span')
        badge.className = BADGE_CLASS
        badge.textContent = 'Đã thu hồi'
        badge.title = 'Tin nhắn đã bị thu hồi (ZaDark giữ lại). Rê chuột vào đây để xem dạng đã thu hồi.'
        badge.addEventListener('mouseenter', () => peek(row))
        badge.addEventListener('mouseleave', () => unpeek(row))
        row.appendChild(badge)
      }
      place(row)
    }

    const removeBadge = (row) => {
      unpeek(row)
      const badge = badgeOf(row)
      if (badge && badge.parentNode) badge.parentNode.removeChild(badge)
      if (row._zadarkResize) {
        row._zadarkResize.disconnect()
        row._zadarkResize = null
        row._zadarkObserved = null
      }
      row.classList.remove(ROW_CLASS)
    }

    const mark = (el) => {
      if (!el || el.nodeType !== 1 || !el.id || el.id.indexOf(ROW_PREFIX) !== 0) return
      // Never flag a row that already shows Zalo's own recalled bubble.
      const kept = unsentStore.has(null, el.id.slice(ROW_PREFIX.length)) && !isRecalledByZalo(el)
      if (kept) {
        el.classList.add(ROW_CLASS)
        ensureBadge(el)
      } else if (el.classList.contains(ROW_CLASS)) {
        // Rows are recycled by the virtual list.
        removeBadge(el)
      }
    }

    const scan = (root) => {
      if (!root || root.nodeType !== 1) return
      mark(root)
      root.querySelectorAll(ROW_SELECTOR).forEach(mark)
    }

    const style = document.createElement('style')
    style.id = 'zadark-unsent-style'
    style.textContent = CSS
    document.head.appendChild(style)

    scan(document.body)

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          mark(mutation.target)
          continue
        }
        const row = mutation.target && mutation.target.closest && mutation.target.closest(ROW_SELECTOR)
        if (row) mark(row)
        mutation.addedNodes.forEach(scan)
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] })

    document.addEventListener(UNSENT_CHANGE_EVENT, () => scan(document.body))

    const placeAll = () => document.querySelectorAll('.' + ROW_CLASS).forEach(place)

    // Zalo shows the toolbar a moment after the pointer arrives, with no further
    // mouse event, so each (throttled) move also re-places at +150ms and +400ms.
    let lastKick = 0
    let followUps = []
    const kick = (event) => {
      if (event && typeof event.clientY === 'number') pointerY = event.clientY
      const now = Date.now()
      if (now - lastKick < 60) return
      lastKick = now
      placeAll()
      followUps.forEach(window.clearTimeout)
      followUps = [window.setTimeout(placeAll, 150), window.setTimeout(placeAll, 400)]
    }
    document.addEventListener('mousemove', kick)
    document.addEventListener('mouseover', kick)
    window.addEventListener('resize', placeAll)
  }

  /* ------------------------------------------------------------------ *
   * Feature: keep expired files & media downloadable
   *
   * Every message-level expiry check on PC — `isExpired`/`isExpiredAll` on media
   * items, `isExpireMsg`, the download service's "Download message: expired"
   * throw, the media viewer blanking the URL, "Show in folder" — reduces to
   *
   *   getMessageStatus[Sync](msg).status === 'none'
   *
   * from a single module whose status is a bitmask of
   * { none: 0, clouded: 1, local: 2, server_temp: 4, not_check: 8, auto_downloading: 16 }.
   * A 'none' result is upgraded to `server_temp` ("still on Zalo's server"), which
   * sends every consumer down its normal download-from-URL path. Real results are
   * left alone: claiming `local` would make Zalo open a file that is not on disk
   * and skip the unzip of downloaded folders, and `clouded` without `server_temp`
   * is what the Zalo Cloud upsell keys off.
   *
   * Limit: this only lifts the client-side gate. A file the server has really
   * deleted still fails to download, and Zalo shows its own download error.
   * ------------------------------------------------------------------ */

  const STATUS_FLAG_SERVER_TEMP = 4

  const unexpireStatus = (result) => {
    if (!result || result.status !== 'none' || !readFlag(KEY_KEEP_EXPIRED_MEDIA)) return result
    return { status: 'server_temp', flag: (result.flag | 0) | STATUS_FLAG_SERVER_TEMP }
  }

  registerFactory(
    'keep-expired-media/status',
    // The defining module, not the many importers: only it exports both names and
    // falls back to the temp-status lookup.
    (source) =>
      source.indexOf('"getMessageStatusSync"') !== -1 &&
      source.indexOf('"getMessageStatus"') !== -1 &&
      source.indexOf('getTempStatusSync(') !== -1,
    {
      getMessageStatusSync: (original) =>
        function () {
          return unexpireStatus(original.apply(this, arguments))
        },
      getMessageStatus: (original) =>
        async function () {
          return unexpireStatus(await original.apply(this, arguments))
        }
    }
  )

  register(
    'keep-expired-media/send-to-me',
    // Large files sent to "My Cloud" expire on their own clock (size limit and
    // duration from server config), independent of the status above.
    (source) => source.indexOf('static isExpiredOnCloud(') !== -1,
    (id) => {
      const module = requireModule(id)
      const helper = module.default
      if (!helper || typeof helper.isExpiredOnCloud !== 'function') throw new Error('isExpiredOnCloud missing')

      const original = helper.isExpiredOnCloud
      helper.isExpiredOnCloud = function () {
        if (readFlag(KEY_KEEP_EXPIRED_MEDIA)) return false
        return original.apply(this, arguments)
      }
    }
  )

  /* ------------------------------------------------------------------ *
   * boot
   * ------------------------------------------------------------------ */

  captureWebpackRequire()

  if (req) {
    wrapFactories()
    sweep()
  }

  window.addEventListener('load', sweep)
  startPolling()

  const startBadgesSafely = () => {
    try {
      startUnsentBadges()
    } catch (e) {
      debug('unsent badges failed', e)
    }
  }
  if (document.body) startBadgesSafely()
  else document.addEventListener('DOMContentLoaded', startBadgesSafely)

  window.ZaDarkUnsent = unsentStore

  window.ZaDarkPatches = {
    sweep,
    status: () =>
      patches
        .map((patch) => ({
          name: patch.name,
          applied: patch.applied
        }))
        .concat(
          factoryPatches.map((patch) => ({
            name: patch.name,
            applied: patch.applied,
            error: patch.error
          }))
        )
  }
})()
