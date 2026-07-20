import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_FEEDBACK_DRAWER_HEIGHT_PERCENT } from '@/app/admin/AdminFeedbackInbox';
import { AdminExperience } from '@/app/admin/AdminApp';
import { writeOperations, type WriteOperations } from '@/app/operations';
import { strings } from '@/content/strings.ar';
import type { MemberFeedback } from '@/domain/types';
import {
  renderWithAppProviders,
  type RenderWithAppProvidersOptions,
} from '../support/reactTestHarness';

const unread: MemberFeedback = {
  id: 'feedback-1',
  memberId: 'person-1',
  memberName: 'Amina',
  message: 'Please add a dark reading mode.',
  isRead: false,
  createdAt: 2,
};

const read: MemberFeedback = {
  id: 'feedback-2',
  memberId: 'person-1',
  memberName: 'Amina',
  message: 'The larger text is very helpful.',
  isRead: true,
  createdAt: 1,
};

function renderAdmin(options: RenderWithAppProvidersOptions = {}) {
  return renderWithAppProviders(<AdminExperience />, {
    route: '/settings',
    ...options,
  });
}

describe('admin feedback inbox', () => {
  it('shows a live unread badge and a 70%-height top drawer', async () => {
    const harness = renderAdmin({ data: { feedback: [unread, read] } });
    const notification = screen.getByRole('button', {
      name: `${strings.admin.feedbackNotifications}: ١ ${strings.admin.unreadFeedback}`,
    });

    expect(ADMIN_FEEDBACK_DRAWER_HEIGHT_PERCENT).toBe(70);
    expect(harness.subscriptions.feedback.counts()).toEqual({
      starts: 1,
      stops: 0,
      active: 1,
    });

    harness.subscriptions.feedback.emit([unread, { ...read, isRead: false }]);
    expect(
      screen.getByRole('button', {
        name: `${strings.admin.feedbackNotifications}: ٢ ${strings.admin.unreadFeedback}`,
      }),
    ).toBeVisible();

    await harness.user.click(notification);
    const drawer = screen.getByRole('dialog', {
      name: strings.admin.feedbackInboxHeading,
    });
    expect(within(drawer).getAllByText('Amina')).toHaveLength(2);
    expect(within(drawer).getByText(unread.message)).toBeVisible();
    expect(within(drawer).getByText(read.message)).toBeVisible();
  });

  it('marks read/unread, copies, and deletes independent feedback documents', async () => {
    const setFeedbackRead = vi
      .fn<WriteOperations['setFeedbackRead']>()
      .mockResolvedValue(undefined);
    const deleteFeedback = vi
      .fn<WriteOperations['deleteFeedback']>()
      .mockResolvedValue(undefined);
    const harness = renderAdmin({
      data: { feedback: [unread, read] },
      operations: { ...writeOperations, setFeedbackRead, deleteFeedback },
    });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await harness.user.click(
      screen.getByRole('button', {
        name: `${strings.admin.feedbackNotifications}: ١ ${strings.admin.unreadFeedback}`,
      }),
    );

    const unreadCard = screen.getByText(unread.message).closest('section');
    const readCard = screen.getByText(read.message).closest('section');
    expect(unreadCard).not.toBeNull();
    expect(readCard).not.toBeNull();

    await harness.user.click(
      within(unreadCard!).getByRole('button', {
        name: strings.admin.markFeedbackRead,
      }),
    );
    await harness.user.click(
      within(readCard!).getByRole('button', {
        name: strings.admin.markFeedbackUnread,
      }),
    );
    expect(setFeedbackRead).toHaveBeenNthCalledWith(1, unread.id, true);
    expect(setFeedbackRead).toHaveBeenNthCalledWith(2, read.id, false);

    await harness.user.click(
      within(unreadCard!).getByRole('button', { name: strings.admin.copyFeedback }),
    );
    expect(writeText).toHaveBeenCalledWith(unread.message);
    expect(await screen.findByText(strings.admin.feedbackCopied)).toBeVisible();

    await harness.user.click(
      within(unreadCard!).getByRole('button', { name: strings.admin.deleteFeedback }),
    );
    const confirmation = screen.getByRole('dialog', {
      name: strings.common.confirmTitle,
    });
    expect(
      within(confirmation).getByText(strings.admin.confirmDeleteFeedback),
    ).toBeVisible();
    await harness.user.click(
      within(confirmation).getByRole('button', { name: strings.common.confirm }),
    );
    expect(deleteFeedback).toHaveBeenCalledWith(unread.id);
  });
});
