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

import { MergeStrategy } from '../config/settingsSchema.js';

export type Mergeable =
  | string
  | number
  | boolean
  | null
  | undefined
  | object
  | Mergeable[];

export type MergeableObject = Record<string, Mergeable>;

function isPlainObject(item: unknown): item is MergeableObject {
  return !!item && typeof item === 'object' && !Array.isArray(item);
}

function mergeRecursively(
  target: MergeableObject,
  source: MergeableObject,
  getMergeStrategyForPath: (path: string[]) => MergeStrategy | undefined,
  path: string[] = [],
) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    const newPath = [...path, key];
    const srcValue = source[key];
    const objValue = target[key];
    const mergeStrategy = getMergeStrategyForPath(newPath);

    if (mergeStrategy === MergeStrategy.SHALLOW_MERGE && objValue && srcValue) {
      const obj1 =
        typeof objValue === 'object' && objValue !== null ? objValue : {};
      const obj2 =
        typeof srcValue === 'object' && srcValue !== null ? srcValue : {};
      target[key] = { ...obj1, ...obj2 };
      continue;
    }

    if (Array.isArray(objValue)) {
      const srcArray = Array.isArray(srcValue) ? srcValue : [srcValue];
      if (mergeStrategy === MergeStrategy.CONCAT) {
        target[key] = objValue.concat(srcArray);
        continue;
      }
      if (mergeStrategy === MergeStrategy.UNION) {
        target[key] = [...new Set(objValue.concat(srcArray))];
        continue;
      }
    }

    if (isPlainObject(objValue) && isPlainObject(srcValue)) {
      mergeRecursively(objValue, srcValue, getMergeStrategyForPath, newPath);
    } else if (isPlainObject(srcValue)) {
      target[key] = {};
      mergeRecursively(
        target[key] as MergeableObject,
        srcValue,
        getMergeStrategyForPath,
        newPath,
      );
    } else {
      target[key] = srcValue;
    }
  }
  return target;
}

export function customDeepMerge(
  getMergeStrategyForPath: (path: string[]) => MergeStrategy | undefined,
  ...sources: MergeableObject[]
): MergeableObject {
  const result: MergeableObject = {};

  for (const source of sources) {
    if (source) {
      mergeRecursively(result, source, getMergeStrategyForPath);
    }
  }

  return result;
}
