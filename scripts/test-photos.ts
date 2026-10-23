/** Generates test photos for the 3-step verification browser walkthrough. */
import sharp from 'sharp'

async function main() {
  // "Real photo"-style base: textured gradient with vignette + grain, workshop scene feel
  const base = await sharp({
    create: { width: 900, height: 600, channels: 3, background: '#7d8a94' },
  })
    .composite([
      // wall texture bands
      { input: Buffer.from('<svg width="900" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8beb2"/><stop offset="0.6" stop-color="#a89a8a"/><stop offset="1" stop-color="#6e6155"/></linearGradient></defs><rect width="900" height="600" fill="url(#g)"/><rect x="60" y="80" width="340" height="240" fill="#e8e4de" stroke="#8a8378" stroke-width="6"/><rect x="70" y="90" width="320" height="220" fill="#b9d2e8" stroke="#7d90a5" stroke-width="3"/><rect x="520" y="120" width="300" height="330" fill="#556270"/><rect x="540" y="140" width="260" height="290" fill="#7fa3bd"/><circle cx="180" cy="470" r="42" fill="#f2f0eb" stroke="#8a8378" stroke-width="4"/><path d="M150 470 h60 M180 440 v60" stroke="#4a4a4a" stroke-width="7"/></svg>') },
    ])
    .jpeg({ quality: 82 })
    .toBuffer()

  // Proof photo (maintenance upload)
  await sharp(base).toFile('/tmp/cg-proof.jpg')

  // Confirmation photo (reporter upload) — same scene, slightly cropped & zoomed (different angle feel)
  await sharp(base)
    .extract({ left: 60, top: 40, width: 780, height: 520 })
    .resize(900, 600)
    .modulate({ brightness: 1.04 })
    .jpeg({ quality: 80 })
    .toFile('/tmp/cg-confirm.jpg')

  // Deliberately morphed photo — mirrored patch + pasted block (for rejection-path test)
  const clean = await sharp(base).toBuffer()
  const patch = await sharp(clean).extract({ left: 0, top: 0, width: 300, height: 300 }).flop().toBuffer()
  await sharp(clean)
    .composite([{ input: patch, left: 520, top: 260 }])
    .jpeg({ quality: 82 })
    .toFile('/tmp/cg-morphed.jpg')

  console.log('test photos written: /tmp/cg-proof.jpg /tmp/cg-confirm.jpg /tmp/cg-morphed.jpg')
}
main()
