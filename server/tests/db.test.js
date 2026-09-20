const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

describe('Database Configuration & Base Schema Conventions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('connectDB throws error when MONGODB_URI is not set', async () => {
    delete process.env.MONGODB_URI;
    process.env.NODE_ENV = 'test';

    await expect(connectDB()).rejects.toThrow('MONGODB_URI environment variable is not defined.');
  });

  test('Mongoose schemas inherit base conventions (timestamps & toJSON sanitization)', () => {
    const TestSchema = new mongoose.Schema({
      name: { type: String, required: true },
      password: { type: String },
    });

    const TestModel = mongoose.models.TestModel || mongoose.model('TestModel', TestSchema);

    const instance = new TestModel({
      name: 'John Doe',
      password: 'supersecretpassword',
    });

    const json = instance.toJSON();

    // Verify __v and password are removed
    expect(json).not.toHaveProperty('__v');
    expect(json).not.toHaveProperty('password');
    expect(json).toHaveProperty('name', 'John Doe');
    expect(json).toHaveProperty('_id');

    // Verify schema options have timestamps set
    expect(TestSchema.get('timestamps')).toBe(true);
  });
});
