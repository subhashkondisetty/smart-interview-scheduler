const isValidUrl = (urlStr) => {
  if (!urlStr) return true;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
};

const ALLOWED_TARGET_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Mobile Developer',
  'Data Scientist/ML Engineer',
  'DevOps Engineer',
  'QA/SDET',
  'Other',
];

/**
 * Validator for candidate profile update payload.
 */
const validateProfileUpdate = (req, res, next) => {
  const {
    fullName,
    phone,
    headline,
    bio,
    githubUrl,
    linkedinUrl,
    portfolioUrl,
    skills,
    experienceLevel,
    yearsOfExperience,
    targetRole,
    education,
  } = req.body;

  const errors = [];

  if (fullName !== undefined && typeof fullName !== 'string') {
    errors.push('fullName must be a string');
  }

  if (phone !== undefined && typeof phone !== 'string') {
    errors.push('phone must be a string');
  }

  if (headline !== undefined && (typeof headline !== 'string' || headline.length > 200)) {
    errors.push('headline must be a string with a maximum of 200 characters');
  }

  if (bio !== undefined && (typeof bio !== 'string' || bio.length > 1000)) {
    errors.push('bio must be a string with a maximum of 1000 characters');
  }

  if (githubUrl && !isValidUrl(githubUrl)) {
    errors.push('githubUrl must be a valid HTTP/HTTPS URL');
  }

  if (linkedinUrl && !isValidUrl(linkedinUrl)) {
    errors.push('linkedinUrl must be a valid HTTP/HTTPS URL');
  }

  if (portfolioUrl && !isValidUrl(portfolioUrl)) {
    errors.push('portfolioUrl must be a valid HTTP/HTTPS URL');
  }

  if (skills !== undefined && !Array.isArray(skills)) {
    errors.push('skills must be an array of strings');
  }

  if (
    experienceLevel !== undefined &&
    !['entry', 'mid', 'senior', 'lead'].includes(experienceLevel)
  ) {
    errors.push('experienceLevel must be one of: entry, mid, senior, lead');
  }

  if (
    yearsOfExperience !== undefined &&
    (typeof yearsOfExperience !== 'number' || yearsOfExperience < 0)
  ) {
    errors.push('yearsOfExperience must be a non-negative number');
  }

  if (targetRole !== undefined && targetRole !== null && targetRole !== '') {
    if (typeof targetRole !== 'string' || !ALLOWED_TARGET_ROLES.includes(targetRole)) {
      errors.push(
        `targetRole must be one of: ${ALLOWED_TARGET_ROLES.join(', ')}`
      );
    }
  } else if (targetRole === '') {
    req.body.targetRole = null;
  }

  if (education !== undefined && !Array.isArray(education)) {
    errors.push('education must be an array of education objects');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
};

module.exports = {
  validateProfileUpdate,
};
