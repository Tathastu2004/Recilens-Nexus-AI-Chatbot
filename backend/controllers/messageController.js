// ✅ IMPROVED AI RESPONSE HANDLING WITH BETTER ERROR MESSAGES
const generateAIResponse = async (req, res) => {
  const { sessionId, message } = req.body;
  
  console.log('🤖 [MESSAGE] Generating AI response for session:', sessionId);
  
  // ✅ SET PROPER SSE HEADERS
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    // ✅ SEND INITIAL STATUS
    res.write(`data: ${JSON.stringify({ 
      status: 'processing', 
      message: 'AI is thinking...' 
    })}\n\n`);

    // ✅ GENERATE AI RESPONSE WITH RETRY LOGIC
    const aiResponse = await generateAIResponseWithRetry(message, sessionId);
    
    if (!aiResponse || aiResponse.includes('experiencing high demand')) {
      // ✅ HANDLE OVERLOAD GRACEFULLY
      res.write(`data: ${JSON.stringify({ 
        chunk: aiResponse || "I'm currently experiencing high demand. Please try again in a moment.",
        isOverloaded: true
      })}\n\n`);
    } else {
      // ✅ STREAM RESPONSE IN CHUNKS FOR BETTER UX
      const words = aiResponse.split(' ');
      const chunkSize = 3; // Send 3 words at a time
      
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize).join(' ') + ' ';
        
        res.write(`data: ${JSON.stringify({ 
          chunk,
          progress: Math.round((i / words.length) * 100)
        })}\n\n`);
        
        // ✅ SMALL DELAY FOR TYPEWRITER EFFECT
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // ✅ SAVE AI MESSAGE TO DATABASE
    const aiMessage = new Message({
      session: sessionId,
      sender: 'AI',
      message: aiResponse,
      type: 'text',
      timestamp: new Date()
    });
    
    await aiMessage.save();
    
    // ✅ SEND FINAL CONFIRMATION
    res.write(`data: ${JSON.stringify({ 
      isFinal: true, 
      messageId: aiMessage._id,
      status: 'completed'
    })}\n\n`);
    
    console.log('✅ [MESSAGE] AI response completed and saved');
    
  } catch (error) {
    console.error('❌ [MESSAGE] Error generating AI response:', error);
    
    // ✅ SEND ERROR TO CLIENT
    res.write(`data: ${JSON.stringify({ 
      error: 'Failed to generate response. Please try again.',
      isRetryable: true
    })}\n\n`);
  } finally {
    res.end();
  }
};

// ✅ ADD RETRY WRAPPER FUNCTION
const generateAIResponseWithRetry = async (message, sessionId, maxRetries = 2) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await aiService.generateResponse(message, sessionId);
      return response;
    } catch (error) {
      console.log(`❌ [AI RETRY] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
      
      if (attempt === maxRetries) {
        return "I apologize, but I'm experiencing technical difficulties right now. Please try sending your message again in a few moments.";
      }
      
      // ✅ PROGRESSIVE DELAY
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
};