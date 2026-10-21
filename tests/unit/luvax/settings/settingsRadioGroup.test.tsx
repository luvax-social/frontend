import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { SettingsRadioGroup } from '@/features/luvax/components/settings/SettingsRadioGroup';

const OPTIONS = [
  { value: 'a', label: 'alpha', description: 'The first one.' },
  { value: 'b', label: 'beta' },
  { value: 'c', label: 'gamma' },
] as const;

const setup = (value: string | undefined, props: { disabled?: boolean } = {}) => {
  const onChange = vi.fn();
  render(
    <SettingsRadioGroup
      label="letters"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
  return onChange;
};

const radio = (name: string) => screen.getByRole('radio', { name });

describe('SettingsRadioGroup', () => {
  it('names the group, checks the value and describes an option by its sentence', () => {
    setup('b');

    expect(screen.getByRole('radiogroup', { name: 'letters' })).toBeInTheDocument();
    expect(radio('beta')).toHaveAttribute('aria-checked', 'true');
    expect(radio('alpha')).toHaveAttribute('aria-checked', 'false');
    expect(radio('alpha')).toHaveAccessibleDescription('The first one.');
  });

  it('makes the first option tabbable when nothing is selected yet', () => {
    setup(undefined);

    expect(radio('alpha')).toHaveAttribute('tabindex', '0');
    expect(radio('beta')).toHaveAttribute('tabindex', '-1');
  });

  it('reports a click on an unselected option and ignores one on the selected option', () => {
    const onChange = setup('a');

    fireEvent.click(radio('alpha'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(radio('gamma'));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it.each([
    ['ArrowRight', 'a', 'b'],
    ['ArrowDown', 'b', 'c'],
    ['ArrowRight', 'c', 'a'],
    ['ArrowLeft', 'a', 'c'],
    ['ArrowUp', 'c', 'b'],
    ['Home', 'c', 'a'],
    ['End', 'a', 'c'],
  ])('%s from %s selects %s', (key, from, to) => {
    const onChange = setup(from);
    const labels: Record<string, string> = { a: 'alpha', b: 'beta', c: 'gamma' };

    fireEvent.keyDown(radio(labels[from]), { key });

    expect(onChange).toHaveBeenCalledWith(to);
  });

  it('does nothing for other keys', () => {
    const onChange = setup('a');

    fireEvent.keyDown(radio('alpha'), { key: 'Tab' });
    fireEvent.keyDown(radio('alpha'), { key: 'a' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('is inert while disabled', () => {
    const onChange = setup('a', { disabled: true });

    fireEvent.click(radio('beta'));
    fireEvent.keyDown(radio('alpha'), { key: 'ArrowRight' });

    expect(onChange).not.toHaveBeenCalled();
    expect(radio('alpha')).toBeDisabled();
  });
});
