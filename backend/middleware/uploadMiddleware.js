// middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 [UPLOAD MIDDLEWARE] Initializing enhanced upload middleware...');

// ✅ ENSURE UPLOAD DIRECTORIES EXIST
const ensureUploadDirs = () => {
  const dirs = [
    './uploads',
    './uploads/profile', 
    './uploads/chat', 
    './uploads/documents', 
    './uploads/images'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('📁 [UPLOAD] Created directory:', dir);
    }
  });
};

ensureUploadDirs();

// ✅ ENHANCED STORAGE CONFIGURATION
const createStorage = (uploadType) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = `./uploads/${uploadType}`;
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}-${randomSuffix}-${sanitizedName}`;
      cb(null, filename);
    }
  });
};

// ✅ ENHANCED FILE FILTERS
const createFileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    console.log('📋 [FILTER] Checking file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    try {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeType = file.mimetype.toLowerCase();
      
      // Check if file type is allowed
      const isAllowed = allowedTypes.some(type => {
        if (type.startsWith('.')) {
          return ext === type;
        }
        return mimeType.includes(type) || mimeType === type;
      });

      if (isAllowed) {
        // Add metadata to request
        req.detectedFileType = getFileCategory(mimeType, ext);
        req.fileCategory = req.detectedFileType;
        cb(null, true);
      } else {
        const error = new Error(`Unsupported file type. Allowed: ${allowedTypes.join(', ')}`);
        error.code = 'UNSUPPORTED_FILE_TYPE';
        cb(error, false);
      }
    } catch (error) {
      console.error('❌ [FILTER] Error:', error.message);
      cb(error, false);
    }
  };
};

// ✅ FILE CATEGORY DETECTION
const getFileCategory = (mimeType, extension) => {
  const imageTypes = ['image/', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const documentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxml', 'text/', '.pdf', '.doc', '.docx', '.txt'];
  
  const isImage = imageTypes.some(type => 
    type.startsWith('.') ? extension === type : mimeType.includes(type)
  );
  
  const isDocument = documentTypes.some(type => 
    type.startsWith('.') ? extension === type : mimeType.includes(type)
  );
  
  if (isImage) return 'image';
  if (isDocument) return 'document';
  return 'unknown';
};

// ✅ SUPPORTED FILE TYPES
const supportedTypes = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', 'image/'],
  documents: ['.pdf', '.doc', '.docx', '.txt', 'application/pdf', 'application/msword', 'text/']
};

// ✅ CREATE MULTER INSTANCES
export const uploadChatFile = multer({
  storage: createStorage('chat'),
  fileFilter: createFileFilter([
    ...supportedTypes.images,
    ...supportedTypes.documents
  ]),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
  }
});

// ✅ ADD PROFILE PICTURE UPLOAD MIDDLEWARE
export const uploadProfilePic = multer({
  storage: createStorage('profile'),
  fileFilter: createFileFilter(supportedTypes.images), // Only images for profile pics
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for profile pictures
    files: 1
  }
});

// ✅ SIMPLE UPLOAD HANDLER WITH BETTER ERROR HANDLING
export const uploadFileHandler = async (req, res) => {
  console.log('📤 [UPLOAD] Starting file upload...');
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    console.log('📋 [UPLOAD] File received:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
      path: req.file.path
    });

    // Determine file type
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const isImage = supportedTypes.images.some(type => 
      type.startsWith('.') ? fileExtension === type : req.file.mimetype.includes(type.replace('/', ''))
    );
    const isDocument = supportedTypes.documents.some(type => 
      type.startsWith('.') ? fileExtension === type : req.file.mimetype.includes(type.replace('/', ''))
    );

    const detectedType = isImage ? 'image' : isDocument ? 'document' : 'unknown';

    console.log('🔍 [UPLOAD] File analysis:', {
      extension: fileExtension,
      detectedType,
      isImage,
      isDocument
    });

    // ✅ SIMPLE CLOUDINARY UPLOAD (No deduplication for now to avoid errors)
    let uploadResult;
    
    try {
      // Import Cloudinary dynamically to handle missing dependency
      const { uploadToCloudinary } = await import('../config/cloudinary.js');
      
      const uploadOptions = {
        folder: 'nexus_chat_files',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        access_mode: 'public',
        timeout: 60000,
        context: {
          file_type: detectedType,
          original_name: req.file.originalname,
          upload_timestamp: new Date().toISOString()
        }
      };

      console.log('☁️ [UPLOAD] Uploading to Cloudinary...');
      uploadResult = await uploadToCloudinary(req.file.path, uploadOptions);
      
      console.log('✅ [UPLOAD] Cloudinary upload successful:', {
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url?.substring(0, 50) + '...'
      });

    } catch (cloudinaryError) {
      console.error('❌ [UPLOAD] Cloudinary upload failed:', cloudinaryError.message);
      
      // Return error but don't crash
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to cloud storage',
        error: cloudinaryError.message,
        code: 'CLOUDINARY_FAILED'
      });
    }

    // ✅ SIMPLE TEXT EXTRACTION (Only for documents, with error handling)
    let extractedText = null;
    let textExtractionError = null;

    // ✅ ENHANCED TEXT EXTRACTION (Add PDF support)
    if (detectedType === 'document') {
      console.log('📄 [UPLOAD] Attempting text extraction...');
      
      try {
        if (fileExtension === '.txt') {
          const textContent = fs.readFileSync(req.file.path, 'utf-8');
          extractedText = textContent.trim();
          console.log('✅ [UPLOAD] TXT extraction successful:', extractedText.length, 'characters');
          
        } else if (fileExtension === '.pdf') {
          console.log('📄 [PDF] PDF text extraction will be handled by controller');
          extractedText = 'PDF_PROCESSING_DEFERRED';
        } else if (fileExtension === '.docx') {
          // ✅ ADD DOCX TEXT EXTRACTION
          try {
            console.log('📄 [DOCX] Starting DOCX text extraction...');
            
            const { extractTextFromDOCX } = await import('../utils/textExtraction.js');
            extractedText = await extractTextFromDOCX(req.file.path);
            
            if (extractedText && extractedText.trim().length > 10) {
              console.log('✅ [DOCX] Text extraction successful:', extractedText.length, 'characters');
            } else {
              throw new Error('DOCX returned no usable text');
            }
            
          } catch (docxError) {
            console.error('❌ [DOCX] Extraction failed:', docxError.message);
            extractedText = `❌ DOCX text extraction failed: ${docxError.message}`;
            textExtractionError = docxError.message;
          }
          
        } else {
          console.log('⚠️ [UPLOAD] Text extraction not supported for', fileExtension);
          extractedText = `❌ Text extraction not supported for ${fileExtension} files`;
          textExtractionError = `Unsupported file type: ${fileExtension}`;
        }
        
      } catch (extractError) {
        console.error('❌ [UPLOAD] Text extraction failed:', extractError.message);
        textExtractionError = extractError.message;
        extractedText = `❌ Text extraction failed: ${extractError.message}`;
      }
    }

    // ✅ CLEANUP TEMP FILE
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🧹 [UPLOAD] Cleaned up temp file');
      }
    } catch (cleanupError) {
      console.warn('⚠️ [UPLOAD] Cleanup warning:', cleanupError.message);
    }

    // ✅ SUCCESS RESPONSE
    const response = {
      success: true,
      message: 'File uploaded successfully',
      fileUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      type: detectedType,
      fileType: req.file.mimetype,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      detectedExtension: fileExtension,
      
      // Text extraction info
      extractedText,
      hasText: !!extractedText && extractedText.length > 0,
      textLength: extractedText ? extractedText.length : 0,
      textPreview: extractedText ? extractedText.substring(0, 200) : null,
      textExtractionError,
      
      // Processing hints
      processingHints: {
        canAnalyze: true,
        recommendedProcessor: detectedType === 'image' ? 'BLIP' : 'Llama3',
        estimatedProcessingTime: detectedType === 'image' ? '2-5 seconds' : '3-8 seconds'
      }
    };

    console.log('✅ [UPLOAD] Upload completed successfully:', {
      fileType: detectedType,
      hasText: response.hasText,
      textLength: response.textLength
    });

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ [UPLOAD] Unexpected error:', error);

    // Clean up temp file on error
    try {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('⚠️ [UPLOAD] Cleanup error:', cleanupError.message);
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during file upload',
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
};

// ✅ PROFILE PIC UPLOAD HANDLER
export const uploadProfilePicHandler = async (req, res) => {
  console.log('👤 [PROFILE] Starting profile picture upload...');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture uploaded',
        code: 'NO_FILE'
      });
    }

    console.log('📋 [PROFILE] File received:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`
    });

    // Validate it's an image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed for profile pictures',
        code: 'INVALID_FILE_TYPE'
      });
    }

    try {
      // Upload to Cloudinary
      const { uploadToCloudinary } = await import('../config/cloudinary.js');
      
      const uploadOptions = {
        folder: 'nexus_profile_pics',
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        transformation: [
          { width: 200, height: 200, crop: 'fill', gravity: 'face' }, // Square crop focused on face
          { quality: 'auto:good' }
        ],
        access_mode: 'public',
        timeout: 30000
      };

      const uploadResult = await uploadToCloudinary(req.file.path, uploadOptions);
      
      console.log('✅ [PROFILE] Profile picture uploaded successfully');

      // Clean up temp file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(200).json({
        success: true,
        message: 'Profile picture uploaded successfully',
        profilePicUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id
      });

    } catch (uploadError) {
      console.error('❌ [PROFILE] Upload failed:', uploadError.message);
      
      // Clean up temp file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to upload profile picture',
        error: uploadError.message,
        code: 'UPLOAD_FAILED'
      });
    }

  } catch (error) {
    console.error('❌ [PROFILE] Unexpected error:', error);
    
    // Clean up temp file
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during profile picture upload',
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
};

// ✅ ERROR HANDLER MIDDLEWARE
export const handleUploadError = (error, req, res, next) => {
  console.error('❌ [UPLOAD ERROR]:', error.message);

  if (error instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'File too large. Maximum size is 50MB.',
      LIMIT_FILE_COUNT: 'Too many files. Only one file allowed.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected field. Use "file" as field name.'
    };

    return res.status(400).json({
      success: false,
      message: messages[error.code] || error.message,
      code: error.code
    });
  }

  if (error.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: error.message,
      code: error.code,
      supportedTypes: supportedTypes
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    message: 'File upload failed',
    error: error.message,
    code: 'UPLOAD_FAILED'
  });
};

// ✅ UTILITY FUNCTIONS
export const getSupportedFileTypes = () => supportedTypes;

export const getFileSizeLimits = () => ({
  chat: '50MB',
  image: '10MB', 
  document: '50MB'
});

console.log('✅ [UPLOAD MIDDLEWARE] Initialization complete');
