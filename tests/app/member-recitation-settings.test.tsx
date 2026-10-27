import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemberIdentityBoundary } from '@/app/member/MemberIdentityBoundary';
import { MemberExperience } from '@/app/member/MemberApp';
import { strings } from '@/content/strings.ar';
import type { Person } from '@/domain/types';
import {
  createFakeRecitationEnvironment,
  type FakeRecitationEnvironment,
} from '../support/fakeRecitationEnvironment';
import { renderWithAppProviders } from '../support/reactTestHarness';

const amina: Person = {
  id: 'person-1',
  name: 'Amina',
  completedPages: [],
  pagesPerDay: 2,
  enabled: true,
  createdAt: 1,
};

const names = strings.recitation.qariNames;
const previewLabel = (name: string) => strings.recitation.preview.replace('{name}', name);
const stopLabel = (name: string) =>
  strings.recitation.stopPreview.replace('{name}', name);

function renderSettings(fake: FakeRecitationEnvironment) {
  localStorage.setItem('khatma.memberId', amina.id);
  return renderWithAppProviders(
    <MemberIdentityBoundary>
      <MemberExperience recitationEnvironment={fake.env} />
    </MemberIdentityBoundary>,
    { route: '/settings', data: { roster: [amina] } },
  );
}

async function openQariSection(harness: ReturnType<typeof renderSettings>) {
  await screen.findByRole('heading', { name: strings.nav.settings });
  const summary = screen.getByText(strings.recitation.title).closest('summary')!;
  await harness.user.click(summary);
  return screen.getByRole('radiogroup', { name: strings.recitation.pickerLabel });
}

describe('member recitation voice settings', () => {
  let fake: FakeRecitationEnvironment;

  beforeEach(() => {
    localStorage.clear();
    fake = createFakeRecitationEnvironment();
  });

  it('sits after reading size and before the avatar card', async () => {
    renderSettings(fake);
    await screen.findByRole('heading', { name: strings.nav.settings });

    const headings = screen
      .getAllByRole('heading')
      .map((heading) => heading.textContent ?? '');
    const at = (text: string) => headings.indexOf(text);
    expect(at(strings.settings.fontSize)).toBeGreaterThan(-1);
    expect(at(strings.recitation.title)).toBe(at(strings.settings.fontSize) + 1);
    expect(at(strings.settings.avatarTitle)).toBe(at(strings.recitation.title) + 1);
  });

  it('defaults to Alafasy and saves a new choice on tap', async () => {
    const harness = renderSettings(fake);
    const group = await openQariSection(harness);

    const radios = within(group).getAllByRole('radio');
    // Arabic alphabetical order of the displayed names.
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'shatri',
      'ajmi',
      'ghamdi',
      'shuraim',
      'abdulbasit',
      'sudais',
      'basfar',
      'hudhaify',
      'maher',
      'ayyub',
      'jibreel',
      'minshawi',
      'husary',
      'alafasy',
      'qatami',
      'rifai',
      'dossari',
    ]);
    expect(within(group).getByRole('radio', { name: names.alafasy })).toBeChecked();

    await harness.user.click(within(group).getByRole('radio', { name: names.husary }));
    expect(within(group).getByRole('radio', { name: names.husary })).toBeChecked();
    expect(localStorage.getItem('khatma.qari')).toBe('husary');
    // Choosing never plays anything by itself.
    expect(fake.createAudio).not.toHaveBeenCalled();
  });

  it('previews Ayat al-Kursi, one voice at a time, and stops when closed', async () => {
    const harness = renderSettings(fake);
    const group = await openQariSection(harness);

    await harness.user.click(
      within(group).getByRole('button', { name: previewLabel(names.alafasy) }),
    );
    expect(fake.audio.src).toBe('https://everyayah.com/data/Alafasy_128kbps/002255.mp3');
    act(() => fake.audio.startPlaying());
    expect(
      within(group).getByRole('button', { name: stopLabel(names.alafasy) }),
    ).toHaveAttribute('aria-pressed', 'true');

    await harness.user.click(
      within(group).getByRole('button', { name: previewLabel(names.minshawi) }),
    );
    expect(fake.audio.src).toBe(
      'https://everyayah.com/data/Minshawy_Murattal_128kbps/002255.mp3',
    );
    expect(
      within(group).getByRole('button', { name: previewLabel(names.alafasy) }),
    ).toHaveAttribute('aria-pressed', 'false');
    // Previewing is not choosing.
    expect(within(group).getByRole('radio', { name: names.alafasy })).toBeChecked();

    await harness.user.click(
      screen.getByText(strings.recitation.title).closest('summary')!,
    );
    expect(fake.audio.src).toBe('');
  });

  it("tunes the chosen voice's overlap under advanced settings and tests it", async () => {
    const harness = renderSettings(fake);
    const group = await openQariSection(harness);
    await harness.user.click(within(group).getByRole('radio', { name: names.husary }));

    await harness.user.click(screen.getByText(strings.recitation.advancedTitle));
    const slider = screen.getByRole('slider', { name: strings.recitation.overlapLabel });
    expect(slider).toHaveAttribute('aria-valuenow', '200');
    expect(
      screen.getByText(strings.recitation.overlapFor.replace('{name}', names.husary), {
        exact: false,
      }),
    ).toBeVisible();
    const reset = screen.getByRole('button', { name: strings.recitation.resetOverlap });
    expect(reset).toBeDisabled();

    slider.focus();
    await harness.user.keyboard('{ArrowLeft}{ArrowLeft}');
    const tuned = Number(slider.getAttribute('aria-valuenow'));
    expect(tuned).not.toBe(200);
    expect(JSON.parse(localStorage.getItem('khatma.verseOverlap')!)).toEqual({
      husary: tuned,
    });

    // The test crosses ayah boundaries in Al-Fatiha with this voice.
    await harness.user.click(
      screen.getByRole('button', { name: strings.recitation.testTransition }),
    );
    expect(fake.audio.src).toBe('https://everyayah.com/data/Husary_128kbps/001001.mp3');
    act(() => fake.audio.startPlaying());
    expect(
      screen.getByRole('button', { name: strings.recitation.stopTransition }),
    ).toHaveAttribute('aria-pressed', 'true');
    act(() => fake.audio.finish());
    expect(fake.audio.src).toBe('https://everyayah.com/data/Husary_128kbps/001002.mp3');

    await harness.user.click(
      screen.getByRole('button', { name: strings.recitation.stopTransition }),
    );
    expect(fake.audio.src).toBe('');

    await harness.user.click(reset);
    expect(slider).toHaveAttribute('aria-valuenow', '200');
    expect(JSON.parse(localStorage.getItem('khatma.verseOverlap')!)).toEqual({
      husary: 200,
    });
  });

  it('shows one clear dialog when recitation cannot be reached', async () => {
    fake.setOnline(false);
    const harness = renderSettings(fake);
    const group = await openQariSection(harness);

    await harness.user.click(
      within(group).getByRole('button', { name: previewLabel(names.alafasy) }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: strings.recitation.unavailableTitle,
    });
    expect(within(dialog).getByText(strings.recitation.unavailableBody)).toBeVisible();
    expect(within(dialog).getAllByRole('button')).toHaveLength(1);

    await harness.user.click(
      within(dialog).getByRole('button', { name: strings.recitation.dismiss }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: strings.recitation.unavailableTitle }),
      ).toBeNull(),
    );
    expect(fake.createAudio).not.toHaveBeenCalled();
  });
});
