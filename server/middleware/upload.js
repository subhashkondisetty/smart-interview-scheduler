const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Target directory for uploaded resumes
const uploadDir = path.join(__dirname, '../uploads/resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration with UUID-based filename sanitization
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueId = crypto.randomUUID();
    const safeFilename = `resume-${uniqueId}${ext}`;
    cb(null, safeFilename);
  },
});

// Allowed MIME types and extensions for resume files
const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const allowedExtensions = ['.pdf', '.doc', '.docx'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(mime)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const getUploadInstance = () => {
  const maxMb = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5;
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxMb * 1024 * 1024,
    },
  });
};

/**
 * Middleware handling single resume file upload with structured error responses.
 */
const uploadResumeMiddleware = (req, res, next) => {
  const uploadSingle = getUploadInstance().single('resume');

  uploadSingle(req, res, (err) => {
    if (err) {
      if (req.readable) {
        req.resume(); // Drain unread data to prevent socket hanging in tests and HTTP clients
      }

      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMb = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5;
        return res.status(400).json({
          success: false,
          message: `File size exceeds the allowed limit of ${maxMb}MB.`,
        });
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'Error occurred during file upload.',
      });
    }

    next();
  });
};

module.exports = {
  uploadResumeMiddleware,
  uploadDir,
};
