# Slack - Local Codey Architecture

This is theoretical architecture for a Slack integration with local `codey` agent.

This is not the current implementation of the codey-slack package.

## Overview

This architecture enables Slack users to execute `codey` commands on their local machines through slash commands and @mentions, while maintaining security and privacy. The solution consists of three main components: a Slack bot that handles user interactions, a production service that routes commands, and local agents running on user machines that execute the actual CLI operations.

The key innovation is that sensitive code and data never leave the user's local environment. When a user types `/codey analyze my-project/` in Slack, the command is routed through our production service to their specific local agent, which then executes the `codey` against their local files and returns the results back to Slack. This provides the convenience of Slack-based collaboration while preserving the security of local execution.

The architecture supports multiple users with their own local agents, handles offline scenarios gracefully through command queuing, and can scale to enterprise deployments where workspace admins install the Slack app once and individual developers opt-in by running local agents on their development machines.

## Why This Architecture?

Users could simply run `codey` directly in their terminals, but this Slack integration provides significant workflow benefits while maintaining local file access. The key advantage is enabling **collaborative AI assistance** - team members can share `codey` insights directly in Slack channels, ask questions about code in context of discussions, and get AI help without leaving their communication flow.

More importantly, this architecture solves a fundamental limitation of hosted AI services: **local file access**. If we built a purely hosted Slack integration (where `codey` ran entirely in the cloud), users would need to upload their entire codebase to our servers for analysis. This creates security concerns, privacy issues, and practical problems with large repositories, private dependencies, and local development environments.

By keeping `codey` execution local while routing commands through Slack, users get the best of both worlds: the convenience and collaboration of Slack-based AI assistance, combined with full access to their local project files, environment variables, git history, and development tools. The AI can analyze their actual working code without any data leaving their machine.

## Setup Process

### For Slack Workspace Admins (One-time setup)

1. **Install the Codey Slack App**
   - Go to the Slack App Directory or use a custom installation link
   - Click "Install to Workspace"
   - Review and approve the requested permissions:
     - `app_mentions:read` - Respond when @mentioned
     - `chat:write` - Send messages and replies
     - `channels:history` - Read message context for thread analysis
   - The app is now available to all workspace members

2. **Configure App Settings (Optional)**
   - Set up any workspace-level preferences
   - Configure channel restrictions if needed
   - Add the bot to relevant channels where teams will use it

### For Workspace Members (Per-user setup)

1. **Verify Slack App Access**
   - Type `/codey` in any channel to see if the command appears
   - Try `@Codey hello` to test basic connectivity
   - If the app isn't available, ask your workspace admin to install it

2. **Install the Local Agent**
   ```bash
   # Install the codey CLI tool
   npm install -g @saleforce/codey
   ```

3. **Start the Local Agent**
   ```bash
   # Connect to the service
   codey daemon start
   ```
   This will:
   - Generate a unique agent token for your machine
   - Establish the connection between your Slack user and local agent
   - Start the agent in the background (optional)

4. **Test the Integration**
   ```bash
   # In Slack, try:
   /codey status
   # Should show: "Agent: Connected ✅"

   /codey help
   # Should list available commands

   /codey analyze src/
   # Should execute on your local machine and return results
   ```

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│     Slack       │    │  Production Service │    │  Local Agents   │
│   Workspace     │    │   (Your Backend)    │    │ (User Machines) │
│                 │    │                     │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────────┐ │    │ ┌─────────────┐ │
│ │ User types: │ │    │ │ Agent Registry: │ │    │ │   Agent A   │ │
│ │/codey help  │ │◄──►│ │ U1234→agent_a   │ │◄──►│ │ (Alice's    │ │
│ └─────────────┘ │    │ │ U5678→agent_b   │ │    │ │  MacBook)   │ │
│                 │    │ │ U9012→agent_c   │ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ └─────────────────┘ │    │                 │
│ │ Bot responds│ │    │                     │    │ ┌─────────────┐ │
│ │ in thread   │ │    │ ┌─────────────────┐ │    │ │   Agent B   │ │
│ └─────────────┘ │    │ │ Command Queue:  │ │    │ │ (Bob's      │ │
│                 │    │ │ U1234: [cmd1]   │ │◄──►│ │  Windows)   │ │
│ ┌─────────────┐ │    │ │ U5678: [cmd2,3] │ │    │ └─────────────┘ │
│ │ @mentions   │ │    │ │ U9012: []       │ │    │                 │
│ │ work too    │ │    │ └─────────────────┘ │    │ ┌─────────────┐ │
│ └─────────────┘ │    │                     │    │ │   Agent C   │ │
└─────────────────┘    │ ┌─────────────────┐ │    │ │ (Carol's    │ │
                       │ │ Slack Bot API:  │ │◄──►│ │  Linux)     │ │
                       │ │ • Socket Mode   │ │    │ └─────────────┘ │
                       │ │ • Responds fast │ │    └─────────────────┘
                       │ │ • Thread aware  │ │
                       │ └─────────────────┘ │
                       └─────────────────────┘
```

```
┌─────────────┐
│   Slack     │
│ Workspace   │
└──────┬──────┘
       │ 1. User: /codey analyze file.js
       ▼
┌─────────────┐
│ Slack Bot   │ ◄─── codey-slack package
│ (Socket     │
│  Mode)      │
└──────┬──────┘
       │ 2. POST /api/commands
       ▼
┌─────────────┐
│ Production  │ ◄─── Your backend service
│ Service     │      (Express/Next.js/etc)
│             │
│ Routes to:  │
│ U1234567 →  │
│ agent_abc   │
└──────┬──────┘
       │ 3. Queue command for user U1234567
       ▼
┌─────────────┐
│ Command     │ ◄─── Database/Redis/Queue
│ Storage     │
│             │
│ U1234567:   │
│ [{cmd1}]    │
└──────┬──────┘
       │ 4. Agent polls: GET /api/commands/pending
       ▼
┌─────────────┐
│ Local Agent │ ◄─── User's machine
│ (Alice's    │      (codey-agent process)
│  MacBook)   │
│             │
│ Executes:   │
│ codey CLI   │
└──────┬──────┘
       │ 5. POST /api/commands/{id}/result
       ▼
┌─────────────┐
│ Production  │
│ Service     │
│             │
│ Sends result│
│ to Slack    │
└──────┬──────┘
       │ 6. Bot posts result in thread
       ▼
┌─────────────┐
│   Slack     │
│ (Thread     │
│  Reply)     │
└─────────────┘
```
