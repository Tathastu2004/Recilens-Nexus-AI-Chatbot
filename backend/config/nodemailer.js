import dotenv from 'dotenv';
dotenv.config(); // ✅ Load .env before accessing process.env

import nodeMailer from 'nodemailer';

console.log('EMAIL:', process.env.EMAIL ? '✅ Loaded' : '❌ Missing');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Loaded' : '❌ Missing');

const transporter = nodeMailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('Transporter error:', error);
  } else {
    console.log('Email transporter is working!');
  }
});

export default transporter;
