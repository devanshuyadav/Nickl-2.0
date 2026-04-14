const fs = require('fs');
// Using the legacy build is crucial in Node to avoid DOM/Browser errors
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const pdfPath = './Contract_Note_6851287181_04-Feb-2026 (1).pdf';

// Use the EXACT string that worked in your browser
const password = 'BFRPY6947R';

async function runTest() {
    try {
        console.log("1. Reading file from disk...");
        // pdf.js prefers Uint8Array over Node's native Buffer
        const dataBuffer = new Uint8Array(fs.readFileSync(pdfPath));

        console.log("2. Bypassing wrappers and calling Mozilla's pdf.js directly...");

        // Pass the password directly into the core engine
        const loadingTask = pdfjsLib.getDocument({
            data: dataBuffer,
            password: password,
            useSystemFonts: true
        });

        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;
        console.log(`✅ Unlocked successfully! Document has ${numPages} page(s).`);

        console.log("3. Extracting text...");
        let fullText = "";

        // Loop through each page and extract the text chunks
        for (let i = 1; i <= numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();

            // Items contains the raw text strings. We join them with a space.
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + "\n";
        }

        console.log("\n✅ SUCCESS! Extracted Text Preview:");
        console.log("--------------------------------------------------");
        console.log(fullText.substring(0, 1500));
        console.log("--------------------------------------------------");

    } catch (err) {
        console.error("\n❌ FAILED:");
        console.error(err.message || err);
    }
}

runTest();