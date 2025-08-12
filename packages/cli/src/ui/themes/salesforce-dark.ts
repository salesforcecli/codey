/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { darkSemanticColors } from './semantic-tokens.js';

const salesforceDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0e1118',
  Foreground: '#c9c9c9',
  LightBlue: '#57a3fd',
  AccentBlue: '#1b96ff',
  AccentPurple: '#9343ff',
  AccentCyan: '#08abed',
  AccentGreen: '#41b658',
  AccentYellow: '#f5b800',
  AccentRed: '#ff5555',
  DiffAdded: '#11431d',
  DiffRemoved: '#6e1818',
  Comment: '#706e6b',
  Gray: '#514f4d',
  GradientColors: ['#1b96ff', '#08abed'],
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
