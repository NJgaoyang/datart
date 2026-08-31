import { vi } from 'vitest';
import { registerDqlLanguage } from '../registerDqlLanguage';

describe('registerDqlLanguage', () => {
  it('registers dql only once when the computed field editor is reopened', () => {
    const registeredLanguages: Array<{ id: string }> = [];
    const monacoEditor = {
      languages: {
        getLanguages: () => registeredLanguages,
        register: vi.fn(language => registeredLanguages.push(language)),
      },
    };

    registerDqlLanguage(monacoEditor);
    registerDqlLanguage(monacoEditor);

    expect(monacoEditor.languages.register).toHaveBeenCalledTimes(1);
    expect(monacoEditor.languages.register).toHaveBeenCalledWith({ id: 'dql' });
  });
});
