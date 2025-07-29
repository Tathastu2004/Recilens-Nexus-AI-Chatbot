import React, { useState, useEffect } from 'react';
import { 
  IconRobot, 
  IconBrain, 
  IconMessages, 
  IconShield, 
  IconBolt 
} from '@tabler/icons-react';

const ImageSlideshow = () => {
  // ✅ ENHANCED SLIDES WITH VALID ICONS
  const slides = [
    {
      id: 1,
      title: "Smart AI Conversations",
      subtitle: "Experience the future of intelligent chat",
      description: "Our advanced AI understands context and provides meaningful responses to help you accomplish more.",
      icon: <IconRobot size={48} className="text-blue-400" />,
      gradient: "from-blue-600 via-blue-700 to-indigo-800",
      features: ["Real-time responses", "Context awareness", "Multi-format support"]
    },
    {
      id: 2,
      title: "Powered by Advanced AI",
      subtitle: "Cutting-edge technology at your fingertips",
      description: "Built with the latest AI models to understand complex queries and provide accurate, helpful responses.",
      icon: <IconBrain size={48} className="text-purple-400" />,
      gradient: "from-purple-600 via-purple-700 to-indigo-800",
      features: ["Latest AI models", "Complex reasoning", "Accurate responses"]
    },
    {
      id: 3,
      title: "Seamless Communication",
      subtitle: "Chat naturally with AI assistance",
      description: "Engage in natural conversations with our AI that remembers context and provides personalized assistance.",
      icon: <IconMessages size={48} className="text-green-400" />,
      gradient: "from-green-600 via-teal-600 to-blue-700",
      features: ["Natural language", "Memory retention", "Personalized help"]
    },
    {
      id: 4,
      title: "Secure & Private",
      subtitle: "Your data protection is our priority",
      description: "Enterprise-grade security with end-to-end encryption ensures your conversations remain private and secure.",
      icon: <IconShield size={48} className="text-yellow-400" />,
      gradient: "from-yellow-600 via-orange-600 to-red-700",
      features: ["End-to-end encryption", "Privacy first", "Secure storage"]
    },
    {
      id: 5,
      title: "Lightning Fast",
      subtitle: "Instant responses when you need them",
      description: "Optimized infrastructure delivers lightning-fast responses without compromising on quality or accuracy.",
      icon: <IconBolt size={48} className="text-cyan-400" />,
      gradient: "from-cyan-600 via-blue-600 to-purple-700",
      features: ["Sub-second responses", "Global infrastructure", "99.9% uptime"]
    }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // ✅ AUTOMATIC SLIDESHOW WITH PAUSE ON HOVER
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  const currentSlideData = slides[currentSlide];

  return (
    <div 
      className={`relative w-full h-full bg-gradient-to-br ${currentSlideData.gradient} overflow-hidden transition-all duration-1000 ease-in-out`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ✅ BACKGROUND PATTERN */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-repeat animate-pulse" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      {/* ✅ FLOATING ELEMENTS */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-4 h-4 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-40 right-20 w-6 h-6 bg-white/10 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-40 left-20 w-3 h-3 bg-white/15 rounded-full animate-bounce" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 right-10 w-5 h-5 bg-white/10 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-white/10 rounded-full animate-ping" style={{ animationDelay: '3s' }}></div>
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-white/15 rounded-full animate-ping" style={{ animationDelay: '1.5s' }}></div>
      </div>

      {/* ✅ MAIN CONTENT */}
      <div className="relative h-full flex flex-col justify-center items-center p-8 text-white">
        {/* Icon with Enhanced Glow Effect */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute inset-0 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative p-6 bg-white/10 rounded-full backdrop-blur-sm border border-white/20 shadow-2xl">
              {currentSlideData.icon}
            </div>
          </div>
        </div>

        {/* Content with Fade Animation */}
        <div className="text-center max-w-lg mx-auto">
          {/* Title with Enhanced Animation */}
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 leading-tight animate-fade-in">
            {currentSlideData.title}
          </h1>

          {/* Subtitle */}
          <h2 className="text-xl lg:text-2xl font-medium mb-6 text-white/90">
            {currentSlideData.subtitle}
          </h2>

          {/* Description */}
          <p className="text-lg leading-relaxed text-white/80 mb-8">
            {currentSlideData.description}
          </p>

          {/* Features List with Staggered Animation */}
          <div className="grid grid-cols-1 gap-3">
            {currentSlideData.features.map((feature, index) => (
              <div 
                key={index} 
                className="flex items-center justify-center gap-3 text-sm opacity-0 animate-slide-up"
                style={{ 
                  animationDelay: `${index * 0.2}s`,
                  animationFillMode: 'forwards'
                }}
              >
                <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                <span className="text-white/90">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ✅ CLEAN SLIDE INDICATORS (NO BUTTONS) */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-all duration-500 ${
                  currentSlide === index 
                    ? 'bg-white scale-125 shadow-lg animate-pulse' 
                    : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ✅ SLIDE TRANSITION ANIMATION */}
        <div 
          key={currentSlide}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-slide-transition pointer-events-none"
        ></div>
      </div>

      {/* ✅ ENHANCED GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default ImageSlideshow;