# 🤖 Nexus AI Chatbot

A powerful AI chatbot with support for both text conversations (Llama3) and image analysis (BLIP).

## 🚀 Features

- 💬 **Text Chat**: Powered by Llama3 via Ollama
- 🖼️ **Image Analysis**: BLIP model for image captioning and visual Q&A
- 🌊 **Streaming Responses**: Real-time response streaming
- 🎯 **Auto Type Detection**: Automatically routes based on content type
- 🔄 **RESTful API**: FastAPI-based backend with full documentation

## 📋 Prerequisites

### System Requirements
- **Python 3.8+** (Python 3.10+ recommended)
- **Node.js 16+** (for frontend)
- **4GB+ RAM** (8GB+ recommended for BLIP model)
- **Internet connection** (for initial model downloads)

### Required Services
- **Ollama** (for Llama3 text generation)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/NexusChatBot.git
cd NexusChatBot/Recilens-Nexus-AI-Chatbot
```

### 2. Set Up Python Environment (AI Model Service)
```bash
# Navigate to AI Model directory
cd AIModel

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Install and Set Up Ollama
```bash
# Install Ollama (macOS)
brew install ollama

# Or download from: https://ollama.ai/download

# Start Ollama service
ollama serve

# In another terminal, pull Llama3 model
ollama pull llama3
```

### 4. Set Up Node.js Backend
```bash
# Navigate to backend directory
cd ../backend

# Install Node.js dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env file with your configuration
```

### 5. Set Up React Frontend
```bash
# Navigate to frontend directory
cd ../frontend

# Install React dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env file with your configuration
```

## 🚀 Running the Application

### 1. Start AI Model Service (FastAPI)
```bash
cd AIModel
source .venv/bin/activate  # Activate virtual environment
python main.py
```
**Expected output:**
```
🚀 Starting FastAPI server...
📡 Endpoints available:
   - POST /chat (AI chat with type-based routing)
   - GET /health (Health check)
✅ [BLIP] Model loaded successfully on device: cpu
INFO: Uvicorn running on http://0.0.0.0:8000
```

### 2. Start Node.js Backend
```bash
cd backend
npm start
```
**Expected output:**
```
🚀 Server running on port 3000
📡 Database connected
✅ Routes loaded
```

### 3. Start React Frontend
```bash
cd frontend
npm start
```
**Expected output:**
```
webpack compiled successfully
Local: http://localhost:3001
```

## 🧪 Testing the Setup

### Test AI Service Health
```bash
curl http://localhost:8000/health
```

### Test Text Chat
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?", "type": "chat"}'
```

### Test Image Analysis
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What do you see in this image?",
    "type": "image",
    "fileUrl": "https://example.com/image.jpg"
  }'
```

## 📦 Model Downloads

**First Run Downloads:**
- 🦙 **Llama3**: ~4.7GB (via Ollama)
- 🖼️ **BLIP**: ~990MB (automatic via Hugging Face)

These models are cached locally and won't re-download.

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/nexuschat
JWT_SECRET=your_jwt_secret_here
FASTAPI_BASE_URL=http://127.0.0.1:8000
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_AI_SERVICE_URL=http://localhost:8000
```

#### AI Model Service
No environment file needed. Configuration is in `main.py`.

## 🐳 Docker Setup (Optional)

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "command not found: python"
```bash
# Try python3 instead
python3 main.py

# Or install Python
brew install python  # macOS
```

#### 2. "ModuleNotFoundError: No module named 'ollama'"
```bash
# Make sure virtual environment is activated
source .venv/bin/activate
pip install -r requirements.txt
```

#### 3. "Ollama service unavailable"
```bash
# Start Ollama service
ollama serve

# In another terminal, check if llama3 is installed
ollama list
# If not listed, install it
ollama pull llama3
```

#### 4. "BLIP model download stuck"
- Check internet connection
- Wait for download to complete (~990MB)
- Models cache in `~/.cache/huggingface/`

#### 5. Port already in use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or change port in main.py
uvicorn.run(app, host="0.0.0.0", port=8001)
```

## 📚 API Documentation

Once running, visit:
- **FastAPI Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Look at [Issues](https://github.com/yourusername/NexusChatBot/issues)
3. Create a new issue with detailed error messages

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React         │    │   Node.js        │    │   FastAPI       │
│   Frontend      │◄──►│   Backend        │◄──►│   AI Service    │
│   (Port 3001)   │    │   (Port 3000)    │    │   (Port 8000)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   MongoDB        │    │   Ollama        │
                       │   Database       │    │   + BLIP        │
                       └──────────────────┘    └─────────────────┘
```