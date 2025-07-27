// /middlewares/chatFileUpload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

console.log('🚀 [CHAT FILE UPLOAD] Initializing chat file upload middleware...');

// Ensure uploads directory exists
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 [UPLOAD DIR CREATED]:', uploadDir);
} else {
  console.log('📁 [UPLOAD DIR EXISTS]:', uploadDir);
}

// Check directory permissions
try {
  fs.accessSync(uploadDir, fs.constants.W_OK);
  console.log('✅ [UPLOAD DIR] Write permissions confirmed');
} catch (error) {
  console.error('❌ [UPLOAD DIR] Write permission error:', error.message);
}

// Allowed file types with more detailed MIME types
const allowedTypes = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // Text files
  'text/plain',
  'text/csv',
  'application/rtf'
];

console.log('📋 [ALLOWED TYPES]:', allowedTypes.length, 'file types supported');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('📂 [STORAGE DESTINATION] Setting destination to:', uploadDir);
    console.log('📊 [DEBUG] Request info:', {
      method: req.method,
      url: req.url,
      headers: Object.keys(req.headers),
      userId: req.user?._id
    });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    console.log('📝 [STORAGE FILENAME] Processing file:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname,
      encoding: file.encoding
    });
    
    // Create safe filename
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const uniqueName = `${timestamp}-${randomString}-${baseName}${fileExtension}`;
    
    console.log('✅ [STORAGE FILENAME] Generated unique name:', uniqueName);
    cb(null, uniqueName);
  }
});

// Enhanced file filter with comprehensive debugging
const fileFilter = (req, file, cb) => {
  console.log('🔍 [FILE FILTER] Starting file validation...');
  console.log('📊 [DEBUG] File details:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname,
    encoding: file.encoding,
    size: file.size || 'unknown'
  });
  
  console.log('📊 [DEBUG] Request details:', {
    method: req.method,
    url: req.url,
    contentType: req.headers['content-type'],
    userId: req.user?._id,
    hasFormData: req.headers['content-type']?.includes('multipart/form-data')
  });

  // Check if file type is allowed
  if (allowedTypes.includes(file.mimetype)) {
    console.log('✅ [FILE FILTER] File type approved:', {
      file: file.originalname,
      mime: file.mimetype,
      field: file.fieldname
    });
    cb(null, true);
  } else {
    console.error('❌ [FILE FILTER] File type rejected:', {
      file: file.originalname,
      mime: file.mimetype,
      field: file.fieldname,
      allowedTypes: allowedTypes
    });
    const error = new Error(`Unsupported file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`);
    error.code = 'UNSUPPORTED_FILE_TYPE';
    cb(error, false);
  }
};

// Enhanced multer configuration with size limits and error handling
const uploadChatFile = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1, // Only one file at a time
    fields: 10, // Allow up to 10 form fields
    fieldSize: 2 * 1024 * 1024, // 2MB per field
    fieldNameSize: 100, // 100 bytes field name limit
    headerPairs: 2000 // Maximum number of header key=>value pairs
  },
  // Handle errors gracefully
  onError: (err, next) => {
    console.error('❌ [MULTER ERROR]:', {
      message: err.message,
      code: err.code,
      field: err.field,
      stack: err.stack
    });
    next(err);
  }
});

// Add comprehensive error handling middleware
const handleUploadErrors = (err, req, res, next) => {
  console.error('🚨 [UPLOAD ERROR HANDLER] Error occurred:', {
    message: err.message,
    code: err.code,
    field: err.field,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        console.error('📏 [UPLOAD ERROR] File too large');
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 50MB.',
          code: 'FILE_TOO_LARGE'
        });
        
      case 'LIMIT_FILE_COUNT':
        console.error('📊 [UPLOAD ERROR] Too many files');
        return res.status(400).json({
          success: false,
          message: 'Too many files. Only one file allowed at a time.',
          code: 'TOO_MANY_FILES'
        });
        
      case 'LIMIT_UNEXPECTED_FILE':
        console.error('🔍 [UPLOAD ERROR] Unexpected field name');
        return res.status(400).json({
          success: false,
          message: 'Unexpected field name. Use "file" as the field name.',
          code: 'UNEXPECTED_FIELD',
          expectedField: 'file',
          receivedField: err.field
        });
        
      case 'LIMIT_PART_COUNT':
        console.error('📋 [UPLOAD ERROR] Too many parts');
        return res.status(400).json({
          success: false,
          message: 'Too many form parts.',
          code: 'TOO_MANY_PARTS'
        });
        
      default:
        console.error('⚠️ [UPLOAD ERROR] Unknown Multer error');
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
          code: err.code || 'UNKNOWN_MULTER_ERROR'
        });
    }
  }

  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: 'UNSUPPORTED_FILE_TYPE',
      allowedTypes: allowedTypes
    });
  }

  // Generic error
  console.error('🔥 [UPLOAD ERROR] Generic error');
  return res.status(500).json({
    success: false,
    message: 'File upload failed due to server error.',
    code: 'UPLOAD_FAILED'
  });
};

// Debug middleware to log all requests
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
  
  // Log raw headers for debugging
  console.log('📋 [UPLOAD DEBUG] Request headers:', req.headers);
  
  next();
};

console.log('✅ [CHAT FILE UPLOAD] Middleware initialized successfully');

export default uploadChatFile;
export { handleUploadErrors, debugUploadRequest };
