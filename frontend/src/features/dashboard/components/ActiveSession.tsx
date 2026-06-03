import type {
  WorkoutSessionWithExercises,
  WorkoutSessionExercise,
  WorkoutSessionSet,
  EditableSet,
} from '@/types';
import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { cn } from '@/lib/utils';
import { X, MessageSquare, Trash2, Plus, ArrowLeft, ArrowRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ActiveSessionProps {
  session: WorkoutSessionWithExercises;
  previousSession?: WorkoutSessionWithExercises | null;
  onComplete: (editedSets: EditableSet[][]) => void;
  onCancel?: () => void;
  isCancelling?: boolean;
  initialEditableSets?: EditableSet[][];
  initialExerciseIndex?: number;
  onStateChange?: (sets: EditableSet[][], idx: number) => void;
}

type SetDelta = {
  difference: number;
  direction: 'up' | 'down' | 'neutral';
} | null;

function buildEditableSets(session: WorkoutSessionWithExercises): EditableSet[][] {
  return session.exercises.map((exercise) =>
    exercise.sets.map((set) => ({
      setNumber: set.setNumber,
      reps: set.reps,
      weight: set.weight,
      durationSeconds: set.durationSeconds,
      restSeconds: set.restSeconds,
      notes: set.notes,
      isCompleted: false,
    }))
  );
}

const getPreviousExercise = (
  currentExercise: WorkoutSessionExercise,
  previousExercises: WorkoutSessionExercise[]
) => {
  const byExerciseId = previousExercises.find(
    (exercise) => exercise.exerciseId === currentExercise.exerciseId
  );

  if (byExerciseId) {
    return byExerciseId;
  }

  return previousExercises.find(
    (exercise) => exercise.exerciseName === currentExercise.exerciseName
  );
};

const getSetDelta = (
  currentValue: number | undefined,
  previousValue: number | undefined
): SetDelta => {
  if (currentValue === undefined || previousValue === undefined) {
    return null;
  }

  const difference = currentValue - previousValue;
  if (difference > 0) {
    return { difference, direction: 'up' };
  }

  if (difference < 0) {
    return { difference, direction: 'down' };
  }

  return { difference, direction: 'neutral' };
};

const formatSignedDelta = (delta: SetDelta, unit: string) => {
  if (!delta || delta.direction === 'neutral') {
    return null;
  }

  return `${delta.difference > 0 ? '+' : ''}${delta.difference} ${unit}`;
};

const getDeltaClasses = (delta: SetDelta) => {
  if (!delta || delta.direction === 'neutral') {
    return 'text-muted-foreground border-border';
  }

  return delta.direction === 'up'
    ? 'text-green-500 border-green-500/30'
    : 'text-red-500 border-red-500/30';
};

const getSetSummary = (set: EditableSet | WorkoutSessionSet) => {
  const parts: string[] = [];

  if (set.reps !== undefined) {
    parts.push(`${set.reps} reps`);
  }

  if (set.weight !== undefined) {
    parts.push(`${set.weight} kg`);
  }

  if (set.durationSeconds !== undefined && set.durationSeconds > 0) {
    parts.push(`${set.durationSeconds} seg`);
  }

  return parts.join(' · ') || 'Sin datos';
};

const normalizeLabel = (value: string | undefined) =>
  (value ?? '').trim().toLocaleLowerCase('es-ES');

export default function ActiveSession({
  session,
  previousSession,
  onComplete,
  onCancel,
  isCancelling = false,
  initialEditableSets,
  initialExerciseIndex,
  onStateChange,
}: ActiveSessionProps) {
  const [currentIdx, setCurrentIdx] = useState(initialExerciseIndex ?? 0);
  const [editableSets, setEditableSets] = useState<EditableSet[][]>(() =>
    initialEditableSets ?? buildEditableSets(session)
  );
  const [activeSetIdx, setActiveSetIdx] = useState(0);
  const [animatingExercise, setAnimatingExercise] = useState(false);
  const [animatingSet, setAnimatingSet] = useState(false);
  const [setTransitionPhase, setSetTransitionPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [isDraggingSet, setIsDraggingSet] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [slideDir, setSlideDir] = useState(0);
  const [setCardSlideDir, setSetCardSlideDir] = useState(0);
  const [setPulse, setSetPulse] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    exerciseIdx: number;
    setIdx: number;
  } | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const editableSetsRef = useRef(editableSets);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    editableSetsRef.current = editableSets;
  }, [editableSets]);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIdx, activeSetIdx]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange(editableSets, currentIdx);
    }
  }, [editableSets, currentIdx, onStateChange]);

  const exercise = session.exercises[currentIdx];
  const currentSets = editableSets[currentIdx];
  const totalCompletedExercises = editableSets.filter((sets) =>
    sets.every((set) => set.isCompleted)
  ).length;
  const pendingSetCount = editableSets.reduce(
    (total, sets) => total + sets.filter((set) => !set.isCompleted).length,
    0
  );
  const allSetsCompleted = pendingSetCount === 0;

  const isExerciseCompleted = currentSets.every((set) => set.isCompleted);
  const activeSet = currentSets[activeSetIdx];
  const showMuscleGroupTag =
    normalizeLabel(exercise.muscleGroup) !== normalizeLabel(session.title);

  useEffect(() => {
    const firstPendingSetIdx = currentSets.findIndex((set) => !set.isCompleted);

    if (firstPendingSetIdx === -1) {
      setActiveSetIdx(0);
      return;
    }

    setActiveSetIdx((prev) => (prev >= currentSets.length ? firstPendingSetIdx : prev));
  }, [currentIdx, currentSets]);

  const previousExercise = useMemo(() => {
    if (!previousSession) {
      return undefined;
    }

    return getPreviousExercise(exercise, previousSession.exercises);
  }, [exercise, previousSession]);

  const previousSetsByNumber = useMemo(
    () => new Map((previousExercise?.sets ?? []).map((set) => [set.setNumber, set])),
    [previousExercise]
  );

  const activePreviousSet = activeSet
    ? previousSetsByNumber.get(activeSet.setNumber)
    : undefined;

  const repsDelta = getSetDelta(activeSet?.reps, activePreviousSet?.reps);
  const weightDelta = getSetDelta(activeSet?.weight, activePreviousSet?.weight);
  const durationDelta = getSetDelta(
    activeSet?.durationSeconds,
    activePreviousSet?.durationSeconds
  );
  const restDelta = getSetDelta(activeSet?.restSeconds, activePreviousSet?.restSeconds);

  const repsDeltaLabel = formatSignedDelta(repsDelta, 'reps');
  const weightDeltaLabel = formatSignedDelta(weightDelta, 'kg');
  const durationDeltaLabel = formatSignedDelta(durationDelta, 'seg');
  const restDeltaLabel = formatSignedDelta(restDelta, 'seg desc');

  const updateSetField = (
    exerciseIdx: number,
    setIdx: number,
    field: keyof EditableSet,
    value: number | string | boolean | undefined
  ) => {
    setEditableSets((prev) =>
      prev.map((sets, ei) =>
        ei === exerciseIdx
          ? sets.map((set, si) => (si === setIdx ? { ...set, [field]: value } : set))
          : sets
      )
    );
  };

  const goToExercise = (idx: number, dir: number) => {
    if (idx < 0 || idx >= session.exercises.length || animatingExercise) return;

    setAnimatingExercise(true);
    setSlideDir(dir);

    setTimeout(() => {
      setCurrentIdx(idx);

      const nextSets = editableSetsRef.current[idx];
      const nextPendingSetIdx = nextSets.findIndex((set) => !set.isCompleted);
      setActiveSetIdx(nextPendingSetIdx === -1 ? 0 : nextPendingSetIdx);

      setSlideDir(0);
      setAnimatingExercise(false);
    }, 280);
  };

  const goToSet = (setIdx: number) => {
    if (setIdx < 0 || setIdx >= currentSets.length || animatingSet || setIdx === activeSetIdx) {
      return;
    }

    const direction = setIdx > activeSetIdx ? 1 : -1;
    setSetCardSlideDir(direction);
    setAnimatingSet(true);
    setSetTransitionPhase('out');

    setTimeout(() => {
      setActiveSetIdx(setIdx);
      setSetTransitionPhase('in');

      setTimeout(() => {
        setSetCardSlideDir(0);
        setAnimatingSet(false);
        setSetTransitionPhase('idle');
      }, 120);
    }, 120);
  };

  const handleSetTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (animatingSet) {
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDraggingSet(false);
    setDragOffsetX(0);
  };

  const handleSetTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start || animatingSet) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    const isHorizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) + 8;
    if (!isHorizontalIntent) {
      return;
    }

    event.preventDefault();
    setIsDraggingSet(true);

    const isFirstSet = activeSetIdx === 0;
    const isLastSet = activeSetIdx === currentSets.length - 1;
    const blocked = (isFirstSet && deltaX > 0) || (isLastSet && deltaX < 0);
    const adjustedDeltaX = blocked ? deltaX * 0.35 : deltaX;
    setDragOffsetX(adjustedDeltaX);
  };

  const handleSetTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    touchStartRef.current = null;

    if (!isDraggingSet) {
      setDragOffsetX(0);
      return;
    }

    setIsDraggingSet(false);
    setDragOffsetX(0);

    const isHorizontalSwipe =
      Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) + 12;
    if (!isHorizontalSwipe) {
      return;
    }

    if (animatingSet) {
      return;
    }

    if (deltaX < 0) {
      goToSet(activeSetIdx + 1);
      return;
    }

    goToSet(activeSetIdx - 1);
  };

  const handleSetTouchCancel = () => {
    touchStartRef.current = null;
    setIsDraggingSet(false);
    setDragOffsetX(0);
  };

  const toggleNotes = (setIdx: number) => {
    const key = `${currentIdx}-${setIdx}`;
    setExpandedNotes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const performDeleteSet = (exerciseIdx: number, setIdx: number) => {
    setEditableSets((prev) =>
      prev.map((sets, ei) => {
        if (ei !== exerciseIdx || sets.length <= 1) {
          return sets;
        }

        return sets
          .filter((_, si) => si !== setIdx)
          .map((set, index) => ({
            ...set,
            setNumber: index + 1,
          }));
      })
    );

    setActiveSetIdx((prev) => {
      if (prev === setIdx) {
        return Math.max(0, prev - 1);
      }

      if (prev > setIdx) {
        return prev - 1;
      }

      return prev;
    });

    setDeleteConfirm(null);
  };

  const deleteSet = (exerciseIdx: number, setIdx: number) => {
    const set = editableSets[exerciseIdx]?.[setIdx];
    if (!set) {
      return;
    }

    if (set.isCompleted) {
      setDeleteConfirm({ exerciseIdx, setIdx });
      return;
    }

    performDeleteSet(exerciseIdx, setIdx);
  };

  const addSet = (exerciseIdx: number) => {
    const shouldMoveToNewSet = editableSets[exerciseIdx]?.[activeSetIdx]?.isCompleted;

    setEditableSets((prev) =>
      prev.map((sets, ei) =>
        ei === exerciseIdx
          ? [
            ...sets,
            {
              setNumber: sets.length + 1,
              reps: undefined,
              weight: undefined,
              durationSeconds: undefined,
              restSeconds: undefined,
              notes: undefined,
              isCompleted: false,
            },
          ]
          : sets
      )
    );

    if (shouldMoveToNewSet) {
      setActiveSetIdx(currentSets.length);
    }
  };

  const completeSet = () => {
    if (!activeSet || activeSet.isCompleted) {
      return;
    }

    setSetPulse(true);
    setTimeout(() => setSetPulse(false), 250);

    const updatedSets = editableSetsRef.current.map((sets, exerciseIdx) =>
      exerciseIdx === currentIdx
        ? sets.map((set, setIdx) =>
            setIdx === activeSetIdx ? { ...set, isCompleted: true } : set
          )
        : sets
    );

    setEditableSets(updatedSets);
    editableSetsRef.current = updatedSets;

    const currentSetsSnapshot = updatedSets[currentIdx];
    const nextPendingInExercise = currentSetsSnapshot.findIndex((set) => !set.isCompleted);

    if (nextPendingInExercise >= 0) {
      setTimeout(() => {
        goToSet(nextPendingInExercise);
      }, 220);
      return;
    }

    const allSetsCompletedAfterCurrent = updatedSets.every((sets) =>
      sets.every((set) => set.isCompleted)
    );

    if (allSetsCompletedAfterCurrent) {
      setTimeout(() => {
        onComplete(updatedSets);
      }, 450);
      return;
    }

    const nextExerciseWithPendingIdx = updatedSets.findIndex((sets) =>
      sets.some((set) => !set.isCompleted)
    );

    if (nextExerciseWithPendingIdx === -1 || nextExerciseWithPendingIdx === currentIdx) {
      return;
    }

    goToExercise(
      nextExerciseWithPendingIdx,
      nextExerciseWithPendingIdx > currentIdx ? 1 : -1
    );
  };

  const finishSessionNow = () => {
    setShowFinishConfirm(false);
    onComplete(editableSetsRef.current);
  };

  const parseNumericInput = (raw: string, integer: boolean): number | undefined => {
    if (raw === '') return undefined;
    const n = integer ? parseInt(raw, 10) : parseFloat(raw);
    if (Number.isNaN(n) || n < 0) return undefined;
    return n;
  };

  const progress = (totalCompletedExercises / session.exercises.length) * 100;
  const animatedSetOffset =
    animatingSet && setTransitionPhase === 'out'
      ? setCardSlideDir > 0
        ? -16
        : 16
      : animatingSet && setTransitionPhase === 'in'
        ? setCardSlideDir > 0
          ? 16
          : -16
        : 0;

  const cardOffsetX = isDraggingSet ? dragOffsetX : animatedSetOffset;
  const cardOpacity = isDraggingSet
    ? Math.max(0.78, 1 - Math.abs(dragOffsetX) / 280)
    : animatingSet
      ? 0
      : 1;

  return (
    <div
      className={cn(
        'flex flex-col h-full w-full transition-opacity duration-400 ease-in-out',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {showCancelConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-8 w-full max-w-sm border border-border bg-background p-8 space-y-6">
            <div>
              <div className="font-bebas text-2xl tracking-[2px] text-foreground mb-2">
                CANCELAR SESIÓN
              </div>
              <p className="font-barlow text-sm text-muted-foreground">
                Se perderá todo el progreso de esta sesión. Esta acción no se puede
                deshacer.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  onCancel?.();
                }}
                disabled={isCancelling}
                className="w-full bg-destructive border-none text-destructive-foreground font-bebas text-[18px] tracking-[3px] py-4 cursor-pointer transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? 'CANCELANDO...' : 'CANCELAR SESIÓN'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="w-full bg-transparent border border-border text-muted-foreground font-barlow text-[13px] tracking-[3px] py-4 cursor-pointer hover:bg-muted/20 transition-colors disabled:opacity-50"
              >
                CONTINUAR ENTRENANDO
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-8 w-full max-w-sm border border-border bg-background p-8 space-y-6">
            <div>
              <div className="font-bebas text-2xl tracking-[2px] text-foreground mb-2">
                ELIMINAR SET COMPLETADO
              </div>
              <p className="font-barlow text-sm text-muted-foreground">
                Este set ya esta marcado como completado. Quieres eliminarlo?
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() =>
                  performDeleteSet(deleteConfirm.exerciseIdx, deleteConfirm.setIdx)
                }
                className="w-full bg-destructive border-none text-destructive-foreground font-bebas text-[18px] tracking-[3px] py-4 cursor-pointer transition-colors hover:bg-destructive/90"
              >
                ELIMINAR SET
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="w-full bg-transparent border border-border text-muted-foreground font-barlow text-[13px] tracking-[3px] py-4 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinishConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-8 w-full max-w-sm border border-border bg-background p-8 space-y-6">
            <div>
              <div className="font-bebas text-2xl tracking-[2px] text-foreground mb-2">
                COMPLETAR SESIÓN
              </div>
              <p className="font-barlow text-sm text-muted-foreground">
                {pendingSetCount > 0
                  ? `Quedan ${pendingSetCount} sets sin completar. Si continúas, la sesión se guardará como completada con el progreso actual.`
                  : 'Todos los sets están completos. ¿Deseas guardar y completar la sesión?'}
              </p>
            </div>
            <div className="flex flex-col gap-3">
                <button
                  onClick={finishSessionNow}
                  className="w-full bg-primary border-none text-black font-bebas text-[18px] tracking-[3px] py-4 cursor-pointer transition-colors hover:bg-primary/90"
                >
                  COMPLETAR Y GUARDAR
                </button>
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="w-full bg-transparent border border-border text-muted-foreground font-barlow text-[13px] tracking-[3px] py-4 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                SEGUIR ENTRENANDO
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex-1 flex flex-col p-8 pt-4 overflow-y-auto transition-all duration-300 ease-in-out',
          animatingExercise ? 'opacity-0' : 'opacity-100'
        )}
        style={{
          transform: animatingExercise ? `translateX(${slideDir * -56}px)` : 'translateX(0)',
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 flex flex-wrap">
            <div className="font-barlow text-[11px] tracking-[3px] text-primary uppercase leading-5">
              {session.title}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <div className="font-bebas text-[20px] sm:text-[24px] text-primary leading-none">
              {String(currentIdx + 1).padStart(2, '0')}
              <span className="text-[12px] sm:text-[14px] text-muted-foreground mx-0.5">/</span>
              <span className="text-[12px] sm:text-[14px] text-muted-foreground">
                {String(session.exercises.length).padStart(2, '0')}
              </span>
            </div>

            {onCancel && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Cancelar sesión"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {showMuscleGroupTag && (
          <div className="font-barlow text-[10px] tracking-[4px] text-primary font-semibold mb-3 uppercase">
            {exercise.muscleGroup}
          </div>
        )}

        <div
          className={cn(
            'font-bebas text-[clamp(40px,10vw,64px)] leading-[0.9] tracking-[2px] mb-5 transition-colors duration-300 ease-in-out',
            isExerciseCompleted ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {exercise.exerciseName}
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-4">
          {currentSets.map((set, index) => (
            <button
              key={`set-dot-${set.setNumber}`}
              onClick={() => goToSet(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-200',
                index === activeSetIdx
                  ? set.isCompleted
                    ? 'w-6 bg-primary'
                    : 'w-6 bg-border'
                  : set.isCompleted
                    ? 'w-2 bg-primary/70'
                    : 'w-2 bg-border'
              )}
              aria-label={`Ir al set ${set.setNumber}`}
            />
          ))}
        </div>

        {activeSet && (
          <div
            ref={cardRef}
            onTouchStart={handleSetTouchStart}
            onTouchMove={handleSetTouchMove}
            onTouchEnd={handleSetTouchEnd}
            onTouchCancel={handleSetTouchCancel}
            className={cn(
              'border border-primary/40 bg-primary/5 rounded-none p-4 sm:p-5 transition-all duration-140 ease-out touch-pan-y',
              setPulse ? 'scale-[0.98]' : 'scale-100',
              isDraggingSet && 'transition-none'
            )}
            style={{
              transform: `translateX(${cardOffsetX}px)`,
              opacity: cardOpacity,
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="font-barlow text-[11px] tracking-[3px] text-secondary-foreground font-semibold uppercase">
                Set actual · {activeSet.setNumber}
              </div>
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-150',
                  activeSet.isCompleted
                    ? 'bg-primary shadow-[0_0_8px_var(--orange-glow)]'
                    : 'bg-transparent border border-border'
                )}
              />
            </div>

            <div className='grid grid-cols-6'>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 col-span-5">
                <SetInput
                  label="Reps"
                  value={activeSet.reps}
                  onChange={(value) =>
                    updateSetField(currentIdx, activeSetIdx, 'reps', parseNumericInput(value, true))
                  }
                  integer
                />

                <SetInput
                  label="Peso (kg) "
                  value={activeSet.weight}
                  onChange={(value) =>
                    updateSetField(
                      currentIdx,
                      activeSetIdx,
                      'weight',
                      parseNumericInput(value, false)
                    )
                  }
                  step="0.5"
                  integer={false}
                />

                <SetInput
                  label="Duración (seg)"
                  value={activeSet.durationSeconds}
                  onChange={(value) =>
                    updateSetField(
                      currentIdx,
                      activeSetIdx,
                      'durationSeconds',
                      parseNumericInput(value, true)
                    )
                  }
                  integer
                />

                <SetInput
                  label="Descanso (seg)"
                  value={activeSet.restSeconds}
                  onChange={(value) =>
                    updateSetField(
                      currentIdx,
                      activeSetIdx,
                      'restSeconds',
                      parseNumericInput(value, true)
                    )
                  }
                  integer
                />
              </div>
              <div className="flex flex-col items-center justify-center gap-12 col-span-1 sm:flex-row sm:gap-4 ">

                {currentSets.length > 1 && (
                  <button
                    onClick={() => deleteSet(currentIdx, activeSetIdx)}
                    className="p-1 text-destructive hover:text-destructive/80 transition-colors"
                    aria-label="Eliminar set"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  onClick={() => toggleNotes(activeSetIdx)}
                  className={cn(
                    'p-1 transition-colors',
                    activeSet.notes
                      ? 'text-primary'
                      : 'text-muted-foreground/40 hover:text-muted-foreground'
                  )}
                  aria-label="Notas"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>



            {!!expandedNotes[`${currentIdx}-${activeSetIdx}`] && (
              <div className="mt-3">
                <input
                  type="text"
                  value={activeSet.notes ?? ''}
                  onChange={(event) =>
                    updateSetField(
                      currentIdx,
                      activeSetIdx,
                      'notes',
                      event.target.value || undefined
                    )
                  }
                  placeholder="Notas del set..."
                  className="w-full bg-transparent border border-border rounded-none px-2 py-1.5 font-barlow text-[11px] tracking-[1px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  maxLength={500}
                />
              </div>
            )}

            <div className="mt-4 border-t border-border pt-3 space-y-2">
              <div className="text-[10px] font-barlow tracking-[2px] uppercase text-muted-foreground">
                Comparación con sesión anterior
              </div>

              {activePreviousSet ? (
                <>
                  <div className="text-xs font-barlow text-muted-foreground">
                    Anterior (set {activePreviousSet.setNumber}): {getSetSummary(activePreviousSet)}
                  </div>
                  {(repsDeltaLabel || weightDeltaLabel || durationDeltaLabel || restDeltaLabel) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {repsDeltaLabel && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-barlow uppercase tracking-[2px] ${getDeltaClasses(repsDelta)}`}
                        >
                          {repsDeltaLabel}
                        </span>
                      )}
                      {weightDeltaLabel && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-barlow uppercase tracking-[2px] ${getDeltaClasses(weightDelta)}`}
                        >
                          {weightDeltaLabel}
                        </span>
                      )}
                      {durationDeltaLabel && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-barlow uppercase tracking-[2px] ${getDeltaClasses(durationDelta)}`}
                        >
                          {durationDeltaLabel}
                        </span>
                      )}
                      {restDeltaLabel && (
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-barlow uppercase tracking-[2px] text-muted-foreground border-border"
                        >
                          {restDeltaLabel}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-barlow uppercase tracking-[2px] text-primary">
                  Nuevo set
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 hidden sm:flex items-center justify-between gap-3">
          <button
            onClick={() => goToSet(activeSetIdx - 1)}
            disabled={activeSetIdx === 0 || animatingSet}
            className={cn(
              'flex items-center gap-2 bg-transparent border-none font-barlow text-[11px] tracking-[2px] p-0',
              activeSetIdx === 0
                ? 'text-border cursor-default'
                : 'text-muted-foreground cursor-pointer'
            )}
          >
            <ArrowLeft className='w-4 h-4 mr-2'/> SET ANTERIOR
          </button>

          <button
            onClick={() => addSet(currentIdx)}
            disabled={animatingExercise}
            className="flex items-center gap-2 justify-between border border-dashed border-border rounded-none px-5 py-2 font-barlow text-[10px] tracking-[3px] uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className='w-4 h-4' /> SET
          </button>

          <button
            onClick={() => goToSet(activeSetIdx + 1)}
            disabled={activeSetIdx === currentSets.length - 1 || animatingSet}
            className={cn(
              'flex items-center gap-2 bg-transparent border-none font-barlow text-[11px] tracking-[2px] p-0',
              activeSetIdx === currentSets.length - 1
                ? 'text-border cursor-default'
                : 'text-muted-foreground cursor-pointer'
            )}
          >
            SIGUIENTE SET <ArrowRight className='w-4 h-4 mr-2'/>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
          <div className="font-barlow text-[10px] tracking-[2px] text-muted-foreground uppercase">
            Desliza para cambiar set
          </div>
          <button
            onClick={() => addSet(currentIdx)}
            disabled={animatingExercise}
            className="flex items-center gap-2 border border-dashed border-border rounded-none px-4 py-1.5 font-barlow text-[10px] tracking-[3px] uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className='w-4 h-4' /> SET
          </button>
        </div>
      </div>

      <div className="px-8 pb-5">
        <button
          onClick={completeSet}
          disabled={isExerciseCompleted || !activeSet || activeSet.isCompleted}
          className={cn(
            'w-full font-bebas text-[20px] tracking-[4px] py-[18px] transition-all duration-300 ease-in-out',
            isExerciseCompleted || !activeSet || activeSet.isCompleted
              ? 'bg-transparent border border-border text-muted-foreground cursor-default'
              : 'bg-primary border-none text-black cursor-pointer',
            setPulse ? 'scale-[0.97]' : 'scale-100'
          )}
        >
          {isExerciseCompleted
            ? 'EJERCICIO COMPLETADO'
            : activeSet?.isCompleted
              ? 'SET COMPLETADO'
              : 'COMPLETAR SET'}
        </button>
      </div>

        <div className="px-8 pb-4">
        <button
          onClick={() => setShowFinishConfirm(true)}
          className="w-full bg-transparent border border-border text-muted-foreground font-barlow text-[12px] tracking-[3px] py-3 cursor-pointer hover:bg-muted/20 transition-colors"
        >
          {allSetsCompleted ? 'COMPLETAR SESIÓN' : 'COMPLETAR SESIÓN'}
        </button>
      </div>

      <div className="px-8 pb-7">
        <div className="h-0.5 bg-border rounded-sm overflow-hidden">
          <div
            className="h-full bg-primary rounded-sm transition-[width] duration-400 ease-in-out shadow-[0_0_6px_var(--orange-glow)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between px-8 pb-4">
        <button
          onClick={() => goToExercise(currentIdx - 1, -1)}
          disabled={currentIdx === 0}
          className={cn(
            'flex items-center gap-2 bg-transparent border-none font-barlow text-[11px] tracking-[2px] p-0',
            currentIdx === 0
              ? 'text-border cursor-default'
              : 'text-muted-foreground cursor-pointer'
          )}
        >
          <ArrowLeft className='w-4 h-4 mr-2'/> EJERCICIO ANTERIOR
        </button>
        <button
          onClick={() => goToExercise(currentIdx + 1, 1)}
          disabled={currentIdx === session.exercises.length - 1}
          className={cn(
            'flex items-center gap-2 bg-transparent border-none font-barlow text-[11px] tracking-[2px] p-0',
            currentIdx === session.exercises.length - 1
              ? 'text-border cursor-default'
              : 'text-muted-foreground cursor-pointer'
          )}
        >
          SIGUIENTE EJERCICIO <ArrowRight className='w-4 h-4 ml-2'/>
        </button>
      </div>
    </div>
  );
}

interface SetInputProps {
  label: string;
  value: number | undefined;
  onChange: (raw: string) => void;
  step?: string;
  integer?: boolean;
}

function SetInput({ label, value, onChange, step, integer = true }: SetInputProps) {
  return (
    <div className="space-y-1">
      <Label className="font-barlow text-[9px] tracking-[2px] text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        step={step ?? '1'}
        min="0"
        className="bg-transparent border border-border rounded-none px-1.5 py-1 font-bebas text-[18px] text-foreground text-center focus:outline-none focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}
