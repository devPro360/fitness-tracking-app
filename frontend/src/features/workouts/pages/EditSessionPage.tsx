// src/features/workouts/pages/EditSessionPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkoutSession, useUpdateSession } from '../hooks/useWorkoutSessions';
import type { CreateWorkoutSessionData, WorkoutSessionWithExercises } from '@/types';

export default function EditSessionPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = id!;
  const navigate = useNavigate();

  const { data: response, isLoading, isError } = useWorkoutSession(sessionId);
  const { mutate: updateSession, isPending } = useUpdateSession();

  const session = response || null;

  const [formState, setFormState] = useState<Partial<CreateWorkoutSessionData> | null>(null);

  useEffect(() => {
    if (!session) return;

    // Initialize form state from session
    const data: CreateWorkoutSessionData = {
      templateId: session.templateId ?? '',
      title: session.title,
      notes: session.notes ?? undefined,
      sessionDate: session.sessionDate,
      durationMinutes: session.durationMinutes,
      exercises: (session.exercises || []).map((ex) => ({
        exerciseId: ex.exerciseId,
        orderIndex: ex.orderIndex,
        sets: (ex.sets || []).map((s) => ({
          setNumber: s.setNumber,
          reps: s.reps,
          weight: s.weight,
          durationSeconds: s.durationSeconds,
          restSeconds: s.restSeconds,
          notes: s.notes,
        })),
      })),
    };

    setFormState(data);
  }, [session]);

  if (isLoading) {
    return (
      <div className="mx-auto space-y-6 w-full">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !session || !formState) {
    return (
      <Card className="p-12 text-center mx-auto w-full">
        <p className="text-muted-foreground mb-4">Sesión no encontrada</p>
        <Button onClick={() => navigate('/workouts?tab=sessions')}>Ir a historial</Button>
      </Card>
    );
  }

  const updateField = (path: string, value: any) => {
    setFormState((prev) => {
      if (!prev) return prev;
      const copy: any = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return copy;
    });
  };

  const handleSubmit = () => {
    if (!formState) return;

    // Prepare payload - send only editable fields allowed by backend
    const payload: Partial<CreateWorkoutSessionData> = {
      title: formState.title,
      notes: formState.notes,
      sessionDate: formState.sessionDate,
      durationMinutes: formState.durationMinutes,
      exercises: formState.exercises?.map((ex) => ({
        exerciseId: ex.exerciseId,
        orderIndex: ex.orderIndex,
        sets: ex.sets.map((s) => ({
          setNumber: s.setNumber,
          reps: s.reps,
          weight: s.weight,
          durationSeconds: s.durationSeconds,
          restSeconds: s.restSeconds,
          notes: s.notes,
        })),
      })),
    };

    updateSession({ id: sessionId, data: payload }, {
      onSuccess: () => {
        navigate(`/workouts/sessions/${sessionId}`);
      }
    });
  };

  return (
    <div className="px-2 md:px-6 space-y-6 w-full">
      <div className="space-y-4">
        <h2 className="text-3xl font-bebas tracking-[2px] uppercase text-foreground">Editar sesión</h2>
        <p className="text-muted-foreground">Edita valores de las series existentes. No puedes agregar ni eliminar ejercicios o series en esta versión.</p>
      </div>

      <div className="space-y-4">
        <label className="font-barlow text-sm">Título</label>
        <input
          className="w-full bg-transparent border border-border rounded-none px-2 py-1"
          value={formState.title}
          onChange={(e) => updateField('title', e.target.value)}
        />
      </div>

      <div className="space-y-4">
        <label className="font-barlow text-sm">Notas</label>
        <textarea
          className="w-full bg-transparent border border-border rounded-none px-2 py-1 h-24"
          value={formState.notes ?? ''}
          onChange={(e) => updateField('notes', e.target.value || undefined)}
        />
      </div>

      <div className="space-y-6">
        {(formState.exercises || []).map((ex, exIdx) => (
          <Card key={ex.exerciseId} className="p-4 rounded-none border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bebas text-lg">Ejercicio</div>
              <div className="text-xs text-muted-foreground">Orden {ex.orderIndex}</div>
            </div>

            <div className="space-y-2">
              {(ex.sets || []).map((s, sIdx) => (
                <div key={s.setNumber} className="grid grid-cols-5 gap-2 items-center">
                  <div className="text-sm font-barlow">Serie {s.setNumber}</div>
                  <input
                    type="number"
                    className="bg-transparent border border-border rounded-none px-2 py-1"
                    value={s.reps ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateField(`exercises.${exIdx}.sets.${sIdx}.reps`, val);
                    }}
                    placeholder="reps"
                  />
                  <input
                    type="number"
                    step="0.5"
                    className="bg-transparent border border-border rounded-none px-2 py-1"
                    value={s.weight ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      updateField(`exercises.${exIdx}.sets.${sIdx}.weight`, val);
                    }}
                    placeholder="kg"
                  />
                  <input
                    type="number"
                    className="bg-transparent border border-border rounded-none px-2 py-1"
                    value={s.durationSeconds ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateField(`exercises.${exIdx}.sets.${sIdx}.durationSeconds`, val);
                    }}
                    placeholder="seg"
                  />
                  <input
                    type="number"
                    className="bg-transparent border border-border rounded-none px-2 py-1"
                    value={s.restSeconds ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateField(`exercises.${exIdx}.sets.${sIdx}.restSeconds`, val);
                    }}
                    placeholder="desc seg"
                  />
                  <textarea
                    className="col-span-5 bg-transparent border border-border rounded-none px-2 py-1 mt-2"
                    value={s.notes ?? ''}
                    onChange={(e) => updateField(`exercises.${exIdx}.sets.${sIdx}.notes`, e.target.value || undefined)}
                    placeholder="Notas (opcional)"
                  />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={() => navigate(`/workouts/sessions/${sessionId}`)}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
