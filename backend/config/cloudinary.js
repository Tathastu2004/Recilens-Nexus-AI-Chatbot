// /config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();
console.log(process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'NexusChat/ChatFiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'txt'],
    public_id: (req, file) => {
      const timestamp = Date.now();
      return `${file.originalname.split('.')[0]}_${timestamp}`;
    }
  }
});

export { cloudinary, chatStorage };
