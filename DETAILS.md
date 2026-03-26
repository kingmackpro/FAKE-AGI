# Fake AGI Details

This file is the full readable reference for the current system.

## What the system is

Fake AGI is a Node.js + Ollama multi-agent AI system with:

- a web chat frontend
- a fast-response mode for active users
- a deep background-thinking mode for offline improvement
- visible thought streaming
- agent logs
- JSON-based memory
- a task queue for background work
- task cancellation, pause, resume, and progress control through normal chat

## Main behavior

The system supports:

- normal chat
- memory storage from user-defined facts
- deep reasoning tasks only when needed
- visible background work
- improved answers later through updates
- selective task control without resetting the entire system
- full reset when requested

## Runtime flow

### 1. User sends a message

The frontend sends the message to `POST /chat`.

The backend then:

1. checks whether the message is a control message
2. checks whether the message is a real deep-reasoning problem
3. runs fast mode for the immediate reply
4. optionally queues a deep task
5. logs visible thoughts and agent activity

### 2. Fast mode

Fast mode is used while the user is active.

Fast mode does:

- memory extraction and storage
- fast response generation
- classifier logging
- no heavy multi-agent loop

Fast mode returns a quick natural response.

### 3. Deep mode

Deep mode runs only when:

- the user has been inactive long enough
- there is a queued task
- the task is not paused

Deep mode uses the real multi-agent chain:

1. thinker
2. critic
3. finalizer

Deep mode logs:

- iteration starts
- thinker output
- critic output
- finalizer output
- improvement decisions
- completion or failure

## Modes

### Fast mode

Purpose:

- quick response for active chat

Characteristics:

- low-latency reply
- uses stored memory
- does not do the full deep loop

### Deep mode

Purpose:

- improve meaningful tasks while the user is away

Characteristics:

- task-based
- multi-agent
- iterative
- visible in thought stream
- can be paused, resumed, cancelled

## Problem classifier

The classifier decides if a message should become a background task.

It returns only:

- `YES`
- `NO`

It avoids queueing:

- greetings
- small talk
- simple acknowledgements
- memory statements like `apple = banana`

It queues only meaningful reasoning tasks.

Main file:

- `core/classifier.js`

## Multi-agent system

The system uses real role separation.

### Thinker

Purpose:

- create the first deep draft

Main file:

- `core/thinker.js`

### Critic

Purpose:

- score the draft
- detect flaws
- propose an improved answer
- decide if more work should continue

Main file:

- `core/critic.js`

### Finalizer

Purpose:

- turn the best draft into a polished user-facing answer

Main file:

- `core/finalizer.js`

## Context building

Every agent gets structured context through the context builder.

Included in prompt context:

- core system instructions
- stored memory
- current task state
- previous best answer
- critique notes when available
- current user input

Main file:

- `core/context.js`

## Memory system

The memory system is JSON-based.

### Long-term memory file

File:

- `memory/longterm.json`

Contains:

- `facts`
- `interactions`
- `updates`

### Facts

Facts are extracted from user input such as:

- `apple = banana`
- `remember that my favorite color is green`

Facts are stored and later injected into prompts.

The system treats stored memory as authoritative for the user.

### Interactions

Interactions store previous chat results, including:

- user input
- answer
- confidence
- task id if present
- mode

### Updates

Updates are generated when deep mode finds a better answer later.

These are returned by:

- `GET /updates`

Main file:

- `core/memory.js`

## Thoughts system

The thoughts system stores visible internal activity.

File:

- `memory/thoughts.json`

Each entry may contain:

- `id`
- `taskId`
- `mode`
- `agent`
- `text`
- `score`
- `confidence`
- `createdAt`

Thoughts are returned by:

- `GET /thoughts`

Main file:

- `core/thoughts.js`

## Task queue system

Background tasks are stored using:

- `memory/dolist.json`
- `problems/*.json`

### Queue file

`memory/dolist.json` contains lightweight queue entries.

### Problem files

Each problem task has its own file in `problems/`.

A task can store:

- `id`
- `userInput`
- `status`
- `attempts`
- `stagnantIterations`
- `maxIterations`
- `initialAnswer`
- `initialConfidence`
- `initialScore`
- `bestAnswer`
- `bestConfidence`
- `bestScore`
- `history`
- timestamps

Main file:

- `core/taskManager.js`

## Task status behavior

Task statuses may include:

- `queued`
- `running`
- `paused`
- `completed`
- `failed`

Paused tasks stay in the queue but are skipped by deep mode until resumed.

## Task control through chat

The user can control tasks using natural language.

Supported behaviors include:

- cancel task
- stop task
- forget that problem
- pause task
- resume task
- ask for progress

### Cancel behavior

Examples:

