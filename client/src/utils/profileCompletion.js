/**
 * Pure function to calculate candidate profile completion percentage.
 * Total: 100%
 * - Basic Contact (fullName, phone, location): 20% (+10 fullName, +10 phone or location)
 * - Professional Overview (headline or bio): 15%
 * - Skills (at least 1 skill): 20%
 * - Education (at least 1 entry): 20%
 * - External Links (github, linkedin, or portfolio): 10%
 * - Resume uploaded: 15%
 *
 * NOTE: This client calculation drives optimistic live feedback between saves.
 * Upon successful save, the backend's authoritative value takes precedence.
 *
 * @param {Object} profile - Candidate profile document or form state
 * @returns {{ percentage: number, sections: Object }} Calculated percentage and section breakdown
 */
export function calculateProfileCompletion(profile = {}) {
  let score = 0;
  const sections = {
    fullName: false,
    phoneOrLocation: false,
    overview: false,
    skills: false,
    education: false,
    links: false,
    resume: false,
  };

  // Basic Contact: 20 points
  if (profile.fullName && profile.fullName.trim().length > 0) {
    score += 10;
    sections.fullName = true;
  }
  if (
    (profile.phone && profile.phone.trim().length > 0) ||
    (profile.location && profile.location.trim().length > 0)
  ) {
    score += 10;
    sections.phoneOrLocation = true;
  }

  // Professional Overview: 15 points
  if (
    (profile.headline && profile.headline.trim().length > 0) ||
    (profile.bio && profile.bio.trim().length > 0)
  ) {
    score += 15;
    sections.overview = true;
  }

  // Skills: 20 points (at least 1 non-empty skill)
  if (Array.isArray(profile.skills) && profile.skills.some((s) => s && s.trim().length > 0)) {
    score += 20;
    sections.skills = true;
  }

  // Education: 20 points (at least 1 entry with institution or degree)
  if (
    Array.isArray(profile.education) &&
    profile.education.length > 0 &&
    profile.education.some(
      (edu) =>
        (edu.institution && edu.institution.trim().length > 0) ||
        (edu.degree && edu.degree.trim().length > 0)
    )
  ) {
    score += 20;
    sections.education = true;
  }

  // Social/Portfolio links: 10 points
  if (
    (profile.githubUrl && profile.githubUrl.trim().length > 0) ||
    (profile.linkedinUrl && profile.linkedinUrl.trim().length > 0) ||
    (profile.portfolioUrl && profile.portfolioUrl.trim().length > 0)
  ) {
    score += 10;
    sections.links = true;
  }

  // Resume: 15 points
  if (profile.resume && profile.resume.url) {
    score += 15;
    sections.resume = true;
  }

  return {
    percentage: Math.min(100, score),
    sections,
  };
}

export default calculateProfileCompletion;
