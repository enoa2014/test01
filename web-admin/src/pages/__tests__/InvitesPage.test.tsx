import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InvitesPage } from '../InvitesPage';
import '../../test/setup';

vi.mock('../../hooks/useCloudbase', () => ({
  useCloudbase: () => ({
    app: null,
  }),
}));

describe('InvitesPage role options', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderInvitesPage = () =>
    render(
      <MemoryRouter>
        <InvitesPage />
      </MemoryRouter>
    );

  it('includes social worker in filter options', () => {
    renderInvitesPage();

    const options = screen.getAllByRole('option', { name: '社工' });
    expect(options).toHaveLength(1);
  });

  it('shows social worker option in create modal', async () => {
    const user = userEvent.setup();
    renderInvitesPage();

    const createButton = screen.getByRole('button', { name: '创建邀请码' });
    await user.click(createButton);

    const options = screen.getAllByRole('option', { name: '社工' });
    expect(options).toHaveLength(2);
  });
});
