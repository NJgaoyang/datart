export const registerDqlLanguage = monacoEditor => {
  const isDqlRegistered = monacoEditor.languages
    .getLanguages()
    .some(language => language.id === 'dql');
  if (!isDqlRegistered) {
    monacoEditor.languages.register({ id: 'dql' });
  }
};
