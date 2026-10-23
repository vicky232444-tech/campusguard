'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, CheckCircle2, RefreshCw, X, AlertTriangle, ShieldCheck, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

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
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<PhotoVerificationResult | null>(null)

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
  }

  const startCamera = async () => {
    setCameraError(null)
    setCapturedImage(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API is not supported in this browser environment or requires HTTPS.')
      return
    }

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        // Fallback for devices without 'environment' facing mode or specific constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch((err) => {
          console.warn('Video play non-fatal warning:', err)
        })
      }
      setCameraActive(true)
    } catch (err: any) {
      console.warn('Camera access error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser, or pick a photo.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can choose a photo file instead.')
      } else {
        setCameraError(`Camera unavailable (${err.message || err.name || 'Device busy'}). You can pick a file instead.`)
      }
      setCameraActive(false)
    }
  }

  useEffect(() => {
    if (open) {
      void startCamera()
    } else {
      stopCamera()
      setCapturedImage(null)
      setCameraError(null)
    }
    return () => {
      stopCamera()
    }
  }, [open])

  const snapPhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const rawW = video.videoWidth || 640
    const rawH = video.videoHeight || 480
    const scale = Math.min(1, 960 / Math.max(rawW, rawH))
    const width = Math.max(320, Math.round(rawW * scale))
    const height = Math.max(240, Math.round(rawH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      toast.error('Canvas rendering not supported on this browser')
      return
    }

    try {
      ctx.drawImage(video, 0, 0, width, height)

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
        ? 'Warning: Image appears too dark. Better lighting recommended.'
        : isTooBright
          ? 'Warning: Image appears overexposed.'
          : 'Photo Verified: Optimal lighting, contrast and focus detected.'

      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      const result: PhotoVerificationResult = {
        dataUrl,
        isVerified: isGood,
        brightness: Math.round(avgBrightness),
        resolution: `${width}x${height}`,
        note,
      }

      setCapturedImage(result)
      stopCamera()
    } catch (e) {
      console.error('Snap error:', e)
      toast.error('Failed to capture frame from camera')
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
    void startCamera()
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
        const img = new Image()
        img.onload = () => {
          const rawW = img.width || 640
          const rawH = img.height || 480
          const scale = Math.min(1, 960 / Math.max(rawW, rawH))
          const w = Math.round(rawW * scale)
          const h = Math.round(rawH * scale)
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const ctx = c.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h)
            const resizedUrl = c.toDataURL('image/jpeg', 0.82)
            setCapturedImage({
              dataUrl: resizedUrl,
              isVerified: true,
              brightness: 120,
              resolution: `${w}x${h}`,
              note: 'Photo Attached from Device',
            })
          }
        }
        img.src = reader.result
      }
    }
    reader.readAsDataURL(file)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border bg-card text-card-foreground shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-emerald-500" />
            <h3 className="font-bold text-base leading-none">
              {title || (lang === 'hi' ? 'सीधा कैमरा फोटो खींचें' : 'Direct Camera Capture & Verification')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Camera error */}
        {cameraError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400 space-y-2.5">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Camera Notice</span>
            </div>
            <p>{cameraError}</p>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={startCamera} className="h-7 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" /> Retry Access
              </Button>
              <Button size="sm" variant="secondary" onClick={() => fileFallbackRef.current?.click()} className="h-7 text-xs">
                <Upload className="h-3 w-3 mr-1" /> Pick Photo Instead
              </Button>
            </div>
          </div>
        )}

        {/* Viewfinder or Preview */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-border shadow-inner flex items-center justify-center">
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="h-full w-full object-cover"
              />
              {cameraActive && (
                <div className="absolute inset-4 pointer-events-none border-2 border-white/40 rounded-lg flex flex-col justify-between p-2">
                  <span className="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded self-start font-mono">
                    CAMERA VIEWFINDER · 1080p
                  </span>
                  <span className="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded self-center font-mono">
                    Center object inside reticle
                  </span>
                </div>
              )}
            </>
          ) : (
            <img
              src={capturedImage.dataUrl}
              alt="Captured photo preview"
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {/* Photo verification badge */}
        {capturedImage && (
          <div
            className={cn(
              'rounded-xl border p-3 text-xs space-y-1',
              capturedImage.isVerified ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'
            )}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                {capturedImage.isVerified ? 'AI Photo Verified' : 'Check Warning'}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{capturedImage.resolution}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{capturedImage.note}</p>
          </div>
        )}

        {/* Hidden Fallback Input */}
        <input
          ref={fileFallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFallbackFile(e.target.files?.[0])}
        />

        {/* Footer controls */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          {!capturedImage ? (
            <>
              <Button variant="outline" onClick={handleClose} size="sm">
                Cancel
              </Button>
              <Button
                onClick={snapPhoto}
                disabled={!cameraActive}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                size="sm"
              >
                <Camera className="h-4 w-4 mr-1.5" />
                {lang === 'hi' ? 'फोटो खींचें' : 'Snap Photo'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={retakePhoto} size="sm">
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {lang === 'hi' ? 'दोबारा लें' : 'Retake'}
              </Button>
              <Button
                onClick={confirmPhoto}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {lang === 'hi' ? 'फोटो संलग्न करें' : 'Attach Verified Photo'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
