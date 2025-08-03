import React from 'react';
import VerifyMail from '../components/verfiyMail.jsx';
import AuthLayout from '../components/AuthLayout.jsx';

const VerifyEmailPage = () => {
  return (
    <AuthLayout 
      title="Verify Your Email" 
      subtitle="Check your inbox for verification instructions"
      useSlideshow={true}
    >
      <VerifyMail 
        email="user@example.com" // You can pass the actual email here
        onVerificationSuccess={() => {
          // Handle successful verification
          console.log('Email verified successfully!');
        }}
        onBack={() => {
          // Handle back action
          window.history.back();
        }}
      />
    </AuthLayout>
  );
};

export default VerifyEmailPage;