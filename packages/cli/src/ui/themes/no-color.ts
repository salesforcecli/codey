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

import type { ColorsTheme } from './theme.js';
import { Theme } from './theme.js';
import type { SemanticColors } from './semantic-tokens.js';

const noColorColorsTheme: ColorsTheme = {
  type: 'ansi',
  Background: '',
  Foreground: '',
  LightBlue: '',
  AccentBlue: '',
  AccentPurple: '',
  AccentCyan: '',
  AccentGreen: '',
  AccentYellow: '',
  AccentRed: '',
  DiffAdded: '',
  DiffRemoved: '',
  Comment: '',
  Gray: '',
};

const noColorSemanticColors: SemanticColors = {
  text: {
    primary: '',
    secondary: '',
    link: '',
    accent: '',
  },
  background: {
    primary: '',
    diff: {
      added: '',
      removed: '',
    },
  },
  border: {
    default: '',
    focused: '',
  },
  ui: {
    comment: '',
    symbol: '',
    gradient: [],
  },
  status: {
    error: '',
    success: '',
    warning: '',
  },
};

export const NoColorTheme: Theme = new Theme(
  'NoColor',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
    },
    'hljs-keyword': {},
    'hljs-literal': {},
    'hljs-symbol': {},
    'hljs-name': {},
    'hljs-link': {
      textDecoration: 'underline',
    },
    'hljs-built_in': {},
    'hljs-type': {},
    'hljs-number': {},
    'hljs-class': {},
    'hljs-string': {},
    'hljs-meta-string': {},
    'hljs-regexp': {},
    'hljs-template-tag': {},
    'hljs-subst': {},
    'hljs-function': {},
    'hljs-title': {},
    'hljs-params': {},
    'hljs-formula': {},
    'hljs-comment': {
      fontStyle: 'italic',
    },
    'hljs-quote': {
      fontStyle: 'italic',
    },
    'hljs-doctag': {},
    'hljs-meta': {},
    'hljs-meta-keyword': {},
    'hljs-tag': {},
    'hljs-variable': {},
    'hljs-template-variable': {},
    'hljs-attr': {},
    'hljs-attribute': {},
    'hljs-builtin-name': {},
    'hljs-section': {},
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-bullet': {},
    'hljs-selector-tag': {},
    'hljs-selector-id': {},
    'hljs-selector-class': {},
    'hljs-selector-attr': {},
    'hljs-selector-pseudo': {},
    'hljs-addition': {
      display: 'inline-block',
      width: '100%',
    },
    'hljs-deletion': {
      display: 'inline-block',
      width: '100%',
    },
  },
  noColorColorsTheme,
  noColorSemanticColors,
);
