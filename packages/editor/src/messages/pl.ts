import type { Messages } from './en.ts';

export const pl: Messages = {
  'editor.toolbar': 'Pasek narzędzi',
  'editor.leftPanel': 'Wstawianie i warstwy',
  'editor.canvas': 'Kanwa',
  'editor.inspector': 'Inspektor',
  'editor.canvas.connecting': 'Łączenie z kanwą…',
  'editor.canvas.frame': 'Podgląd strony',
  'editor.canvas.reload': 'Przeładuj kanwę',
  'editor.canvas.error.timeout':
    'Kanwa nie odpowiada. Sprawdź jej adres, nagłówek Content-Security-Policy (frame-ancestors) i dozwolone źródła.',
  'editor.canvas.error.manifest':
    'Kanwa zbudowana jest z innych komponentów niż edytor. Zbuduj kanwę ponownie lub przeładuj edytor.',
  'editor.canvas.error.protocol': 'Kanwa i edytor mają różne wersje. Zaktualizuj je razem.',
  'editor.canvas.error.canvas': 'Kanwa przestała działać.',
  'editor.issues': 'Problemy',
  'editor.breadcrumbs': 'Ścieżka zaznaczenia',
  'editor.issues.show': 'Pokaż problemy',
  'editor.issues.hide': 'Ukryj problemy',
  'editor.resize.left': 'Zmień szerokość lewego panelu',
  'editor.resize.right': 'Zmień szerokość prawego panelu',
  'ui.close': 'Zamknij',
};
