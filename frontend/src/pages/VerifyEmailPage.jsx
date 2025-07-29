import React from 'react';
import VerifyMail from '../components/verfiyMail.jsx';
import AuthLayout from '../components/AuthLayout.jsx';

const VerifyEmailPage = () => {
  return (
    <AuthLayout 
      title="Verify Your Email" 
      subtitle="Check your inbox for verification instructions"
    >
      <VerifyMail />
    </AuthLayout>
  );
};

export default VerifyEmailPage;