import React, { useState, useEffect } from 'react';
import { 
  IconRobot, 
  IconBrain, 
  IconMessages, 
  IconShield, 
  IconBolt,
  IconCpu
} from '@tabler/icons-react';

const ImageSlideshow = () => {
  // ✅ AI-FOCUSED SLIDES WITH TECH AESTHETIC
  const slides = [
    {
      id: 1,
      title: "Neural Conversations",
      subtitle: "Advanced AI language processing",
      description: "Powered by transformer neural networks that understand context, nuance, and intent like never before.",
      icon: <IconBrain size={56} className="text-cyan-300" />,
      gradient: "from-slate-900 via-cyan-900 to-blue-900",
      features: ["Neural Processing", "Context Understanding", "Real-time Learning"],
      accentColor: "cyan"
    },
    {
      id: 2,
      title: "Machine Intelligence",
      subtitle: "Deep learning at its finest",
      description: "Multi-layered neural networks process billions of parameters to deliver human-like conversational AI.",
      icon: <IconCpu size={56} className="text-purple-300" />,
      gradient: "from-slate-900 via-purple-900 to-indigo-900",
      features: ["Deep Learning", "Parameter Optimization", "Cognitive Processing"],
      accentColor: "purple"
    },
    {
      id: 3,
      title: "Quantum Communication",
      subtitle: "Next-gen dialogue systems",
      description: "Revolutionary communication protocols that adapt and evolve with every interaction for optimal responses.",
      icon: <IconMessages size={56} className="text-emerald-300" />,
      gradient: "from-slate-900 via-emerald-900 to-teal-900",
      features: ["Adaptive Algorithms", "Quantum Processing", "Evolutionary Learning"],
      accentColor: "emerald"
    },
    {
      id: 4,
      title: "Encrypted Intelligence",
      subtitle: "Secure AI architecture",
      description: "Military-grade encryption meets advanced AI to ensure your conversations remain private and protected.",
      icon: <IconShield size={56} className="text-amber-300" />,
      gradient: "from-slate-900 via-amber-900 to-orange-900",
      features: ["Quantum Encryption", "Zero-Knowledge Architecture", "Privacy-First AI"],
      accentColor: "amber"
    },
    {
      id: 5,
      title: "Lightning Cognition",
      subtitle: "Instantaneous AI responses",
      description: "Optimized tensor processing units deliver sub-millisecond response times without compromising intelligence.",
      icon: <IconBolt size={56} className="text-blue-300" />,
      gradient: "from-slate-900 via-blue-900 to-violet-900",
      features: ["TPU Acceleration", "Edge Computing", "Parallel Processing"],
      accentColor: "blue"
    }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // ✅ AUTOMATIC SLIDESHOW
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  const currentSlideData = slides[currentSlide];

  return (
    <div 
      className={`relative w-full h-full bg-gradient-to-br ${currentSlideData.gradient} overflow-hidden transition-all duration-1000 ease-in-out`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ✅ AI CIRCUIT PATTERN BACKGROUND */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1' opacity='0.3'%3E%3Cpath d='M20 20h60v60H20z'/%3E%3Cpath d='M30 20v60M40 20v60M50 20v60M60 20v60M70 20v60'/%3E%3Cpath d='M20 30h60M20 40h60M20 50h60M20 60h60M20 70h60'/%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3Ccircle cx='50' cy='50' r='2'/%3E%3Ccircle cx='70' cy='70' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '100px 100px'
        }}></div>
      </div>

      {/* ✅ GLOWING DATA PARTICLES */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated particles with glow */}
        <div className="absolute top-20 left-10 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-60"></div>
        <div className="absolute top-32 right-16 w-1 h-1 bg-purple-400 rounded-full animate-pulse opacity-80" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute bottom-40 left-16 w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-40" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-24 right-12 w-2 h-2 bg-amber-400 rounded-full animate-pulse opacity-60" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-1 h-1 bg-blue-400 rounded-full animate-ping opacity-70" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-violet-400 rounded-full animate-pulse opacity-50" style={{ animationDelay: '2.5s' }}></div>
        
        {/* Floating code-like elements */}
        <div className="absolute top-16 right-20 text-xs font-mono text-white/20 animate-pulse" style={{ animationDelay: '1s' }}>01001</div>
        <div className="absolute bottom-32 left-24 text-xs font-mono text-white/20 animate-pulse" style={{ animationDelay: '2s' }}>AI.exe</div>
        <div className="absolute top-2/3 right-1/4 text-xs font-mono text-white/20 animate-pulse" style={{ animationDelay: '0.5s' }}>∇θ</div>
      </div>

      {/* ✅ SCANNING LINE EFFECT */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent animate-scan"></div>
      </div>

      {/* ✅ MAIN CONTENT */}
      <div className="relative h-full flex flex-col justify-center items-center p-8 text-white">
        {/* AI Icon with Holographic Effect */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            {/* Multiple glow layers for holographic effect */}
            <div className={`absolute inset-0 bg-${currentSlideData.accentColor}-400/30 rounded-full blur-2xl animate-pulse`}></div>
            <div className={`absolute inset-0 bg-${currentSlideData.accentColor}-300/20 rounded-full blur-3xl`}></div>
            <div className="absolute inset-0 bg-white/10 rounded-full blur-xl animate-pulse"></div>
            
            {/* Holographic border */}
            <div className="relative p-8 bg-slate-800/30 rounded-full backdrop-blur-sm border border-cyan-400/30 shadow-2xl">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/10 via-transparent to-purple-400/10 animate-spin-slow"></div>
              <div className="relative">
                {currentSlideData.icon}
              </div>
            </div>
            
            {/* Orbiting elements */}
            <div className="absolute inset-0 animate-spin-slow">
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-cyan-400/60 rounded-full transform -translate-x-1/2"></div>
              <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-purple-400/60 rounded-full transform -translate-x-1/2"></div>
            </div>
          </div>
        </div>

        {/* Content with Tech Typography */}
        <div className="text-center max-w-lg mx-auto">
          {/* Title with Glitch Effect */}
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 leading-tight font-mono tracking-wider">
            <span className="bg-gradient-to-r from-cyan-300 via-white to-purple-300 bg-clip-text text-transparent">
              {currentSlideData.title}
            </span>
          </h1>

          {/* Subtitle with Neon Effect */}
          <h2 className="text-lg lg:text-xl font-medium mb-6 font-mono text-cyan-200/90 tracking-wide">
            &gt; {currentSlideData.subtitle}
          </h2>

          {/* Description */}
          <p className="text-base leading-relaxed text-slate-200/80 mb-8 font-light">
            {currentSlideData.description}
          </p>

          {/* Features List with Terminal Style */}
          <div className="grid grid-cols-1 gap-2 mb-8">
            {currentSlideData.features.map((feature, index) => (
              <div 
                key={index} 
                className="flex items-center justify-center gap-3 text-sm font-mono opacity-0 animate-slide-up"
                style={{ 
                  animationDelay: `${index * 0.3}s`,
                  animationFillMode: 'forwards'
                }}
              >
                <div className={`w-2 h-2 bg-${currentSlideData.accentColor}-400 rounded-full animate-pulse shadow-glow`}></div>
                <span className="text-slate-200/90">$ {feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ✅ FUTURISTIC SLIDE INDICATORS */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="flex gap-3 p-2 bg-slate-800/30 rounded-full backdrop-blur-sm border border-slate-600/30">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`transition-all duration-500 ${
                  currentSlide === index 
                    ? 'w-8 h-2 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full shadow-glow animate-pulse' 
                    : 'w-2 h-2 bg-slate-400/40 rounded-full hover:bg-slate-300/60'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ✅ HOLOGRAPHIC GRID OVERLAY */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px'
            }}
          ></div>
        </div>
      </div>

      {/* ✅ ENHANCED GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none"></div>
    </div>
  );
};

export default ImageSlideshow;