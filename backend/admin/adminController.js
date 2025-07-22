import User from '../models/User.js';

export const getAllUsers = async (req, res) => {
  const users = await User.find({}, '-password'); // don't send passwords
  res.json(users);
};
