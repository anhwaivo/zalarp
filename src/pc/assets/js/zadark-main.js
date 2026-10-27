/*
  ZaDark – Zalo Dark Mode
  Made by Quaric
*/

/* eslint-disable node/no-callback-literal  */

const { app, session } = require('electron')

const getFilterUrls = (domains = [], paths = []) => {
  return paths.reduce((prevUrls, path) => {
    const nextUrls = domains.map((domain) => [domain, path].join(''))
    return [...prevUrls, ...nextUrls]
  }, [])
}

const PARTITION_NAME = 'persist:zalo'

const BLOCK_STORAGE_KEYS = {
  block_typing: '@ZaDark:ENABLED_BLOCK_TYPING',
  block_delivered: '@ZaDark:ENABLED_BLOCK_DELIVERED',
  block_seen: '@ZaDark:ENABLED_BLOCK_SEEN'
  // block_story_seen: '@ZaDark:ENABLED_BLOCK_STORY_SEEN',
  // block_ads: '@ZaDark:ENABLED_BLOCK_ADS',
  // block_telemetry: '@ZaDark:ENABLED_BLOCK_TELEMETRY'
}

const FILTER_DOMAINS = [
  '*://*.zalo.me',
  '*://*.zaloapp.com'
]
const FILTER_PATHS = [
  // Typing
  '/api/message/typing?*',
  '/api/group/typing?*',

  // Delivered
  '/api/message/deliveredv2?*',
  '/api/e2ee/pc/t/message/delivered?*',
  '/api/group/deliveredv2?*',

  // Seen
  '/api/message/seenv2?*',
  '/api/group/seenv2?*',

  // Story seen (View stories anonymously)
  '/api/social/story/seen*'
]

const BLOCK_FILTER = {
  urls: getFilterUrls(FILTER_DOMAINS, FILTER_PATHS)
}

// Ported from NexAlloy-XES `adtima/*` and `tracking/*` patches.
// Zalo PC reaches the Adtima ad SDK and the ads tracker over HTTP from the
// renderer session, so the Android hooks become request filters here.
const ADS_FILTER = {
  urls: [
    ...getFilterUrls(['*://*.adtimaserver.vn'], ['/*']),
    ...getFilterUrls(['*://*.admicro.vn'], ['/*']),
    ...getFilterUrls(FILTER_DOMAINS, ['/api/ads/*', '/api/message/ads/*', '/api/ads/show/*'])
  ]
}

// Ported from NexAlloy-XES `telemetry/*` patches (Firebase Analytics,
// Crashlytics, Advertising ID lookup).
const TELEMETRY_FILTER = {
  urls: [
    '*://*.google-analytics.com/*',
    '*://*.app-measurement.com/*',
    '*://*.crashlytics.com/*',
    '*://firebase-settings*',
    '*://firebaselogging*',
    '*://*.googlesyndication.com/*',
    '*://*.doubleclick.net/*',
    '*://*.googleadservices.com/*'
  ]
}

app.whenReady().then(() => {
  const _blockSettings = {
    block_typing: false,
    block_delivered: false,
    block_seen: false
    // block_story_seen: false,
    // block_ads: false,
    // block_telemetry: false
  }

  const zaloSession = session.fromPartition(PARTITION_NAME)

  zaloSession.webRequest.onBeforeRequest(BLOCK_FILTER, (details, callback) => {
    // Typing
    if (_blockSettings.block_typing && (details.url.includes('api/message/typing') || details.url.includes('api/group/typing'))) {
      if (DEBUG) console.log('ZaDarkPC: block_typing', details.url)
      callback({ cancel: true })
      return
    }

    // Delivered
    if (_blockSettings.block_delivered && (details.url.includes('api/message/deliveredv2') || details.url.includes('api/e2ee/pc/t/message/delivered') || details.url.includes('api/group/deliveredv2'))) {
      if (DEBUG) console.log('ZaDarkPC: block_delivered', details.url)
      callback({ cancel: true })
      return
    }

    // Seen
    if (_blockSettings.block_seen && (details.url.includes('api/message/seenv2') || details.url.includes('api/group/seenv2'))) {
      if (DEBUG) console.log('ZaDarkPC: block_seen', details.url)
      callback({ cancel: true })
      return
    }

    /*
    // Story seen
    if (_blockSettings.block_story_seen && details.url.includes('api/social/story/seen')) {
      if (DEBUG) console.log('ZaDarkPC: block_story_seen', details.url)
      callback({ cancel: true })
      return
    }
    */

    callback({ cancel: false })
  })

  /*
  zaloSession.webRequest.onBeforeRequest(ADS_FILTER, (details, callback) => {
    if (!_blockSettings.block_ads) {
      callback({ cancel: false })
      return
    }

    if (DEBUG) console.log('ZaDarkPC: block_ads', details.url)
    callback({ cancel: true })
  })

  zaloSession.webRequest.onBeforeRequest(TELEMETRY_FILTER, (details, callback) => {
    if (!_blockSettings.block_telemetry) {
      callback({ cancel: false })
      return
    }

    if (DEBUG) console.log('ZaDarkPC: block_telemetry', details.url)
    callback({ cancel: true })
  })
  */

  zaloSession.cookies.get({ domain: 'zadark.com' })
    .then((cookies = []) => {
      if (DEBUG) console.log('ZaDarkPC: Cookies/zadark.com', cookies)

      cookies.forEach((cookie) => {
        const settingKey = Object.keys(BLOCK_STORAGE_KEYS).find((key) => BLOCK_STORAGE_KEYS[key] === cookie.name)
        if (!settingKey) {
          return
        }

        _blockSettings[settingKey] = cookie.value === 'true'
      })

      if (DEBUG) console.log('ZaDarkPC: _blockSettings', _blockSettings)
    })
})
