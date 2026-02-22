Thank you for providing your API key. Please be aware that this key is sensitive information and I will not store it or embed it directly into any files.

For **Google Cloud Text-to-Speech (TTS)**, the authentication method is typically different. It usually requires a **service account key file (JSON format)**, which is then referenced by the `GOOGLE_APPLICATION_CREDENTIALS` environment variable. The key you provided (`AIzaSyC5MnPE8i8iStXih2775YQMspW8SPujIJc`) appears to be an API key for the Google Gemini API (aistudio.google.com), not the standard authentication for Google Cloud TTS.

To use Google Cloud TTS with the `generate_video.py` script, please follow these steps to set up the correct credentials:

1.  **Ensure Google Cloud Text-to-Speech API is enabled:**
    *   Go to the Google Cloud Console: `https://console.cloud.google.com/`
    *   Select your project.
    *   Navigate to 'APIs & Services' > 'Enabled APIs & Services'.
    *   Search for 'Cloud Text-to-Speech API' and enable it if it's not already.

2.  **Create a Service Account Key file (JSON):**
    *   In the Google Cloud Console, go to 'IAM & Admin' > 'Service Accounts'.
    *   Click '+ CREATE SERVICE ACCOUNT'.
    *   Follow the prompts to create a service account. When asked, grant it the 'Cloud Text-to-Speech User' role (`roles/cloudtts.user`).
    *   After creating the service account, click on its email address in the list.
    *   Go to the 'KEYS' tab, click 'ADD KEY' > 'Create new key', and select 'JSON'.
    *   Download this JSON file to a secure location on your machine. This is your service account key.

3.  **Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable:**
    *   Before running the `generate_video.py` script, you need to tell your system where to find this service account key file.
    *   Open your terminal and run the following command (replace `/path/to/your/service-account-key.json` with the actual path to the JSON file you downloaded):
        ```bash
        export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
        ```
    *   You might want to add this line to your shell's profile file (e.g., `~/.bashrc`, `~/.zshrc`) to make it permanent for future sessions.

Once you have set up the `GOOGLE_APPLICATION_CREDENTIALS` environment variable, you can then run the video generation script using Google Cloud TTS with the following command:

```bash
cd videos
source .venv/bin/activate
python3 generate_video.py --article se-remettre-dune-perte --use-google-tts
```

Let me know once you have configured the service account credentials, and I can then proceed with generating the audio using Google Cloud TTS.
