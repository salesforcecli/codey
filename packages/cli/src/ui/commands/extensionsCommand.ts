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

import {
  updateAllUpdatableExtensions,
  type ExtensionUpdateInfo,
  updateExtension,
} from '../../config/extensions/update.js';
import { getErrorMessage } from '../../utils/errors.js';
import { ExtensionUpdateState } from '../state/extensions.js';
import { MessageType } from '../types.js';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';

async function listAction(context: CommandContext) {
  context.ui.addItem(
    {
      type: MessageType.EXTENSIONS_LIST,
    },
    Date.now(),
  );
}

async function updateAction(context: CommandContext, args: string) {
  const updateArgs = args.split(' ').filter((value) => value.length > 0);
  const all = updateArgs.length === 1 && updateArgs[0] === '--all';
  const names = all ? undefined : updateArgs;
  let updateInfos: ExtensionUpdateInfo[] = [];

  if (!all && names?.length === 0) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /extensions update <extension-names>|--all',
      },
      Date.now(),
    );
    return;
  }

  try {
    context.ui.setPendingItem({
      type: MessageType.EXTENSIONS_LIST,
    });
    if (all) {
      updateInfos = await updateAllUpdatableExtensions(
        context.services.config!.getWorkingDir(),
        context.services.config!.getExtensions(),
        context.ui.extensionsUpdateState,
        context.ui.setExtensionsUpdateState,
      );
    } else if (names?.length) {
      const workingDir = context.services.config!.getWorkingDir();
      const extensions = context.services.config!.getExtensions();
      for (const name of names) {
        const extension = extensions.find(
          (extension) => extension.name === name,
        );
        if (!extension) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Extension ${name} not found.`,
            },
            Date.now(),
          );
          continue;
        }
        const updateInfo = await updateExtension(
          extension,
          workingDir,
          context.ui.extensionsUpdateState.get(extension.name) ??
            ExtensionUpdateState.UNKNOWN,
          (updateState) => {
            context.ui.setExtensionsUpdateState((prev) => {
              const newState = new Map(prev);
              newState.set(name, updateState);
              return newState;
            });
          },
        );
        if (updateInfo) updateInfos.push(updateInfo);
      }
    }

    if (updateInfos.length === 0) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: 'No extensions to update.',
        },
        Date.now(),
      );
      return;
    }
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  } finally {
    context.ui.addItem(
      {
        type: MessageType.EXTENSIONS_LIST,
      },
      Date.now(),
    );
    context.ui.setPendingItem(null);
  }
}

const listExtensionsCommand: SlashCommand = {
  name: 'list',
  description: 'List active extensions',
  kind: CommandKind.BUILT_IN,
  action: listAction,
};

const updateExtensionsCommand: SlashCommand = {
  name: 'update',
  description: 'Update extensions. Usage: update <extension-names>|--all',
  kind: CommandKind.BUILT_IN,
  action: updateAction,
};

export const extensionsCommand: SlashCommand = {
  name: 'extensions',
  description: 'Manage extensions',
  kind: CommandKind.BUILT_IN,
  subCommands: [listExtensionsCommand, updateExtensionsCommand],
  action: (context, args) =>
    // Default to list if no subcommand is provided
    listExtensionsCommand.action!(context, args),
};
