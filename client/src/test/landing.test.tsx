import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../landing/LandingPage';

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('opens with the product name as the page title', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1, name: 'Smart Finance' })).toBeInTheDocument();
  });

  it('offers sign in and account creation', () => {
    renderLanding();
    expect(screen.getAllByRole('link', { name: 'Create free account' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(0);
  });

  it('computes the 50/30/20 split live from the take-home input', async () => {
    const user = userEvent.setup();
    renderLanding();

    const input = screen.getByLabelText('Your monthly take-home, in dollars');
    await user.clear(input);
    await user.type(input, '2400');

    expect(screen.getByText('$1,200.00')).toBeInTheDocument(); // Needs 50%
    expect(screen.getByText('$720.00')).toBeInTheDocument(); // Wants 30%
    expect(screen.getByText('$480.00')).toBeInTheDocument(); // Savings 20%
  });
});
