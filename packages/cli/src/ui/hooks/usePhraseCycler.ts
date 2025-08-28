/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';

export const WITTY_LOADING_PHRASES = [
  // jokes
  'What do you call a bear with no teeth? A gummy bear...',
  "What's a bear's favorite dessert? Blue-beary pie...",
  'What do you call a bear without ears? B...',

  // bear puns
  'Gathering some bear necessities...',
  'Bear with me, magic is happening...',
  "Bear with me, I'm blazing a trail...",
  "Bear with me, I'm coding...",
  "Bear with me, I'm almost there...",
  'Bear-y excited to help!',
  'Bear-y busy processing...',
  'Fetching some bear-y cool data...',
  'Your request is being bear-handled...',
  "I'm just getting my bearings...",

  // paw puns
  "Paws for a moment, I'm on it...",
  'Your request is in good paws...',

  // trailblazing
  'Trailblazing through the code...',
  'On the trail to success...',
  'Loading your adventure...',

  // Misc
  'Hugging the server for a response...',
  'Crafting something special...',
  "Just a moment, I'm coding...",
  "Hold tight, I'm coding...",
  'Codey is working his magic...',
  'Almost there, thanks for waiting...',
  'Codey is making it happen...',
  'Just a moment, Codey is on it...',
];

export const PHRASE_CHANGE_INTERVAL_MS = 15000;

/**
 * Custom hook to manage cycling through loading phrases.
 * @param isActive Whether the phrase cycling should be active.
 * @param isWaiting Whether to show a specific waiting phrase.
 * @returns The current loading phrase.
 */
export const usePhraseCycler = (isActive: boolean, isWaiting: boolean) => {
  const [currentLoadingPhrase, setCurrentLoadingPhrase] = useState(
    WITTY_LOADING_PHRASES[0],
  );
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isWaiting) {
      setCurrentLoadingPhrase('Waiting for user confirmation...');
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    } else if (isActive) {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
      }
      // Select an initial random phrase
      const initialRandomIndex = Math.floor(
        Math.random() * WITTY_LOADING_PHRASES.length,
      );
      setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[initialRandomIndex]);

      phraseIntervalRef.current = setInterval(() => {
        // Select a new random phrase
        const randomIndex = Math.floor(
          Math.random() * WITTY_LOADING_PHRASES.length,
        );
        setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[randomIndex]);
      }, PHRASE_CHANGE_INTERVAL_MS);
    } else {
      // Idle or other states, clear the phrase interval
      // and reset to the first phrase for next active state.
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
      setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[0]);
    }

    return () => {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    };
  }, [isActive, isWaiting]);

  return currentLoadingPhrase;
};
