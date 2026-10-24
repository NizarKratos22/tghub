import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { AppError } from '../../core/http/errors';
import { processImage } from './media.service';

async function photo(width: number, height: number, withGps = false): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 10, g: 150, b: 232 } } });
  const tagged = withGps
    ? image.withExif({ IFD0: { Make: 'TestPhone', Model: 'TG-1' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '36/1 48/1 0/1' } })
    : image;
  return tagged.jpeg().toBuffer();
}

describe('image processing', () => {
  it('strips EXIF (camera and GPS) from uploads', async () => {
    const input = await photo(1200, 900, true);
    assert.ok((await sharp(input).metadata()).exif, 'fixture should carry EXIF');

    const { full, thumb } = await processImage(input);
    assert.equal((await sharp(full).metadata()).exif, undefined);
    assert.equal((await sharp(thumb).metadata()).exif, undefined);
  });

  it('caps the long edge at 1600px and crops a square thumbnail', async () => {
    const result = await processImage(await photo(4000, 2000));
    assert.equal(result.width, 1600);
    assert.equal(result.height, 800);
    const thumb = await sharp(result.thumb).metadata();
    assert.equal(thumb.format, 'webp');
    assert.deepEqual([thumb.width, thumb.height], [480, 480]);
  });

  it('refuses images too small to show', async () => {
    await assert.rejects(processImage(await photo(120, 120)), AppError);
  });

  it('refuses files that are not images', async () => {
    await assert.rejects(processImage(Buffer.from('<svg onload="alert(1)"></svg>')), AppError);
  });
});
