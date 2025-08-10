# blip_handler.py

from PIL import Image
import requests
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from io import BytesIO
import asyncio
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

print("🚀 [BLIP] Loading BLIP model and processor...")

# Load processor and model
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

print("✅ [BLIP] Model loaded successfully on device:", device)

# 🔹 Download image from URL and convert to PIL image
def load_image_from_url(url):
    try
        print(f"🌐 [BLIP] Downloading image from: {url}")
        
        # ✅ FIX: Add a User-Agent header to mimic a browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Use the headers in the request
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        image = Image.open(BytesIO(response.content)).convert("RGB")
        print(f"✅ [BLIP] Image loaded successfully: {image.size}")
        return image
    except Exception as e:
        print("❌ [BLIP] Failed to load image:", e)
        return None

# 🔹 Generate caption from image
def generate_image_caption(image_url):
    print(f"📸 [BLIP] Generating caption for: {image_url}")
    image = load_image_from_url(image_url)
    if image is None:
        return "Unable to load image."

    try:
        inputs = processor(images=image, return_tensors="pt").to(device)
        out = model.generate(**inputs, max_length=50, num_beams=5)
        caption = processor.decode(out[0], skip_special_tokens=True)

        print("📝 [BLIP] Generated caption:", caption)
        return caption
    except Exception as e:
        print("❌ [BLIP] Caption generation failed:", e)
        return f"Error generating caption: {str(e)}"

# 🔹 Visual Question Answering (VQA)
def answer_question_about_image(image_url, question):
    print(f"❓ [BLIP] VQA - Question: {question}")
    print(f"🖼️  [BLIP] VQA - Image: {image_url}")
    
    image = load_image_from_url(image_url)
    if image is None:
        return "Unable to load image."

    try:
        inputs = processor(images=image, text=question, return_tensors="pt").to(device)
        out = model.generate(**inputs, max_length=50, num_beams=5)
        answer = processor.decode(out[0], skip_special_tokens=True)

        print(f"🤖 [BLIP] Q: {question} | A: {answer}")
        return answer
    except Exception as e:
        print("❌ [BLIP] VQA failed:", e)
        return f"Error answering question: {str(e)}"

# ✅ STREAMING FUNCTION FOR FASTAPI INTEGRATION
async def generate_blip_response_stream(user_input, image_url):
    """
    Generate clean streaming response for BLIP image analysis
    """
    print(f"🌊 [BLIP STREAM] Starting analysis...")
    print(f"📝 [BLIP STREAM] User query: {user_input}")
    print(f"🖼️  [BLIP STREAM] Image URL: {image_url}")
    
    try:
        # ✅ DOWNLOAD IMAGE (NO USER-VISIBLE MESSAGES)
        image = load_image_from_url(image_url)
        if image is None:
            yield "❌ Unable to load the image. Please check the URL and try again."
            return
        
        # ✅ DETERMINE ANALYSIS TYPE
        user_input_lower = user_input.lower()
        
        if any(word in user_input_lower for word in ['what', 'describe', 'caption', 'see', 'show', 'tell']):
            # ✅ IMAGE CAPTIONING - CLEAN OUTPUT
            caption = generate_image_caption(image_url)
            
            # Stream the caption naturally
            words = caption.split()
            for i, word in enumerate(words):
                yield word + " "
                if i % 3 == 0 and i > 0:  # Small pause every 3 words
                    await asyncio.sleep(0.08)
            
        else:
            # ✅ VISUAL QUESTION ANSWERING - CLEAN OUTPUT
            answer = answer_question_about_image(image_url, user_input)
            
            # Stream the answer naturally
            words = answer.split()
            for i, word in enumerate(words):
                yield word + " "
                if i % 2 == 0 and i > 0:  # Small pause every 2 words
                    await asyncio.sleep(0.08)
        
    except Exception as e:
        print(f"❌ [BLIP STREAM] Error: {e}")
        yield f"I'm sorry, I couldn't analyze this image. Please try with a different image."

# ✅ HEALTH CHECK FUNCTION
def check_blip_health():
    """Check if BLIP service is working"""
    try:
        test_input = torch.randn(1, 3, 224, 224).to(device)
        with torch.no_grad():
            _ = model.vision_model(test_input)
        return True, "BLIP model is working"
    except Exception as e:
        return False, f"BLIP model error: {str(e)}"

# ✅ INITIALIZATION TEST
def test_blip_initialization():
    """Test BLIP with a dummy image"""
    print("🧪 [BLIP] Running initialization test...")
    try:
        from PIL import Image
        import numpy as np
        
        test_image = Image.fromarray(np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8))
        
        inputs = processor(images=test_image, return_tensors="pt").to(device)
        out = model.generate(**inputs, max_length=20)
        caption = processor.decode(out[0], skip_special_tokens=True)
        
        print(f"✅ [BLIP] Test successful! Generated: '{caption}'")
        return True
    except Exception as e:
        print(f"❌ [BLIP] Test failed: {e}")
        return False

# === FASTAPI SERVER INTEGRATION ===

app = FastAPI()

class AnalyzeRequest(BaseModel):
    image_url: str
    question: str = None

@app.post("/analyze")
async def analyze_image(req: AnalyzeRequest):
    if not req.image_url:
        raise HTTPException(status_code=400, detail="Missing image_url")
    try:
        if req.question and req.question.strip():
            result = answer_question_about_image(req.image_url, req.question)
        else:
            result = generate_image_caption(req.image_url)
        return {"result": result}
    except Exception as e:
        print(f"❌ [BLIP API] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    ok, msg = check_blip_health()
    return {"ok": ok, "msg": msg}

# ✅ RUN INITIALIZATION TEST
if __name__ == "__main__":
    test_blip_initialization()
else:
    test_blip_initialization()

print("🎯 [BLIP] Handler ready for image analysis!")
