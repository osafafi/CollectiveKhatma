import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { Theme } from '@mui/material/styles';
import { useWriteOperation } from '@/app/operations';
import { AppButton, NestedSurface, StatusChip } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toWesternDigits } from '@/content/quran/symbols';
import { resolvePageScope } from '@/domain/assignment';
import type { DistributionMember, DistributionKhatmaState } from '@/domain/distribution';
import {
  buildDistributionDraft,
  defaultDistributionAdjustments,
  type DistributionDraft,
  type DistributionDraftAdjustments,
  type DistributionDraftMode,
  type PendingPageDecision,
} from '@/domain/distributionDraft';
import { pendingChunks } from '@/domain/progress';
import { pickDuaReciter } from '@/domain/rotation';
import { nextSeriesNumber, seriesTitle, type SeriesGroup } from '@/domain/series';
import type { Assignment, Khatma, MemberCapacity, Person } from '@/domain/types';
import { todayIso } from '../todayIso';
import type { QuranScopeMaps } from '../useQuranScopeMaps';

interface PlannerSnapshot {
  mode: DistributionDraftMode;
  khatmas: DistributionKhatmaState[];
  members: DistributionMember[];
  newKhatmaPool: number[];
  newKhatmaSeriesNumber: number;
  rolloverSeed: {
    seriesId: string;
    seriesName: string;
    imageName?: string;
    seriesNumber: number;
    totalPages: number;
    scope: Khatma['scope'];
    memberIds: string[];
    duaReciterId: string;
    capacities: Record<string, MemberCapacity>;
    pool: number[];
  };
}

interface DistributionPlannerDialogProps {
  group: SeriesGroup;
  allKhatmas: readonly Khatma[];
  roster: readonly Person[];
  assignmentsByKhatma: Readonly<Record<string, readonly Assignment[]>>;
  assignmentsReady: boolean;
  scopeMaps: QuranScopeMaps | null;
}

function pageRanges(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((left, right) => left - right);
  const ranges: string[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const start = sorted[index]!;
    let end = start;
    while (sorted[index + 1] === end + 1) end = sorted[++index]!;
    ranges.push(start === end ? `${start}` : `${start}–${end}`);
  }
  return ranges.join('، ');
}

function memberName(roster: readonly Person[], memberId: string): string {
  return roster.find((person) => person.id === memberId)?.name ?? memberId;
}

function membersForPlanner(khatmas: readonly Khatma[], roster: readonly Person[]) {
  const memberIds = [...new Set(khatmas.flatMap((khatma) => khatma.memberIds))];
  return memberIds.flatMap((memberId) => {
    const person = roster.find((candidate) => candidate.id === memberId);
    const owningKhatma = [...khatmas]
      .reverse()
      .find((candidate) => candidate.capacities[memberId] !== undefined);
    return person
      ? [
          {
            id: memberId,
            capacity: owningKhatma?.capacities[memberId] ?? {
              pages: person.pagesPerDay,
              surahs: 0,
              juz: 0,
            },
            // Production roster documents created before lifetime tracking do not
            // contain this field. Match the transaction's legacy default.
            completedPages: person.completedPages ?? [],
            enabled: person.enabled,
            holdPages: person.holdPages === true,
          },
        ]
      : [];
  });
}

function skipReason(reason: DistributionDraft['skipped'][number]['reason']): string {
  return strings.admin.distributionSkipReasons[reason];
}

type PlannerGradientTone = 'neutral' | 'gold' | 'emerald';

function plannerGradient(theme: Theme, tone: PlannerGradientTone) {
  const cardLayer = theme.custom.cardBg.startsWith('linear-gradient')
    ? theme.custom.cardBg
    : 'none';
  if (tone === 'emerald') {
    return {
      color: theme.custom.heroInk,
      backgroundColor: theme.palette.primary.dark,
      backgroundImage: theme.custom.heroGrad,
      border: `1px solid ${theme.palette.primary.main}`,
      boxShadow: theme.custom.cardShadow,
    };
  }
  if (tone === 'gold') {
    return {
      color: theme.palette.text.primary,
      backgroundColor: theme.custom.goldSoft,
      backgroundImage:
        cardLayer === 'none'
          ? theme.custom.heroGlow
          : `${theme.custom.heroGlow}, ${cardLayer}`,
      border: `1px solid ${theme.palette.secondary.main}`,
      boxShadow: theme.custom.cardShadow,
    };
  }
  return {
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: cardLayer,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.custom.cardShadow,
  };
}

