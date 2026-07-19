/**
 * cloudinary.js — file-upload configuration (three multer uploaders):
 *
 *  - uploadAvatar : profile pictures → Cloudinary, cropped 400×400, ≤2 MB
 *  - uploadReport : lab reports (PDF/image) → Cloudinary, ≤10 MB
 *  - csvUpload    : bulk-import CSVs → kept in memory only (parsed, never stored)
 *
 * Credentials come from .env (CLOUDINARY_*).
 */
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Avatar upload ──────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req) => ({
    folder:         'medisync/avatars',
    public_id:      `avatar-${req.user.id}`,
    overwrite:      true,
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
    format:         'jpg',
  }),
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'), false);
    }
    cb(null, true);
  },
}).single('avatar');

// ── Medical report upload (PDF + images) ───────────────────────
const reportStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === 'application/pdf';
    return {
      folder:        'medisync/reports',
      resource_type: isPdf ? 'raw' : 'image',
      public_id:     `report-${req.user.id}-${Date.now()}`,
      overwrite:     false,
    };
  },
});

const uploadReport = multer({
  storage: reportStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PDF or image files are allowed.'), false);
    }
    cb(null, true);
  },
}).single('report');

// ── CSV / plain file upload (memory storage, no cloud) ────────
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype)
      || file.originalname.toLowerCase().endsWith('.csv');
    if (!ok) return cb(new Error('Only CSV files are allowed'));
    cb(null, true);
  },
}).single('file');

module.exports = { cloudinary, uploadAvatar, uploadReport, csvUpload };
