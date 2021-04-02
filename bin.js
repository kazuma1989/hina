#!/usr/bin/env node

// @ts-check
/// <reference lib="es2018" />

const fs = require("fs")
const https = require("https")

/**
 * @param {string} url
 * @param {string} dest
 */
async function fetch(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (resp) => {
        const { statusCode, statusMessage, headers } = resp

        if (statusCode >= 400) {
          reject({ statusCode, statusMessage })
          return
        }

        if (statusCode >= 300) {
          fetch(headers.location, dest).then(resolve, reject)
          return
        }

        resp
          .pipe(fs.createWriteStream(dest))
          .on("finish", () => resolve())
          .on("error", reject)
      })
      .on("error", reject)
  })
}

async function main() {
  await fetch(
    "https://github.com/kazuma1989/firebook/archive/HEAD.zip",
    "./bar.zip"
  )
}

main().catch((e) => {
  console.error(e)

  process.exit(1)
})
