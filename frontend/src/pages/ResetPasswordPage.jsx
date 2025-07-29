import React from 'react';
import ResetPassword from '../components/ResetPassword.jsx';
import AuthLayout from '../components/AuthLayout.jsx';

const ResetPasswordPage = () => {
  return (
    <AuthLayout 
      title="Reset Password" 
      subtitle="Enter your email to receive reset instructions"
    >
      <ResetPassword />
    </AuthLayout>
  );
};

export default ResetPasswordPage;