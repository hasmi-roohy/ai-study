import path from 'path';
import fs from 'fs/promises';
import { v4 as uuid } from 'uuid';

/**
 * Storage adapter for uploaded material files (PDFs).
 *
 * Two backends:
 *  - Remote object storage, via any S3-compatible provider (Backblaze B2, Cloudflare R2,
 *    Wasabi, MinIO, AWS S3 itself, etc.) — used automatically when S3_ENDPOINT /
 *    S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_BUCKET_NAME are set. This is what
 *    production should use — local disk doesn't survive redeploys or scale past one instance.
 *    Recommended free option: Backblaze B2 (10GB free, no card required, S3-compatible
 *    endpoint at https://s3.<region>.backblazeb2.com).
 *  - Local disk (MATERIAL_STORAGE_DIR, defaults to ./storage/materials): the original
 *    dev-only behavior, kept as a zero-config fallback so `npm run dev` still works
 *    without any cloud credentials.
 *
 * `Material.storagePath` stores whichever key was returned by `putMaterial`. Reads
 * branch on its shape (absolute filesystem path vs. an object key) so existing rows
 * written under the old local-only behavior keep working without a migration.
 */

const UPLOAD_DIR = process.env.MATERIAL_STORAGE_DIR ?? path.join(process.cwd(), 'storage', 'materials');

function remoteConfig() {
  const raw = {
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET_NAME,
    region: process.env.S3_REGION
  };
  if (!raw.endpoint || !raw.accessKeyId || !raw.secretAccessKey || !raw.bucket) return null;
  // Trim defensively: a stray trailing space/newline from copy-pasting into .env is the
  // single most common cause of providers rejecting an otherwise-correct key as malformed.
  return {
    endpoint: raw.endpoint.trim(),
    accessKeyId: raw.accessKeyId.trim(),
    secretAccessKey: raw.secretAccessKey.trim(),
    bucket: raw.bucket.trim(),
    region: raw.region?.trim() || 'auto'
  };
}

export function isRemoteStorageConfigured(): boolean {
  return remoteConfig() !== null;
}

// Lazily constructed + lazily imported: the AWS SDK is only needed when remote storage
// is actually configured, so local-only dev setups don't need it installed to run.
let cachedClient: import('@aws-sdk/client-s3').S3Client | null = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  const config = remoteConfig();
  if (!config) throw new Error('Remote storage is not configured');
  const { S3Client } = await import('@aws-sdk/client-s3');
  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    // Most S3-compatible providers (B2 included) need path-style addressing rather
    // than AWS's default virtual-hosted-style bucket subdomains.
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
  return cachedClient;
}

/** Stores a file and returns the value to persist in `Material.storagePath`. */
export async function putMaterial(buffer: Buffer, filename: string): Promise<string> {
  const config = remoteConfig();
  const key = `materials/${uuid()}-${filename}`;

  if (config) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await getClient();
    try {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: buffer, ContentType: 'application/pdf' }));
    } catch (err) {
      throw wrapStorageError(err);
    }
    return key; // relative object key => read path knows this is remote
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const absolutePath = path.join(UPLOAD_DIR, path.basename(key));
  await fs.writeFile(absolutePath, buffer);
  return absolutePath; // absolute filesystem path => read path knows this is local
}

/** Reads a previously stored file back into memory for processing. */
export async function getMaterial(storagePath: string): Promise<Buffer> {
  if (path.isAbsolute(storagePath)) {
    return fs.readFile(storagePath);
  }

  const config = remoteConfig();
  if (!config) {
    throw new Error(`Material was stored remotely (key: ${storagePath}) but remote storage env vars are not set`);
  }
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getClient();
  let result;
  try {
    result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: storagePath }));
  } catch (err) {
    throw wrapStorageError(err);
  }
  const byteArray = await result.Body!.transformToByteArray();
  return Buffer.from(byteArray);
}

/**
 * The raw AWS SDK error (e.g. "Malformed Access Key Id", "InvalidAccessKeyId",
 * "SignatureDoesNotMatch") is accurate but not actionable for whoever sees it surfaced
 * in the UI. Re-throw with a pointer at the actual fix, while keeping the original
 * message and stack for server logs (the caller/handler still logs unhandled errors).
 */
function wrapStorageError(err: unknown): Error {
  const original = err instanceof Error ? err.message : String(err);
  const looksLikeCredentialIssue = /access key|signature|credential|invalidaccesskeyid/i.test(original);
  const hint = looksLikeCredentialIssue
    ? ' Check S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_ENDPOINT / S3_REGION in your .env — this usually means one of them has a typo, extra quotes, or came from the wrong page (e.g. an account ID pasted where an Application Key ID belongs).'
    : '';
  const wrapped = new Error(`Uploading to remote storage failed (${original}).${hint}`);
  wrapped.stack = err instanceof Error ? err.stack : wrapped.stack;
  return wrapped;
}
