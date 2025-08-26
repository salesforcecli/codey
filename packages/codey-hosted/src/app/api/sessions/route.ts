/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest } from 'next/server';
import { createSession } from '../../lib/session';
import {
  validateWorkspaceRoot,
  createErrorResponse,
  createSuccessResponse,
} from '../../lib/utils';
import { logger } from '../../lib/logger';

export async function POST(request: NextRequest) {
  const requestId = `req_${Math.random().toString(36).slice(2, 11)}`;
  const startTime = Date.now();

  try {
    const body = await request.json();
    const workspaceRoot = validateWorkspaceRoot(body);
    const model = body.model as string | undefined;

    if (!workspaceRoot) {
      return createErrorResponse('workspaceRoot is required', 400, {
        requestId,
        workspaceRoot: body.workspaceRoot,
        model,
      });
    }

    logger.info(
      {
        requestId,
        workspaceRoot,
        model,
      },
      'Creating session',
    );

    const { id } = await createSession(workspaceRoot, model);

    logger.info(
      {
        requestId,
        sessionId: id,
        workspaceRoot,
        model,
        duration: Date.now() - startTime,
      },
      'Session created',
    );

    return createSuccessResponse({ sessionId: id }, 201, {
      Location: `/api/sessions/${id}`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      {
        requestId,
        duration,
        err: error, // Pino automatically formats Error objects
      },
      'Error creating session',
    );

    return createErrorResponse('Internal server error', 500, { requestId });
  }
}
