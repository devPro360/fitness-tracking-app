// src/features/workouts/pages/WorkoutDetailPage.tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Dumbbell,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useWorkoutSession, useDeleteSession } from "../hooks/useWorkoutSessions";
import { workoutSessionsApi } from "@/api/endpoints/workoutSessions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkoutSessionExercise, WorkoutSessionSet, WorkoutSessionWithExercises } from "@/types";

type SessionMetrics = {
  totalVolume: number;
  totalReps: number;
  totalCompletedSets: number;
};

type SetDelta = {
  difference: number;
  direction: 'up' | 'down' | 'neutral';
} | null;

const getSessionTimestamp = (session: { sessionDate: string; createdAt?: string }) => {
  const sessionDateTime = new Date(session.sessionDate).getTime();
  if (!Number.isNaN(sessionDateTime) && sessionDateTime > 0) {
    return sessionDateTime;
  }

  if (session.createdAt) {
    const createdAtTime = new Date(session.createdAt).getTime();
    if (!Number.isNaN(createdAtTime) && createdAtTime > 0) {
      return createdAtTime;
    }
  }

  return 0;
};

const calculateMetrics = (workoutSession: WorkoutSessionWithExercises | null): SessionMetrics => {
  if (!workoutSession?.exercises?.length) {
    return {
      totalVolume: 0,
      totalReps: 0,
      totalCompletedSets: 0,
    };
  }

  return workoutSession.exercises.reduce(
    (acc, exercise: WorkoutSessionExercise) => {
      const sets = exercise.sets ?? [];

      const exerciseTotals = sets.reduce(
        (setAcc, set: WorkoutSessionSet) => {
          const reps = set.reps ?? 0;
          const weight = set.weight ?? 0;

          return {
            volume: setAcc.volume + weight * reps,
            reps: setAcc.reps + reps,
          };
        },
        { volume: 0, reps: 0 }
      );

      return {
        totalVolume: acc.totalVolume + exerciseTotals.volume,
        totalReps: acc.totalReps + exerciseTotals.reps,
        totalCompletedSets: acc.totalCompletedSets + sets.length,
      };
    },
    { totalVolume: 0, totalReps: 0, totalCompletedSets: 0 }
  );
};

const formatDelta = (current: number, previous: number | null) => {
  if (previous === null) {
    return {
      difference: 0,
      percentage: null as number | null,
      direction: 'neutral' as 'up' | 'down' | 'neutral',
    };
  }

  const difference = current - previous;
  const percentage = previous === 0 ? null : (difference / previous) * 100;

  if (difference > 0) {
    return { difference, percentage, direction: 'up' as const };
  }

  if (difference < 0) {
    return { difference, percentage, direction: 'down' as const };
  }

  return { difference, percentage, direction: 'neutral' as const };
};

