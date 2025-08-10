// Important: Import the preload file FIRST before pdf-parse
import './preLoad.js';
import pdfParse from 'pdf-parse';

/**
 * Parses a PDF buffer and extracts text content
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<string>} - The extracted text
 */
export async function parsePdf(buffer) {
  try {
    console.log('📄 [PDF PARSER] Starting PDF parsing with pdf-parse...');
    
    // Simple options, no file references
    const options = { version: false };
    
    // Parse the PDF
    const data = await pdfParse(buffer, options);
    
    console.log('✅ [PDF PARSER] PDF parsing successful:', {
      textLength: data.text?.length || 0,
      pages: data.numpages || 0,
      preview: data.text ? data.text.substring(0, 200) + '...' : 'No text'
    });
    
    return data.text || '';
  } catch (error) {
    console.error('❌ [PDF PARSER] PDF parsing failed:', error.message);
    
    // Use fallback
    try {
      console.log('🔄 [PDF PARSER] Attempting fallback text extraction...');
      const text = buffer
        .toString('utf8')
        .replace(/^\s*%PDF-[\d.]+\s*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (text && text.length > 50) {
        console.log('✅ [PDF PARSER] Fallback extraction successful:', {
          textLength: text.length
        });
        return text;
      } else {
        console.log('⚠️ [PDF PARSER] Fallback yielded insufficient text');
        return 'Unable to extract text from this PDF';
      }
    } catch (fallbackError) {
      console.error('❌ [PDF PARSER] Fallback also failed:', fallbackError.message);
      return 'This appears to be a PDF document, but text extraction failed';
    }
  }
}