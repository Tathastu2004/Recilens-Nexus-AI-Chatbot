// utils/textExtraction.js
import fs from 'fs';
import mammoth from 'mammoth';
import path from 'path';

// ✅ SIMPLE PDF EXTRACTION USING pdf-parse ONLY
export const extractTextFromPDF = async (filePath) => {
  try {
    console.log('📄 [PDF EXTRACT] Processing file with pdf-parse:', filePath);
    
    // Use pdf-parse instead of pdf-poppler
    const pdfParse = (await import('pdf-parse')).default;
    
    const pdfBuffer = fs.readFileSync(filePath);
    console.log('📄 [PDF EXTRACT] File size:', pdfBuffer.length, 'bytes');
    
    const data = await pdfParse(pdfBuffer);
    
    console.log('📄 [PDF EXTRACT] Raw result:', {
      pages: data.numpages,
      textLength: data.text?.length || 0,
      info: data.info
    });
    
    if (!data.text || data.text.trim().length < 10) {
      throw new Error('PDF contains no extractable text or is image-based');
    }
    
    // Clean up the text
    const cleanText = data.text
      .replace(/\n\s*\n/g, '\n\n') // Clean multiple newlines
      .replace(/\s+/g, ' ') // Clean multiple spaces
      .trim();
    
    console.log('✅ [PDF EXTRACT] Success:', cleanText.length, 'characters extracted');
    console.log('📄 [PDF EXTRACT] Preview:', cleanText.substring(0, 300) + '...');
    
    return cleanText;
    
  } catch (error) {
    console.error('❌ [PDF EXTRACT] Failed:', error.message);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
};

// ✅ DOCX TEXT EXTRACTION
export const extractTextFromDOCX = async (filePath) => {
  try {
    console.log('📄 [DOCX EXTRACT] Processing file:', filePath);
    
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    if (!text || text.trim().length < 10) {
      throw new Error('DOCX contains no extractable text');
    }
    
    console.log('✅ [DOCX EXTRACT] Success:', text.length, 'characters extracted');
    return text.trim();
    
  } catch (error) {
    console.error('❌ [DOCX EXTRACT] Failed:', error.message);
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
};

// ✅ TXT TEXT EXTRACTION
export const extractTextFromTXT = async (filePath) => {
  try {
    console.log('📄 [TXT EXTRACT] Processing file:', filePath);
    
    const text = fs.readFileSync(filePath, 'utf-8');
    
    if (!text || text.trim().length < 1) {
      throw new Error('TXT file is empty');
    }
    
    console.log('✅ [TXT EXTRACT] Success:', text.length, 'characters extracted');
    return text.trim();
    
  } catch (error) {
    console.error('❌ [TXT EXTRACT] Failed:', error.message);
    throw new Error(`TXT extraction failed: ${error.message}`);
  }
};

// ✅ UNIVERSAL TEXT EXTRACTOR (SIMPLIFIED)
export const extractTextFromFile = async (filePath, fileType) => {
  const extension = path.extname(filePath).toLowerCase();
  
  console.log('📄 [UNIVERSAL EXTRACT] Starting extraction for:', extension);
  
  try {
    switch (extension) {
      case '.pdf':
        return await extractTextFromPDF(filePath);
      case '.docx':
        return await extractTextFromDOCX(filePath);
      case '.txt':
        return await extractTextFromTXT(filePath);
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  } catch (error) {
    console.error('❌ [UNIVERSAL EXTRACT] Failed:', error.message);
    throw error;
  }
};

console.log('✅ [TEXT EXTRACTION] Utility loaded - supports PDF (pdf-parse), DOCX, TXT');