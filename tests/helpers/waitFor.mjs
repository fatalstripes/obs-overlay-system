/** Polls `fn` until it returns something truthy (returned), or throws after `timeout` ms with `what` in the message. */
export async function waitFor(fn, what = 'condition', timeout = 3000) {
  const start = Date.now()
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 10))
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
