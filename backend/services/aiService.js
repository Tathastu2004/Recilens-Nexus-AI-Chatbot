// /services/aiService.js
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

console.log('🚀 [AI SERVICE] Initializing AI Service...');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log('🔑 [AI SERVICE] Gemini API Key status:', process.env.GEMINI_API_KEY ? 'Found' : 'Missing');

const downloadFile = async (url, localPath) => {
  console.log('📥 [DOWNLOAD] Starting file download:', { url, localPath });
  try {
    const response = await axios({ method: 'GET', url, responseType: 'stream' });
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('✅ [DOWNLOAD] File downloaded successfully:', localPath);
        resolve();
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('❌ [DOWNLOAD] Failed to download file:', error.message);
    throw error;
  }
};

const imageToBase64 = async (filePath) => {
  console.log('🖼️ [IMAGE TO BASE64] Starting conversion for:', filePath);
  try {
    let localPath = filePath;
    if (filePath.startsWith('http')) {
      const tempPath = `/tmp/temp_image_${Date.now()}.jpg`;
      await downloadFile(filePath, tempPath);
      localPath = tempPath;
    }
    if (!fs.existsSync(localPath)) {
      console.error(`❌ [IMAGE TO BASE64] Image file not found: ${localPath}`);
      return null;
    }
    const buffer = fs.readFileSync(localPath);
    const base64 = buffer.toString('base64');
    if (filePath.startsWith('http') && fs.existsSync(localPath)) fs.unlinkSync(localPath);
    console.log('✅ [IMAGE TO BASE64] Conversion successful:', { originalPath: filePath, base64Length: base64.length });
    return base64;
  } catch (error) {
    console.error(`❌ [IMAGE TO BASE64] Error:`, { filePath, error: error.message });
    return null;
  }
};

const extractTextFromPDF = async (pdfPath) => {
  console.log('📄 [PDF EXTRACT] Starting text extraction for:', pdfPath);
  try {
    let localPath = pdfPath;
    if (pdfPath.startsWith('http')) {
      const tempPath = `/tmp/temp_pdf_${Date.now()}.pdf`;
      await downloadFile(pdfPath, tempPath);
      localPath = tempPath;
    }
    if (!fs.existsSync(localPath)) {
      console.error(`❌ [PDF EXTRACT] PDF file not found: ${localPath}`);
      return 'PDF file not found';
    }
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = fs.readFileSync(localPath);
    const data = await pdfParse(buffer);
    if (pdfPath.startsWith('http') && fs.existsSync(localPath)) fs.unlinkSync(localPath);
    console.log('✅ [PDF EXTRACT] PDF parsing successful:', { originalPath: pdfPath, textLength: data.text.length, pages: data.numpages });
    return data.text;
  } catch (error) {
    console.error(`❌ [PDF EXTRACT] Error:`, { pdfPath, error: error.message });
    return 'Error reading PDF file';
  }
};

export const getAIResponse = async (input) => {
  console.log('🚀 [AI SERVICE] Starting AI response generation...');
  console.log('📊 [DEBUG] Input analysis:', {
    type: typeof input,
    isString: typeof input === 'string',
    isObject: typeof input === 'object' && input !== null,
    stringLength: typeof input === 'string' ? input.length : null,
    inputPreview: typeof input === 'string' ? input.substring(0, 100) + '...' : JSON.stringify(input)
  });
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    if (typeof input === 'string') {
      console.log('📝 [AI SERVICE] Processing simple text input...');
      const result = await model.generateContent(input);
      const response = await result.response;
      const text = response.text();
      console.log('✅ [AI SERVICE] Text response generated:', { inputLength: input.length, responseLength: text.length });
      return text;
    }

    if (typeof input === 'object' && input !== null) {
      console.log('🗂️ [AI SERVICE] Processing object input...');
      const parts = [];
      const textContent = input.prompt || input.message || "";
      if (textContent) {
        parts.push({ text: textContent });
        console.log('📝 [DEBUG] Added text part:', textContent.substring(0, 100));
      }

      if (input.fileUrl && input.fileType) {
        console.log(`📁 [AI SERVICE] Processing file:`, { fileUrl: input.fileUrl, fileType: input.fileType });
        if (input.fileType === 'image') {
          const base64Image = await imageToBase64(input.fileUrl);
          if (base64Image) {
            let mimeType = input.mimeType || 'image/jpeg';
            if (input.fileUrl.includes('.png')) mimeType = 'image/png';
            if (input.fileUrl.includes('.jpg') || input.fileUrl.includes('.jpeg')) mimeType = 'image/jpeg';
            if (input.fileUrl.includes('.gif')) mimeType = 'image/gif';
            if (input.fileUrl.includes('.webp')) mimeType = 'image/webp';
            parts.push({ inlineData: { mimeType, data: base64Image } });
            console.log('✅ [AI SERVICE] Image part added');
          }
        }
        if (input.fileType === 'document' || input.fileUrl.includes('.pdf')) {
          const extractedText = await extractTextFromPDF(input.fileUrl);
          parts.push({ text: `Document content:\n${extractedText}` });
          console.log('✅ [AI SERVICE] Document part added');
        }
      }

      if (parts.length === 0) {
        console.warn('⚠️ [AI SERVICE] No valid parts found');
        return 'No valid input provided.';
      }

      console.log('🔄 [AI SERVICE] Generating content with', parts.length, 'parts...');
      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();
      console.log('✅ [AI SERVICE] Multimodal response generated:', { partsCount: parts.length, responseLength: text.length });
      return text;
    }

    console.warn('⚠️ [AI SERVICE] Invalid input format:', typeof input);
    return 'Invalid input format provided.';
  } catch (err) {
    console.error('❌ [AI SERVICE] Error occurred:', { message: err.message, inputType: typeof input });
    if (err.message.includes('API_KEY')) return 'AI service configuration error. Please check API key.';
    if (err.message.includes('quota') || err.message.includes('429')) return 'AI service temporarily unavailable due to quota limits.';
    if (err.message.includes('404')) return 'AI model temporarily unavailable. Please try again.';
    return 'I apologize, but I encountered an error while processing your request. Please try again.';
  }
};

export const getSimpleAIResponse = async (message) => {
  console.log('🚀 [SIMPLE AI] Starting simple AI response generation...');
  console.log('📊 [DEBUG] Message details:', {
    type: typeof message,
    isString: typeof message === 'string',
    length: typeof message === 'string' ? message.length : null,
    preview: typeof message === 'string' ? message.substring(0, 100) + '...' : String(message)
  });
  try {
    if (!message || typeof message !== 'string') {
      console.warn('⚠️ [SIMPLE AI] Invalid message provided:', typeof message);
      return 'Please provide a valid message.';
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();
    console.log('✅ [SIMPLE AI] Response generated successfully:', {
      inputLength: message.length,
      responseLength: text.length,
      responsePreview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
    });
    return text;
  } catch (err) {
    console.error('❌ [SIMPLE AI] Error occurred:', {
      message: err.message,
      stack: err.stack,
      inputMessage: typeof message === 'string' ? message.substring(0, 100) + '...' : String(message)
    });
    return 'I apologize, but I encountered an error. Please try again.';
  }
};

console.log('✅ [AI SERVICE] AI Service initialization complete');