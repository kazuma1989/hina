#!/usr/bin/env node

const fs = require("fs")
const https = require("https")
const mkdirp = require("mkdirp")
const tar = require("tar")

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
function hina(src, option = {}) {
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
     * @param {string=} dest
     */
    async clone(dest) {
      const file = `${ref || "HEAD"}.tar.gz`

      await this.downloadTo(file)
      await this.extract(file, dest)

      await this.remove(file).catch((err) => {
        console.warn(err)
      })
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
     * If dest doesn't exist, it will be created.
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

      if (dest) {
        await mkdirp(dest)
      }

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
  }
}

/**
 * @example
 * ```console
 * npx hina user/repo               # copy into the current working directory
 * npx hina user/repo path/to/dir   # specify a directory
 *
 * npx hina user/repo#dev           # branch
 * npx hina user/repo#v1.2.3        # release tag
 * npx hina user/repo#1234abcd      # commit hash
 *
 * npx hina user/repo/sub           # extract a sub directory
 * ```
 */
async function main() {
  try {
    const [src, dest] = process.argv.slice(2)
    if (!src) {
      throw new Error(
        "Too few arguments. The command requires at least 1 argument"
      )
    }

    await hina(src).clone(dest)
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

main()
