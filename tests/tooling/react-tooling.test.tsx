import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

function HookProbe() {
  const [count, setCount] = useState(0);

  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  );
}

describe('React tooling', () => {
  it('renders TSX and handles a hook-driven interaction in jsdom', async () => {
    const user = userEvent.setup();

    render(<HookProbe />);

    const button = screen.getByRole('button', { name: 'Count: 0' });
    await user.click(button);

    expect(button).toHaveTextContent('Count: 1');
  });
});
