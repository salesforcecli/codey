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

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const ansiLightColors: ColorsTheme = {
  type: 'light',
  Background: 'white',
  Foreground: '#444',
  LightBlue: 'blue',
  AccentBlue: 'blue',
  AccentPurple: 'purple',
  AccentCyan: 'cyan',
  AccentGreen: 'green',
  AccentYellow: 'orange',
  AccentRed: 'red',
  DiffAdded: '#E5F2E5',
  DiffRemoved: '#FFE5E5',
  Comment: 'gray',
  Gray: 'gray',
  GradientColors: ['blue', 'green'],
};

export const ANSILight: Theme = new Theme(
  'ANSI Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: 'white',
      color: 'black',
    },
    'hljs-keyword': {
      color: 'blue',
    },
    'hljs-literal': {
      color: 'blue',
    },
    'hljs-symbol': {
      color: 'blue',
    },
    'hljs-name': {
      color: 'blue',
    },
    'hljs-link': {
      color: 'blue',
    },
    'hljs-built_in': {
      color: 'cyan',
    },
    'hljs-type': {
      color: 'cyan',
    },
    'hljs-number': {
      color: 'green',
    },
    'hljs-class': {
      color: 'green',
    },
    'hljs-string': {
      color: 'red',
    },
    'hljs-meta-string': {
      color: 'red',
    },
    'hljs-regexp': {
      color: 'magenta',
    },
    'hljs-template-tag': {
      color: 'magenta',
    },
    'hljs-subst': {
      color: 'black',
    },
    'hljs-function': {
      color: 'black',
    },
    'hljs-title': {
      color: 'black',
    },
    'hljs-params': {
      color: 'black',
    },
    'hljs-formula': {
      color: 'black',
    },
    'hljs-comment': {
      color: 'gray',
    },
    'hljs-quote': {
      color: 'gray',
    },
    'hljs-doctag': {
      color: 'gray',
    },
    'hljs-meta': {
      color: 'gray',
    },
    'hljs-meta-keyword': {
      color: 'gray',
    },
    'hljs-tag': {
      color: 'gray',
    },
    'hljs-variable': {
      color: 'purple',
    },
    'hljs-template-variable': {
      color: 'purple',
    },
    'hljs-attr': {
      color: 'blue',
    },
    'hljs-attribute': {
      color: 'blue',
    },
    'hljs-builtin-name': {
      color: 'blue',
    },
    'hljs-section': {
      color: 'orange',
    },
    'hljs-bullet': {
      color: 'orange',
    },
    'hljs-selector-tag': {
      color: 'orange',
    },
    'hljs-selector-id': {
      color: 'orange',
    },
    'hljs-selector-class': {
      color: 'orange',
    },
    'hljs-selector-attr': {
      color: 'orange',
    },
    'hljs-selector-pseudo': {
      color: 'orange',
    },
  },
  ansiLightColors,
  lightSemanticColors,
);
