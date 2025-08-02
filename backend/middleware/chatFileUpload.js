import multer from 'multer';
import path from 'path';
import fs from 'fs';

console.log('🚀 [CHAT FILE UPLOAD] Initializing chat file upload middleware...');

const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 [UPLOAD DIR CREATED]:', uploadDir);
} else {
  console.log('📁 [UPLOAD DIR EXISTS]:', uploadDir);
}

try {
  fs.accessSync(uploadDir, fs.constants.W_OK);
  console.log('✅ [UPLOAD DIR] Write permissions confirmed');
} catch (error) {
  console.error('❌ [UPLOAD DIR] Write permission error:', error.message);
}

const allowedTypes = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf'
];

console.log('📋 [ALLOWED TYPES]:', allowedTypes.length, 'file types supported');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${baseName}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Unsupported file type: ${file.mimetype}`);
    error.code = 'UNSUPPORTED_FILE_TYPE';
    cb(error, false);
  }
};

const uploadChatFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
    fields: 10,
    fieldSize: 2 * 1024 * 1024,
    fieldNameSize: 100,
    headerPairs: 2000
  }
});

const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'File too large. Maximum size is 50MB.',
      LIMIT_FILE_COUNT: 'Too many files. Only one file allowed.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected field. Use "file" as field name.',
      LIMIT_PART_COUNT: 'Too many form parts.'
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] || err.message,
      code: err.code
    });
  }

  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: err.code,
      allowedTypes
    });
  }

  console.error('🔥 [UPLOAD ERROR] Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'File upload failed due to server error.',
    code: 'UPLOAD_FAILED'
  });
};

const debugUploadRequest = (req, res, next) => {
  console.log('🔍 [UPLOAD DEBUG] Incoming request:', {
    method: req.method,
    url: req.url,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    userAgent: req.headers['user-agent'],
    userId: req.user?._id,
    timestamp: new Date().toISOString()
  });
  next();
};

console.log('✅ [CHAT FILE UPLOAD] Middleware initialized successfully');

export default uploadChatFile;
export { handleUploadErrors, debugUploadRequest };
