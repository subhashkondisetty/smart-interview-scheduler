const CandidateProfile = require('../models/CandidateProfile');
const fixtures = require('./fixtures/profileCompletionFixtures.json');

describe('Profile Completion Scoring - Backend Mongoose Model', () => {
  fixtures.forEach(({ name, profile, expectedPercentage }) => {
    test(`should calculate ${expectedPercentage}% for scenario: "${name}"`, () => {
      const doc = new CandidateProfile(profile);
      const score = doc.calculateCompletion();
      expect(score).toBe(expectedPercentage);
    });
  });
});
