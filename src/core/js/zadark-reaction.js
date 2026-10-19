(function () {
  const log = console.log.bind(console, '[zadark-reaction]')

  // Copied from assets/zalo-reactions-emoji-pos.json
  const EMOJI_POS = {
    ':)': '82.00% 17.50%',
    ':~': '84.00% 37.50%',
    ':b': '82.00% 30.00%',
    ":')": '82.00% 05.00%',
    '8-)': '82.00% 45.00%',
    ':-((': '84.00% 02.50%',
    ':$': '82.00% 20.00%',
    ':3': '82.00% 37.50%',
    ':z': '84.00% 50.00%',
    ':((': '82.00% 95.00%',
    '&-(': '84.00% 35.00%',
    ':-h': '84.00% 05.00%',
    ':p': '82.00% 40.00%',
    ':d': '82.00% 00.00%',
    ':o': '84.00% 20.00%',
    ':(': '82.00% 85.00%',
    ';-)': '82.00% 50.00%',
    '--b': '84.00% 30.00%',
    ':))': '82.00% 10.00%',
    ':-*': '82.00% 32.50%',
    ';p': '82.00% 22.50%',
    ';-d': '82.00% 27.50%',
    ';d': '82.00% 60.00%',
    ';o': '82.00% 87.50%',
    ';g': '82.00% 42.50%',
    '|-)': '84.00% 45.00%',
    ':!': '84.00% 00.00%',
    ':l': '82.00% 70.00%',
    ':>': '82.00% 07.50%',
    ':;': '82.00% 47.50%',
    ';f': '82.00% 57.50%',
    ':v': '82.00% 55.00%',
    ':wipe': '84.00% 32.50%',
    ':-dig': '82.00% 80.00%',
    ':handclap': '82.00% 77.50%',
    'b-)': '82.00% 02.50%',
    ':-r': '82.00% 72.50%',
    ':-<': '82.00% 65.00%',
    ':-o': '84.00% 47.50%',
    ';-s': '84.00% 07.50%',
    ';?': '84.00% 17.50%',
    ';-x': '82.00% 75.00%',
    ':-f': '84.00% 40.00%',
    ';!': '82.00% 100.00%',
    ';xx': '84.00% 12.50%',
    ':-bye': '82.00% 12.50%',
    '>-|': '82.00% 82.50%',
    'p-(': '82.00% 90.00%',
    ':--|': '82.00% 92.50%',
    ':q': '84.00% 10.00%',
    'x-)': '82.00% 52.50%',
    ':*': '82.00% 35.00%',
    ';-a': '84.00% 22.50%',
    '8*': '82.00% 97.50%',
    ':|': '82.00% 67.50%',
    ':x': '84.00% 27.50%',
    ':t': '84.00% 42.50%',
    ';-/': '84.00% 15.00%',
    ':-l': '82.00% 62.50%',
    '$-)': '82.00% 15.00%',
    '/-rose': '84.00% 60.00%',
    '/-fade': '84.00% 62.50%',
    '/-bd': '84.00% 65.00%',
    '/-bome': '84.00% 67.50%',
    '/-heart': '84.00% 72.50%',
    '/-break': '84.00% 75.00%',
    '/-shit': '84.00% 77.50%',
    '/-li': '84.00% 80.00%',
    '/-strong': '84.00% 82.50%',
    '/-weak': '84.00% 85.00%',
    '/-ok': '84.00% 87.50%',
    '/-v': '84.00% 90.00%',
    '/-thanks': '84.00% 92.50%',
    '/-punch': '84.00% 95.00%',
    '/-share': '84.00% 97.50%',
    '_()_': '84.00% 100.00%',
    '/-no': '86.00% 00.00%',
    '/-bad': '86.00% 02.50%',
    '/-loveu': '86.00% 05.00%',
    ':christmas_tree:': '16.00% 70.00%',
    ':snowman:': '02.00% 07.50%',
    ':gift:': '16.00% 62.50%'
  }

  const EMOJI_POS_MAP = new Map(Object.entries(EMOJI_POS))

  /**
   * @typedef {Object} Emoji
   * @property {number} rType - The type of the emoji (e.g. 0 for default).
   * @property {string} rIcon - The textual representation of the emoji.
   * @property {string} backgroundPosition - The CSS background-position for sprite sheets.
   */

  /** @type {Emoji[]} */
  const EMOJI_LIST = [
    {
      rType: 0,
      rIcon: ':>'
    },
    {
      rType: 1,
      rIcon: '--b'
    },
    {
      rType: 2,
      rIcon: ':-(('
    },
    {
      rType: 3,
      rIcon: '/-strong'
    },
    {
      rType: 4,
      rIcon: '/-weak'
    },
    {
      rType: 5,
      rIcon: '/-heart'
    },
    {
      rType: 6,
      rIcon: ':d'
    },
    {
      rType: 7,
      rIcon: ":')"
    },
    {
      rType: 8,
      rIcon: ':-*'
    },
    {
      rType: 9,
      rIcon: ':3'
    },
    {
      rType: 10,
      rIcon: ':b'
    },
    {
      rType: 11,
      rIcon: ';d'
    },
    {
      rType: 12,
      rIcon: ':~'
    },
    {
      rType: 13,
      rIcon: ';p'
    },
    {
      rType: 14,
      rIcon: ':*'
    },
    {
      rType: 15,
      rIcon: ';o'
    },
    {
      rType: 16,
      rIcon: ':(('
    },
    {
      rType: 17,
      rIcon: ':)'
    },
    {
      rType: 18,
      rIcon: ':p'
    },
    {
      rType: 19,
      rIcon: ':$'
    },
    {
      rType: 20,
      rIcon: ':-h'
    },
    {
      rType: 21,
      rIcon: 'x-)'
    },
    {
      rType: 22,
      rIcon: '8-)'
    },
    {
      rType: 23,
      rIcon: ';-d'
    },
    {
      rType: 24,
      rIcon: ':q'
    },
    {
      rType: 25,
      rIcon: ':('
    },
    {
      rType: 26,
      rIcon: 'b-)'
    },
    {
      rType: 27,
      rIcon: ';?'
    },
    {
      rType: 28,
      rIcon: ':|'
    },
    {
      rType: 29,
      rIcon: ';xx'
    },
    {
      rType: 30,
      rIcon: ':--|'
    },
    {
      rType: 31,
      rIcon: ';g'
    },
    {
      rType: 32,
      rIcon: ':o'
    },
    {
      rType: 33,
      rIcon: ':z'
    },
    {
      rType: 34,
      rIcon: ':l'
    },
    {
      rType: 35,
      rIcon: 'p-('
    },
    {
      rType: 36,
      rIcon: ':-bye'
    },
    {
      rType: 37,
      rIcon: ':x'
    },
    {
      rType: 38,
      rIcon: '|-)'
    },
    {
      rType: 39,
      rIcon: ':wipe'
    },
    {
      rType: 40,
      rIcon: ':!'
    },
    {
      rType: 41,
      rIcon: '8*'
    },
    {
      rType: 42,
      rIcon: ':-dig'
    },
    {
      rType: 43,
      rIcon: ':t'
    },
    {
      rType: 44,
      rIcon: '&-('
    },
    {
      rType: 45,
      rIcon: ';-)'
    },
    {
      rType: 46,
      rIcon: ':handclap'
    },
    {
      rType: 47,
      rIcon: '>-|'
    },
    {
      rType: 48,
      rIcon: ':-f'
    },
    {
      rType: 49,
      rIcon: ':-l'
    },
    {
      rType: 50,
      rIcon: ':-r'
    },
    {
      rType: 51,
      rIcon: ';-/'
    },
    {
      rType: 52,
      rIcon: ';-x'
    },
    {
      rType: 53,
      rIcon: ':-o'
    },
    {
      rType: 54,
      rIcon: ';-s'
    },
    {
      rType: 56,
      rIcon: ';!'
    },
    {
      rType: 57,
      rIcon: ';f'
    },
    {
      rType: 58,
      rIcon: ':;'
    },
    {
      rType: 59,
      rIcon: ':v'
    },
    {
      rType: 60,
      rIcon: ';-a'
    },
    {
      rType: 61,
      rIcon: ':-<'
    },
    {
      rType: 62,
      rIcon: ':))'
    },
    {
      rType: 63,
      rIcon: '$-)'
    },
    {
      rType: 65,
      rIcon: '/-break'
    },
    {
      rType: 66,
      rIcon: '/-shit'
    },
    {
      rType: 67,
      rIcon: '/-li'
    },
    {
      rType: 68,
      rIcon: '/-ok'
    },
    {
      rType: 69,
      rIcon: '/-v'
    },
    {
      rType: 70,
      rIcon: '/-thanks'
    },
    {
      rType: 71,
      rIcon: '/-punch'
    },
    {
      rType: 72,
      rIcon: '/-share'
    },
    {
      rType: 73,
      rIcon: '_()_'
    },
    {
      rType: 84,
      rIcon: ':christmas_tree:'
    },
    {
      rType: 86,
      rIcon: ':snowman:'
    },
    {
      rType: 95,
      rIcon: ':gift:'
    },
    {
      rType: 120,
      rIcon: '/-rose'
    },
    {
      rType: 121,
      rIcon: '/-fade'
    },
    {
      rType: 126,
      rIcon: '/-bd'
    },
    {
      rType: 127,
      rIcon: '/-bome'
    },
    {
      rType: 131,
      rIcon: '/-no'
    },
    {
      rType: 132,
      rIcon: '/-bad'
    },
    {
      rType: 133,
      rIcon: '/-loveu'
    }
  ].map((emoji) => ({
    ...emoji,
    backgroundPosition: EMOJI_POS_MAP.get(emoji.rIcon) || '0% 0%'
  }))

  /**
   * Retrieves the internal React Fiber node from a given DOM element.
   *
   * @param {HTMLElement} el - The DOM element to inspect.
   * @returns {Object|null} - The corresponding React Fiber node if found, otherwise null.
   */
  const getReactFiber = (el) => {
    for (const k in el) {
      if (k.startsWith('__reactInternalInstance')) {
        return el[k]
      }
    }
    return null
  }

  const RECENT_EMOJI_LIST_KEY = 'zadark/reaction-recent-emojis'
  const FAVORITE_EMOJI_LIST_KEY = 'zadark/reaction-favorite-emojis'

  // Each bottom row is a 6-column grid: 1 cell for the row icon + 11 emojis = 2 full lines
  const RECENT_EMOJI_LIMIT = 11
  const FAVORITE_EMOJI_LIMIT = 11
  // Zalo's quick reaction bar shows 6 emojis; the first favorites replace them
  const QUICK_EMOJI_LIMIT = 6

  /**
   * Builds a key that identifies a list of emojis, used to skip re-rendering when nothing changed.
   *
   * @param {Emoji[]} emojis - An array of emoji objects.
   * @returns {string} - The key, e.g. "1:/-strong,2:/-heart".
   */
  const getEmojisKey = (emojis) => emojis.map((e) => `${e.rType}:${e.rIcon}`).join(',')

  /**
   * Saves the list of recently used emojis to localStorage.
   *
   * @param {Emoji[]} emojis - An array of emoji objects to be saved.
   */
  const saveRecentEmojis = (emojis) => {
    try {
      localStorage.setItem(RECENT_EMOJI_LIST_KEY, JSON.stringify(emojis))
    } catch (e) {
      log('Failed to save recent emojis to localStorage', e)
    }
  }

  /**
   * Saves the list of favorite emojis to localStorage.
   *
   * @param {Emoji[]} emojis - An array of emoji objects to be saved.
   */
  const saveFavoriteEmojis = (emojis) => {
    try {
      localStorage.setItem(FAVORITE_EMOJI_LIST_KEY, JSON.stringify(emojis))
    } catch (e) {
      log('Failed to save favorite emojis to localStorage', e)
    }
  }

  /**
   * Adds a new emoji to the recent emoji list.
   * If the emoji already exists, it is moved to the top of the list.
   * The list is trimmed to a maximum of RECENT_EMOJI_LIMIT emojis.
   *
   * @param {Emoji} emoji - The emoji object to be added.
   */
  const addRecentEmoji = (emoji) => {
    const existingIndex = RECENT_EMOJI_LIST.findIndex(e => e.rIcon === emoji.rIcon)

    if (existingIndex !== -1) {
      RECENT_EMOJI_LIST.splice(existingIndex, 1)
    }

    RECENT_EMOJI_LIST.unshift(emoji)

    if (RECENT_EMOJI_LIST.length > RECENT_EMOJI_LIMIT) {
      RECENT_EMOJI_LIST.length = RECENT_EMOJI_LIMIT
    }

    saveRecentEmojis(RECENT_EMOJI_LIST)
  }

  /**
   * Cleans a list of emojis by filtering out those not found in the global EMOJI_LIST.
   *
   * @param {Emoji[]} emojis - An optional array of emoji objects to clean.
   * @returns {Emoji[]} A filtered and validated list of emoji objects.
   */
  const cleanEmojis = (emojis) => {
    if (!Array.isArray(emojis)) {
      return []
    }

    if (emojis.length === 0) {
      return []
    }

    const emojiListMap = new Map(EMOJI_LIST.map((e) => [e.rIcon, e]))
    return emojis.map((e) => emojiListMap.get(e.rIcon)).filter(Boolean)
  }

  /**
   * Retrieves the list of recently used emojis from localStorage.
   * Returns a cleaned list with only valid emojis based on EMOJI_LIST.
   *
   * @returns {Emoji[]} An array of recently used emoji objects.
   */
  const getRecentEmojis = () => {
    const recentEmojis = localStorage.getItem(RECENT_EMOJI_LIST_KEY)

    if (!recentEmojis) {
      return []
    }

    try {
      return cleanEmojis(JSON.parse(recentEmojis))
    } catch (e) {
      log('Failed to parse recent emojis from localStorage', e)
      return []
    }
  }

  /**
   * Retrieves the list of favorite emojis from localStorage.
   * Returns a cleaned list with only valid emojis based on EMOJI_LIST.
   *
   * @returns {Emoji[]} An array of favorite emoji objects.
   */
  const getFavoriteEmojis = () => {
    try {
      const favoriteEmojis = localStorage.getItem(FAVORITE_EMOJI_LIST_KEY)
      if (!favoriteEmojis) {
        return []
      }

      // cleanEmojis returns the shared EMOJI_LIST objects, so a Set also drops duplicates
      return Array.from(new Set(cleanEmojis(JSON.parse(favoriteEmojis)))).slice(0, FAVORITE_EMOJI_LIMIT)
    } catch (e) {
      log('Failed to parse favorite emojis from localStorage', e)
      return []
    }
  }

  const RECENT_EMOJI_LIST = getRecentEmojis()
  const FAVORITE_EMOJI_LIST = getFavoriteEmojis()

  /**
   * Pins an emoji to the favorite list, or unpins it if it is already there.
   * New favorites are appended so the row keeps the order the user picked.
   *
   * @param {Emoji} emoji - The emoji object to toggle.
   * @returns {boolean} - false when the list is full and the emoji was not added.
   */
  const toggleFavoriteEmoji = (emoji) => {
    const existingIndex = FAVORITE_EMOJI_LIST.findIndex(e => e.rIcon === emoji.rIcon)

    if (existingIndex !== -1) {
      FAVORITE_EMOJI_LIST.splice(existingIndex, 1)
    } else if (FAVORITE_EMOJI_LIST.length >= FAVORITE_EMOJI_LIMIT) {
      return false
    } else {
      FAVORITE_EMOJI_LIST.push(emoji)
    }

    saveFavoriteEmojis(FAVORITE_EMOJI_LIST)
    return true
  }

  /**
   * A cache map for storing previously created emoji elements,
   * keyed by a combination of emoji type and icon.
   */
  const emojiCache = new Map()

  /**
   * Returns the per-emoji image that Zalo PC uses, e.g. "84% 82.5%" -> "<dir>/row-34-column-43.png".
   * The sprite is a 51 x 41 grid, so x = (column - 1) * 2% and y = (row - 1) * 2.5%.
   *
   * @param {string} emojiDir - Directory of the per-emoji images (data-zadark-emoji-dir).
   * @param {Emoji} emoji - The emoji object.
   * @returns {string} - The image URL.
   */
  const getEmojiImageUrl = (emojiDir, emoji) => {
    const [x, y] = emoji.backgroundPosition.split(' ').map(parseFloat)
    return `${emojiDir}/row-${Math.round(y / 2.5) + 1}-column-${Math.round(x / 2) + 1}.png`
  }

  /**
   * Creates a new emoji DOM element, or reuses one from cache if available.
   * Adds necessary styling and click behavior.
   *
   * @param {Emoji} emoji - Contains properties like rType, rIcon, and backgroundPosition.
   * @param {Function} sendReaction - Callback triggered when the emoji is clicked.
   * @param {Function} closePopover - Callback to close the emoji selection UI.
   * @returns {HTMLElement} - A fully prepared DOM element representing the emoji.
   */
  const createEmojiEl = (emoji, sendReaction, closePopover) => {
    // Only set on Zalo PC, once its per-emoji images are known to exist (see src/pc/assets/js/zadark.js)
    const emojiDir = document.documentElement.getAttribute('data-zadark-emoji-dir')
    const cacheKey = `${emojiDir || 'sprite'}:${emoji.rType}:${emoji.rIcon}`

    if (emojiCache.has(cacheKey)) {
      // log('using cached emoji', cacheKey)

      const cachedEl = emojiCache.get(cacheKey).cloneNode(true)
      attachClickHandler(cachedEl, emoji, sendReaction, closePopover)

      return cachedEl
    }

    // log('creating new emoji', cacheKey)

    const wrapperEl = document.createElement('div')
    wrapperEl.className = 'zadark-reaction__emoji'

    const emojiEl = document.createElement('span')
    emojiEl.className = 'emoji-sizer emoji-outer'
    emojiEl.style.backgroundRepeat = 'no-repeat'
    emojiEl.style.webkitUserDrag = 'none'

    // Same styles as Zalo's own emojis for each rendering mode
    if (emojiDir) {
      emojiEl.style.backgroundSize = 'contain'
      emojiEl.style.backgroundImage = `url("${getEmojiImageUrl(emojiDir, emoji)}")`
    } else {
      const emojiUrl = document.documentElement.getAttribute('data-zadark-emoji-url')
      emojiEl.style.backgroundSize = '5100%'
      emojiEl.style.backgroundImage = `url("${emojiUrl}?v=250409")`
      emojiEl.style.backgroundPosition = emoji.backgroundPosition
      emojiEl.style.margin = '-1px'
    }

    wrapperEl.appendChild(emojiEl)
    wrapperEl.setAttribute('data-r-icon', emoji.rIcon)

    emojiCache.set(cacheKey, wrapperEl.cloneNode(true))
    attachClickHandler(wrapperEl, emoji, sendReaction, closePopover)

    return wrapperEl
  }

  /**
   * Attaches a click event handler to an emoji element that:
   * - Prevents default behavior and stops event propagation.
   * - Invokes the sendReaction callback with emoji data if provided.
   * - Closes the emoji popover if the closePopover callback is defined.
   *
   * @param {HTMLElement} el - The target element to bind the event to.
   * @param {Emoji} emoji - Contains rType and rIcon for reaction payload.
   * @param {Function} sendReaction - Function to handle the emoji click action.
   * @param {Function} closePopover - Function to close the emoji popover UI.
   */
  const attachClickHandler = (el, emoji, sendReaction, closePopover) => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (typeof sendReaction === 'function') {
        sendReaction({
          rType: emoji.rType,
          rIcon: emoji.rIcon
        })
        addRecentEmoji(emoji)
      }

      if (typeof closePopover === 'function') {
        closePopover()
      }
    })
  }

  /**
   * Sets the emoji tooltip based on whether it is already a favorite.
   *
   * @param {HTMLElement} el - The emoji element (.zadark-reaction__emoji).
   */
  const updateFavoriteTitle = (el) => {
    const rIcon = el.getAttribute('data-r-icon')
    const isFavorite = FAVORITE_EMOJI_LIST.some((e) => e.rIcon === rIcon)

    const title = isFavorite
      ? 'Nhấp chuột phải để bỏ khỏi Yêu thích'
      : 'Nhấp chuột phải để thêm vào Yêu thích'

    if (el.title !== title) {
      el.title = title
    }
  }

  // The tooltip depends on the current favorites and emoji elements are cloned from cache,
  // so set it on hover instead of when the element is created.
  window.addEventListener('mouseover', (e) => {
    const el = e.target && e.target.closest && e.target.closest('.zadark-reaction__emoji')
    if (el) updateFavoriteTitle(el)
  }, true)

  // Zalo listens to "contextmenu" in the capture phase on each message and stops it,
  // so listen on window (capture) to run first. Right-click an emoji = pin/unpin it.
  window.addEventListener('contextmenu', (e) => {
    const el = e.target && e.target.closest && e.target.closest('.zadark-reaction__emoji')
    if (!el) return

    e.preventDefault()
    e.stopPropagation()

    const emoji = EMOJI_LIST.find((item) => item.rIcon === el.getAttribute('data-r-icon'))
    if (!emoji) return

    if (!toggleFavoriteEmoji(emoji)) {
      el.setAttribute('data-favorite-full', 'true')
      setTimeout(() => el.removeAttribute('data-favorite-full'), 400)
      return
    }

    updateFavoriteTitle(el)

    // Bubbles up to the popover that contains this emoji so it can re-render its rows
    el.dispatchEvent(new CustomEvent('zadark-reaction:favorites-change', { bubbles: true }))
  }, true)

  /**
   * Traverses up the React Fiber tree starting from a given DOM element,
   * looking for a fiber node that contains a `sendReaction` function in its props.
   *
   * @param {HTMLElement} el - The DOM element to begin traversal from.
   * @param {number} [maxDepth=10] - Maximum number of parent levels to search through.
   * @returns {Function|null} - The found sendReaction function, or null if not found.
   */
  const getReactFiberUpToDepth = (el, maxDepth = 10) => {
    let fiber = getReactFiber(el)
    let depth = 0

    while (fiber && depth < maxDepth) {
      if (fiber.memoizedProps && typeof fiber.memoizedProps.sendReaction === 'function') {
        return fiber.memoizedProps.sendReaction
      }
      fiber = fiber.return
      ++depth
    }

    return null
  }

  // Lucide icons for the favorite and recent rows in the popover
  const STAR_ICON_HTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star-icon lucide-star"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>'
  const HISTORY_ICON_HTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history-icon lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>'

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.type !== 'childList' || m.addedNodes.length === 0) return

      const targetNode = Array.from(m.addedNodes).find(
        (n) => n.querySelector && n.querySelector('.reaction-emoji-list')
      )

      if (!targetNode) return

      requestAnimationFrame(() => {
        document.querySelectorAll('.reaction-emoji-list').forEach((el) => {
          if (el.getAttribute('data-zadark-reaction-initialized') === 'true') {
            return
          }

          el.setAttribute('data-zadark-reaction-initialized', 'true')

          const zaloEmojiListWrapperEl = el.closest('.emoji-list-wrapper')
          if (!zaloEmojiListWrapperEl) {
            return
          }

          const sendReaction = getReactFiberUpToDepth(zaloEmojiListWrapperEl, 10)

          const containerEl = document.createElement('div')
          containerEl.className = 'zadark-reaction'
          containerEl.setAttribute('data-open', 'false')

          const closePopover = () => {
            containerEl.setAttribute('data-open', 'false')
          }

          const popoverContentListFragment = document.createDocumentFragment()
          for (const emoji of EMOJI_LIST) {
            const emojiEl = createEmojiEl(emoji, sendReaction, closePopover)
            popoverContentListFragment.appendChild(emojiEl)
          }

          const popoverContentListEl = document.createElement('div')
          popoverContentListEl.className = 'zadark-reaction__popover-content__list'
          popoverContentListEl.appendChild(popoverContentListFragment)

          const popoverContentFavoriteEl = document.createElement('div')
          popoverContentFavoriteEl.className = 'zadark-reaction__popover-content__row zadark-reaction__popover-content__favorite'

          const popoverContentRecentEl = document.createElement('div')
          popoverContentRecentEl.className = 'zadark-reaction__popover-content__row zadark-reaction__popover-content__recent'

          const popoverContentEl = document.createElement('div')
          popoverContentEl.className = 'zadark-reaction__popover-content'
          popoverContentEl.appendChild(popoverContentListEl)
          popoverContentEl.appendChild(popoverContentFavoriteEl)
          popoverContentEl.appendChild(popoverContentRecentEl)

          popoverContentEl.addEventListener('mouseleave', (e) => {
            containerEl.setAttribute('data-open', 'false')
          })

          const lastRenderedKeys = new Map()

          /**
           * Renders one bottom row (row icon + emojis + optional hint), skipping the work when nothing changed.
           * A row with a hint stays visible even when it has no emojis.
           *
           * @param {HTMLElement} rowEl - The row container.
           * @param {string} iconHTML - SVG markup of the row icon.
           * @param {Emoji[]} emojis - Emojis to show in the row.
           * @param {string} [hint] - Small helper text shown after the emojis.
           */
          const renderRow = (rowEl, iconHTML, emojis, hint = '') => {
            const key = `${getEmojisKey(emojis)}|${hint}`

            if (lastRenderedKeys.get(rowEl) === key) {
              return
            }

            lastRenderedKeys.set(rowEl, key)

            const iconEl = document.createElement('span')
            iconEl.className = 'zadark-reaction__popover-content__row-icon'
            iconEl.innerHTML = iconHTML

            const fragment = document.createDocumentFragment()
            fragment.appendChild(iconEl)
            for (const emoji of emojis) {
              fragment.appendChild(createEmojiEl(emoji, sendReaction, closePopover))
            }

            if (hint) {
              const hintEl = document.createElement('span')
              hintEl.className = 'zadark-reaction__popover-content__row-hint'
              hintEl.textContent = hint
              fragment.appendChild(hintEl)
            }

            rowEl.setAttribute('data-visible', String(emojis.length > 0 || Boolean(hint)))
            rowEl.replaceChildren(fragment)
          }

          const renderBottomRows = () => {
            renderRow(
              popoverContentFavoriteEl,
              STAR_ICON_HTML,
              FAVORITE_EMOJI_LIST,
              // Right-click is hidden behind the tooltip, so explain it while the favorite row is empty
              FAVORITE_EMOJI_LIST.length > 0 ? '' : 'Nhấp chuột phải vào emoji để thêm vào Yêu thích'
            )
            renderRow(
              popoverContentRecentEl,
              HISTORY_ICON_HTML,
              RECENT_EMOJI_LIST.slice(0, RECENT_EMOJI_LIMIT)
            )
          }

          popoverContentEl.addEventListener('zadark-reaction:favorites-change', renderBottomRows)

          const popoverTriggerEl = document.createElement('button')
          popoverTriggerEl.classList = 'zadark-reaction__popover-trigger'
          popoverTriggerEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-icon lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>'

          popoverTriggerEl.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()

            const isOpen = containerEl.getAttribute('data-open') === 'true'
            containerEl.setAttribute('data-open', String(!isOpen))

            if (!isOpen) {
              renderBottomRows()
            }
          })

          containerEl.appendChild(popoverTriggerEl)
          containerEl.appendChild(popoverContentEl)

          el.appendChild(containerEl)

          let lastRenderedQuickKey = ''

          // Replace Zalo's quick reactions with the first favorites (CSS hides the native ones)
          const renderQuickEmojis = () => {
            const quickEmojis = FAVORITE_EMOJI_LIST.slice(0, QUICK_EMOJI_LIMIT)
            const key = getEmojisKey(quickEmojis)

            if (key === lastRenderedQuickKey) {
              return
            }

            lastRenderedQuickKey = key

            el.querySelectorAll(':scope > .zadark-reaction__quick').forEach((quickEl) => quickEl.remove())
            el.setAttribute('data-zadark-quick', String(quickEmojis.length > 0))

            quickEmojis.forEach((emoji, index) => {
              const quickEl = document.createElement('div')
              quickEl.className = 'reaction-emoji-icon zadark-reaction__quick'
              // Stagger the zoom-in animation like Zalo's native icons (20ms, 40ms, ...)
              quickEl.style.animationDelay = `${(index + 1) * 20}ms`
              quickEl.appendChild(createEmojiEl(emoji, sendReaction))
              el.insertBefore(quickEl, containerEl)
            })
          }

          renderQuickEmojis()
          el.addEventListener('zadark-reaction:favorites-change', renderQuickEmojis)
          el.addEventListener('mouseenter', renderQuickEmojis)
        })
      })
    })
  })

  observer.observe(document.querySelector('#app'), { childList: true, subtree: true })
})()
