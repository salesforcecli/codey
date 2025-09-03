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
import { darkSemanticColors } from './semantic-tokens.js';
import { SalesforceColorPalette } from './salesforce-color-palette.js';

const salesforceDarkColors: ColorsTheme = {
  type: 'dark',
  Background: SalesforceColorPalette.neutral10,
  Foreground: SalesforceColorPalette.neutral95,
  LightBlue: SalesforceColorPalette.cloudBlue80,
  AccentBlue: SalesforceColorPalette.cloudBlue60,
  AccentPurple: SalesforceColorPalette.cloudBlue60,
  AccentCyan: SalesforceColorPalette.teal80,
  AccentGreen: SalesforceColorPalette.green65,
  AccentYellow: SalesforceColorPalette.orange70,
  AccentRed: SalesforceColorPalette.red60,
  DiffAdded: SalesforceColorPalette.green30,
  DiffRemoved: SalesforceColorPalette.red20,
  Comment: SalesforceColorPalette.neutral80,
  Gray: SalesforceColorPalette.neutral60,
  GradientColors: [
    SalesforceColorPalette.cloudBlue60,
    SalesforceColorPalette.cloudBlue60,
  ],
};

export const SalesforceDark: Theme = new Theme(
  'SalesforceDark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: salesforceDarkColors.Background,
      color: salesforceDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: salesforceDarkColors.AccentBlue,
      fontWeight: 'bold',
    },
    'hljs-selector-tag': {
      color: salesforceDarkColors.AccentBlue,
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: salesforceDarkColors.AccentBlue,
      fontWeight: 'bold',
    },
    'hljs-section': {
      color: salesforceDarkColors.AccentBlue,
      fontWeight: 'bold',
    },
    'hljs-link': {
      color: salesforceDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: salesforceDarkColors.AccentPurple,
    },
    'hljs-subst': {
      color: salesforceDarkColors.Foreground,
    },
    'hljs-string': {
      color: salesforceDarkColors.AccentYellow,
    },
    'hljs-title': {
      color: salesforceDarkColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-name': {
      color: salesforceDarkColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: salesforceDarkColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-attribute': {
      color: salesforceDarkColors.AccentYellow,
    },
    'hljs-symbol': {
      color: salesforceDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: salesforceDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: salesforceDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: salesforceDarkColors.AccentYellow,
    },
    'hljs-template-tag': {
      color: salesforceDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: salesforceDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: salesforceDarkColors.Comment,
    },
    'hljs-quote': {
      color: salesforceDarkColors.Comment,
    },
    'hljs-deletion': {
      color: salesforceDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: salesforceDarkColors.Comment,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  salesforceDarkColors,
  darkSemanticColors,
);
