# Fake AGI

Fake AGI is now a real multi-agent Ollama workflow built with Node.js.

## What it does

- stores user-defined facts in JSON memory
- injects memory into every agent prompt
- runs three real agents with separate system prompts:
  - thinker
  - critic
  - finalizer
- keeps improving weak answers in the background while the user is offline
- delivers improved answers later through `/updates`

## Architecture

```text
server.js
  -> core/brain.js
      -> core/memory.js
      -> core/thinker.js
      -> core/critic.js
      -> core/finalizer.js
      -> core/taskManager.js
      -> core/context.js
      -> core/ai.js
```

## Memory behavior

The system extracts explicit memory from user input such as:

- `apple = banana`
- `remember that my favorite color is green`

Stored memory lives in `memory/longterm.json` and is injected into every agent prompt. Memory is treated as authoritative for that user session, even if it conflicts with real-world facts.

## Background improvement behavior

- live chat returns an immediate multi-agent answer
- if confidence or score is low, the task is added to `memory/dolist.json`
- when the user is idle, the background loop re-runs the multi-agent pipeline
- if the answer gets better, the system stores an update
- the frontend polls `/updates` and shows the improved answer later

## Setup

1. Install dependencies

```bash
npm install
```

2. Create a local `.env` file from the example

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Edit `.env` and point it at Ollama or your ngrok tunnel

```env
OLLAMA_URL=https://your-ngrok-url.ngrok-free.app/api/chat
OLLAMA_MODEL=qwen2.5
PORT=3000
```

4. Start the app

```bash
npm start
```

5. Open the UI

```text
http://localhost:3000
```

## API

### `POST /chat`

```json
{
  "message": "apple = banana"
}
```

Response:

```json
{
  "reply": "Understood. I will treat apple as banana for you.",
  "confidence": 94,
  "score": 93,
  "queuedTaskId": null,
  "storedFacts": [
    {
      "key": "apple",
      "value": "banana",
      "source": "regex"
    }
  ]
}
```

### `GET /updates?since=0`

Returns improved offline answers that were generated after the given timestamp.

## Important files

- `core/brain.js`: central orchestration
- `core/memory.js`: extraction, storage, prompt memory injection, updates
- `core/context.js`: full prompt context builder
- `core/thinker.js`: first-pass answer generation
- `core/critic.js`: structured critique and improvement scoring
- `core/finalizer.js`: final polished answer
- `core/scheduler.js`: offline loop control
- `core/taskManager.js`: queued background task persistence
