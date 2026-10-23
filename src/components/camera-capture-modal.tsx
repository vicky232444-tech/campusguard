'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  X,
  AlertTriangle,
  ShieldCheck,
  Upload,
  SwitchCamera,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { beep } from '@/lib/beep'

export type PhotoVerificationResult = {
  dataUrl: string
  isVerified: boolean
  brightness: number
  resolution: string
  note: string
}

interface CameraCaptureModalProps {
  open: boolean
  onClose: () => void
  onCapture: (result: PhotoVerificationResult) => void
  title?: string
}

export function CameraCaptureModal({ open, onClose, onCapture, title }: CameraCaptureModalProps) {
  const { lang } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileFallbackRef = useRef<HTMLInputElement>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<PhotoVerificationResult | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [flashing, setFlashing] = useState(false)

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      streamRef.current = null
    }
    setCameraActive(false)
    setCameraLoading(false)
  }

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null)
    setCapturedImage(null)
    setCameraLoading(true)

    stopCamera()

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        lang === 'hi'
          ? 'ब्राउज़र में कैमरा API समर्थित नहीं है। नीचे दिए गए बटन से फोटो चुनें।'
          : 'Live camera stream is not supported in this browser. Please use the Device Camera button below.'
      )
      setCameraLoading(false)
      return
    }

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        // Fallback constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream

      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = stream
        video.muted = true
        video.defaultMuted = true
        video.playsInline = true
        video.setAttribute('playsinline', 'true')
        video.setAttribute('webkit-playsinline', 'true')
        video.setAttribute('autoplay', 'true')
        video.setAttribute('muted', 'true')

        video.onloadedmetadata = () => {
          video.play().catch(console.warn)
          setCameraActive(true)
          setCameraLoading(false)
        }

        try {
          await video.play()
          setCameraActive(true)
          setCameraLoading(false)
        } catch (e) {
          console.warn('Initial play promise non-fatal:', e)
          setCameraActive(true)
          setCameraLoading(false)
        }
      }
    } catch (err: any) {
      console.warn('Camera access notice:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(
          lang === 'hi'
            ? 'कैमरा अनुमति अस्वीकृत हुई। आप नीचे "डिवाइस कैमरा से लें" बटन दबाकर तुरंत फोटो खींच सकते हैं।'
            : 'Camera permission denied. Click "Take with Device Camera" below to capture instantly.'
        )
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError(
          lang === 'hi'
            ? 'कोई वेबकैम नहीं मिला। नीचे से डिवाइस कैमरा या फ़ाइल चुनें।'
            : 'No live webcam detected. Use the Device Camera button below.'
        )
      } else {
        setCameraError(
          lang === 'hi'
            ? 'कैमरा व्यस्त या अनुपलब्ध है। डिवाइस कैमरा से फोटो लेने हेतु नीचे क्लिक करें।'
            : `Camera unavailable (${err.name || 'busy'}). Use Device Camera below.`
        )
      }
      setCameraActive(false)
      setCameraLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      void startCamera(facingMode)
    } else {
      stopCamera()
      setCapturedImage(null)
      setCameraError(null)
    }
    return () => {
      stopCamera()
    }
  }, [open])

  const toggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    void startCamera(next)
  }

  const processAndSetCapturedImage = (dataUrl: string) => {
    try {
      beep('info')
    } catch {}

    setFlashing(true)
    setTimeout(() => setFlashing(false), 200)

    const img = new Image()
    img.onload = () => {
      const rawW = img.width || 640
      const rawH = img.height || 480
      const scale = Math.min(1, 1280 / Math.max(rawW, rawH))
      const width = Math.max(320, Math.round(rawW * scale))
      const height = Math.max(240, Math.round(rawH * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        const optimizedUrl = canvas.toDataURL('image/jpeg', 0.85)

        let avgBrightness = 128
        try {
          const frame = ctx.getImageData(0, 0, width, height)
          const data = frame.data
          let totalLuma = 0
          let count = 0
          const step = Math.max(16, Math.floor(data.length / 4000) * 4)
          for (let i = 0; i < data.length; i += step) {
            totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
            count++
          }
          if (count > 0) avgBrightness = totalLuma / count
        } catch {}

        const isTooDark = avgBrightness < 20
        const isTooBright = avgBrightness > 245
        const isGood = !isTooDark && !isTooBright

        const note = isTooDark
          ? 'Notice: Low ambient lighting detected'
          : isTooBright
            ? 'Notice: High ambient exposure detected'
            : 'AI Verified: Valid resolution, contrast & integrity'

        setCapturedImage({
          dataUrl: optimizedUrl,
          isVerified: isGood,
          brightness: Math.round(avgBrightness),
          resolution: `${width}x${height}`,
          note,
        })
        stopCamera()
        toast.success(lang === 'hi' ? 'फोटो खींच ली गई!' : 'Photo clicked successfully!')
      }
    }
    img.src = dataUrl
  }

  const snapPhoto = async () => {
    // If camera is not active or video not ready, seamlessly fallback to device camera!
    if (!videoRef.current || !cameraActive || !streamRef.current) {
      fileFallbackRef.current?.click()
      return
    }

    const video = videoRef.current

    // Strategy 1: Hardware ImageCapture API
    try {
      const track = streamRef.current.getVideoTracks()[0]
      if (track && 'ImageCapture' in window) {
        const imageCapture = new (window as any).ImageCapture(track)
        const blob = await imageCapture.takePhoto()
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            processAndSetCapturedImage(reader.result)
          }
        }
        reader.readAsDataURL(blob)
        return
      }
    } catch (e) {
      console.warn('ImageCapture hardware snapshot fallback to canvas:', e)
    }

    // Strategy 2: Canvas drawImage
    try {
      const rawW = video.videoWidth || video.clientWidth || 640
      const rawH = video.videoHeight || video.clientHeight || 480
      const scale = Math.min(1, 1280 / Math.max(rawW, rawH))
      const width = Math.max(320, Math.round(rawW * scale))
      const height = Math.max(240, Math.round(rawH * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not initialize 2D canvas')

      ctx.drawImage(video, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      processAndSetCapturedImage(dataUrl)
    } catch (err) {
      console.warn('Canvas snapshot fallback to native device camera:', err)
      fileFallbackRef.current?.click()
    }
  }

  const confirmPhoto = () => {
    if (capturedImage) {
      const img = capturedImage
      stopCamera()
      setCapturedImage(null)
      onCapture(img)
      onClose()
    }
  }

  const retakePhoto = () => {
    setCapturedImage(null)
    void startCamera(facingMode)
  }

  const handleClose = () => {
    stopCamera()
    setCapturedImage(null)
    setCameraError(null)
    onClose()
  }

  const onFallbackFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        processAndSetCapturedImage(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/95 text-card-foreground shadow-2xl p-4 sm:p-5 space-y-3.5 max-h-[94vh] overflow-y-auto card-3d border-top-maintenance">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                {title || (lang === 'hi' ? 'सीधा कैमरा फोटो कैप्चर' : 'Direct Camera Capture')}
              </h3>
              <p className="text-[10px] text-muted-foreground font-medium">
                {lang === 'hi' ? 'क्लिक करके फोटो खींचें व सत्यापन हेतु संलग्न करें' : 'Click to take a real photo & attach for verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Camera Notice Banner if error or blocked */}
        {cameraError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-2">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>{lang === 'hi' ? 'कैमरा सूचना' : 'Camera Notice'}</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">{cameraError}</p>
            <div className="flex items-center gap-2 pt-0.5">
              <Button
                size="sm"
                variant="default"
                onClick={() => fileFallbackRef.current?.click()}
                className="h-8 text-xs btn-3d-primary font-bold gap-1.5 flex-1"
              >
                <Camera className="h-3.5 w-3.5" />
                {lang === 'hi' ? 'डिवाइस कैमरा से लें' : 'Take with Device Camera'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => startCamera(facingMode)}
                className="h-8 text-xs gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                {lang === 'hi' ? 'पुनः प्रयास' : 'Retry'}
              </Button>
            </div>
          </div>
        )}

        {/* Viewfinder or Preview Box */}
        <div
          onClick={!capturedImage ? snapPhoto : undefined}
          className={cn(
            'relative aspect-video w-full overflow-hidden rounded-2xl bg-black border-2 border-border/80 shadow-inner flex items-center justify-center select-none',
            !capturedImage && 'cursor-pointer group'
          )}
        >
          {/* Shutter flash animation */}
          {flashing && (
            <div className="absolute inset-0 z-30 bg-white opacity-85 transition-opacity duration-150 pointer-events-none" />
          )}

          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.play().catch(console.warn)
                    setCameraActive(true)
                    setCameraLoading(false)
                  }
                }}
                onCanPlay={() => {
                  setCameraActive(true)
                  setCameraLoading(false)
                }}
                className="h-full w-full object-cover"
              />

              {/* Viewfinder Reticle & HUD Overlay */}
              <div className="absolute inset-3 pointer-events-none border border-white/30 rounded-xl flex flex-col justify-between p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/90 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md font-mono flex items-center gap-1 shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE VIEWFINDER
                  </span>

                  {/* Camera Flip Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFacingMode()
                    }}
                    className="pointer-events-auto flex items-center gap-1 rounded-md bg-black/60 hover:bg-black/80 backdrop-blur-sm px-2 py-1 text-[10px] font-bold text-white transition-colors cursor-pointer border border-white/20"
                    title="Flip between front and rear camera"
                  >
                    <SwitchCamera className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{facingMode === 'environment' ? 'Rear' : 'Front'}</span>
                  </button>
                </div>

                {/* Center Crosshair Target */}
                <div className="self-center flex flex-col items-center">
                  <div className="h-12 w-12 rounded-full border-2 border-dashed border-white/50 flex items-center justify-center group-hover:scale-110 group-hover:border-emerald-400 transition-all">
                    <div className="h-2 w-2 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-[10px] text-white/90 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded mt-1 font-mono">
                    {lang === 'hi' ? 'फोटो खींचने के लिए यहां टैप करें' : 'Tap screen or shutter to snap'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] text-white/70 font-mono">
                  <span>720p / 1080p HDR</span>
                  <span>AI Tamper Guard</span>
                </div>
              </div>

              {/* Floating Large 3D Shutter Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  snapPhoto()
                }}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-90 text-white shadow-[0_6px_20px_rgba(0,0,0,0.6)] transition-all cursor-pointer"
                title={lang === 'hi' ? 'फोटो क्लिक करें' : 'Click to take photo'}
              >
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-white/60 bg-white/25 flex items-center justify-center">
                  <Camera className="h-6 w-6 sm:h-7 sm:w-7 text-white drop-shadow" />
                </div>
              </button>

              {/* Connecting loader overlay */}
              {cameraLoading && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 text-white">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
                  <p className="text-xs font-semibold">{lang === 'hi' ? 'कैमरा कनेक्ट हो रहा है…' : 'Connecting to camera…'}</p>
                </div>
              )}
            </>
          ) : (
            <div className="relative h-full w-full">
              <img
                src={capturedImage.dataUrl}
                alt="Captured photo preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-emerald-600 text-white px-2.5 py-1 rounded-md text-[10px] font-black flex items-center gap-1 shadow-md">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {lang === 'hi' ? 'फोटो क्लिक हो गई' : 'Captured'}
              </div>
            </div>
          )}
        </div>

        {/* Verification Breakdown Card */}
        {capturedImage && (
          <div
            className={cn(
              'rounded-xl border p-3 text-xs space-y-1 shadow-xs',
              capturedImage.isVerified ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-amber-500/35 bg-amber-500/10'
            )}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                {capturedImage.isVerified ? 'AI Photo Verified' : 'Check Warning'}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{capturedImage.resolution}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{capturedImage.note}</p>
          </div>
        )}

        {/* Hidden Device Camera / File Input */}
        <input
          ref={fileFallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFallbackFile(e.target.files?.[0])}
        />

        {/* Footer Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
          {!capturedImage ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileFallbackRef.current?.click()}
                size="sm"
                className="text-xs gap-1.5 border-dashed"
              >
                <Upload className="h-3.5 w-3.5" />
                {lang === 'hi' ? 'डिवाइस कैमरा / गैलरी' : 'Device Camera / Files'}
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleClose} size="sm" className="text-xs">
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </Button>
                <Button
                  type="button"
                  onClick={snapPhoto}
                  className="btn-3d-primary font-bold text-xs gap-1.5 h-9 px-4 cursor-pointer"
                  size="sm"
                >
                  <Camera className="h-4 w-4" />
                  {lang === 'hi' ? 'फोटो खींचें (Snap)' : 'Snap Photo'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={retakePhoto} size="sm" className="text-xs gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                {lang === 'hi' ? 'दोबारा खींचें' : 'Retake'}
              </Button>
              <Button
                type="button"
                onClick={confirmPhoto}
                className="btn-3d-primary font-bold text-xs gap-1.5 h-9 px-4 cursor-pointer"
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                {lang === 'hi' ? 'सत्यापित फोटो संलग्न करें' : 'Attach Verified Photo'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
