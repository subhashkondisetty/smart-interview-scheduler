/**
 * Resume File Upload Validation Utilities
 * Mirrors backend Multer rules from server/middleware/upload.js
 */

export const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];

export const ALLOWED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const MAX_RESUME_SIZE_MB =
  parseInt(import.meta.env?.VITE_MAX_FILE_SIZE_MB, 10) || 5;

export const MAX_RESUME_SIZE_BYTES = MAX_RESUME_SIZE_MB * 1024 * 1024;

/**
 * Validates a resume file on the client prior to network transmission.
 *
 * @param {File} file - Browser File object from input[type="file"]
 * @returns {{ valid: boolean, error: string | null }} Validation result
 */
export function validateResumeFile(file) {
  if (!file) {
    return {
      valid: false,
      error: 'Please select a file to upload.',
    };
  }

  // 1. Extension validation (case-insensitive)
  const filename = file.name || '';
  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';

  if (!ALLOWED_RESUME_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.',
    };
  }

  // 2. MIME type validation (when provided by browser)
  if (file.type && !ALLOWED_RESUME_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.',
    };
  }

  // 3. File size validation
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the allowed limit of ${MAX_RESUME_SIZE_MB}MB.`,
    };
  }

  return {
    valid: true,
    error: null,
  };
}

export default validateResumeFile;
