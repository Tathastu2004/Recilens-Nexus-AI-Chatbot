import torch
from transformers import BlipProcessor, BlipForQuestionAnswering
from PIL import Image
import os
import logging
from typing import Optional, List, Dict, Any

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BLIPImageQA:
    """
    BLIP Image Question Answering Model
    Uses the smaller BLIP model optimized for CPU and limited RAM (8GB)
    """
    
    def __init__(self, model_name: str = "Salesforce/blip-vqa-base"):
        """
        Initialize BLIP model
        
        Args:
            model_name: HuggingFace model name (default: smaller BLIP model)
        """
        self.model_name = model_name
        self.processor = None
        self.model = None
        self.device = "cpu"  # Force CPU usage for your specs
        self.is_loaded = False
        
        logger.info(f"Initializing BLIP model: {model_name}")
        self._load_model()
    
    def _load_model(self):
        """Load the BLIP model and processor"""
        try:
            logger.info("Loading BLIP processor...")
            self.processor = BlipProcessor.from_pretrained(self.model_name)
            
            logger.info("Loading BLIP model...")
            self.model = BlipForQuestionAnswering.from_pretrained(
                self.model_name, 
                torch_dtype=torch.float32,  # Use float32 for CPU compatibility
                low_cpu_mem_usage=True
            )
            
            self.is_loaded = True
            logger.info("BLIP model loaded successfully!")
            
        except Exception as e:
            logger.error(f"Error loading BLIP model: {str(e)}")
            raise
    
    def load_image(self, image_path: str) -> Optional[Image.Image]:
        """
        Load and validate an image
        
        Args:
            image_path: Path to the image file
            
        Returns:
            PIL Image object or None if error
        """
        try:
            if not os.path.exists(image_path):
                logger.error(f"Image file not found: {image_path}")
                return None
            
            image = Image.open(image_path)
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            logger.info(f"Image loaded successfully: {image_path}")
            return image
            
        except Exception as e:
            logger.error(f"Error loading image {image_path}: {str(e)}")
            return None
    
    def ask_question(self, image_path: str, question: str) -> Dict[str, Any]:
        """
        Ask a question about an image
        
        Args:
            image_path: Path to the image file
            question: Question to ask about the image
            
        Returns:
            Dictionary with answer and metadata
        """
        if not self.is_loaded:
            return {"error": "Model not loaded", "success": False}
        
        try:
            # Load image
            image = self.load_image(image_path)
            if image is None:
                return {"error": "Failed to load image", "success": False}
            
            # Prepare inputs
            inputs = self.processor(image, question, return_tensors="pt")
            
            # Generate answer
            with torch.no_grad():  # Disable gradient computation for inference
                outputs = self.model.generate(**inputs, max_length=50)
            
            # Decode answer
            answer = self.processor.decode(outputs[0], skip_special_tokens=True)
            
            return {
                "success": True,
                "answer": answer,
                "question": question,
                "image_path": image_path,
                "model": self.model_name
            }
            
        except Exception as e:
            logger.error(f"Error processing question: {str(e)}")
            return {"error": str(e), "success": False}
    
    def describe_image(self, image_path: str) -> Dict[str, Any]:
        """
        Generate a description of the image
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Dictionary with description and metadata
        """
        return self.ask_question(image_path, "What is in this image?")
    
    def get_image_details(self, image_path: str) -> Dict[str, Any]:
        """
        Get detailed information about the image
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Dictionary with detailed analysis
        """
        questions = [
            "What objects are visible in this image?",
            "What colors are prominent in this image?",
            "What is the main subject of this image?",
            "Describe the setting or background of this image."
        ]
        
        results = {}
        for question in questions:
            result = self.ask_question(image_path, question)
            if result["success"]:
                results[question] = result["answer"]
            else:
                results[question] = f"Error: {result.get('error', 'Unknown error')}"
        
        return {
            "success": True,
            "detailed_analysis": results,
            "image_path": image_path,
            "model": self.model_name
        }

# Example usage and testing functions
def test_blip_model():
    """Test the BLIP model with a sample image"""
    try:
        # Initialize model
        qa_model = BLIPImageQA()
        
        # Test with a sample image (you'll need to provide one)
        test_image_path = "Test.jpg"  # Your image file
        
        if os.path.exists(test_image_path):
            # Test basic question
            result = qa_model.ask_question(test_image_path, "What is in this image?")
            print("Basic Question Result:", result)
            
            # Test image description
            desc_result = qa_model.describe_image(test_image_path)
            print("Image Description:", desc_result)
            
            # Test detailed analysis
            detail_result = qa_model.get_image_details(test_image_path)
            print("Detailed Analysis:", detail_result)
        else:
            print(f"Test image not found: {test_image_path}")
            print("Please place a test image in the AIModel folder and update the path.")
            
    except Exception as e:
        print(f"Error testing model: {str(e)}")

def create_simple_api():
    """Create a simple function for external API calls"""
    qa_model = BLIPImageQA()
    
    def answer_question(image_path: str, question: str) -> Dict[str, Any]:
        """Simple function to answer questions about images"""
        return qa_model.ask_question(image_path, question)
    
    return answer_question

# Main execution
if __name__ == "__main__":
    print("BLIP Image Question Answering Model")
    print("=" * 50)
    
    # Test the model
    test_blip_model()
    
    print("\nTo use this model in your project:")
    print("1. Import the BLIPImageQA class")
    print("2. Create an instance: qa_model = BLIPImageQA()")
    print("3. Ask questions: result = qa_model.ask_question('image.jpg', 'What is this?')")
    print("4. Check result['success'] and get result['answer']")
