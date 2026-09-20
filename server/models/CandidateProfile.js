const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema(
  {
    institution: { type: String, trim: true },
    degree: { type: String, trim: true },
    fieldOfStudy: { type: String, trim: true },
    graduationYear: { type: Number },
    gpa: { type: String, trim: true },
  },
  { _id: true }
);

const candidateProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    headline: {
      type: String,
      trim: true,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    githubUrl: {
      type: String,
      trim: true,
      default: '',
    },
    linkedinUrl: {
      type: String,
      trim: true,
      default: '',
    },
    portfolioUrl: {
      type: String,
      trim: true,
      default: '',
    },
    skills: {
      type: [String],
      default: [],
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'lead'],
      default: 'entry',
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 0,
    },
    education: {
      type: [educationSchema],
      default: [],
    },
    resume: {
      url: { type: String, default: '' },
      fileName: { type: String, default: '' },
      originalName: { type: String, default: '' },
      uploadedAt: { type: Date, default: null },
    },
    profileCompletionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Calculates profile completion percentage based on filled sections.
 * Total: 100%
 * - Basic Contact (fullName, phone, location): 20%
 * - Professional Overview (headline or bio): 15%
 * - Skills (at least 1 skill): 20%
 * - Education (at least 1 entry): 20%
 * - External Links (github, linkedin, or portfolio): 10%
 * - Resume uploaded: 15%
 */
candidateProfileSchema.methods.calculateCompletion = function () {
  let score = 0;

  // Basic Contact: 20 points
  if (this.fullName && this.fullName.trim().length > 0) score += 10;
  if ((this.phone && this.phone.trim().length > 0) || (this.location && this.location.trim().length > 0)) {
    score += 10;
  }

  // Professional Overview: 15 points
  if ((this.headline && this.headline.trim().length > 0) || (this.bio && this.bio.trim().length > 0)) {
    score += 15;
  }

  // Skills: 20 points
  if (Array.isArray(this.skills) && this.skills.length > 0) {
    score += 20;
  }

  // Education: 20 points
  if (
    Array.isArray(this.education) &&
    this.education.length > 0 &&
    this.education.some((edu) => edu.institution || edu.degree)
  ) {
    score += 20;
  }

  // Social/Portfolio links: 10 points
  if (this.githubUrl || this.linkedinUrl || this.portfolioUrl) {
    score += 10;
  }

  // Resume: 15 points
  if (this.resume && this.resume.url) {
    score += 15;
  }

  return Math.min(100, score);
};

// Pre-save hook: auto-compute completion percentage
candidateProfileSchema.pre('save', async function (next) {
  this.profileCompletionPercentage = this.calculateCompletion();
  if (typeof next === 'function') next();
});

const CandidateProfile =
  mongoose.models.CandidateProfile || mongoose.model('CandidateProfile', candidateProfileSchema);

module.exports = CandidateProfile;
