// middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

console.log('🚀 [UPLOAD MIDDLEWARE] Initializing enhanced upload middleware...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ ENSURE UPLOAD DIRECTORIES EXIST
const uploadDirs = {
  profile: path.join(__dirname, '../uploads/profile'),
  chat: path.join(__dirname, '../uploads/chat'),
  images: path.join(__dirname, '../uploads/images'),
  documents: path.join(__dirname, '../uploads/documents'),
  datasets: path.join(__dirname, '../uploads/datasets')
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 [UPLOAD] Created directory: ${dir}`);
  }
});

// ✅ PROFILE PICTURE STORAGE CONFIGURATION
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.profile);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

// ✅ CHAT FILE STORAGE CONFIGURATION
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine subdirectory based on file type
    let subDir = 'chat';
    if (file.mimetype.startsWith('image/')) {
      subDir = 'images';
    } else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) {
      subDir = 'documents';
    }
    
    const targetDir = uploadDirs[subDir];
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${randomId}-${sanitizedName}`);
  }
});

// ✅ DATASET STORAGE CONFIGURATION (ADD THIS)
const datasetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.datasets);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `dataset-${timestamp}-${sanitizedName}`);
  }
});

// ✅ FILE FILTER FOR IMAGES
const imageFilter = (req, file, cb) => {
  console.log('🖼️ [UPLOAD] Image filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid image type. Allowed: ${allowedTypes.join(', ')}`), false);
  }
};

