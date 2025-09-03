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

import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    // First, add a timestamp to the log info object
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS A', // Custom timestamp format
    }),
    // Here we define the custom output format
    winston.format.printf((info) => {
      const { level, timestamp, message, ...rest } = info;
      return (
        `[${level.toUpperCase()}] ${timestamp} -- ${message}` +
        `${Object.keys(rest).length > 0 ? `\n${JSON.stringify(rest, null, 2)}` : ''}`
      ); // Only print ...rest if present
    }),
  ),
  transports: [new winston.transports.Console()],
});

export { logger };
