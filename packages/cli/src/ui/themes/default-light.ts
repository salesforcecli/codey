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

import { lightTheme, Theme } from './theme.js';

export const DefaultLight: Theme = new Theme(
  'Default Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: lightTheme.Background,
      color: lightTheme.Foreground,
    },
    'hljs-comment': {
      color: lightTheme.Comment,
    },
    'hljs-quote': {
      color: lightTheme.Comment,
    },
    'hljs-variable': {
      color: lightTheme.Foreground,
    },
    'hljs-keyword': {
      color: lightTheme.AccentBlue,
    },
    'hljs-selector-tag': {
      color: lightTheme.AccentBlue,
    },
    'hljs-built_in': {
      color: lightTheme.AccentBlue,
    },
    'hljs-name': {
      color: lightTheme.AccentBlue,
    },
    'hljs-tag': {
      color: lightTheme.AccentBlue,
    },
    'hljs-string': {
      color: lightTheme.AccentRed,
    },
    'hljs-title': {
      color: lightTheme.AccentRed,
    },
    'hljs-section': {
      color: lightTheme.AccentRed,
    },
    'hljs-attribute': {
      color: lightTheme.AccentRed,
    },
    'hljs-literal': {
      color: lightTheme.AccentRed,
    },
    'hljs-template-tag': {
      color: lightTheme.AccentRed,
    },
    'hljs-template-variable': {
      color: lightTheme.AccentRed,
    },
    'hljs-type': {
      color: lightTheme.AccentRed,
    },
    'hljs-addition': {
      color: lightTheme.AccentGreen,
    },
    'hljs-deletion': {
      color: lightTheme.AccentRed,
    },
    'hljs-selector-attr': {
      color: lightTheme.AccentCyan,
    },
    'hljs-selector-pseudo': {
      color: lightTheme.AccentCyan,
    },
    'hljs-meta': {
      color: lightTheme.AccentCyan,
    },
    'hljs-doctag': {
      color: lightTheme.Gray,
    },
    'hljs-attr': {
      color: lightTheme.AccentRed,
    },
    'hljs-symbol': {
      color: lightTheme.AccentCyan,
    },
    'hljs-bullet': {
      color: lightTheme.AccentCyan,
    },
    'hljs-link': {
      color: lightTheme.AccentCyan,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
  },
  lightTheme,
);
