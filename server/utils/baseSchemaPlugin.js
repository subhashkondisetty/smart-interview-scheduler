/**
 * Base Mongoose schema plugin to enforce consistent schema conventions across models:
 * - Enables timestamps (createdAt, updatedAt)
 * - Removes __v and sensitive fields like password when serializing to JSON or Object
 */
const baseSchemaPlugin = (schema) => {
  // Ensure timestamps are enabled by default
  schema.set('timestamps', true);

  const existingToJSONTransform = schema.options.toJSON && schema.options.toJSON.transform;

  schema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret, options) => {
      delete ret.__v;
      if (ret.password) {
        delete ret.password;
      }
      if (typeof existingToJSONTransform === 'function') {
        return existingToJSONTransform(doc, ret, options);
      }
      return ret;
    },
  });

  const existingToObjectTransform = schema.options.toObject && schema.options.toObject.transform;

  schema.set('toObject', {
    virtuals: true,
    transform: (doc, ret, options) => {
      delete ret.__v;
      if (ret.password) {
        delete ret.password;
      }
      if (typeof existingToObjectTransform === 'function') {
        return existingToObjectTransform(doc, ret, options);
      }
      return ret;
    },
  });
};

module.exports = baseSchemaPlugin;
