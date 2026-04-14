import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const IS_PROD = process.env.NODE_ENV === 'production';
const GCS_BUCKET = process.env.GCS_BUCKET || 'djaber-prod-uploads';

const uploadDir = path.join(__dirname, '../../uploads/products');

// Ensure local directory exists (used in dev, and as temp in prod)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uuid = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid}-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.jpeg', '.jpg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only jpeg, png, webp, and gif images are allowed'));
  }
};

export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10,
  },
});

/**
 * Upload a local file to GCS and return the public URL.
 * In dev mode, returns a local URL.
 */
export async function uploadToCloud(localPath: string, filename: string): Promise<string> {
  if (!IS_PROD) {
    // Dev: return local URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:6001';
    return `${backendUrl}/uploads/products/${filename}`;
  }

  // Production: upload to GCS
  const { Storage } = require('@google-cloud/storage');
  const gcs = new Storage();
  const bucket = gcs.bucket(GCS_BUCKET);

  const destination = `products/${filename}`;
  await bucket.upload(localPath, {
    destination,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  // Clean up local temp file
  try {
    fs.unlinkSync(localPath);
  } catch {}

  return `https://storage.googleapis.com/${GCS_BUCKET}/${destination}`;
}

/**
 * Get the public URL for a product image filename.
 * In dev mode, returns local URL. In prod, returns GCS URL.
 */
export function getImageUrl(filename: string): string {
  if (!IS_PROD) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:6001';
    return `${backendUrl}/uploads/products/${filename}`;
  }
  return `https://storage.googleapis.com/${GCS_BUCKET}/products/${filename}`;
}
