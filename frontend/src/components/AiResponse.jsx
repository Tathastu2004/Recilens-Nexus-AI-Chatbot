import React, { useState, useEffect } from 'react';
import { IconRobot, IconBrain, IconCpu } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const AiResponse = ({ 
  isTyping = false, 
  message = '', 
  showAnimation = true,
  animationType = 'dots',
  customIcon = null,
  timestamp = null,
  fileUrl = null,
  fileType = null,
  serviceStatus = 'normal',
  shouldAnimate = false,
  customResponseText = null
}) => {
  // ✅ ANIMATION COMPONENTS
  const DotsAnimation = () => (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    </div>
  );

  const PulseAnimation = () => (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-pulse"></div>
      <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      <div className="w-4 h-4 bg-gradient-to-r from-pink-400 to-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </div>
  );

  const WaveAnimation = () => (
    <div className="flex items-end gap-1 h-6">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full animate-wave"
          style={{
            width: '3px',
            height: `${12 + (i % 3) * 8}px`,
            animationDelay: `${i * 0.1}s`
          }}
        ></div>
      ))}
    </div>
  );

  const ThinkingAnimation = () => (
    <div className="flex items-center gap-3">
      <div className="relative">
        <IconBrain size={20} className="text-blue-500 animate-spin-slow" />
        <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
      </div>
      <div className="flex gap-1">
        <span className="text-blue-600 animate-pulse">●</span>
        <span className="text-blue-500 animate-pulse" style={{ animationDelay: '0.3s' }}>●</span>
        <span className="text-blue-400 animate-pulse" style={{ animationDelay: '0.6s' }}>●</span>
      </div>
    </div>
  );

  // ✅ RENDER ANIMATION BASED ON TYPE
  const renderAnimation = () => {
    switch (animationType) {
      case 'pulse':
        return <PulseAnimation />;
      case 'wave':
        return <WaveAnimation />;
      case 'thinking':
        return <ThinkingAnimation />;
      default:
        return <DotsAnimation />;
    }
  };

  // ✅ SIMPLIFIED MARKDOWN RENDERER
  const MessageRenderer = ({ message }) => (
    <div className="prose prose-sm max-w-none">
      {serviceStatus === 'overloaded' && (
        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          ⚠️ AI service is experiencing high demand. Response may be delayed.
        </div>
      )}
      
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-md !mt-2 !mb-2"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code 
                className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono" 
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>;
          },
          blockquote({ children }) {
            return <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2">{children}</blockquote>;
          },
          strong({ children }) {
            return <strong className="font-semibold">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          }
        }}
      >
        {message}
      </ReactMarkdown>
    </div>
  );

  return (
    <div className={`flex justify-start mb-4 ${shouldAnimate ? 'message-enter message-enter-active' : ''}`}>
      <div className="max-w-xs lg:max-w-md xl:max-w-lg">
        {/* ✅ AI AVATAR WITH ENHANCED GLOW EFFECT */}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center relative overflow-hidden">
              {/* ✅ ANIMATED BACKGROUND */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 to-purple-400/30 animate-pulse"></div>
              
              {/* ✅ ICON */}
              <div className="relative z-10">
                {customIcon || <IconRobot size={16} className="text-white" />}
              </div>
              
              {/* ✅ GLOW EFFECT */}
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md animate-pulse"></div>
            </div>
            
            {/* ✅ TYPING INDICATOR */}
            {isTyping && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-white"></div>
            )}
          </div>

          {/* ✅ MESSAGE BUBBLE */}
          <div className={`relative px-4 py-3 rounded-2xl shadow-sm transition-all duration-300 ${
            isTyping 
              ? 'bg-gradient-to-r from-gray-50 to-blue-50 border border-blue-200' 
              : 'bg-gray-50 border border-gray-200'
          }`}>
            {/* ✅ AI LABEL */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-600">🤖 AI Assistant</span>
              {isTyping && (
                <span className="text-xs text-blue-600 animate-pulse">typing...</span>
              )}
            </div>

            {/* ✅ SIMPLIFIED CONTENT - NO TYPEWRITER EFFECT */}
            <div className="text-sm text-gray-800">
              {isTyping ? (
                // ✅ LOADING STATE
                <div className="flex items-center gap-3 py-2">
                  <span className="text-gray-600">
                    {customResponseText || "AI is thinking..."}
                  </span>
                  {showAnimation && renderAnimation()}
                </div>
              ) : (
                // ✅ COMPLETE MESSAGE - DISPLAYED INSTANTLY
                <div className="relative">
                  {message ? (
                    <MessageRenderer message={message} />
                  ) : (
                    <span className="text-gray-500">No response</span>
                  )}
                </div>
              )}
            </div>

            {/* ✅ FILE ATTACHMENT */}
            {fileUrl && !isTyping && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                {fileType === 'image' ? (
                  <img 
                    src={fileUrl} 
                    alt="AI Generated" 
                    className="max-w-full h-auto rounded border animate-fade-in"
                  />
                ) : (
                  <a 
                    href={fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    📎 View File
                  </a>
                )}
              </div>
            )}

            {/* ✅ TIMESTAMP */}
            {!isTyping && message && timestamp && (
              <div className="text-xs text-gray-500 mt-2 pt-1 border-t border-gray-100">
                {new Date(timestamp).toLocaleTimeString()}
              </div>
            )}

            {/* ✅ BUBBLE TAIL */}
            <div className="absolute left-0 top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-50 -translate-x-2"></div>
          </div>
        </div>

        {/* ✅ PROCESSING INDICATORS - ONLY WHEN TYPING */}
        {isTyping && (
          <div className="ml-11 mt-2 flex items-center gap-4 text-xs text-gray-500 animate-slide-up">
            <div className="flex items-center gap-1">
              <IconCpu size={12} className="animate-spin" />
              <span>Processing</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              <span>Online</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiResponse;