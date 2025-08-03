import React from 'react';
import { useTheme } from '../context/ThemeContext';
import ImageSlideshow from './ImageSlideshow';
import {
  IconSun,
  IconMoon,
  IconBolt,
  IconShield,
  IconSparkles,
  IconRocket,
  IconStarFilled
} from '@tabler/icons-react';

const AuthLayout = ({ title, subtitle, children, feature = 'lightning', useSlideshow = false }) => {
  const { isDark, toggleTheme, isTransitioning } = useTheme();

  const features = {
    lightning: {
      icon: <IconBolt size={60} className="text-blue-400" />,
      title: "Lightning Fast",
      description: "Instant responses when you need them",
      detail: "Optimized infrastructure delivers lightning-fast responses without compromising on quality or accuracy.",
      gradient: "from-blue-600 via-purple-600 to-blue-800"
    },
    security: {
      icon: <IconShield size={60} className="text-emerald-400" />,
      title: "Ultra Secure",
      description: "Your data is protected with enterprise-grade security",
      detail: "End-to-end encryption and advanced security protocols ensure your conversations remain private and secure.",
      gradient: "from-emerald-600 via-cyan-600 to-emerald-800"
    },
    intelligence: {
      icon: <IconSparkles size={60} className="text-purple-400" />,
      title: "AI Powered",
      description: "Advanced AI technology at your fingertips",
      detail: "Cutting-edge artificial intelligence provides intelligent responses and learns from your interactions.",
      gradient: "from-purple-600 via-pink-600 to-purple-800"
    }
  };

  const currentFeature = features[feature] || features.lightning;

  return (
    <div className={`h-screen w-screen flex overflow-hidden transition-all duration-500 ${
      isDark 
        ? 'bg-gray-900' 
        : 'bg-gray-100'
    } ${isTransitioning ? 'animate-pulse' : ''}`}>
      
      {/* ✅ THEME TOGGLE BUTTON */}
      <button
        onClick={toggleTheme}
        className={`fixed top-4 right-4 z-50 p-2.5 rounded-lg transition-all duration-300 transform hover:scale-110 group ${
          isDark 
            ? 'bg-gray-800/90 hover:bg-gray-700/90 text-yellow-400 border border-gray-700/50 shadow-xl' 
            : 'bg-white/90 hover:bg-gray-50/90 text-gray-600 border border-gray-200/50 shadow-lg'
        } backdrop-blur-sm`}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? (
          <IconSun size={18} className="transition-transform group-hover:rotate-180 duration-500" />
        ) : (
          <IconMoon size={18} className="transition-transform group-hover:-rotate-12 duration-500" />
        )}
      </button>

      {/* ✅ LEFT SIDE - SLIDESHOW OR FEATURE SECTION */}
      <div className="flex-1 h-full overflow-hidden">
        {useSlideshow ? (
          <ImageSlideshow />
        ) : (
          <div className={`h-full flex flex-col justify-center items-center p-8 relative overflow-hidden ${
            isDark 
              ? `bg-gradient-to-br ${currentFeature.gradient} text-white` 
              : `bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white`
          }`}>
            
            {/* ✅ FLOATING PARTICLES */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-float opacity-10"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.7}s`,
                    animationDuration: `${4 + Math.random() * 3}s`
                  }}
                >
                  {i % 3 === 0 ? <IconBolt size={20} /> : 
                   i % 3 === 1 ? <IconSparkles size={16} /> : 
                   <IconStarFilled size={14} />}
                </div>
              ))}
            </div>

            <div className="relative z-10 text-center max-w-lg">
              {/* ✅ FEATURE ICON */}
              <div className="mb-6">
                <div className="relative inline-block">
                  <div className={`w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
                    isDark 
                      ? 'bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl' 
                      : 'bg-white/5 backdrop-blur-sm border border-white/10 shadow-2xl'
                  }`}>
                    {React.cloneElement(currentFeature.icon, { size: 48 })}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                    <IconRocket size={12} className="text-white" />
                  </div>
                </div>
              </div>

              {/* ✅ FEATURE CONTENT */}
              <h1 className="text-3xl lg:text-4xl font-bold mb-3 tracking-tight">
                {currentFeature.title}
              </h1>
              
              <p className="text-lg mb-4 text-white/90 font-medium">
                {currentFeature.description}
              </p>
              
              <p className="text-white/70 leading-relaxed text-sm mb-6">
                {currentFeature.detail}
              </p>

              {/* ✅ FEATURE STATS */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "99.9%", label: "Uptime" },
                  { value: "<100ms", label: "Response" },
                  { value: "24/7", label: "Available" }
                ].map((stat, index) => (
                  <div key={index} className={`text-center p-3 rounded-xl transition-all duration-300 hover:scale-105 ${
                    isDark 
                      ? 'bg-white/5 backdrop-blur-sm border border-white/10' 
                      : 'bg-white/5 backdrop-blur-sm border border-white/10'
                  }`}>
                    <div className="text-lg font-bold text-white mb-1">{stat.value}</div>
                    <div className="text-xs text-white/70">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ✅ RIGHT SIDE - FORM SECTION */}
      <div className={`flex-1 h-full overflow-y-auto scrollbar-hide flex flex-col justify-center items-center p-4 ${
        isDark 
          ? 'bg-gray-900' 
          : 'bg-gray-50'
      }`}>
        <div className="w-full max-w-md my-auto">
          {/* ✅ HEADER */}
          <div className="text-center mb-6">
            <h2 className={`text-2xl lg:text-3xl font-bold mb-2 transition-colors duration-300 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {title}
            </h2>
            <p className={`text-base transition-colors duration-300 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {subtitle}
            </p>
          </div>

          {/* ✅ FORM CONTAINER */}
          <div className={`${
            isDark 
              ? 'bg-gray-800/50 border-gray-700/50' 
              : 'bg-white/80 border-gray-200/50'
          } backdrop-blur-xl rounded-2xl p-6 border shadow-2xl transition-all duration-300`}>
            {children}
          </div>
        </div>
      </div>

      {/* ✅ CSS ANIMATIONS + HIDE SCROLLBAR */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.1; }
          25% { transform: translateY(-15px) rotate(90deg); opacity: 0.2; }
          50% { transform: translateY(-30px) rotate(180deg); opacity: 0.1; }
          75% { transform: translateY(-15px) rotate(270deg); opacity: 0.2; }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        
        /* Hide scrollbar for Chrome, Safari and Opera */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        /* Hide scrollbar for IE, Edge and Firefox */
        .scrollbar-hide {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Ensure no body scroll */
        body {
          overflow: hidden;
        }
        
        html, body, #root {
          height: 100vh;
          max-height: 100vh;
        }
      `}</style>
    </div>
  );
};

export default AuthLayout;