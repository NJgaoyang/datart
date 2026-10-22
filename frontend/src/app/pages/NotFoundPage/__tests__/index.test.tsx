import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { NotFoundPage } from '..';

const renderPage = () =>
  render(
    <MemoryRouter>
      <HelmetProvider>
        <NotFoundPage />
      </HelmetProvider>
    </MemoryRouter>,
  );

describe('<NotFoundPage />', () => {
  it('shows the missing page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('404');
  });
});
