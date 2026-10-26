import type { VideoPolicy } from "@/shared/media-policy"

/**
 * Client-side prep for a film, the counterpart to `image-optimize.ts`: play it
 * into a canvas at the target size and record the canvas back out. Browser-only.
 *
 * It DROPS THE AUDIO, because a canvas stream has none — which is why callers
 * opt in rather than getting this by default. Correct for a muted background,
 * wrong for a clip somebody might want to hear.
 *
 * Unlike an image there is no single API that does this, and `MediaRecorder`
 * decides the container at runtime, so the output type is returned rather than
 * assumed: the stored key's extension has to match the bytes.
 */

/** Containers to record into, best first. MP4 leads because every browser can
    play it back; WebM is the fallback that Chrome and Firefox actually offer. */
const CANDIDATES: { record: string; stored: "video/mp4" | "video/webm" }[] = [
  { record: 'video/mp4;codecs="avc1.42E01E"', stored: "video/mp4" },
  { record: "video/mp4", stored: "video/mp4" },
  { record: 'video/webm;codecs="vp9"', stored: "video/webm" },
  { record: 'video/webm;codecs="vp8"', stored: "video/webm" },
  { record: "video/webm", stored: "video/webm" },
]

/** How often to ask whether playback is still advancing. */
const STALL_CHECK_MS = 5000

/** The container this browser will give us, or null if it will not encode at
    all — in which case the caller keeps the original file. */
export function videoEncoding(): (typeof CANDIDATES)[number] | null {
  if (typeof MediaRecorder === "undefined") {
    return null
  }

  return CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.record)) ?? null
}

export const videoOptimizeSupported = (): boolean => videoEncoding() !== null

/** Longer than the policy allows. Its own type because it is the one failure
    worth explaining to whoever picked the file. */
export class VideoTooLongError extends Error {
  // Declared and assigned rather than a `readonly` constructor parameter: the
  // test runner strips types instead of compiling them, and a parameter
  // property is syntax it refuses outright.
  readonly seconds: number

  constructor(seconds: number) {
    super(`Film is ${seconds}s`)
    this.name = "VideoTooLongError"
    this.seconds = seconds
  }
}

/**
 * Fit inside `maxDim` on the longest side, keeping the aspect ratio. Rounded to
 * EVEN numbers: yuv420 stores chroma at half resolution, so an odd width or
 * height is rejected outright by the encoders that matter.
 */
export function targetSize(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2)

  return { width: even(width), height: even(height) }
}

export async function optimizeVideo(
  file: Blob,
  policy: VideoPolicy,
  onProgress?: (fraction: number) => void,
): Promise<{ blob: Blob; type: "video/mp4" | "video/webm" }> {
  const encoding = videoEncoding()
  if (!encoding) {
    throw new Error("This browser can't re-encode video")
  }

  const url = URL.createObjectURL(file)
  const video = document.createElement("video")

  // Hoisted so `finally` can tear all of it down on ANY exit. Left after the
  // happy path only, a stalled film kept drawing to a live encoder for the life
  // of the page.
  let frame = 0
  let watchdog: ReturnType<typeof setInterval> | undefined
  let onVisibility: (() => void) | undefined
  let recorder: MediaRecorder | undefined
  let stream: MediaStream | undefined

  try {
    video.src = url
    video.muted = true
    video.playsInline = true
    video.preload = "auto"

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error("Couldn't read that film"))
    })

    // No video track — an audio file with a video extension. Without this the
    // even-size floor turns it into a 2x2-pixel "film" and publishes it.
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("That file has no picture in it")
    }
    // Duration is not guaranteed at `loadedmetadata`: a WebM without it in the
    // header reads Infinity or NaN. Unknown means unchecked — telling her a
    // six-second clip is too long would be worse than not checking.
    if (Number.isFinite(video.duration) && video.duration > policy.maxSeconds) {
      throw new VideoTooLongError(Math.round(video.duration))
    }

    const size = targetSize(video.videoWidth, video.videoHeight, policy.maxDim)
    const canvas = document.createElement("canvas")
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Canvas unsupported")
    }

    stream = canvas.captureStream(policy.fps)
    recorder = new MediaRecorder(stream, {
      mimeType: encoding.record,
      videoBitsPerSecond: policy.bitsPerSecond,
    })
    const active = recorder
    const chunks: Blob[] = []
    active.ondataavailable = (event) => {
      if (event.data.size) {
        chunks.push(event.data)
      }
    }
    const stopped = new Promise<void>((resolve) => {
      active.onstop = () => resolve()
    })

    active.start()
    await video.play()

    // Both sides pause together when the tab goes away. `requestAnimationFrame`
    // is suspended while hidden but the film would keep playing, so the canvas
    // would hold one frame and the recording would capture that frame for as
    // long as she was gone — a background that freezes two seconds in, with
    // nothing anywhere reporting it.
    onVisibility = () => {
      if (document.hidden) {
        video.pause()
        if (active.state === "recording") {
          active.pause()
        }
      } else {
        if (active.state === "paused") {
          active.resume()
        }
        void video.play()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    let lastPercent = -1
    const draw = () => {
      ctx.drawImage(video, 0, 0, size.width, size.height)
      if (onProgress && Number.isFinite(video.duration) && video.duration > 0) {
        // Whole percents only: this fires per animation frame, and the caller
        // puts it in React state.
        const percent = Math.min(
          100,
          Math.round((video.currentTime / video.duration) * 100),
        )
        if (percent !== lastPercent) {
          lastPercent = percent
          onProgress(percent / 100)
        }
      }
      frame = requestAnimationFrame(draw)
    }
    draw()

    // A watchdog rather than a deadline: a paused tab is not a stall, and a
    // duration we could not read makes any computed deadline nonsense.
    const stalled = new Promise<never>((_, reject) => {
      let seen = -1
      watchdog = setInterval(() => {
        if (video.paused) {
          return
        }
        if (video.currentTime === seen) {
          reject(new Error("Re-encoding stalled"))

          return
        }
        seen = video.currentTime
      }, STALL_CHECK_MS)
    })

    await Promise.race([
      new Promise<void>((resolve) => {
        video.onended = () => resolve()
      }),
      stalled,
    ])

    cancelAnimationFrame(frame)
    frame = 0
    active.stop()
    await stopped

    return {
      blob: new Blob(chunks, { type: encoding.stored }),
      type: encoding.stored,
    }
  } finally {
    if (frame) {
      cancelAnimationFrame(frame)
    }
    clearInterval(watchdog)
    if (onVisibility) {
      document.removeEventListener("visibilitychange", onVisibility)
    }
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    }
    stream?.getTracks().forEach((track) => track.stop())
    video.pause()
    video.removeAttribute("src")
    URL.revokeObjectURL(url)
  }
}
