import { PassThrough } from "node:stream";
import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ZipArchive, type ProgressData } from "archiver";

/**
 * Storage on Cloudflare R2.
 *
 * R2 speaks the S3 protocol, so the ordinary AWS SDK works against it. The
 * reason for choosing R2 over S3 is one line: egress is free at any volume.
 * For a product whose entire job is handing people large files, bandwidth
 * would otherwise be the dominant cost.
 *
 * The archive is streamed. Files are read from disk, compressed, and pushed to
 * R2 as they go, so a two hundred megabyte site never sits in memory. Building
 * the zip in a buffer first is what makes a service like this fall over.
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function createR2Client(cfg: R2Config): S3Client {
  return new S3Client({
    // R2 has no regions, but the SDK insists on one. "auto" is what R2 expects.
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

export interface ZipUploadResult {
  key: string;
  bytes: number;
}

/**
 * Zips a directory straight into R2.
 *
 * The two halves run at once: archiver writes compressed bytes into a pipe
 * while the uploader reads from the other end and sends them. Neither waits
 * for the other to finish, and nothing accumulates.
 */
export async function zipDirectoryToR2(
  client: S3Client,
  bucket: string,
  key: string,
  sourceDir: string,
  onProgress?: (bytes: number) => void,
): Promise<ZipUploadResult> {
  const passthrough = new PassThrough();
  // Level 6 is the usual balance. Higher spends noticeably more CPU for very
  // little on files that are already compressed, which most images are.
  const archive = new ZipArchive({ zlib: { level: 6 } });

  let bytes = 0;
  archive.on("progress", (p: ProgressData) => {
    bytes = p.fs.processedBytes;
    onProgress?.(bytes);
  });

  // A warning is a missing file, which we can live with. An error is not.
  const failures: string[] = [];
  archive.on("warning", (err: Error) => failures.push(err.message));

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: passthrough,
      ContentType: "application/zip",
    },
    // 8MB parts. Below 5MB S3 rejects all but the final part.
    partSize: 8 * 1024 * 1024,
    queueSize: 3,
  });

  archive.pipe(passthrough);
  archive.directory(sourceDir, false);

  // Start both, then wait. finalize() resolves when everything is queued, and
  // upload.done() resolves when R2 has it all.
  const finalized = archive.finalize();
  const uploaded = upload.done();

  await Promise.all([finalized, uploaded]);

  return { key, bytes: archive.pointer() };
}

/**
 * A link that works for a fixed window and then stops.
 *
 * Short expiry is deliberate. It keeps storage near zero, and it limits how
 * long a copy of someone else's site is reachable from a URL we handed out.
 */
export async function presignDownload(
  client: S3Client,
  bucket: string,
  key: string,
  ttlSeconds: number,
  filename: string,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    // Makes the browser save it under a sensible name rather than the key.
    ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
  });
  return getSignedUrl(client, command, { expiresIn: ttlSeconds });
}

/** Used by the admin route to remove something before its lifecycle rule fires. */
export async function deleteObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Where a job's archive lives. Date prefix keeps the bucket browsable. */
export function objectKeyForJob(jobId: string, hostname: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const safeHost = hostname.replace(/[^a-z0-9.-]/gi, "-").slice(0, 60);
  return `captures/${day}/${jobId}-${safeHost}.zip`;
}
