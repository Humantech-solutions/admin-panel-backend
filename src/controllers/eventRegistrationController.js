const EventRegistration = require('../models/eventRegistrationModel');

// SUBMIT REGISTRATION
exports.submitRegistration = async (req, res) => {
  try {
    const { 
      eventTitle, 
      firstName, 
      lastName, 
      email, 
      company, 
      jobTitle, 
      interests, 
      pageTitle, 
      pageUrl 
    } = req.body;
    
    const newRegistration = new EventRegistration({
      eventTitle,
      firstName,
      lastName,
      email,
      company,
      jobTitle,
      interests,
      pageTitle,
      pageUrl
    });

    await newRegistration.save();

    res.json({ success: true, message: "Registration submitted successfully" });
  } catch (error) {
    console.error("Registration submission error:", error);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
};

// GET ALL REGISTRATIONS
exports.getAllRegistrations = async (req, res) => {
  try {
    const registrations = await EventRegistration.find().sort({ submittedAt: -1 });
    res.json({ success: true, registrations });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching registrations" });
  }
};
