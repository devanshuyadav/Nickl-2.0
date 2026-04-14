const express = require('express');
const multer = require('multer');
const { processContractNote } = require('../controllers/pdf.controller');

const router = express.Router();

// Configure Multer to store the uploaded file in memory
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});

// Route expects a form-data field named 'contractNote'
router.post('/contract-note', upload.single('contractNote'), processContractNote);

module.exports = router;