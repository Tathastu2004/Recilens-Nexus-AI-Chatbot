import React from 'react';
import ImageSlideshow from './ImageSlideshow.jsx';
import { IconRobot } from '@tabler/icons-react';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <>
      {/* Mobile Header - Shows slideshow content on small screens */}
      <div className="lg:hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="text-center">
          <div className="mb-4">
            <IconRobot size={48} className="mx-auto text-blue-200" />
          </div>
          <h2 className="text-2xl font-bold mb-2">NexusChat AI</h2>
          <p className="text-blue-100">Intelligent conversations powered by AI</p>
        </div>
      </div>

      <div className="min-h-screen flex">
        {/* Left Half - Image Slideshow (Desktop only) */}
        <div className="hidden lg:flex lg:w-1/2 relative">
          <ImageSlideshow />
        </div>

        {/* Right Half - Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50 min-h-screen lg:min-h-0">
          <div className="w-full max-w-md">
            {/* Optional Header */}
            {(title || subtitle) && (
              <div className="text-center mb-8">
                {title && (
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-gray-600">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            
            {/* Auth Component */}
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthLayout;

