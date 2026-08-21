const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

// Initialize S3 Client if AWS credentials exist
let s3Client = null;
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const region = process.env.AWS_REGION || 'us-east-1';

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && bucketName) {
  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Checks if a file exists in S3. If it exists, returns its S3 URL.
 * If not, uploads it to S3 and returns the new S3 URL.
 *
 * @param {Object} options
 * @param {Buffer|String} options.fileSource - File Buffer or local file path
 * @param {String} options.fileName - Destination filename (e.g. "documents/my-brochure.pdf")
 * @param {String} [options.mimeType] - Content MIME type (e.g. "application/pdf")
 * @returns {Promise<String>} Public S3 URL or fallback URL
 */
async function getOrUploadS3File({ fileSource, fileName, mimeType = 'application/pdf' }) {
  if (!s3Client || !bucketName) {
    console.log('ℹ️ AWS S3 not configured. Using local file storage path.');
    return null; // Signals fallback to local storage
  }

  // Clean object key prefix
  const s3Key = fileName.startsWith('uploads/') ? fileName : `uploads/documents/${fileName.replace(/^\//, '')}`;
  const customDomain = process.env.AWS_S3_CUSTOM_DOMAIN;
  const s3Url = customDomain 
    ? `${customDomain.replace(/\/$/, '')}/${s3Key}` 
    : `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

  try {
    // 1. Check if file already exists in S3
    await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: s3Key }));
    console.log(`✅ S3 Cache Hit: '${s3Key}' already exists in S3. Reusing existing URL.`);
    return s3Url;
  } catch (err) {
    // If not found (404 / NotFound), proceed to upload
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`📤 S3 Miss: '${s3Key}' not in S3. Uploading file now...`);
    } else {
      console.warn(`⚠️ S3 HeadObject check warning for '${s3Key}':`, err.message);
    }
  }

  // 2. Prepare file buffer
  let fileBuffer;
  if (Buffer.isBuffer(fileSource)) {
    fileBuffer = fileSource;
  } else if (typeof fileSource === 'string' && fs.existsSync(fileSource)) {
    fileBuffer = fs.readFileSync(fileSource);
  } else {
    throw new Error('Invalid fileSource provided for S3 upload.');
  }

  // 3. Upload file to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  console.log(`🚀 File uploaded successfully to S3: ${s3Url}`);
  return s3Url;
}

module.exports = {
  getOrUploadS3File,
  isS3Configured: () => Boolean(s3Client && bucketName)
};
