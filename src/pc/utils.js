const chalk = require('chalk')
const fs = require('fs-extra')
const crossSpawn = require('cross-spawn')

const { IS_MAC } = require('./constants')

const psList = require('./packages/ps-list')

const print = (...args) => console.log(args.join(' '))
const printDebug = (...args) => print(chalk.gray(...args))
const printError = (...args) => console.log(chalk.redBright(args.join(' ')))
const clearScreen = () => console.clear()

/**
 * Get the PIDs of every running process whose name matches one of `processNames`.
 * @param {string[]} processNames - Lowercase process names, e.g. ['zalo.exe']
 * @returns {Promise<number[]>} - The matching process IDs
 * @throws {Error} - Throws error if the process list cannot be read
 */
const getProcessIdsByName = async (processNames = []) => {
  const processes = await psList()

  return processes
    .filter((process) => typeof process.name === 'string' && processNames.includes(process.name.toLowerCase()))
    .map((process) => process.pid)
}

/**
 * Open a website in the default browser
 * @param {string} url - The URL to open
 * @returns {void}
*/
const openWebsite = (url) => {
  const cmd = IS_MAC ? 'open' : 'start'
  const _url = `"${url}"`
  const args = IS_MAC ? [_url] : ['""', _url]
  crossSpawn(cmd, args, { shell: true })
}

/**
 * Check if the path is a file
 * @param {string} p - The path to check
 * @returns {boolean} - Returns true if the path is a file, otherwise false
 * @throws {Error} - Throws error if the path is invalid
 */
const isFile = (p) => {
  try {
    const stats = fs.statSync(p)
    return stats.isFile()
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false
    } else {
      throw error
    }
  }
}

/**
 * Check if the path is a directory
 * @param {string} p - The path to check
 * @returns {boolean} - Returns true if the path is a directory, otherwise false
 * @throws {Error} - Throws error if the path is invalid
* */
const isDirectory = (p) => {
  try {
    const stats = fs.statSync(p)
    return stats.isDirectory()
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false
    } else {
      throw error
    }
  }
}

/**
 * Kill a process by its PID
 * @param {number} pid - The process ID
 * @returns {boolean} - Returns true if the process was killed, otherwise false
 */
const killProcess = (pid) => {
  try {
    const args = IS_MAC ? [pid.toString()] : ['/F', '/PID', pid.toString()]
    const result = crossSpawn.sync(IS_MAC ? 'kill' : 'taskkill', args)
    return result?.status === 0
  } catch (error) {
    return false
  }
}

/**
 * Kill multiple processes by their PIDs
 * @param {number[]} processIds - An array of process IDs
 * @returns {void}
 */
const killProcesses = (processIds = []) => {
  processIds.forEach((pid) => killProcess(pid))
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Block the event loop (and therefore the terminal spinner) for `ms`.
 *
 * Needed after killing Zalo because `taskkill` reports success before the OS has
 * finished tearing down the process tree, and the still-closing processes keep
 * handles open on `app.asar`. A sync sleep is also what lets the caller print a
 * status line before a long synchronous step begins.
 * @param {number} ms - The milliseconds to block for
 * @returns {void}
 */
const sleepSync = (ms) => {
  const shared = new SharedArrayBuffer(4)
  Atomics.wait(new Int32Array(shared), 0, 0, ms)
}

/**
 * Wait until no process matches one of `processNames`.
 *
 * `taskkill` resolves as soon as the signal is delivered, not once the process
 * tree has actually gone. Zalo is an Electron app with several child processes,
 * and Windows keeps `app.asar` locked until the last one closes, so installing
 * too early fails or hangs on the archive.
 * @param {string[]} processNames - Lowercase process names to wait out, e.g. ['zalo.exe']
 * @param {object} [options]
 * @param {number} [options.timeoutMs=15000] - How long to wait before giving up
 * @param {number} [options.intervalMs=250] - Delay between checks
 * @returns {Promise<boolean>} - True when no matching process remains
 */
const waitForProcessesToExit = async (processNames, options = {}) => {
  const { timeoutMs = 15000, intervalMs = 250 } = options
  const deadline = Date.now() + timeoutMs

  for (;;) {
    let alive = []
    try {
      const pids = await getProcessIdsByName(processNames)
      alive = pids
    } catch (error) {
      // If the process list cannot be read, stop waiting rather than spin.
      return false
    }

    if (!alive.length) {
      return true
    }

    if (Date.now() >= deadline) {
      return false
    }

    await sleep(intervalMs)
  }
}

module.exports = {
  print,
  printDebug,
  printError,
  clearScreen,

  openWebsite,

  isFile,
  isDirectory,

  killProcess,
  killProcesses,
  sleepSync,
  getProcessIdsByName,
  waitForProcessesToExit,

  sleep
}
