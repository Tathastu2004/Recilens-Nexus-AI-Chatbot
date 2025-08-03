import React from 'react';
import SignUp from '../components/SignUp.jsx';
import AuthLayout from '../components/AuthLayout.jsx';

const LoginPage = () => {
  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Sign in to continue your AI conversations"
      useSlideshow={true}
    >
      <SignUp />
    </AuthLayout>
  );
};

export default LoginPage;