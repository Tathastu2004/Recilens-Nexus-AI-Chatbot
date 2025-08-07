// /config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// ✅ ENHANCED CLOUDINARY CONFIGURATION
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  
  console.log('✅ [CLOUDINARY] Configuration successful');
} catch (error) {
  console.error('❌ [CLOUDINARY] Configuration failed:', error.message);
}

// ✅ SIMPLE UPLOAD FUNCTION
export const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    console.log('☁️ [CLOUDINARY] Starting upload...');
    
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'nexus_chat_files',
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      ...options
    });

    console.log('✅ [CLOUDINARY] Upload successful');
    return result;
    
  } catch (error) {
    console.error('❌ [CLOUDINARY] Upload failed:', error.message);
    throw error;
  }
};

// ✅ HEALTH CHECK
export const checkCloudinaryHealth = async () => {
  try {
    const result = await cloudinary.api.ping();
    return { status: 'healthy', result };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
};

export default cloudinary;