export function DistributionPlannerDialog({
  group,
  allKhatmas,
  roster,
  assignmentsByKhatma,
  assignmentsReady,
  scopeMaps,
}: DistributionPlannerDialogProps) {
  const commit = useWriteOperation('commitDistributionRun');
  const [snapshot, setSnapshot] = useState<PlannerSnapshot | null>(null);
  const [adjustments, setAdjustments] = useState<DistributionDraftAdjustments>(
    defaultDistributionAdjustments,
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scopeError, setScopeError] = useState(false);
  const [rolloverAcknowledged, setRolloverAcknowledged] = useState(false);

  const draft = useMemo(() => {
    if (!snapshot) return null;
    return buildDistributionDraft({
      mode: snapshot.mode,
      khatmas: snapshot.khatmas,
      members: snapshot.members,
      newKhatmaPool: snapshot.newKhatmaPool,
      newKhatmaSeriesNumber: snapshot.newKhatmaSeriesNumber,
      unitOfPage: scopeMaps?.pageUnitMaps,
      adjustments,
    });
  }, [adjustments, scopeMaps?.pageUnitMaps, snapshot]);

  const openPlanner = (mode: DistributionDraftMode) => {
    const rolloverScope = { kind: 'full' as const };
    let pool: number[];
    try {
      pool = resolvePageScope(rolloverScope);
    } catch {
      setScopeError(true);
      return;
    }
    setScopeError(false);
    commit.reset();
    const seriesNumber = nextSeriesNumber(allKhatmas, group.seriesId);
    const plannerMembers = membersForPlanner(group.active, roster);
    const states = group.active.map((khatma) => ({
      id: khatma.id,
      seriesNumber: khatma.seriesNumber,
      remainingPages: [...khatma.remainingPages],
      roundCount: khatma.roundCount,
      assignments: plannerMembers.map(
        (member) =>
          assignmentsByKhatma[khatma.id]?.find(
            (assignment) => assignment.memberId === member.id,
          ) ?? {
            memberId: member.id,
            rounds: [],
            doneByRound: {},
            missedStreak: 0,
          },
      ),
    }));
    const rolloverMemberIds = plannerMembers.map((member) => member.id);
    const rolloverCapacities = Object.fromEntries(
      plannerMembers.map((member) => [member.id, member.capacity]),
    );
    setSnapshot({
      mode,
      khatmas: states,
      members: plannerMembers,
      newKhatmaPool: pool,
      newKhatmaSeriesNumber: seriesNumber,
      rolloverSeed: {
        seriesId: group.seriesId,
        seriesName: group.seriesName,
        ...(group.latest.imageName ? { imageName: group.latest.imageName } : {}),
        seriesNumber,
        totalPages: pool.length,
        scope: rolloverScope,
        memberIds: rolloverMemberIds,
        duaReciterId: pickDuaReciter(rolloverMemberIds, allKhatmas),
        capacities: rolloverCapacities,
        pool,
      },
    });
    setAdjustments(defaultDistributionAdjustments());
    setRolloverAcknowledged(false);
    setAdvancedOpen(false);
  };

  const close = () => {
    if (commit.isPending) return;
    setSnapshot(null);
  };

  const updateMember = (
    memberId: string,
    update: Partial<{
      include: boolean;
      capacity: MemberCapacity;
      pendingDecision: PendingPageDecision;
    }>,
  ) => {
    setAdjustments((current) => ({
      ...current,
      recipientOrder: undefined,
      members: {
        ...current.members,
        [memberId]: { ...current.members[memberId], ...update },
      },
    }));
  };

  const swapRecipient = (slotIndex: number, memberId: string) => {
    if (!draft) return;
    const order = [
      ...(adjustments.recipientOrder ??
        draft.allocations.map((allocation) => allocation.memberId)),
    ];
    const otherIndex = order.indexOf(memberId);
    if (otherIndex < 0) return;
    [order[slotIndex], order[otherIndex]] = [order[otherIndex]!, order[slotIndex]!];
    setAdjustments((current) => ({ ...current, recipientOrder: order }));
  };

  const confirm = async () => {
    if (!snapshot || !draft) return;
    const result = await commit.execute({
      khatmaIds: snapshot.khatmas.map((khatma) => khatma.id),
      mode: snapshot.mode,
      expectedSourceRevision: draft.sourceRevision,
      adjustments,
      today: todayIso(),
      rolloverSeed: snapshot.rolloverSeed,
      unitOfPage: scopeMaps?.pageUnitMaps,
    });
    if (result.status === 'success') setSnapshot(null);
  };

  const changeCount =
    (draft?.allocations.length ?? 0) +
    (draft?.releases.length ?? 0) +
    (draft?.plan.completions.length ?? 0);
  const confirmDisabled =
    changeCount === 0 ||
    commit.isPending ||
    (draft?.plan.rollover !== undefined && !rolloverAcknowledged);

  return (
    <NestedSurface>
      <Stack spacing={2}>
        <Typography sx={{ fontWeight: 700 }}>
          {strings.admin.roundControlHeading}
        </Typography>
        <Typography color="text.secondary">
          {strings.admin.roundControlDescription}
        </Typography>
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <AppButton
            hero
            disabled={!assignmentsReady}
            onClick={() => openPlanner('new-round')}
          >
            {strings.admin.prepareNextRound}
          </AppButton>
          <AppButton
            variant="outlined"
            disabled={!assignmentsReady}
            onClick={() => openPlanner('adjust-current')}
          >
            {strings.admin.adjustCurrentRound}
          </AppButton>
        </Stack>
        {!assignmentsReady ? (
          <Typography color="text.secondary" role="status">
            {strings.admin.roundDataLoading}
          </Typography>
        ) : null}
        {scopeError ? (
          <Alert severity="error">{strings.admin.distributeError}</Alert>
        ) : null}
        {commit.state.status === 'success' ? (
          <Alert severity="success" role="status">
            <Stack component="span" spacing={0.5}>
              <Typography component="span">
                {commit.state.result.chunkCount === 0
                  ? strings.admin.zeroAssignmentSuccess
                  : strings.admin.roundCommitSuccess}
              </Typography>
              <Typography component="span" variant="body2">
                {strings.admin.savedAssignmentCount.replace(
                  '{count}',
                  toWesternDigits(commit.state.result.chunkCount),
                )}
              </Typography>
              {commit.state.result.rolloverKhatmaId ? (
                <Typography component="span" variant="body2">
                  {strings.admin.rolloverNote}
                </Typography>
              ) : null}
              {commit.state.result.completedKhatmaIds.length > 0 ? (
                <Typography component="span" variant="body2">
                  {strings.admin.completedNote}
                </Typography>
              ) : null}
            </Stack>
          </Alert>
        ) : null}
      </Stack>

      <Dialog
        open={snapshot !== null}
        onClose={close}
        fullWidth
        maxWidth="md"
        slotProps={{
          paper: {
            sx: (theme) => ({
              ...plannerGradient(theme, 'neutral'),
              overflow: 'hidden',
            }),
          },
        }}
      >
        <DialogTitle
          sx={(theme) => ({
            ...plannerGradient(theme, 'emerald'),
            borderRadius: 0,
            px: 4,
            py: 3,
          })}
        >
          {snapshot?.mode === 'adjust-current'
            ? strings.admin.adjustCurrentRound
            : strings.admin.prepareNextRound}
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {snapshot ? (
              <Stack
                spacing={1}
                sx={(theme) => ({
                  ...plannerGradient(theme, 'gold'),
                  p: 3,
                  borderRadius: `${theme.custom.radii.cardSm}px`,
                })}
              >
                <StatusChip
                  tone="accent"
                  label={`${strings.admin.roundWord} ${toWesternDigits(
                    snapshot.mode === 'adjust-current'
                      ? Math.max(
                          1,
                          ...snapshot.khatmas.map((khatma) => khatma.roundCount),
                        )
                      : Math.max(
                          0,
                          ...snapshot.khatmas.map((khatma) => khatma.roundCount),
                        ) + 1,
                  )}`}
                />
                <Typography color="text.secondary">
                  {strings.admin.roundPreviewSummary
                    .replace(
                      '{assignments}',
                      toWesternDigits(draft?.allocations.length ?? 0),
                    )
                    .replace('{skipped}', toWesternDigits(draft?.skipped.length ?? 0))}
                </Typography>
              </Stack>
            ) : null}

            {draft?.plan.rollover ? (
              <Alert
                severity="warning"
                sx={(theme) => ({
                  ...plannerGradient(theme, 'gold'),
                  borderRadius: `${theme.custom.radii.cardSm}px`,
                })}
              >
                {strings.admin.rolloverPreview.replace(
                  '{number}',
                  toWesternDigits(snapshot?.newKhatmaSeriesNumber ?? 0),
                )}
              </Alert>
            ) : null}

            {snapshot ? (
              <Accordion
                expanded={advancedOpen}
                onChange={(_, expanded) => setAdvancedOpen(expanded)}
                disableGutters
                sx={(theme) => ({
                  ...plannerGradient(theme, 'neutral'),
                  borderRadius: `${theme.custom.radii.cardSm}px !important`,
                  overflow: 'hidden',
                  '&::before': { display: 'none' },
                })}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  sx={(theme) => ({
                    ...plannerGradient(theme, 'gold'),
                    border: 0,
                    boxShadow: 'none',
                  })}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {strings.admin.optionalRoundAdjustments}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails
                  sx={(theme) => ({
                    ...plannerGradient(theme, 'neutral'),
                    border: 0,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    boxShadow: 'none',
                  })}
                >
                  <Stack spacing={2}>
                    {snapshot.members.map((member, memberIndex) => {
                      const adjustment = adjustments.members[member.id];
                      const capacity = adjustment?.capacity ?? member.capacity;
                      const pending = snapshot.khatmas.some((khatma) =>
                        khatma.assignments.some(
                          (assignment) =>
                            assignment.memberId === member.id &&
                            pendingChunks(assignment).length > 0,
                        ),
                      );
                      return (
                        <Box
                          key={member.id}
                          sx={(theme) => ({
                            ...plannerGradient(
                              theme,
                              memberIndex % 2 === 0 ? 'neutral' : 'gold',
                            ),
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '1fr',
                              md: 'minmax(180px, 1fr) 150px 220px',
                            },
                            gap: 2,
                            alignItems: 'center',
                            p: 2,
                            borderRadius: `${theme.custom.radii.button}px`,
                            boxShadow: 'none',
                          })}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={member.enabled && adjustment?.include !== false}
                                disabled={!member.enabled}
                                onChange={(_, checked) =>
                                  updateMember(member.id, { include: checked })
                                }
                              />
                            }
                            label={memberName(roster, member.id)}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label={strings.admin.roundCapacity}
                            value={capacity.pages}
                            slotProps={{ htmlInput: { min: 0, max: 604 } }}
                            onChange={(event) =>
                              updateMember(member.id, {
                                capacity: {
                                  ...capacity,
                                  pages: Math.max(0, Number(event.target.value) || 0),
                                },
                              })
                            }
                          />
                          {pending && snapshot.mode === 'new-round' ? (
                            <FormControl size="small">
                              <InputLabel>{strings.admin.pendingPageDecision}</InputLabel>
                              <Select
                                label={strings.admin.pendingPageDecision}
                                value={
                                  adjustment?.pendingDecision ??
                                  (member.holdPages ? 'add' : 'keep')
                                }
                                onChange={(event) =>
                                  updateMember(member.id, {
                                    pendingDecision: event.target
                                      .value as PendingPageDecision,
                                  })
                                }
                              >
                                <MenuItem value="keep">
                                  {strings.admin.keepAndSkip}
                                </MenuItem>
                                <MenuItem value="release">
                                  {strings.admin.returnAndReassign}
                                </MenuItem>
                                <MenuItem value="add">
                                  {strings.admin.keepAndAdd}
                                </MenuItem>
                              </Select>
                            </FormControl>
                          ) : (
                            <Typography color="text.secondary">
                              {member.enabled
                                ? strings.admin.memberReadyForPlanning
                                : strings.admin.memberDisabledForPlanning}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ) : null}

            {draft ? (
              <Stack
                component="section"
                spacing={2}
                sx={(theme) => ({
                  ...plannerGradient(theme, 'emerald'),
                  p: 3,
                  borderRadius: `${theme.custom.radii.cardSm}px`,
                })}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  {strings.admin.proposedAssignments} (
                  {toWesternDigits(draft.allocations.length)})
                </Typography>
                {draft.allocations.length === 0 ? (
                  <Alert
                    severity="info"
                    sx={(theme) => ({
                      ...plannerGradient(theme, 'neutral'),
                      borderRadius: `${theme.custom.radii.button}px`,
                    })}
                  >
                    {strings.admin.noProposedAssignments}
                  </Alert>
                ) : (
                  draft.allocations.map((allocation, index) => (
                    <Box
                      key={allocation.slotId}
                      sx={(theme) => ({
                        ...plannerGradient(theme, index % 2 === 0 ? 'neutral' : 'gold'),
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                        gap: 2,
                        alignItems: 'center',
                        p: 2,
                        borderRadius: `${theme.custom.radii.button}px`,
                        boxShadow: 'none',
                      })}
                    >
                      {allocation.swappableMemberIds.length > 1 ? (
                        <FormControl size="small">
                          <InputLabel id={`swap-recipient-${allocation.slotId}`}>
                            {strings.admin.swapPagesWith}
                          </InputLabel>
                          <Select
                            labelId={`swap-recipient-${allocation.slotId}`}
                            label={strings.admin.swapPagesWith}
                            value={allocation.memberId}
                            onChange={(event) => swapRecipient(index, event.target.value)}
                          >
                            {allocation.swappableMemberIds.map((memberId) => (
                              <MenuItem key={memberId} value={memberId}>
                                {memberName(roster, memberId)}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Typography sx={{ fontWeight: 600 }}>
                          {memberName(roster, allocation.memberId)}
                        </Typography>
                      )}
                      <Typography>{pageRanges(allocation.pages)}</Typography>
                      <StatusChip
                        tone={allocation.khatmaId === null ? 'warning' : 'accent'}
                        label={
                          allocation.khatmaId === null
                            ? `${group.seriesName} ${toWesternDigits(snapshot?.newKhatmaSeriesNumber ?? 0)}`
                            : seriesTitle(
                                group.active.find(
                                  (khatma) => khatma.id === allocation.khatmaId,
                                ) ?? group.latest,
                                toWesternDigits,
                              )
                        }
                      />
                    </Box>
                  ))
                )}
              </Stack>
            ) : null}

            {draft && draft.releases.length > 0 ? (
              <Alert
                severity="warning"
                sx={(theme) => ({
                  ...plannerGradient(theme, 'gold'),
                  borderRadius: `${theme.custom.radii.cardSm}px`,
                })}
              >
                {strings.admin.pagesReturnedPreview.replace(
                  '{count}',
                  toWesternDigits(
                    draft.releases.reduce(
                      (sum, release) => sum + release.pages.length,
                      0,
                    ),
                  ),
                )}
              </Alert>
            ) : null}

            {draft && draft.skipped.length > 0 ? (
              <Accordion
                disableGutters
                sx={(theme) => ({
                  ...plannerGradient(theme, 'gold'),
                  borderRadius: `${theme.custom.radii.cardSm}px !important`,
                  overflow: 'hidden',
                  '&::before': { display: 'none' },
                })}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  sx={(theme) => ({
                    ...plannerGradient(theme, 'gold'),
                    border: 0,
                    boxShadow: 'none',
                  })}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {strings.admin.skippedMembers} (
                    {toWesternDigits(draft.skipped.length)})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails
                  sx={(theme) => ({
                    ...plannerGradient(theme, 'neutral'),
                    border: 0,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    boxShadow: 'none',
                  })}
                >
                  <Stack spacing={1}>
                    {draft.skipped.map((skip) => (
                      <Typography key={skip.memberId} color="text.secondary">
                        {memberName(roster, skip.memberId)} · {skipReason(skip.reason)}
                      </Typography>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ) : null}

            {draft?.plan.rollover ? (
              <Box
                sx={(theme) => ({
                  ...plannerGradient(theme, 'gold'),
                  p: 2,
                  borderRadius: `${theme.custom.radii.cardSm}px`,
                })}
              >
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox
                      checked={rolloverAcknowledged}
                      onChange={(_, checked) => setRolloverAcknowledged(checked)}
                    />
                  }
                  label={strings.admin.confirmRolloverBoundary}
                />
              </Box>
            ) : null}

            {changeCount === 0 ? (
              <Alert
                severity="info"
                sx={(theme) => ({
                  ...plannerGradient(theme, 'neutral'),
                  borderRadius: `${theme.custom.radii.cardSm}px`,
                })}
              >
                {strings.admin.noDistributionChanges}
              </Alert>
            ) : null}
            {commit.state.status === 'failure' ? (
              <Alert
                severity="error"
                role="alert"
                sx={(theme) => ({
                  ...plannerGradient(theme, 'neutral'),
                  borderColor: theme.palette.error.main,
                  borderRadius: `${theme.custom.radii.cardSm}px`,
                })}
              >
                {commit.state.error.name === 'StaleDistributionDraftError'
                  ? 'reason' in commit.state.error &&
                    commit.state.error.reason === 'rollover-metadata'
                    ? strings.admin.staleRolloverPreview
                    : strings.admin.staleDistributionPreview
                  : commit.state.error.name === 'NoDistributionChangesError'
                    ? strings.admin.noDistributionChanges
                    : strings.admin.distributeError}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={(theme) => ({
            ...plannerGradient(theme, 'gold'),
            borderRadius: 0,
            px: 4,
            py: 3,
          })}
        >
          <AppButton variant="text" quiet color="inherit" onClick={close}>
            {strings.common.cancel}
          </AppButton>
          <AppButton disabled={confirmDisabled} onClick={() => void confirm()}>
            {strings.admin.confirmAndStartRound}
          </AppButton>
        </DialogActions>
      </Dialog>
    </NestedSurface>
  );
}
