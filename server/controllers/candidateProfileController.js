const path = require('path');
const fs = require('fs');
const CandidateProfile = require('../models/CandidateProfile');
const asyncHandler = require('../utils/asyncHandler');
const { uploadDir } = require('../middleware/upload');

/**
 * @desc    Get current candidate's profile
 * @route   GET /api/candidate/profile
 * @access  Private (Candidate only)
 * @note    Ownership is strictly derived from req.user.id. Request body or query parameters are ignored.
 */
const getProfile = asyncHandler(async (req, res) => {
  // Enforce ownership: lookup strictly by authenticated req.user.id
  const candidateUserId = req.user._id || req.user.id;

  let profile = await CandidateProfile.findOne({ user: candidateUserId }).populate(
    'user',
    'email role createdAt'
  );

  if (!profile) {
    profile = await CandidateProfile.create({
      user: candidateUserId,
    });
    // Repopulate user information
    profile = await CandidateProfile.findById(profile._id).populate(
      'user',
      'email role createdAt'
    );
  }

  res.status(200).json({
    success: true,
    message: 'Candidate profile retrieved successfully',
    data: {
      profile,
    },
  });
});

/**
 * @desc    Update current candidate's profile
 * @route   PUT /api/candidate/profile
 * @access  Private (Candidate only)
 * @note    Ownership is strictly derived from req.user.id. Any attempted ID injection in body/params is disregarded.
 */
const updateProfile = asyncHandler(async (req, res) => {
  const candidateUserId = req.user._id || req.user.id;

  let profile = await CandidateProfile.findOne({ user: candidateUserId });

  if (!profile) {
    profile = new CandidateProfile({ user: candidateUserId });
  }

  // Whitelist updateable fields to prevent tampering with user, _id, resume, or completion percentage
  const updatableFields = [
    'fullName',
    'phone',
    'location',
    'headline',
    'bio',
    'githubUrl',
    'linkedinUrl',
    'portfolioUrl',
    'skills',
    'experienceLevel',
    'yearsOfExperience',
    'targetRole',
    'education',
  ];

  for (const field of updatableFields) {
    if (req.body[field] !== undefined) {
      profile[field] = req.body[field];
    }
  }

  await profile.save();

  // Populate user data
  profile = await CandidateProfile.findById(profile._id).populate(
    'user',
    'email role createdAt'
  );

  res.status(200).json({
    success: true,
    message: 'Candidate profile updated successfully',
    data: {
      profile,
    },
  });
});

/**
 * @desc    Upload or replace candidate resume
 * @route   POST /api/candidate/profile/resume
 * @access  Private (Candidate only)
 */
const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a resume file in pdf, doc, or docx format (field name: resume).',
    });
  }

  const candidateUserId = req.user._id || req.user.id;

  let profile = await CandidateProfile.findOne({ user: candidateUserId });
  if (!profile) {
    profile = new CandidateProfile({ user: candidateUserId });
  }

  // If an existing resume file exists on disk, delete old file to prevent orphan files
  if (profile.resume && profile.resume.fileName) {
    const oldFilePath = path.join(uploadDir, profile.resume.fileName);
    if (fs.existsSync(oldFilePath)) {
      try {
        fs.unlinkSync(oldFilePath);
      } catch (err) {
        console.error(`Failed to delete replaced resume file: ${oldFilePath}`, err.message);
      }
    }
  }

  profile.resume = {
    url: `/api/candidate/profile/resume`,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    uploadedAt: new Date(),
  };

  try {
    await profile.save();
  } catch (err) {
    // Orphan file cleanup: remove file from disk if database write fails
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Failed to cleanup orphan file after DB failure:', unlinkErr.message);
      }
    }
    throw err;
  }

  res.status(200).json({
    success: true,
    message: 'Resume uploaded successfully',
    data: {
      resume: profile.resume,
      profileCompletionPercentage: profile.profileCompletionPercentage,
    },
  });
});

/**
 * @desc    Delete candidate resume
 * @route   DELETE /api/candidate/profile/resume
 * @access  Private (Candidate only)
 */
const deleteResume = asyncHandler(async (req, res) => {
  const candidateUserId = req.user._id || req.user.id;

  const profile = await CandidateProfile.findOne({ user: candidateUserId });
  if (!profile || !profile.resume || !profile.resume.fileName) {
    return res.status(404).json({
      success: false,
      message: 'No resume found on candidate profile to delete.',
    });
  }

  // Delete physical file from disk
  const filePath = path.join(uploadDir, profile.resume.fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete resume file: ${filePath}`, err.message);
    }
  }

  // Clear resume fields in DB
  profile.resume = {
    url: '',
    fileName: '',
    originalName: '',
    uploadedAt: null,
  };

  await profile.save();

  res.status(200).json({
    success: true,
    message: 'Resume deleted successfully',
    data: {
      profileCompletionPercentage: profile.profileCompletionPercentage,
    },
  });
});

/**
 * @desc    Retrieve/download resume (candidate's own resume, or target candidate if admin)
 * @route   GET /api/candidate/profile/resume
 * @access  Private (Candidate, Admin)
 */
const getResume = asyncHandler(async (req, res) => {
  let candidateUserId = req.user._id || req.user.id;

  // If requester is admin and specifies target candidate via candidateId query param
  if (req.user.role === 'admin' && req.query.candidateId) {
    candidateUserId = req.query.candidateId;
  }

  const profile = await CandidateProfile.findOne({ user: candidateUserId });
  if (!profile || !profile.resume || !profile.resume.fileName) {
    return res.status(404).json({
      success: false,
      message: 'Resume not found.',
    });
  }

  const filePath = path.join(uploadDir, profile.resume.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: 'Resume file not found on server.',
    });
  }

  res.download(filePath, profile.resume.originalName || 'resume.pdf');
});

module.exports = {
  getProfile,
  updateProfile,
  uploadResume,
  deleteResume,
  getResume,
};