const formatSignedDelta = (delta: SetDelta, unit: string) => {
  if (!delta || delta.direction === 'neutral') {
    return null;
  }

  return `${delta.difference > 0 ? '+' : ''}${delta.difference} ${unit}`;
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

const getDeltaClasses = (delta: SetDelta) => {
  if (!delta || delta.direction === 'neutral') {
    return 'text-muted-foreground border-border';
  }

  if (delta.direction === 'up') {
    return 'text-green-500 border-green-500/30';
  }

  return 'text-red-500 border-red-500/30';
};

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

const renderSetMetrics = (set: WorkoutSessionSet) => {
  return (
    <>
      {set.reps !== null && set.reps !== undefined && (
        <div>
          <span className="font-semibold text-foreground">{set.reps}</span>
          <span className="text-muted-foreground ml-1">reps</span>
        </div>
      )}

      {set.weight !== null && set.weight !== undefined && set.weight > 0 && (
        <div>
          <span className="font-semibold text-foreground">{set.weight}</span>
          <span className="text-muted-foreground ml-1">kg</span>
        </div>
      )}

      {set.durationSeconds !== null &&
        set.durationSeconds !== undefined &&
        set.durationSeconds > 0 && (
          <div>
            <span className="font-semibold text-foreground">{set.durationSeconds}</span>
            <span className="text-muted-foreground ml-1">seg</span>
          </div>
        )}

      {set.restSeconds !== null && set.restSeconds !== undefined && set.restSeconds > 0 && (
        <div>
          <span className="font-semibold text-foreground">{set.restSeconds}</span>
          <span className="text-muted-foreground ml-1">seg desc</span>
        </div>
      )}
    </>
  );
};

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionId = id!;

  const { data: response, isLoading, isError } = useWorkoutSession(sessionId);
  const { mutate: deleteSession, isPending: isDeleting } = useDeleteSession();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);


  const session = response || null;

  const {
    data: previousSession,
    isLoading: isPreviousSessionLoading,
  } = useQuery({
    queryKey: ['previous-session', sessionId, session?.templateId, session?.sessionDate],
    queryFn: async () => {
      if (!session?.templateId) {
        return null;
      }

      const sessionsResponse = await workoutSessionsApi.listSessions({
        templateId: session.templateId,
        limit: 100,
      });

      const currentTimestamp = getSessionTimestamp(session);

      const previousSessionSummary = sessionsResponse.data.items
        .filter((item) => item.id !== sessionId)
        .sort(
          (a, b) => getSessionTimestamp(b) - getSessionTimestamp(a)
        )
        .find((item) => getSessionTimestamp(item) < currentTimestamp);

      if (!previousSessionSummary) {
        return null;
      }

      return workoutSessionsApi.getSession(previousSessionSummary.id);
    },
    enabled: Boolean(session?.templateId),
    staleTime: 5 * 60 * 1000,
  });

  const handleDelete = () => {
    deleteSession(sessionId, {
      onSuccess: () => {
        navigate("/workouts?tab=sessions");
      }
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto space-y-6 w-full">
        <Skeleton className='h-10 w-3/4' />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <Card className="p-12 text-center mx-auto w-full">
        <p className="text-muted-foreground mb-4">
          Sesión no encontrada
        </p>
        <Button onClick={() => navigate('/workouts?tab=sessions')}>
          Ir a historial
        </Button>
      </Card>
    );
  }

  const sessionDate = new Date(session.sessionDate);
  const exercises = session.exercises || [];


  const currentMetrics = calculateMetrics(session);
  const previousMetrics = calculateMetrics(previousSession ?? null);
  const hasPreviousSession = Boolean(previousSession);
  const previousExercises = previousSession?.exercises ?? [];

  const volumeDelta = formatDelta(
    currentMetrics.totalVolume,
    hasPreviousSession ? previousMetrics.totalVolume : null
  );
  const repsDelta = formatDelta(
    currentMetrics.totalReps,
    hasPreviousSession ? previousMetrics.totalReps : null
  );
  const setsDelta = formatDelta(
    currentMetrics.totalCompletedSets,
    hasPreviousSession ? previousMetrics.totalCompletedSets : null
  );

  const renderDelta = (delta: ReturnType<typeof formatDelta>, unit: string) => {
    if (!hasPreviousSession) {
      return <span className="text-xs text-muted-foreground font-barlow">Sin sesión anterior</span>;
    }

    const Icon =
      delta.direction === 'up'
        ? TrendingUp
        : delta.direction === 'down'
          ? TrendingDown
          : Minus;

    const deltaClassName =
      delta.direction === 'up'
        ? 'text-green-500'
        : delta.direction === 'down'
          ? 'text-red-500'
          : 'text-muted-foreground';

    return (
      <div className={`flex items-center gap-1 text-xs font-barlow ${deltaClassName}`}>
        <Icon className="h-3.5 w-3.5" />
        <span>
          {delta.difference > 0 ? '+' : ''}
          {Math.round(delta.difference)} {unit}
        </span>
        {delta.percentage !== null && (
          <span>
            ({delta.percentage > 0 ? '+' : ''}
            {delta.percentage.toFixed(1)}%)
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="px-2 md:px-6 space-y-6 w-full">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/workouts?tab=sessions")}
          className="font-barlow uppercase tracking-widest text-xs rounded-none"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>


        {/* Header */}
        <div className="space-y-4">

          {/* Fecha tag */}
          <h2
            className="font-barlow uppercase tracking-[3px] text-xs text-primary mb-2"
          >
            {format(sessionDate, "d 'de' MMMM, yyyy", { locale: es })}
            {session.templateName ? ` - ${session.templateName}` : ''}
          </h2>


          {/* Título */}
          <h1 className="text-4xl font-bebas tracking-wide uppercase text-foreground">
            Sesión Completada
          </h1>

         
        </div>

        <Separator />

        {/* Estadísticas de comparación */}
        {session.templateId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bebas tracking-[2px] uppercase text-foreground">
                Comparación vs sesión anterior
              </h2>
              {isPreviousSessionLoading && (
                <span className="text-xs text-muted-foreground font-barlow">Cargando comparación...</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <Card className="p-4 rounded-none border-border gap-2 justify-between">
                <p className="text-xs font-barlow uppercase tracking-[2px] text-muted-foreground">
                  Volumen total
                </p>
                <div className="flex justify-between items-center gap-2 sm:flex-col sm:items-start">
                  <p className="text-2xl font-bebas tracking-[2px] text-foreground">
                    {Math.round(currentMetrics.totalVolume)} kg
                  </p>
                  {renderDelta(volumeDelta, 'kg')}
                  {hasPreviousSession && (
                    <p className="text-xs text-muted-foreground font-barlow">
                      Anterior: {Math.round(previousMetrics.totalVolume)} kg
                    </p>
                  )}

                </div>
              </Card>

              <Card className="p-4 rounded-none border-border justify-between gap-2 sm:space-y-2">
                <p className="text-xs font-barlow uppercase tracking-[2px] text-muted-foreground">
                  Repeticiones totales
                </p>
                <div className="flex justify-between items-center gap-2 sm:flex-col sm:items-start">
                  <p className="text-2xl font-bebas tracking-[2px] text-foreground">
                    {currentMetrics.totalReps} reps
                  </p>
                  {renderDelta(repsDelta, 'reps')}
                  {hasPreviousSession && (
                    <p className="text-xs text-muted-foreground font-barlow">
                      Anterior: {previousMetrics.totalReps} reps
                    </p>
                  )}

                </div>
              </Card>

              <Card className="p-4 rounded-none border-border justify-around gap-2 sm:space-y-2 ">
                <p className="text-xs font-barlow uppercase tracking-[2px] text-muted-foreground">
                  Sets completados
                </p>
                <div className="flex justify-between items-center gap-2 sm:flex-col sm:items-start">
                  <p className="text-2xl font-bebas tracking-[2px] text-foreground">
                    {currentMetrics.totalCompletedSets} sets
                  </p>
                  {renderDelta(setsDelta, 'sets')}
                  {hasPreviousSession && (
                    <p className="text-xs text-muted-foreground font-barlow">
                      Anterior: {previousMetrics.totalCompletedSets} sets
                    </p>
                  )}

                </div>
              </Card>
            </div>
          </div>
        )}

        <Separator />


        {/* Ejercicios */}
        <div>
          <div className="space-y-6">
            <h2 className="text-3xl font-bebas tracking-[2px] uppercase text-foreground">
              Ejercicios
            </h2>

            {exercises.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Dumbbell className='h-12 w-12 mx-auto mb-3 opacity-50' />
                <p className="font-barlow">No hay ejercicios registrados</p>
              </div>
            ) : (
              <div className="space-y-6">
                {exercises.map((workoutExercise: WorkoutSessionExercise, index: number) => (
                  <div key={workoutExercise.id}>
                    {index > 0 && <Separator className="my-6" />}

                    <div className="space-y-4">
                      {/* Ejercicio info */}
                      <div className="flex flex-col items-start gap-1">

                        {workoutExercise.muscleGroup && (
                          <div
                            className="font-barlow uppercase text-xs tracking-[2px] text-primary"
                          >
                            {workoutExercise.muscleGroup}
                          </div>
                        )}

                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="font-bebas tracking-[2px] text-xl text-foreground">
                            {workoutExercise.exerciseName || 'Ejercicio'}
                          </h3>

                          {hasPreviousSession && !getPreviousExercise(workoutExercise, previousExercises) && (
                            <span className="inline-flex items-center rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-barlow uppercase tracking-[2px] text-primary">
                              Ejercicio nuevo
                            </span>
                          )}

                        </div>
                      </div>

                      {/* Series */}
                      {workoutExercise.sets && workoutExercise.sets.length > 0 && (
                        <div className="space-y-2">
                          {(() => {
                            const previousExercise = hasPreviousSession
                              ? getPreviousExercise(workoutExercise, previousExercises)
                              : undefined;
                            const previousSetsByNumber = new Map(
                              (previousExercise?.sets ?? []).map((set) => [set.setNumber, set])
                            );
                            const currentSetNumbers = new Set(
                              workoutExercise.sets.map((set) => set.setNumber)
                            );
                            const missingCurrentSets = (previousExercise?.sets ?? []).filter(
                              (previousSet) => !currentSetNumbers.has(previousSet.setNumber)
                            );

                            return (
                              <>
                                {workoutExercise.sets.map((set: WorkoutSessionSet) => {
                                  const previousSet = previousSetsByNumber.get(set.setNumber);
                                  const repsDelta = getSetDelta(set.reps, previousSet?.reps);
                                  const weightDelta = getSetDelta(set.weight, previousSet?.weight);
                                  const durationDelta = getSetDelta(
                                    set.durationSeconds,
                                    previousSet?.durationSeconds
                                  );
                                  const restDelta = getSetDelta(
                                    set.restSeconds,
                                    previousSet?.restSeconds
                                  );

                                  const repsDeltaLabel = formatSignedDelta(repsDelta, 'reps');
                                  const weightDeltaLabel = formatSignedDelta(weightDelta, 'kg');
                                  const durationDeltaLabel = formatSignedDelta(durationDelta, 'seg');
                                  const restDeltaLabel = formatSignedDelta(restDelta, 'seg desc');

                                  return (
                                    <div key={set.setNumber} className="space-y-2">
                                      <div className="flex items-center gap-4 p-3 bg-muted/20 rounded-lg">
                                        <span className="text-xs font-barlow font-bold uppercase text-muted-foreground tracking-wide min-w-[60px]">
                                          Serie {set.setNumber}
                                        </span>

                                        <div className="flex items-center gap-4 flex-wrap text-sm font-barlow">
                                          {renderSetMetrics(set)}
                                        </div>

                                        {set.notes && (
                                          <p className="text-sm text-muted-foreground ml-auto font-barlow">
                                            {set.notes}
                                          </p>
                                        )}
                                      </div>

                                      {hasPreviousSession && (
                                        <div className="pl-2 space-y-2">
                                          {previousSet ? (
                                            <div className="flex items-center gap-4 p-3 bg-muted/10 border border-border/70 rounded-lg">
                                              <span className="text-[10px] font-barlow font-semibold uppercase text-muted-foreground tracking-[2px] min-w-[60px]">
                                                Anterior
                                              </span>

                                              <div className="flex items-center gap-4 flex-wrap text-sm font-barlow text-muted-foreground">
                                                {renderSetMetrics(previousSet)}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="inline-flex items-center rounded-full border border-primary/30 px-2 py-1 text-[10px] font-barlow uppercase tracking-[2px] text-primary">
                                              Nuevo set
                                            </span>
                                          )}

                                          {(repsDeltaLabel ||
                                            weightDeltaLabel ||
                                            durationDeltaLabel ||
                                            restDeltaLabel) && (
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
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {hasPreviousSession && missingCurrentSets.length > 0 && (
                                  <div className="space-y-2 pt-1">
                                    {missingCurrentSets.map((missingSet) => (
                                      <div
                                        key={`missing-${missingSet.setNumber}`}
                                        className="flex items-center gap-4 p-3 border border-dashed border-border rounded-lg bg-muted/5"
                                      >
                                        <span className="text-[10px] font-barlow font-semibold uppercase text-muted-foreground tracking-[2px] min-w-[60px]">
                                          Anterior
                                        </span>

                                        <div className="flex items-center gap-4 flex-wrap text-sm font-barlow text-muted-foreground">
                                          <span>Serie {missingSet.setNumber} no realizada en esta sesión</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            size="lg"
            className="uppercase font-barlow font-semibold tracking-wide"
            onClick={() => navigate(`/workouts/sessions/${session.id}/edit`)}
          >
            Editar
          </Button>

          <Button
            variant="destructive"
            size="lg"
            className="uppercase font-barlow font-semibold tracking-wide"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Dialog de confirmación de eliminación */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <DialogContent className="rounded-none border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive tracking-widest">
              <AlertTriangle className="h-5 w-5" />
              ¿Eliminar sesión?
            </DialogTitle>
            <DialogDescription>
              <p className="mb-3">
                Estás a punto de eliminar esta sesión de entrenamiento.
              </p>
              <p className="font-semibold text-foreground mb-3">
                "{session.title}"
              </p>
              <p className="text-sm">
                Esta acción no se puede deshacer. Se eliminarán todos los ejercicios y series asociados.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant={'outline'}
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="rounded-none tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              variant={'destructive'}
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-none tracking-widest"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


