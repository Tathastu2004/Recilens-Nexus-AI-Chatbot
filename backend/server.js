import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import connectDB from './config/mongodb.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './admin/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';




const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not defined in .env file');
  process.exit(1);
}
connectDB();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));




app.get('/', (req, res) => {
  res.send('Welcome to the Recilens Nexus AI Chatbot Backend!');
});


// Auth routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes); // Ensure userRoutes is imported from the correct file

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
