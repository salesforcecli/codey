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
  console.log('🚀 Starting scale-center Slack app...');

  // Required for Socket Mode
  const botToken = requireEnv('SLACK_BOT_TOKEN');
  const appToken = requireEnv('SLACK_APP_TOKEN');

  console.log('✅ Environment variables loaded');
  console.log(`Bot token: ${botToken.substring(0, 12)}...`);
  console.log(`App token: ${appToken.substring(0, 12)}...`);

  // Import Bolt lazily to avoid module resolution issues
  const slackBolt = await import('@slack/bolt');
  const { App, LogLevel } = slackBolt;

  const logLevel =
    (process.env
      .SLACK_LOG_LEVEL as unknown as (typeof LogLevel)[keyof typeof LogLevel]) ??
    LogLevel.INFO;
  // @ts-expect-error printing enum key for readability
  console.log(`📝 Log level: ${LogLevel[logLevel]}`);

  // Socket Mode app (no public URL required)
  const app = new App({
    token: botToken,
    appToken,
    socketMode: true,
    logLevel,
  });

  app.error(async (error) => {
    console.error('❌ Slack app error:', error);
  });

  // Slash command -> open modal to collect alert text or send directly
  const SLASH_COMMAND = '/scale-center';
  const VIEW_CALLBACK_ID = 'scale_center_alert_view';
  const BLOCK_ID = 'alert_block';
  const ACTION_ID = 'alert_input';

  app.command(SLASH_COMMAND, async ({ command, ack, client, logger }) => {
    await ack();

    // If text is provided with the command, send it directly
    if (command.text && command.text.trim()) {
      try {
        const posted = await client.chat.postMessage({
          channel: command.channel_id,
          text: command.text.trim(),
          unfurl_links: true,
          unfurl_media: true,
        });
        logger?.info?.(
          { ts: (posted as { ts?: string }).ts },
          'Alert message posted directly from slash command',
        );
      } catch (err) {
        logger?.error?.({ err }, 'Failed to post alert from slash command');
      }
      return;
    }

    // If no text provided, post default message
    try {
      const defaultMessage = `:rotating_light:Performance Degradation in Production :rotating_light:

_Source_: \`ProductController.cls\`
_Details_: Average page load time has exceeded threshold.
`;
      const posted = await client.chat.postMessage({
        channel: command.channel_id,
        text: defaultMessage,
        unfurl_links: true,
        unfurl_media: true,
      });
      logger?.info?.(
        { ts: (posted as { ts?: string }).ts },
        'Default alert message posted',
      );
    } catch (err) {
      logger?.error?.({ err }, 'Failed to post default alert message');
    }
  });

  // Handle modal submission and post to current channel
  // Note: Modal submissions don't have direct access to the original channel,
  // so this handler is kept for completeness but the slash command now posts directly
  app.view(VIEW_CALLBACK_ID, async ({ ack, view, client, logger }) => {
    await ack();
    try {
      const values =
        (
          view as {
            state?: {
              values?: Record<string, Record<string, { value?: string }>>;
            };
          }
        ).state?.values ?? {};
      const input = values[BLOCK_ID]?.[ACTION_ID]?.value ?? '';
      const text = input.trim() || 'Scale Center alert triggered.';

      // Since we can't determine the original channel from modal submission,
      // we would need to implement channel tracking if modals are needed
      logger?.info?.(
        'Modal submitted, but posting directly from slash command is preferred',
      );
    } catch (err) {
      console.error('❌ Failed to handle modal submission', err);
    }
  });

  const port = Number(process.env.PORT ?? 3012);
  console.log(`🔌 Starting app (Socket Mode) on port ${port}...`);
  await app.start(port);
  console.log(`⚡️ scale-center app running (Socket Mode) on port ${port}`);
}

main().catch((err) => {
  console.error('💥 Fatal startup error:', err);
  process.exit(1);
});