- `stop working on that`
- `forget that problem`
- `cancel that task`
- `i don't need that anymore`

When cancelled, the system removes only that task from:

- `memory/dolist.json`
- `problems/`
- task-specific updates
- task-specific interactions
- task-specific thoughts

It does not clear full long-term memory.

### Pause behavior

Examples:

- `pause that`
- `pause the task`

The task stays stored but will not run in deep mode.

### Resume behavior

Examples:

- `resume that`
- `continue that`

The paused task is restored to `queued`.

### Progress behavior

Examples:

- `what did you do so far`
- `how far did you get`
- `progress`

The system returns:

- `current_best`
- `score`
- `iterations`

Main logic file:

- `core/brain.js`

## Background scheduler

The scheduler runs deep mode only when the user is inactive.

Main file:

- `core/scheduler.js`

Behavior:

- tracks whether user is active
- prevents overlapping deep cycles
- runs background cycle only when appropriate

## Server API

Main file:

- `server.js`

### `POST /chat`

Purpose:

- send a normal user message
- get an immediate response
- optionally trigger deep background work

### `GET /updates`

Purpose:

- fetch improved answers generated later by deep mode

### `GET /thoughts`

Purpose:

- fetch visible thought stream entries

### `POST /reset`

Purpose:

- clear full system state

This reset clears:

- `memory/longterm.json`
- `memory/dolist.json`
- `memory/thoughts.json`
- all files in `problems/`

Main reset file:

- `core/reset.js`

## Frontend

Main file:

- `public/index.html`

### Current layout

The UI is a dashboard with:

- main chat panel
- AI Thoughts panel
- Agent Logs panel

### Scrolling behavior

The frontend uses a fixed full-height layout.

Behavior:

- page body does not scroll
- chat messages scroll independently
- AI Thoughts scroll independently
- Agent Logs scroll independently
- chat input stays fixed at the bottom of the chat panel

### Frontend features

- send message from input
- animated thinking bubble
- background update display
- thought stream polling
- agent log filtering
- memory reset button
- smooth panel scrolling

### Reset button

The `Clear Memory` button calls:

- `POST /reset`

After reset, the UI clears:

- chat messages
- thought stream panel
- agent logs panel
- update timestamps

## Important files

### Core backend

- `server.js`
- `core/brain.js`
- `core/ai.js`
- `core/context.js`
- `core/classifier.js`
- `core/fastResponder.js`
- `core/thinker.js`
- `core/critic.js`
- `core/finalizer.js`
- `core/scheduler.js`
- `core/taskManager.js`
- `core/memory.js`
- `core/thoughts.js`
- `core/reset.js`
- `core/store.js`

### Frontend

- `public/index.html`

### Data files

- `memory/longterm.json`
- `memory/dolist.json`
- `memory/thoughts.json`
- `problems/*.json`

## Environment configuration

Environment is loaded from `.env`.

Supported values:

- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `PORT`

Example file:

- `.env.example`

## Ollama integration

Ollama is used through the chat API layer.

Main file:

- `core/ai.js`

Capabilities:

- plain text chat responses
- JSON-formatted responses
- model selection from environment
- timeout and request size controls

## Deep task improvement logic

For each deep task, the system tries to improve:

- answer quality
- score
- confidence

Stopping conditions include:

- confidence target reached
- score target reached
- max iterations reached
- stagnation reached
- critic says stop
- repeated failure

## What currently works

- chat replies
- memory extraction
- memory injection into prompts
- fast mode
- deep mode
- visible thought stream
- visible agent logs
- deep task queue
- background updates
- classifier-based task gating
- task cancel through chat
- task pause through chat
- task resume through chat
- task progress query through chat
- selective task cleanup
- full memory reset
- modern dashboard UI
- independent panel scrolling
- `.env` config loading

## Example user actions

### Normal chat

User:

`hey`

Expected behavior:

- fast reply only
- no deep task queued

### Memory definition

User:

`apple = banana`

Expected behavior:

- fact stored
- future prompts can use it
- no unnecessary deep task

### Deep reasoning request

User:

`compare two database designs and tell me which one scales better`

Expected behavior:

- fast reply now
- deep task may be queued
- later improved answer may arrive

### Cancel task

User:

`stop working on that`

Expected behavior:

- latest related active task removed
- other tasks remain

### Pause task

User:

`pause that`

Expected behavior:

- task stays stored
- deep mode stops running it

### Resume task

User:

`resume that`

Expected behavior:

- paused task becomes active again

### Progress query

User:

`what did you do so far`

Expected behavior:

- progress summary for active task

## Notes

This file is intended to be the project-wide readable reference for:

- what exists
- how it works
- what files control what behavior
- what the user can do
- what the UI shows

If the system changes later, this file should be updated alongside the code.
