import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertKey, type ObjectStorage } from './object-storage';

/** Files in one folder (`MEDIA_DIR`). The content type isn't stored: the API serves every key as WebP. */
export class LocalDiskStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  private readonly root: string;
  private ready: Promise<unknown> | null = null;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private file(key: string) {
    assertKey(key);
    return path.join(this.root, key);
  }

  async put(key: string, body: Buffer): Promise<void> {
    this.ready ??= mkdir(this.root, { recursive: true });
    await this.ready;
    await writeFile(this.file(key), body);
  }

  async open(key: string) {
    const file = this.file(key);
    try {
      const info = await stat(file);
      return { stream: createReadStream(file), size: info.size };
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.file(key), { force: true });
  }
}
