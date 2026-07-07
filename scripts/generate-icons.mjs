import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public/app-icon.svg'))
const iconDir = join(root, 'public/icons')
const resourcesDir = join(root, 'resources')

mkdirSync(iconDir, { recursive: true })
mkdirSync(resourcesDir, { recursive: true })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

await Promise.all(
  sizes.map((size) =>
    sharp(svg)
      .resize(size, size)
      .png()
      .toFile(join(iconDir, `icon-${size}.png`)),
  ),
)

await sharp(svg).resize(1024, 1024).png().toFile(join(resourcesDir, 'icon.png'))
await sharp(svg).resize(2732, 2732).png().toFile(join(resourcesDir, 'splash.png'))

console.log('Generated PWA icons and Capacitor resources.')
