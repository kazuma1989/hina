#!/usr/bin/env node

// @ts-check
/// <reference lib="es2018" />

const fs = require("fs")
const https = require("https")
const tar = require("tar")

/**
 * @param {string} url
 * @returns {Promise<import("http").IncomingMessage>}
 */
async function fetch(url) {
  /** @type {import("http").IncomingMessage} */
  const resp = await new Promise((resolve, reject) => {
    https.get(url, resolve).on("error", reject)
  })

  const { statusCode, statusMessage, headers } = resp

  if (statusCode >= 500 || statusCode >= 400) {
    throw new Error(`${statusCode} ${statusMessage}`)
  }

  if (statusCode >= 300) {
    return await fetch(headers.location)
  }

  return resp
}

/**
 * @param {string} url
 * @param {string} dest
 */
async function download(url, dest) {
  const resp = await fetch(url)

  await new Promise((resolve, reject) => {
    resp
      .pipe(fs.createWriteStream(dest))
      .on("finish", resolve)
      .on("error", reject)
  })
}

/**
 * @param {string=} subDir
 */
async function main(subDir) {
  await download(
    "https://github.com/kazuma1989/firebook/archive/HEAD.tar.gz",
    "./HEAD.tar.gz"
  )

  const dest = "./"
  await tar.extract(
    {
      file: "./HEAD.tar.gz",
      strip: subDir ? subDir.split("/").length : 1,
      cwd: dest,
    },
    subDir ? [subDir] : []
  )
}

main().catch((e) => {
  console.error(e)

  process.exit(1)
})
