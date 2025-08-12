/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const salesforceLightColors: ColorsTheme = {
  type: 'light',
  Background: '#ffffff',
  Foreground: '#080707',
  LightBlue: '#57a3fd',
  AccentBlue: '#0b5cab',
  AccentPurple: '#9343ff',
  AccentCyan: '#08abed',
  AccentGreen: '#2e844a',
  AccentYellow: '#f5b800',
  AccentRed: '#ba0517',
  DiffAdded: '#d8fadd',
  DiffRemoved: '#feebee',
  Comment: '#706e6b',
  Gray: '#514f4d',
  GradientColors: ['#0b5cab', '#08abed'],
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
