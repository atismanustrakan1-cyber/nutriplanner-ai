# AI Chat

The chat uses the **backend server** (not the simple file server) so your API key stays on the server.

## Run the app with chat

1. Stop any server already using port 8000 (e.g. `python3 -m http.server 8000`).
2. From the repo root:
   ```bash
   cd backend
   pip3 install -r requirements.txt
   python3 -m uvicorn server:app --port 8000
   ```
3. Open **http://localhost:8000** in your browser.
4. Click **Chat** in the nav or go to **http://localhost:8000/chat.html**.

Your OpenRouter API key is read from `backend/.env` (file is in `.gitignore`). To change it, edit `OPENROUTER_API_KEY` in `backend/.env`.
