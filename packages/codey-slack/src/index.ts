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

  // Hello via app mentions
  app.event('app_mention', async ({ event, say, logger }) => {
    console.log('📢 App mention received:', event);
    try {
      const response = `Hello, <@${event.user}>! I am alive. Time: ${new Date().toISOString()}`;
      await say(response);
      console.log('✅ Response sent:', response);
    } catch (err) {
      console.error('❌ Failed to respond to app_mention:', err);
      logger.error({ err }, 'Failed to respond to app_mention');
    }
  });

  // Optional: Slash command /codey
  app.command('/codey', async ({ ack, respond, body, logger }) => {
    console.log('⚡ Slash command received:', body);
    await ack();
    try {
      const response = `Hello, <@${body.user_id}>! This is codey-slack. Time: ${new Date().toISOString()}`;
      await respond(response);
      console.log('✅ Slash command response sent:', response);
    } catch (err) {
      console.error('❌ Failed to respond to /codey:', err);
      logger.error({ err }, 'Failed to respond to /codey');
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
  console.log('1. In Slack, mention your bot: @YourBotName hello');
  console.log('2. Or use slash command: /codey');
  console.log('');
}

main().catch((err) => {
  console.error('💥 Fatal startup error:', err);
  process.exit(1);
});
