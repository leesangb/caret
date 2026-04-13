export interface Invalidator {
  invalidate(): void
  cancel(): void
}

type RafHandle = ReturnType<typeof requestAnimationFrame>

function getScheduler() {
  const win = globalThis.window as Window | undefined
  const raf = win?.requestAnimationFrame?.bind(win) ?? globalThis.requestAnimationFrame?.bind(globalThis)
  const caf = win?.cancelAnimationFrame?.bind(win) ?? globalThis.cancelAnimationFrame?.bind(globalThis)

  if (raf && caf) {
    return {
      request: raf,
      cancel: caf
    }
  }

  return {
    request: (callback: FrameRequestCallback) => {
      return setTimeout(() => callback(performance.now()), 16) as unknown as RafHandle
    },
    cancel: (handle: RafHandle) => {
      clearTimeout(handle as unknown as number)
    }
  }
}

export function createInvalidator(callback: () => void): Invalidator {
  const scheduler = getScheduler()
  let pendingHandle: RafHandle | null = null

  return {
    invalidate() {
      if (pendingHandle !== null) return

      pendingHandle = scheduler.request(() => {
        pendingHandle = null
        callback()
      })
    },
    cancel() {
      if (pendingHandle === null) return

      scheduler.cancel(pendingHandle)
      pendingHandle = null
    }
  }
}
