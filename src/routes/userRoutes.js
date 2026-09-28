const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/userModel');
const userController = require('../controllers/userController');

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -mfaSecret');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({
      success: true,
      message: "Protected route ✅",
      user
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching profile details" });
  }
});

// Collaborator routes
router.get('/', authMiddleware, userController.getUsers);
router.post('/', authMiddleware, userController.createUser);
router.put('/:id', authMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, userController.deleteUser);

module.exports = router;
