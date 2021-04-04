#!/usr/bin/env node

const hina = require("./index")

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
async function run() {
  try {
    const [src, dest] = process.argv.slice(2)
    if (!src) {
      throw new Error(
        "Too few arguments. The command requires at least 1 argument"
      )
    }

    const h = hina(src)

    h.on("info", (e) => {
      console.error("info:", e)
    })

    h.on("warn", (e) => {
      console.error("warn:", e)
    })

    await h.clone(dest)
  } catch (err) {
    console.error(err)

    process.exit(1)
  }
}

run()
