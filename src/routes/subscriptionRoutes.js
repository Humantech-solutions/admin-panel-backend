const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/subscribe', subscriptionController.subscribe);
router.get('/unsubscribe', subscriptionController.unsubscribe);
router.get('/list', authMiddleware, subscriptionController.getSubscriptions);

router.post('/notify-publish', subscriptionController.notifyPublish);
module.exports = router;

