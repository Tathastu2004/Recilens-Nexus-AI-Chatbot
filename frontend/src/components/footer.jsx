import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-100 border-t">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          {/* Company Info */}
          <div className="mb-4 md:mb-0">
            <h3 className="font-bold text-gray-800">Recilens Cooperation Pvt Ltd</h3>
            <p className="text-sm text-gray-600">Powered by Nexus AI</p>
          </div>

          {/* Links */}
          <div className="flex gap-6 text-sm text-gray-600">
            <a href="#" className="hover:text-gray-900">Privacy Policy</a>
            <a href="#" className="hover:text-gray-900">Terms of Service</a>
            <a href="#" className="hover:text-gray-900">Contact</a>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} Recilens Cooperation Pvt Ltd. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;