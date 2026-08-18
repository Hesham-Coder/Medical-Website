/**
 * Storage Adapter - Abstracts S3/Cloudinary/Local filesystem
 * Detects environment and uses appropriate storage backend
 */

const fs = require('fs').promises;
const path = require('path');
const { UPLOADS_DIR } = require('./config');

const STORAGE_TYPE = process.env.STORAGE_TYPE || detectStorageType();

function detectStorageType() {
  if (process.env.CLOUDINARY_CLOUD_NAME) return 'cloudinary';
  if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) return 's3';
  return 'local'; // Fallback for local/Railway
}

const storage = {};

// ============ LOCAL FILESYSTEM (Railway) ============
if (STORAGE_TYPE === 'local') {
  storage.upload = async (fileBuffer, filename, mimetype) => {
    const filepath = path.join(UPLOADS_DIR, filename);
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(filepath, fileBuffer);
    return {
      url: `/uploads/${filename}`,
      filename,
      mimetype,
    };
  };

  storage.download = async (filename) => {
    const filepath = path.join(UPLOADS_DIR, filename);
    return await fs.readFile(filepath);
  };

  storage.delete = async (filename) => {
    const filepath = path.join(UPLOADS_DIR, filename);
    try {
      await fs.unlink(filepath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  };
}

// ============ CLOUDINARY ============
else if (STORAGE_TYPE === 'cloudinary') {
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage.upload = async (fileBuffer, filename, mimetype) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          public_id: filename.replace(/\.[^/.]+$/, ''),
          folder: 'medical-website/uploads',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve({
            url: result.secure_url,
            filename: filename,
            mimetype: mimetype,
            cloudinaryId: result.public_id,
          });
        }
      );
      stream.end(fileBuffer);
    });
  };

  storage.delete = async (publicId) => {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      if (!err.message.includes('not found')) throw err;
    }
  };
}

// ============ AWS S3 ============
else if (STORAGE_TYPE === 's3') {
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
  });

  storage.upload = async (fileBuffer, filename, mimetype) => {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `uploads/${filename}`,
      Body: fileBuffer,
      ContentType: mimetype,
      ACL: 'public-read',
    };
    const result = await s3.upload(params).promise();
    return {
      url: result.Location,
      filename: filename,
      mimetype: mimetype,
    };
  };

  storage.delete = async (filename) => {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `uploads/${filename}`,
    };
    try {
      await s3.deleteObject(params).promise();
    } catch (err) {
      if (!err.message.includes('not found')) throw err;
    }
  };
}

module.exports = {
  upload: storage.upload,
  download: storage.download,
  delete: storage.delete,
  getType: () => STORAGE_TYPE,
};
