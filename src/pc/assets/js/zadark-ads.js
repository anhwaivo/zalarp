/*
  ZaDark – Zalo Dark Mode
  Made by Quaric
*/

/**
 * Ported from NexAlloy-XES `HideMessageZinstantAds` / `HideFeedZInstantAds`.
 *
 * On Android those patches collapse ad views to zero height once they attach to
 * the window. Zalo PC is React based, so the equivalent is a CSS class on
 * `<body>` that collapses the known zinstant ad containers, driven by a
 * MutationObserver so it keeps working as the virtualised lists re-render.
 */
(function () {
  const HIDE_ADS_CLASS = 'zadark-ads--hidden'

  // Mirrors `feedAdsLayoutHeightFingerprint` / `zinstantAdItemBindFingerprint`:
  // Zalo marks ad containers with `zinstant` media type data attributes.
  const AD_SELECTORS = [
    '[data-zinstant-media-type]',
    '[data-zinstantMediaType]',
    '.zinstant-ad-item',
    '.zinstant-ads',
    '#zinstantAdItemId',
    '.msg-item--zinstant'
  ].join(',')

  const isEnabled = () => document.body.classList.contains(HIDE_ADS_CLASS)

  const collapseAd = (el) => {
    if (!el || el.dataset.zadarkAdCollapsed === 'true') {
      return
    }

    el.dataset.zadarkAdCollapsed = 'true'
    el.style.setProperty('display', 'none', 'important')
    el.style.setProperty('height', '0', 'important')
    el.style.setProperty('margin', '0', 'important')
    el.style.setProperty('padding', '0', 'important')
    el.setAttribute('aria-hidden', 'true')
  }

  const sweep = () => {
    if (!isEnabled()) {
      return
    }

    const ads = document.querySelectorAll(AD_SELECTORS)
    for (let i = 0; i < ads.length; i++) {
      collapseAd(ads[i])
    }
  }

  const observer = new MutationObserver((mutations) => {
    if (!isEnabled()) {
      return
    }

    for (let i = 0; i < mutations.length; i++) {
      const added = mutations[i].addedNodes
      for (let j = 0; j < added.length; j++) {
        const node = added[j]
        if (node.nodeType !== 1) {
          continue
        }

        if (node.matches && node.matches(AD_SELECTORS)) {
          collapseAd(node)
        }

        if (node.querySelectorAll) {
          const nested = node.querySelectorAll(AD_SELECTORS)
          for (let k = 0; k < nested.length; k++) {
            collapseAd(nested[k])
          }
        }
      }
    }
  })

  const hideAds = () => {
    document.body.classList.add(HIDE_ADS_CLASS)
    sweep()
    observer.observe(document.body, { childList: true, subtree: true })
  }

  const showAds = () => {
    document.body.classList.remove(HIDE_ADS_CLASS)
    observer.disconnect()

    const collapsed = document.querySelectorAll('[data-zadark-ad-collapsed="true"]')
    for (let i = 0; i < collapsed.length; i++) {
      const el = collapsed[i]
      el.removeAttribute('data-zadark-ad-collapsed')
      el.removeAttribute('aria-hidden')
      el.style.removeProperty('display')
      el.style.removeProperty('height')
      el.style.removeProperty('margin')
      el.style.removeProperty('padding')
    }
  }

  document.addEventListener('@ZaDark:ENABLED_BLOCK_ADS_CHANGE', (event) => {
    if (event.detail) {
      hideAds()
    } else {
      showAds()
    }
  })

  window.ZaDarkAds = { hideAds, showAds, sweep }

  // The setting is mirrored into localStorage by zadark.min.js, which loads
  // after this script, so defer the initial read.
  window.addEventListener('load', () => {
    if (localStorage.getItem('@ZaDark:ENABLED_BLOCK_ADS') === 'true') {
      hideAds()
    }
  })
})()
