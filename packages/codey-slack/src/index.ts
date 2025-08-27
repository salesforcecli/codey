/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { WITTY_LOADING_PHRASES } from './witty-phrases';
import { PhraseCycler } from './phrase-cycler';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const loadingEmoji = 'loading';
const errorEmoji = 'x';

function getRandomLoadingPhrase(): string {
  return `:${loadingEmoji}: ${
    WITTY_LOADING_PHRASES[
      Math.floor(Math.random() * WITTY_LOADING_PHRASES.length)
    ]
  }`;
}

async function main(): Promise<void> {
  console.log('🚀 Starting codey-slack app...');

  // Required for Socket Mode
  const botToken = requireEnv('SLACK_BOT_TOKEN');
  const appToken = requireEnv('SLACK_APP_TOKEN');

  console.log('✅ Environment variables loaded');
  console.log(`Bot token: ${botToken.substring(0, 12)}...`);
  console.log(`App token: ${appToken.substring(0, 12)}...`);

  // Dynamic import to handle module resolution issues
  const slackBolt = await import('@slack/bolt');
  const { App, LogLevel } = slackBolt;

  console.log('✅ Slack Bolt imported successfully');

  const logLevel =
    (process.env
      .SLACK_LOG_LEVEL as unknown as (typeof LogLevel)[keyof typeof LogLevel]) ??
    LogLevel.DEBUG; // Changed to DEBUG for better troubleshooting

  // @ts-expect-error for now
  console.log(`📝 Log level set to: ${LogLevel[logLevel]}`);

  const app = new App({
    token: botToken,
    appToken,
    socketMode: true,
    logLevel,
  });

  console.log('✅ Slack App instance created');

  // Add error handler
  app.error(async (error) => {
    console.error('❌ Slack app error:', error);
  });

  // Mentions-only POC configuration

  // Minimal hosted integration for POC
  const { HostedClient, HostedError } = await import('./hosted-client');
  const { formatSlackMessage } = await import('./markdown-converter');
  const hostedBaseUrl = requireEnv('CODEY_HOSTED_BASE_URL');
  const hostedToken = requireEnv('CODEY_HOSTED_TOKEN');
  const hosted = new HostedClient(hostedBaseUrl, hostedToken);

  // Default workspace root required for POC
  const defaultWorkspaceRoot = requireEnv('CODEY_DEFAULT_WORKSPACE_ROOT');

  // Import session store and thread history utilities
  const sessionStore = await import('./session-store');
  const threadHistory = await import('./thread-history');

  async function ensureThreadSession(
    teamId: string,
    channelId: string,
    threadTs?: string,
  ): Promise<{
    sessionId: string;
    conversationKey: string;
    isNewSession: boolean;
  }> {
    const conversationKey = sessionStore.getKey(teamId, channelId, threadTs);
    const existing = sessionStore.get(conversationKey);

    if (existing) {
      return {
        sessionId: existing.sessionId,
        conversationKey,
        isNewSession: false,
      };
    }

    // Create new session for this thread
    const { sessionId } = await hosted.createSession(defaultWorkspaceRoot);
    sessionStore.set(conversationKey, {
      sessionId,
      workspaceRoot: defaultWorkspaceRoot,
      threadMessages: [],
      isInitialized: false,
    });

    return { sessionId, conversationKey, isNewSession: true };
  }

  // Mentions: use thread-aware sessions, reply in thread
  app.event('app_mention', async ({ event, say, client, context, logger }) => {
    const channel = (event as unknown as { channel: string }).channel;
    const timestamp = (event as unknown as { ts: string }).ts;
    const userId = (event as unknown as { user: string }).user;
    let loadingMsgTs: string | undefined;
    let phraseCycler: PhraseCycler | undefined;

    try {
      const teamId: string =
        (context as unknown as { teamId?: string }).teamId ?? 'default';
      const threadTs: string | undefined =
        (event as unknown as { thread_ts?: string; ts?: string }).thread_ts ??
        (event as unknown as { ts?: string }).ts;
      const rawText: string =
        (event as unknown as { text?: string }).text ?? '';
      const message = rawText.replace(/<@[^>]+>\s*/, '').trim();

      if (!message) {
        await say({ thread_ts: threadTs, text: 'Please include a message.' });
        return;
      }

      // Send initial loading message
      const loadingMsg = await say({
        thread_ts: threadTs,
        text: getRandomLoadingPhrase(),
      });
      loadingMsgTs = (loadingMsg as { ts?: string }).ts;

      // Start cycling through loading phrases every 10 seconds
      phraseCycler = new PhraseCycler({
        intervalMs: 10000, // 10 seconds
        onPhraseChange: async (phrase: string) => {
          if (loadingMsgTs) {
            try {
              await client.chat.update({
                channel,
                ts: loadingMsgTs,
                text: `:${loadingEmoji}: ${phrase}`,
              });
            } catch (err) {
              // Log but don't fail the request if we can't update the loading message
              logger?.warn?.({ err }, 'Failed to update loading phrase');
            }
          }
        },
      });
      phraseCycler.start();

      const { sessionId, conversationKey, isNewSession } =
        await ensureThreadSession(teamId, channel, threadTs);

      // Handle thread history initialization and updates
      const mapping = sessionStore.get(conversationKey);
      if (!mapping) {
        throw new Error('Session mapping not found after creation');
      }

      // If this is a new session, send initial instructions
      if (isNewSession || !mapping.isInitialized) {
        const initialInstructions = threadHistory.getInitialInstructions();
        await hosted.sendThreadHistoryMessage(
          sessionId,
          defaultWorkspaceRoot,
          initialInstructions,
        );
        sessionStore.markInitialized(conversationKey);
      }

      // Fetch and send thread history update
      if (threadTs) {
        const slackMessages = await threadHistory.fetchSlackThreadHistory(
          // @ts-expect-error for now
          client,
          channel,
          threadTs,
          mapping.lastCodeyResponseTs,
        );

        // Convert Slack messages to our format and add to store
        for (const slackMsg of slackMessages) {
          const threadMessage = {
            text: slackMsg.text,
            timestamp: slackMsg.ts,
            userId: slackMsg.user,
          };
          sessionStore.addMessage(conversationKey, threadMessage);
        }

        // Send thread history update if we have new messages
        if (slackMessages.length > 0) {
          const updatedMapping = sessionStore.get(conversationKey)!;
          const historyUpdate = threadHistory.formatThreadHistoryForAPI(
            updatedMapping.threadMessages,
          );
          await hosted.sendThreadHistoryMessage(
            sessionId,
            defaultWorkspaceRoot,
            historyUpdate,
          );
        }
      }

      // Add the current user message to our store
      sessionStore.addMessage(conversationKey, {
        text: message,
        timestamp,
        userId,
      });

      try {
        const result = await hosted.sendMessage(
          sessionId,
          defaultWorkspaceRoot,
          message,
        );

        // Stop the phrase cycling since we have the response
        phraseCycler?.stop();

        // Update the loading message with the actual response
        const formattedMessage = formatSlackMessage(result.response);
        const updatePayload =
          typeof formattedMessage === 'string'
            ? { text: formattedMessage }
            : formattedMessage;

        await client.chat.update({
          channel,
          ts: loadingMsgTs!,
          ...updatePayload,
        });

        // Track when Codey responded for future thread history filtering
        if (loadingMsgTs) {
          sessionStore.updateLastCodeyResponse(conversationKey, loadingMsgTs);
        }
      } catch (err) {
        if (err instanceof HostedError && err.status === 404) {
          // Recreate session and retry once
          const recreated = await hosted.createSession(defaultWorkspaceRoot);
          sessionStore.set(conversationKey, {
            sessionId: recreated.sessionId,
            workspaceRoot: defaultWorkspaceRoot,
            threadMessages: mapping.threadMessages, // Preserve existing messages
            lastCodeyResponseTs: mapping.lastCodeyResponseTs,
            isInitialized: mapping.isInitialized,
          });

          const result = await hosted.sendMessage(
            recreated.sessionId,
            defaultWorkspaceRoot,
            message,
          );

          // Stop the phrase cycling since we have the response
          phraseCycler?.stop();

          // Update the loading message with the actual response
          const formattedMessage = formatSlackMessage(result.response);
          const updatePayload =
            typeof formattedMessage === 'string'
              ? { text: formattedMessage }
              : formattedMessage;

          await client.chat.update({
            channel,
            ts: loadingMsgTs!,
            ...updatePayload,
          });

          // Track when Codey responded for future thread history filtering
          if (loadingMsgTs) {
            sessionStore.updateLastCodeyResponse(conversationKey, loadingMsgTs);
          }
          return;
        }
        if (err instanceof HostedError && err.status === 401) {
          // Stop the phrase cycling since we have an error
          phraseCycler?.stop();

          await client.reactions.add({
            channel,
            timestamp,
            name: 'x',
          });

          // Update the loading message with error
          await client.chat.update({
            channel,
            ts: loadingMsgTs!,
            text: 'Hosted configuration/token appears invalid (401).',
          });
          return;
        }
        throw err;
      }
    } catch (err) {
      console.error('❌ Failed to handle app_mention:', err);
      logger?.error?.({ err }, 'Failed to handle app_mention');

      // Stop the phrase cycling since we have an error
      phraseCycler?.stop();

      // Add error reaction and update message
      try {
        await client.reactions.add({
          channel,
          timestamp,
          name: errorEmoji,
        });

        // Update the loading message with error if we have the timestamp
        if (loadingMsgTs) {
          await client.chat.update({
            channel,
            ts: loadingMsgTs,
            text: 'Request failed; please try again.',
          });
        } else {
          await say('Request failed; please try again.');
        }
      } catch {
        // If updating fails, fall back to posting a new message
        await say('Request failed; please try again.');
      }
    }
  });

  console.log('✅ Event handlers registered');

  const port = Number(process.env.PORT ?? 3001);

  console.log(`🔌 Starting app on port ${port}...`);
  await app.start(port);

  console.log(`⚡️ codey-slack running (Socket Mode) on port ${port}`);
  console.log('🎯 Ready to receive events!');
  console.log('');
  console.log('Test instructions:');
  console.log(
    '1. In Slack, mention your bot in any channel/DM: @YourBotName hello',
  );
  console.log('');
}

main().catch((err) => {
  console.error('💥 Fatal startup error:', err);
  process.exit(1);
});
