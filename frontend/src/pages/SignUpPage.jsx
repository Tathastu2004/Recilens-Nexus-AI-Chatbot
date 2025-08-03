import React from 'react';
import SignUp from '../components/SignUp.jsx';
import AuthLayout from '../components/AuthLayout.jsx';

const SignUpPage = () => {
  return (
    <AuthLayout 
      title="Welcome to NexusChat" 
      subtitle="Join thousands of users already chatting with AI"
      useSlideshow={true}
    >
      <SignUp />
    </AuthLayout>
  );
};

export default SignUpPage;