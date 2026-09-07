"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Pause, Play } from "lucide-react"
import { useTranslations } from "next-intl"

import { DEFAULT_HERO_IMAGE } from "@/shared/business-profile"

/**
 * A film behind the landing statement.
 *
 * It is rendered PAUSED, with only its metadata preloaded, and starts on mount —
 * never in the markup. That is what lets `prefers-reduced-motion` mean what it
 * says: someone who asked for less movement never downloads the rest of the
 * file, and with JavaScript off the hero is a still frame rather than a black
 * rectangle. Muted and `playsInline` because no browser will autoplay otherwise,
 * and because sound nobody asked for is its own kind of rude.
 *
 * NO `poster`. The obvious one is the photo shipped with the app, and setting it
 * would mean anyone who asked for less motion sees stock imagery instead of her
 * film — which is the opposite of the promise. A paused video paints its own
 * first frame once the metadata lands, and that frame is hers.
 *
 * A film that will not DECODE is a different matter, and falls back to that
 * photo: the container is chosen by whichever browser she uploaded from, so it
 * is possible to store one a visitor's browser cannot play, and the first screen
 * of the site is not allowed to be an empty gradient.
 *
 * The pause control is a button and not the whole surface: the middle of the
 * hero is the Reserve CTA, and a full-bleed click target would swallow it.
 * WCAG 2.2.2 wants a way to stop anything that moves for more than five
 * seconds — this is it, keyboard included.
 */
export function HeroVideo({ src }: { src: string }) {
  const t = useTranslations("hero")
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [undecodable, setUndecodable] = useState(false)

  useEffect(() => {
    const element = video.current
    if (!element) return

    // Read the state off the ELEMENT rather than tracking it alongside: iOS Low
    // Power Mode and a browser's own data-saving both pause a video without
    // asking, and a button that then still says "Pause" tells a screen reader
    // the opposite of what is happening.
    const sync = () => setPlaying(!element.paused)
    element.addEventListener("play", sync)
    element.addEventListener("pause", sync)

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.preload = "auto"
      // Autoplay can still be refused. Staying paused is a fine outcome — the
      // first frame is showing either way.
      void element.play().catch(() => {})
    }

    return () => {
      element.removeEventListener("play", sync)
      element.removeEventListener("pause", sync)
    }
  }, [])

  const toggle = () => {
    const element = video.current
    if (!element) return
    if (element.paused) {
      element.preload = "auto"
      void element.play().catch(() => {})
    } else {
      element.pause()
    }
  }

  if (undecodable) {
    return (
      <Image
        src={DEFAULT_HERO_IMAGE}
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 -z-10 object-cover object-center"
      />
    )
  }

  return (
    <>
      <video
        ref={video}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setUndecodable(true)}
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 -z-10 size-full object-cover object-center"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("pauseBackground") : t("playBackground")}
        className="absolute right-6 bottom-8 rounded-full border border-background/30 bg-foreground/30 p-2 text-background outline-none backdrop-blur-sm transition-colors hover:bg-foreground/50 focus-visible:ring-3 focus-visible:ring-background/40"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </>
  )
}
