import sharp from 'sharp'

const img = sharp('public/logo_definitivo.png')
const { data, info } = await img
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const pixels = new Uint8Array(data)
for (let i = 0; i < pixels.length; i += 4) {
  const r = pixels[i], g = pixels[i+1], b = pixels[i+2]
  if (r > 240 && g > 240 && b > 240) {
    pixels[i+3] = 0
  }
}

await sharp(Buffer.from(pixels), {
  raw: { width: info.width, height: info.height, channels: 4 }
}).png().toFile('public/logo_transparent.png')

console.log('✅ Logo con trasparenza creato')
