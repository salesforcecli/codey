/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  console.log('🚀 Starting scale-agent Slack app...');

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
    (process.env[
      'SLACK_LOG_LEVEL'
    ] as unknown as (typeof LogLevel)[keyof typeof LogLevel]) ?? LogLevel.INFO;
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
  const SLASH_COMMAND = '/scale-agent';

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
_Details_: High CPU Event detected in \`ProductController.getProducts\` entrypoint
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

  const port = Number(process.env.PORT ?? 3012);
  console.log(`🔌 Starting app (Socket Mode) on port ${port}...`);
  await app.start(port);
  console.log(`⚡️ scale-agent app running (Socket Mode) on port ${port}`);
}

main().catch((err) => {
  console.error('💥 Fatal startup error:', err);
  process.exit(1);
});
