import React from 'react';
import ResetPassword from '../components/ResetPassword.jsx';
import AuthLayout from '../components/AuthLayout.jsx';

const ResetPasswordPage = () => {
  return (
    <AuthLayout 
      title="Reset Password" 
      subtitle="Secure password reset in just a few steps"
      useSlideshow={true}
    >
      <ResetPassword />
    </AuthLayout>
  );
};

export default ResetPasswordPage;