// This is a minimal secure backend endpoint example.
const express = require('express');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const cors = require('cors');
const bodyParser = require('body-parser');

// IMPORTANT: Authentication
// For this to work, you must have authenticated the environment 
// (e.g., via 'gcloud auth application-default login' on your machine) 
// or set the GOOGLE_APPLICATION_CREDENTIALS environment variable.

const app = express();
const port = 3000;

// Initialize the TTS client
const ttsClient = new TextToSpeechClient();

app.use(cors({ origin: '*' })); // Allow requests from your local frontend
app.use(bodyParser.json());

app.post('/synthesize', async (req, res) => {
    const { phoneticText } = req.body;

    if (!phoneticText) {
        return res.status(400).send({ error: 'Missing phoneticText parameter.' });
    }

    // Clean and format the phonetic text for SSML.
    // The IPA input must be enclosed in <phoneme> tags and use the 'ipa' alphabet.
    const cleanPhonetics = phoneticText.replace(/[/.]/g, ''); // Remove slashes and dots
    const ssmlText = `<speak><phoneme alphabet="ipa">${cleanPhonetics}</phoneme></speak>`;

    const request = {
        input: { ssml: ssmlText },
        // Use a high-quality Spanish Neural2 voice
        voice: { languageCode: 'es-ES', name: 'es-ES-Neural2-A' }, 
        audioConfig: { audioEncoding: 'MP3' },
    };

    try {
        const [response] = await ttsClient.synthesizeSpeech(request);
        
        // Return the MP3 audio content encoded in base64
        res.status(200).send({
            audioContent: response.audioContent.toString('base64'),
        });

    } catch (error) {
        console.error('TTS API Error:', error);
        res.status(500).send({ error: 'Failed to synthesize speech.' });
    }
});

app.listen(port, () => {
    console.log(`TTS Proxy server listening at http://localhost:${port}`);
});