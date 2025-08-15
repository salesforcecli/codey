/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';
import { SalesforceColorPalette } from './salesforce-color-palette.js';

const salesforceLightColors: ColorsTheme = {
  type: 'light',
  Background: '#ffffff',
  Foreground: SalesforceColorPalette.neutral10,
  LightBlue: SalesforceColorPalette.cloudBlue80,
  AccentBlue: SalesforceColorPalette.blue50,
  AccentPurple: SalesforceColorPalette.cloudBlue60,
  AccentCyan: SalesforceColorPalette.teal60,
  AccentGreen: SalesforceColorPalette.green65,
  AccentYellow: SalesforceColorPalette.orange70,
  AccentRed: SalesforceColorPalette.red60,
  DiffAdded: SalesforceColorPalette.green90,
  DiffRemoved: SalesforceColorPalette.red95,
  Comment: SalesforceColorPalette.neutral80,
  Gray: SalesforceColorPalette.neutral30,
  GradientColors: [
    SalesforceColorPalette.blue50,
    SalesforceColorPalette.cloudBlue60,
  ],
};

export const SalesforceLight: Theme = new Theme(
  'SalesforceLight',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: salesforceLightColors.Background,
      color: salesforceLightColors.Foreground,
    },
    'hljs-keyword': {
      color: salesforceLightColors.AccentBlue,
      fontWeight: 'bold',
    },
    'hljs-selector-tag': {
      color: salesforceLightColors.AccentBlue,
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: salesforceLightColors.AccentBlue,
      fontWeight: 'bold',
    },
    'hljs-section': {
      color: salesforceLightColors.AccentBlue,
      fontWeight: 'bold',
    },
    'hljs-link': {
      color: salesforceLightColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: salesforceLightColors.AccentPurple,
    },
    'hljs-subst': {
      color: salesforceLightColors.Foreground,
    },
    'hljs-string': {
      color: salesforceLightColors.AccentYellow,
    },
    'hljs-title': {
      color: salesforceLightColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-name': {
      color: salesforceLightColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: salesforceLightColors.AccentYellow,
      fontWeight: 'bold',
    },
    'hljs-attribute': {
      color: salesforceLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: salesforceLightColors.AccentYellow,
    },
    'hljs-bullet': {
      color: salesforceLightColors.AccentYellow,
    },
    'hljs-addition': {
      color: salesforceLightColors.AccentGreen,
    },
    'hljs-variable': {
      color: salesforceLightColors.AccentYellow,
    },
    'hljs-template-tag': {
      color: salesforceLightColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: salesforceLightColors.AccentYellow,
    },
    'hljs-comment': {
      color: salesforceLightColors.Comment,
    },
    'hljs-quote': {
      color: salesforceLightColors.Comment,
    },
    'hljs-deletion': {
      color: salesforceLightColors.AccentRed,
    },
    'hljs-meta': {
      color: salesforceLightColors.Comment,
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
  salesforceLightColors,
  lightSemanticColors,
);
