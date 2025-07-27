// /config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('☁️ [CLOUDINARY CONFIG] Initializing Cloudinary...');

// Check if all required environment variables are present
const requiredEnvVars = {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
};

console.log('🔑 [CLOUDINARY CONFIG] Environment variables check:', {
  CLOUDINARY_CLOUD_NAME: requiredEnvVars.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
  CLOUDINARY_API_KEY: requiredEnvVars.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
  CLOUDINARY_API_SECRET: requiredEnvVars.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
});

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ [CLOUDINARY CONFIG] Missing required environment variables:', missingVars);
  console.error('💡 [CLOUDINARY CONFIG] Please add these to your .env file:');
  missingVars.forEach(varName => {
    console.error(`   ${varName}=your_${varName.toLowerCase()}_here`);
  });
  throw new Error(`Missing Cloudinary environment variables: ${missingVars.join(', ')}`);
}

// Configure Cloudinary
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Always use HTTPS
  });

  console.log('✅ [CLOUDINARY CONFIG] Cloudinary configured successfully');
  
  // Test the configuration
  console.log('🧪 [CLOUDINARY CONFIG] Testing configuration...');
  console.log('📋 [CLOUDINARY CONFIG] Config details:', {
    cloud_name: cloudinary.config().cloud_name,
    api_key: cloudinary.config().api_key ? 'Set' : 'Missing',
    api_secret: cloudinary.config().api_secret ? 'Set' : 'Missing'
  });

} catch (error) {
  console.error('❌ [CLOUDINARY CONFIG] Failed to configure Cloudinary:', error.message);
  throw error;
}

// Create Cloudinary storage for chat files
const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'NexusChat/ChatFiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'txt', 'doc', 'ppt', 'pptx', 'xls', 'xlsx'],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const safeName = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
      return `${safeName}_${timestamp}`;
    },
    resource_type: 'auto'
  }
});

console.log('✅ [CLOUDINARY CONFIG] ChatStorage created successfully');

export { cloudinary, chatStorage };
