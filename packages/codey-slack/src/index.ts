/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

//

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
  const hostedBaseUrl = requireEnv('CODEY_HOSTED_BASE_URL');
  const hostedToken = requireEnv('CODEY_HOSTED_TOKEN');
  const hosted = new HostedClient(hostedBaseUrl, hostedToken);

  // Default workspace root required for POC
  const defaultWorkspaceRoot = requireEnv('CODEY_DEFAULT_WORKSPACE_ROOT');

  // Single session per Slack workspace (team)
  const teamSessions = new Map<string, { sessionId: string }>();

  async function ensureTeamSession(teamId: string): Promise<string> {
    const existing = teamSessions.get(teamId);
    if (existing) return existing.sessionId;
    const { sessionId } = await hosted.createSession(defaultWorkspaceRoot);
    teamSessions.set(teamId, { sessionId });
    return sessionId;
  }

  // Mentions: use single session per team, reply in thread
  app.event('app_mention', async ({ event, say, client, context, logger }) => {
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

      // Add reaction to show we're processing
      const channel = (event as unknown as { channel: string }).channel;
      const timestamp = (event as unknown as { ts: string }).ts;
      await client.reactions.add({
        channel,
        timestamp,
        name: 'hourglass_flowing_sand',
      });

      const sessionId = await ensureTeamSession(teamId);

      try {
        const result = await hosted.sendMessage(
          sessionId,
          defaultWorkspaceRoot,
          message,
        );

        // Remove processing reaction and add success reaction
        await client.reactions.remove({
          channel,
          timestamp,
          name: 'hourglass_flowing_sand',
        });

        await say({ thread_ts: threadTs, text: result.response });
      } catch (err) {
        if (err instanceof HostedError && err.status === 404) {
          // Recreate session and retry once
          const recreated = await hosted.createSession(defaultWorkspaceRoot);
          teamSessions.set(teamId, { sessionId: recreated.sessionId });
          const result = await hosted.sendMessage(
            recreated.sessionId,
            defaultWorkspaceRoot,
            message,
          );

          // Remove processing reaction and add success reaction
          await client.reactions.remove({
            channel,
            timestamp,
            name: 'hourglass_flowing_sand',
          });

          await say({ thread_ts: threadTs, text: result.response });
          return;
        }
        if (err instanceof HostedError && err.status === 401) {
          // Remove processing reaction and add error reaction
          await client.reactions.remove({
            channel,
            timestamp,
            name: 'hourglass_flowing_sand',
          });
          await client.reactions.add({
            channel,
            timestamp,
            name: 'x',
          });

          await say({
            thread_ts: threadTs,
            text: 'Hosted configuration/token appears invalid (401).',
          });
          return;
        }
        throw err;
      }
    } catch (err) {
      console.error('❌ Failed to handle app_mention:', err);
      logger?.error?.({ err }, 'Failed to handle app_mention');

      // Remove processing reaction and add error reaction
      try {
        const channel = (event as unknown as { channel: string }).channel;
        const timestamp = (event as unknown as { ts: string }).ts;
        await client.reactions.remove({
          channel,
          timestamp,
          name: 'hourglass_flowing_sand',
        });
        await client.reactions.add({
          channel,
          timestamp,
          name: 'x',
        });
      } catch {
        // Ignore reaction errors in error handler
      }

      await say('Request failed; please try again.');
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
