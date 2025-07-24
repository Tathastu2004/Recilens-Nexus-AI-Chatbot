// /middlewares/chatFileUpload.js
import multer from 'multer';
import { chatStorage } from '../config/cloudinary.js';

const uploadChatFile = multer({ storage: chatStorage });

export default uploadChatFile;
