const fs = require("fs")
const https = require("https")
const mkdirp = require("mkdirp")
const path = require("path")
const tar = require("tar")

/**
 * Create Hina instance.
 *
 * @param {string} src
 * @param {object} option
 *
 * @example
 * const h = hina("user/repo", {})
 *
 * h.clone("path/to/dir").then(() => {
 *   console.log("DONE")
 * })
 */
module.exports = function hina(src, option = {}) {
  // user/repo                 -> user/repo, ____, ____________
  // user/repo/                -> user/repo, /   , ____________
  // user/repo/src             -> user/repo, /src, ____________
  // user/repo#some/branch     -> user/repo, ____, #some/branch
  // user/repo/src#some/branch -> user/repo, /src, #some/branch
  const match = src.match(
    /^(?<user_repo>[^\/]+\/[^\/#]+)(?<sub>\/[^#]*)?(?<ref>#.+)?$/
  )
  if (!match) {
    throw new Error(`Could not parse "${src}"`)
  }

  let { user_repo, sub, ref } = match.groups || {}
  // /src/foo        -> /src/foo/
  // src///foo/bar// -> /src/foo/bar/
  // /               -> /
  sub = `/${sub || ""}/`.replace(/\/{2,}/g, "/")
  if (ref) {
    // ###some///branch/# -> some///branch/#
    ref = ref.replace(/^#+/, "")
  }

  return {
    /**
     * Clone the repo without git histories.
     *
     * @param {string} dest
     */
    async clone(dest = process.cwd()) {
      await this.mkdirp(dest)

      const file = path.resolve(dest, `${ref || "HEAD"}.tar.gz`)

      await this.downloadTo(file)

      await this.extract(file, dest)

      await this.remove(file).catch((err) => {
        // TODO Replace direct console to event emit.
        console.warn(err)
      })

      await this.doActionsAt(dest).catch((err) => {
        // TODO Replace direct console to event emit.
        console.warn(err)
      })
    },

    /**
     * mkdir -p
     *
     * @param {string} dir
     */
    async mkdirp(dir) {
      mkdirp(dir)
    },

    /**
     * Download a file.
     *
     * @param {string} file
     */
    async downloadTo(file) {
      const resp = await fetch(
        `https://github.com/${user_repo}/archive/${ref || "HEAD"}.tar.gz`
      )

      const stream = resp.pipe(fs.createWriteStream(file))
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve).on("error", reject)
      })
    },

    /**
     * Extract a tarball.
     *
     * @param {string} file
     * @param {string=} dest
     */
    async extract(file, dest) {
      /** @type {string} */
      const wrapper = await new Promise((resolve, reject) => {
        tar
          .list({
            file,
            filter(path) {
              // wrapper/             -> wrapper
              // wrapper/package.json -> (not match)
              // wrapper/src/index.js -> (not match)
              const [wrapper] = path.match(/^[^\/]+(?=\/$)/) || []
              if (wrapper) {
                resolve(wrapper)
              }

              return false
            },
          })
          // @ts-ignore
          .then(() => {
            reject(new Error("No wrapper matches"))
          }, reject)
      })

      // wrapper + /
      // wrapper + /src/
      const wrapperDir = `${wrapper}${sub}`
      await tar.extract(
        {
          file,
          strip: wrapperDir.split("/").length - 1,
          cwd: dest,
        },
        [wrapperDir]
      )
    },

    /**
     * Remove the file.
     *
     * @param {string} file
     */
    async remove(file) {
      await fs.promises.unlink(file)
    },

    /**
     * Do actions defined in the degit.json.
     *
     * @param {string} dest
     */
    async doActionsAt(dest = process.cwd()) {
      const actionsPath = path.resolve(dest, "degit.json")

      const actionsContents = await fs.promises
        .readFile(actionsPath)
        .catch(() => null)
      if (!actionsContents) return

      /** @type {unknown} */
      const rawData = JSON.parse(actionsContents.toString())

      if (!Array.isArray(rawData)) return

      await fs.promises.unlink(actionsPath)

      /**
       * @typedef {{
       *  action: "clone"
       *  src: string
       * } | {
       *  action: "remove"
       *  files: string[]
       * }} Action
       * @type {Action[]}
       */
      const actions = rawData.filter((action) => {
        if (!action) {
          return false
        }

        switch (action.action) {
          case "clone": {
            const { src } = action

            return typeof src === "string"
          }

          case "remove": {
            const { files } = action

            return (
              Array.isArray(files) && files.every((v) => typeof v === "string")
            )
          }

          default: {
            return false
          }
        }
      })

      await Promise.all(
        actions.map((action) => {
          switch (action.action) {
            case "clone": {
              // Do nothing.
              return
            }

            case "remove": {
              const { files } = action

              return Promise.all(
                files.map((file) => this.remove(path.resolve(dest, file)))
              )
            }

            default: {
              return
            }
          }
        })
      )
    },
  }
}

/**
 * Follow 3xx redirects.
 *
 * @param {string} url
 * @returns {Promise<import("http").IncomingMessage>}
 */
async function fetch(url) {
  /** @type {import("http").IncomingMessage} */
  const resp = await new Promise((resolve, reject) => {
    https.get(url, resolve).on("error", reject)
  })

  const { statusCode = 500, statusMessage = "", headers } = resp

  if (statusCode >= 500 || statusCode >= 400) {
    throw new Error(`${statusCode} ${statusMessage}`)
  }

  if (statusCode >= 300) {
    const { location } = headers
    if (!location) {
      throw new Error(`No location header. ${statusCode} ${statusMessage}`)
    }

    return await fetch(location)
  }

  return resp
}
