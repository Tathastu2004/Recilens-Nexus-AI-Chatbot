from PIL import Image
import requests
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from io import BytesIO
import asyncio
import time
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

print("🚀 [BLIP] Loading BLIP model and processor...")

# Load processor and model
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

print("✅ [BLIP] Model loaded successfully on device:", device)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ CLEAN IMAGE LOADER
def load_image_from_url(url):
    try:
        print(f"🌐 [BLIP] Downloading image from: {url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content)).convert("RGB")
        print(f"✅ [BLIP] Image loaded successfully: {image.size}")
        return image
    except Exception as e:
        print("❌ [BLIP] Failed to load image:", e)
        return None

# ✅ CLEAN CONTEXT HANDLER
def extract_clean_question(conversation_context, user_question):
    """
    Extract a clean question from context without repeating prompts
    """
    # If user asked a specific question, use it directly
    if user_question and user_question.strip() and not user_question.startswith("Uploaded image:"):
        clean_question = user_question.strip()
        
        # Remove any repeated phrases or malformed text
        if "question :" in clean_question.lower():
            clean_question = clean_question.split("question :")[-1].strip()
        if "answer :" in clean_question.lower():
            clean_question = clean_question.split("answer :")[0].strip()
        if "current question :" in clean_question.lower():
            clean_question = clean_question.split("current question :")[-1].strip()
        
        # Common question cleanup
        clean_question = clean_question.replace("analize", "analyze")
        clean_question = clean_question.replace("give me the analysis", "analyze this image")
        
        return clean_question
    
    # Default to image analysis if no clear question
    return "What do you see in this image?"

# ✅ CLEAN CAPTION GENERATION
def generate_clean_caption(image):
    """Generate a clean caption without context contamination"""
    try:
        # Simple captioning without any text prompt
        inputs = processor(images=image, return_tensors="pt").to(device)
        
        # Generate with good parameters to avoid repetition
        outputs = model.generate(
            **inputs,
            max_length=50,
            num_beams=5,
            do_sample=False,
            repetition_penalty=1.2,
            early_stopping=True
        )
        
        caption = processor.decode(outputs[0], skip_special_tokens=True)
        return caption.strip()
        
    except Exception as e:
        print(f"❌ [BLIP] Caption generation failed: {e}")
        return f"Error generating caption: {str(e)}"

# ✅ CLEAN VQA
def answer_clean_question(image, question):
    """Answer a question about the image without context contamination"""
    try:
        # Use clean prompt format
        prompt = f"Question: {question} Answer:"
        
        inputs = processor(images=image, text=prompt, return_tensors="pt").to(device)
        
        # Generate with parameters to prevent repetition
        outputs = model.generate(
            **inputs,
            max_length=60,
            num_beams=5,
            do_sample=False,
            repetition_penalty=1.3,
            early_stopping=True
        )
        
        # Clean the response
        full_response = processor.decode(outputs[0], skip_special_tokens=True)
        
        # Remove prompt from response
        if "Answer:" in full_response:
            answer = full_response.split("Answer:")[-1].strip()
        else:
            answer = full_response.replace(prompt, "").strip()
        
        # Additional cleaning
        answer = answer.replace(question, "").strip()
        
        # If answer is empty or just the question, fall back to caption
        if not answer or len(answer) < 3 or answer.lower() == question.lower():
            print("⚠️ [BLIP] VQA failed, falling back to caption...")
            return generate_clean_caption(image)
        
        return answer
        
    except Exception as e:
        print(f"❌ [BLIP] VQA failed: {e}")
        return f"Error answering question: {str(e)}"

# ✅ MAIN ANALYSIS ENDPOINT
@app.post("/analyze")
async def analyze_image(request: Request):
    try:
        # Parse request data
        try:
            data = await request.json()
        except:
            form_data = await request.form()
            data = dict(form_data)
        
        image_url = data.get("image_url")
        raw_question = data.get("question")
        
        print(f"📥 [BLIP API] Received request:")
        print(f"   Image URL: {image_url}")
        print(f"   Raw Question: {raw_question}")
        
        if not image_url:
            raise HTTPException(status_code=400, detail="Missing image_url")
        
        # ✅ LOAD IMAGE
        image = load_image_from_url(image_url)
        if image is None:
            return {"result": "Unable to load the image. Please check the URL and try again."}
        
        # ✅ CLEAN THE QUESTION (NO CONTEXT CONTAMINATION)
        clean_question = extract_clean_question([], raw_question)
        print(f"🧹 [BLIP API] Cleaned question: '{clean_question}'")
        
        # ✅ GENERATE CLEAN RESPONSE
        if clean_question and clean_question.lower() not in ["what do you see in this image?", "analyze this image"]:
            # Specific question - use VQA
            print(f"❓ [BLIP API] Processing VQA request")
            result = answer_clean_question(image, clean_question)
        else:
            # General analysis - use captioning
            print(f"📸 [BLIP API] Processing caption request")
            result = generate_clean_caption(image)
        
        # ✅ FINAL CLEANUP
        result = result.strip()
        if result.startswith("Question:") or result.startswith("Answer:"):
            result = result.split(":")[-1].strip()
        
        print(f"✅ [BLIP API] Clean result: {result}")
        return {"result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [BLIP API] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    try:
        # Simple health check
        test_tensor = torch.randn(1, 3, 224, 224).to(device)
        with torch.no_grad():
            _ = model.vision_model(test_tensor)
        return {"ok": True, "msg": "BLIP model is working"}
    except Exception as e:
        return {"ok": False, "msg": f"BLIP model error: {str(e)}"}

@app.get("/")
def root():
    return {"message": "Clean BLIP Image Analysis Server", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    print("🎯 [BLIP] Clean handler ready!")
    print("🚀 [BLIP] Starting server on port 5001...")
    uvicorn.run(app, host="0.0.0.0", port=5001, log_level="info")
