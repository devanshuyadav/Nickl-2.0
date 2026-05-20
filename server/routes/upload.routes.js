const express = require('express');
const multer = require('multer');
const { processContractNote } = require('../controllers/pdf.controller');

const router = express.Router();

// Store the PDF temporarily in RAM
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are allowed!'), false);
    }
});

// The endpoint will expect a form-data field named 'contractNote'
router.post('/contract-note', upload.single('contractNote'), processContractNote);

module.exports = router;