// ✅ FILE FILTER FOR CHAT
const chatFileFilter = (req, file, cb) => {
  console.log('📁 [UPLOAD] Chat file filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedDocTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  const allAllowedTypes = [...allowedImageTypes, ...allowedDocTypes];
  
  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: Images (JPEG, PNG, GIF, WebP) and Documents (PDF, DOC, DOCX, TXT)`), false);
  }
};

// ✅ DATASET FILE FILTER (ADD THIS)
const datasetFilter = (req, file, cb) => {
  console.log('📊 [UPLOAD] Dataset filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  const allowedTypes = [
    'text/plain',
    'application/json',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid dataset type. Allowed: TXT, JSON, CSV, XLS, XLSX'), false);
  }
};

// ✅ PROFILE PICTURE UPLOAD MIDDLEWARE
export const uploadProfilePic = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: imageFilter
});

// ✅ CHAT FILE UPLOAD MIDDLEWARE
export const uploadChatFile = multer({
  storage: chatStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for documents
    files: 1
  },
  fileFilter: chatFileFilter
});

// ✅ DATASET UPLOAD MIDDLEWARE (ADD THIS EXPORT)
export const uploadDataset = multer({
  storage: datasetStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for datasets
    files: 1
  },
  fileFilter: datasetFilter
});

// ✅ ADD THE MISSING uploadFileHandler FUNCTION
export const uploadFileHandler = async (req, res) => {
  console.log('📤 [UPLOAD HANDLER] Starting file upload and text extraction...');
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    console.log('📋 [UPLOAD HANDLER] File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    let uploadResult;
    let extractedText = null;

    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(fileExtension);
    const isDocument = ['.pdf', '.txt', '.docx', '.doc'].includes(fileExtension);

    // ✅ UPLOAD TO CLOUDINARY
    try {
      uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'nexus_chat_files',
        resource_type: isImage ? 'image' : 'raw',
        use_filename: true,
        unique_filename: true,
        access_mode: 'public',
        tags: ['nexus_chat', 'uploaded_file']
      });

      console.log('☁️ [CLOUDINARY] Upload successful:', {
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url,
        bytes: uploadResult.bytes
      });
    } catch (cloudinaryError) {
      console.error('❌ [CLOUDINARY] Upload failed:', cloudinaryError);
      throw new Error(`File upload failed: ${cloudinaryError.message}`);
    }

    // ✅ TEXT EXTRACTION FOR DOCUMENTS
    if (isDocument) {
      const fileBuffer = fs.readFileSync(req.file.path);
      
      if (fileExtension === '.pdf') {
        try {
          const { parsePdf } = await import('../utils/pdfParser.js');
          extractedText = await parsePdf(fileBuffer);
          console.log('✅ [PDF] Text extraction successful, length:', extractedText?.length || 0);
        } catch (pdfError) {
          console.error('❌ [PDF] Text extraction failed:', pdfError);
          extractedText = `❌ PDF text extraction failed: ${pdfError.message}`;
        }
      } else if (fileExtension === '.txt') {
        try {
          extractedText = fileBuffer.toString('utf8').trim();
          console.log('✅ [TXT] Text extraction successful, length:', extractedText.length);
        } catch (txtError) {
          console.error('❌ [TXT] Text extraction failed:', txtError);
          extractedText = `❌ Text file reading failed: ${txtError.message}`;
        }
      } else if (fileExtension === '.docx') {
        try {
          // Try to import mammoth for DOCX parsing
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          extractedText = result.value.trim();
          console.log('✅ [DOCX] Text extraction successful, length:', extractedText.length);
        } catch (docxError) {
          console.warn('⚠️ [DOCX] Mammoth not available or extraction failed:', docxError.message);
          extractedText = `❌ DOCX text extraction failed: ${docxError.message}`;
        }
      } else {
        extractedText = `❌ Text extraction not supported for ${fileExtension} files`;
      }
    }

    const hasValidText = extractedText && !extractedText.startsWith('❌');
    
    // ✅ RESPONSE
    const response = {
      success: true,
      message: isImage ? 
        'Image uploaded successfully. Ready for visual analysis.' : 
        hasValidText ? 
          'Document processed successfully with text extraction.' : 
          'Document uploaded but text extraction failed.',
      fileUrl: uploadResult.secure_url,
      fileName: req.file.originalname,
      fileType: isImage ? 'image' : 'document',
      detectedType: isImage ? 'image' : 'document',
      hasText: hasValidText,
      textLength: hasValidText ? extractedText.length : 0,
      extractionStatus: isDocument ? 
        (hasValidText ? 'success' : 'failed') : 
        'not_applicable',
      cloudinaryInfo: {
        public_id: uploadResult.public_id,
        bytes: uploadResult.bytes,
        format: uploadResult.format
      }
    };

    // Only include extracted text if valid
    if (hasValidText) {
      response.extractedText = extractedText;
    }

    console.log('✅ [UPLOAD HANDLER] Processing complete:', {
      type: response.fileType,
      hasText: response.hasText,
      textLength: response.textLength
    });

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ [UPLOAD HANDLER] Critical error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'File upload and processing failed'
    });
  } finally {
    // ✅ CLEANUP TEMP FILE
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ [CLEANUP] Temp file deleted:', req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ [CLEANUP] Failed to delete temp file:', cleanupError.message);
      }
    }
  }
};

// ✅ ENHANCED ERROR HANDLER MIDDLEWARE
export const handleUploadError = (error, req, res, next) => {
  console.error('❌ [UPLOAD ERROR]:', {
    message: error.message,
    code: error.code,
    field: error.field,
    file: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file'
  });

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          message: 'File too large. Please check size limits.',
          error: 'FILE_TOO_LARGE'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Only one file allowed.',
          error: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field.',
          error: 'UNEXPECTED_FILE'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Upload error: ${error.message}`,
          error: error.code
        });
    }
  }

  if (error.message) {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: 'INVALID_FILE'
    });
  }

  next(error);
};

// ✅ UTILITY FUNCTIONS
export const getUploadPaths = () => uploadDirs;

export const cleanupTempFiles = (filePaths) => {
  if (!Array.isArray(filePaths)) {
    filePaths = [filePaths];
  }

  filePaths.forEach(filePath => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️ [CLEANUP] Deleted temp file: ${filePath}`);
      } catch (error) {
        console.warn(`⚠️ [CLEANUP] Failed to delete temp file: ${filePath}`, error.message);
      }
    }
  });
};

console.log('✅ [UPLOAD MIDDLEWARE] Successfully initialized all upload configurations with file handler');

// ✅ DEFAULT EXPORT
export default {
  uploadProfilePic,
  uploadChatFile,
  uploadDataset, // ✅ ADD THIS TO DEFAULT EXPORT
  uploadFileHandler,
  handleUploadError,
  getUploadPaths,
  cleanupTempFiles
};
