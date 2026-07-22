import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { HeroHeader } from '@/components/navigation';
import { strings } from '@/content/strings.ar';
import { personAvatar } from '@/domain/personAppearance';
import { useMemberIdentity } from './memberIdentityContext';

interface MemberHeroProps {
  /**
   * Title-page variant: the given title fills the hero (as the page `h1`) with
   * the member's name in an end pill. Omit for the greeting variant — avatar
   * chip + greeting eyebrow + the member's name.
   */
  title?: ReactNode;
  children?: ReactNode;
}

/**
 * Member-app hero: binds the shared {@link HeroHeader} chrome to the selected
 * member's identity so the name shows app-wide (design §3.1).
 */
export function MemberHero({ title, children }: MemberHeroProps) {
  const { member } = useMemberIdentity();
  const name = member?.name ?? '';

  if (title !== undefined) {
    return (
      <HeroHeader
        title={title}
        titleComponent="h1"
        action={name ? <HeroNamePill name={name} /> : undefined}
      >
        {children}
      </HeroHeader>
    );
  }

  return (
    <HeroHeader
      avatar={member ? personAvatar(member) : undefined}
      eyebrow={strings.member.greeting}
      title={name}
    >
      {children}
    </HeroHeader>
  );
}

function HeroNamePill({ name }: { name: string }) {
  return (
    <Box
      component="span"
      sx={(theme) => ({
        display: 'inline-block',
        fontSize: '0.8125rem',
        fontWeight: 600,
        bgcolor: theme.custom.heroPill,
        border: `1px solid ${theme.custom.heroPillBorder}`,
        borderRadius: `${theme.custom.radii.pill}px`,
        px: 3,
        py: 1.5,
        maxWidth: 160,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      })}
    >
      {name}
    </Box>
  );
}
