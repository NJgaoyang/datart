import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommonFormTypes } from 'globalConstants';
import { describe, it, vi } from 'vitest';
import { SaveForm } from '../SaveForm';
import { SaveFormContext } from '../SaveFormContext';

vi.mock('app/hooks/useI18NPrefix', () => ({ default: () => (key: string) => key }));
vi.mock('react-redux', () => ({ useSelector: selector => selector({}) }));
vi.mock('app/pages/MainPage/Access', () => ({ getCascadeAccess: () => true }));
vi.mock('app/pages/MainPage/slice/selectors', () => ({
  selectIsOrgOwner: () => true,
  selectModuleAccessMap: () => ({}),
  selectPermissionMap: () => ({}),
  selectOrgId: () => 'org-1',
}));
vi.mock('../slice/selectors', () => ({
  makeSelectViewFolderTree: () => () => [],
  selectCurrentEditingView: () => ({ stage: 0 }),
}));
vi.mock('app/utils/fetch', () => ({ fetchCheckName: () => Promise.resolve() }));
vi.mock('app/components', async () => ({
  ModalForm: (await vi.importActual<typeof import('app/components/ModalForm')>('app/components/ModalForm')).ModalForm,
}));

describe('saved dataset advanced settings', () => {
  it('uses loaded and edited form values for dependent controls', async () => {
    const context = {
      type: CommonFormTypes.Edit,
      open: true,
      parentIdLabel: 'folder',
      onSave: vi.fn(),
      onCancel: vi.fn(),
      showSaveForm: vi.fn(),
      initialValues: {
        name: 'Orders',
        parentId: null,
        config: { cache: true, cacheExpires: 120, concurrencyControl: false },
      },
    };
    const { rerender } = render(
      <SaveFormContext.Provider value={context}><SaveForm /></SaveFormContext.Provider>,
    );
    fireEvent.click(screen.getByText('advanced'));
    const expires = screen.getByRole('spinbutton', { name: 'cacheExpires' });
    await waitFor(() => expect(expires).not.toBeDisabled());
    expect(expires).toHaveValue('120');
    expect(screen.getByRole('switch', { name: 'cache' })).toHaveAttribute('aria-checked', 'true');
    screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());

    fireEvent.click(screen.getByRole('switch', { name: 'cache' }));
    await waitFor(() => expect(expires).toBeDisabled());
    fireEvent.click(screen.getByRole('switch', { name: 'concurrencyControl' }));
    await waitFor(() => screen.getAllByRole('radio').forEach(radio => expect(radio).not.toBeDisabled()));

    rerender(
      <SaveFormContext.Provider value={{
        ...context,
        initialValues: {
          ...context.initialValues,
          config: { cache: true, cacheExpires: 240, concurrencyControl: false },
        },
      }}><SaveForm /></SaveFormContext.Provider>,
    );
    await waitFor(() => expect(expires).not.toBeDisabled());
    expect(expires).toHaveValue('240');
    screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());
  });
});
