import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  Clock3,
  Dumbbell,
  Flame,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStatsData, type StatsRange } from '../hooks/useStatsData';

const rangeOptions: Array<{ label: string; value: StatsRange }> = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
];

type MetricMode = 'reps' | 'volume' | 'mixed';

const metricOptions: Array<{ label: string; value: MetricMode }> = [
  { label: 'Reps', value: 'reps' },
  { label: 'Peso', value: 'volume' },
  { label: 'Mixto', value: 'mixed' },
];

const formatVolume = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K kg`;
  }

  return `${Math.round(value)} kg`;
};

const formatDelta = (value: number): string => {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
};

const formatPercent = (value: number | null): string => {
  if (value === null) {
    return 'nuevo';
  }

  const rounded = Math.round(value);
  if (rounded > 0) {
    return `+${rounded}%`;
  }

  return `${rounded}%`;
};

const getDeltaTone = (value: number): string => {
  if (value > 0) {
    return 'text-emerald-400';
  }

  if (value < 0) {
    return 'text-rose-400';
  }

  return 'text-muted-foreground';
};

export default function StatsPage() {
  const [range, setRange] = useState<StatsRange>('30d');
  const [metricMode, setMetricMode] = useState<MetricMode>('reps');
  const [showAllRecent, setShowAllRecent] = useState(false);

  const {
    sessionStatsQuery,
    sessionsQuery,
    personalRecordStatsQuery,
    periodSummary,
    comparison,
    consistency,
    trends,
    weekdayDistribution,
    topTemplates,
    recentSessions,
    rangeDays,
  } = useStatsData(range);

  const isLoading =
    sessionStatsQuery.isLoading || sessionsQuery.isLoading || personalRecordStatsQuery.isLoading;

  const trendsFiltered = useMemo(() => {
    if (metricMode === 'reps') {
      return trends.filter((point) => point.reps > 0);
    }

    if (metricMode === 'mixed') {
      return trends.filter((point) => point.reps > 0 || point.volume > 0);
    }

    return trends.filter((point) => point.volume > 0);
  }, [metricMode, trends]);

  const maxTrendReps = useMemo(() => {
    if (trendsFiltered.length === 0) return 0;
    return Math.max(...trendsFiltered.map((point) => point.reps));
  }, [trendsFiltered]);

  const maxTrendVolume = useMemo(() => {
    if (trendsFiltered.length === 0) return 0;
    return Math.max(...trendsFiltered.map((point) => point.volume));
  }, [trendsFiltered]);

  const maxTrendValue = useMemo(() => {
    if (trendsFiltered.length === 0) return 0;

    if (metricMode === 'reps') {
      return maxTrendReps;
    }

    return maxTrendVolume;
  }, [maxTrendReps, maxTrendVolume, metricMode, trendsFiltered]);

  const maxWeekdaySessions = useMemo(() => {
    if (weekdayDistribution.length === 0) return 0;
    return Math.max(...weekdayDistribution.map((point) => point.sessions));
  }, [weekdayDistribution]);

  const primaryInsight = useMemo(() => {
    if (metricMode === 'reps') {
      if (comparison.reps.delta > 0) {
        return `Subiste ${comparison.reps.delta} reps frente al período anterior.`;
      }

      if (comparison.reps.delta < 0) {
        return `Bajaste ${Math.abs(comparison.reps.delta)} reps frente al período anterior.`;
      }

      if (periodSummary.totalReps === 0) {
        return 'Registra repeticiones completadas para activar recomendaciones automáticas.';
      }

      return 'Mantienes las mismas repeticiones que en el período anterior.';
    }

    if (metricMode === 'mixed') {
      if (comparison.reps.delta > 0 || comparison.volume.delta > 0) {
        return `Subiste ${formatDelta(comparison.reps.delta)} reps y ${formatVolume(comparison.volume.delta)} frente al período anterior.`;
      }

      if (comparison.reps.delta < 0 || comparison.volume.delta < 0) {
        return `Cambios del período: ${formatDelta(comparison.reps.delta)} reps y ${formatVolume(comparison.volume.delta)}.`;
      }

      if (periodSummary.totalReps === 0 && periodSummary.totalVolume === 0) {
        return 'Registra repeticiones y carga para activar comparativas mixtas.';
      }

      return 'Mantienes estable el trabajo de repeticiones y volumen.';
    }

    if (comparison.volume.delta > 0) {
      return `Subiste ${formatVolume(comparison.volume.delta)} frente al período anterior.`;
    }

    if (comparison.volume.delta < 0) {
      return `Bajaste ${formatVolume(Math.abs(comparison.volume.delta))} frente al período anterior.`;
    }

    if (periodSummary.totalVolume === 0) {
      return 'Registra una sesión con cargas para activar recomendaciones automáticas.';
    }

    return 'Mantienes el mismo volumen que en el período anterior.';
  }, [comparison.reps.delta, comparison.volume.delta, metricMode, periodSummary.totalReps, periodSummary.totalVolume]);

  const visibleRecentSessions = useMemo(
    () => (showAllRecent ? recentSessions : recentSessions.slice(0, 3)),
    [recentSessions, showAllRecent]
  );

  if (isLoading) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const prStats = personalRecordStatsQuery.data;

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bebas tracking-[2px] uppercase text-foreground">Estadísticas</h1>
          <p className="text-muted-foreground font-barlow mt-1">
            Panel de rendimiento con comparativas, consistencia y tendencias
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <div className="flex items-center gap-2 border border-border p-1 bg-muted/10">
            {metricOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={metricMode === option.value ? 'default' : 'ghost'}
                onClick={() => setMetricMode(option.value)}
                className="uppercase text-xs tracking-[2px] font-barlow"
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 border border-border p-1 bg-muted/10">
            {rangeOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={range === option.value ? 'default' : 'ghost'}
                onClick={() => setRange(option.value)}
                className="uppercase text-xs tracking-[2px] font-barlow"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Card className="rounded-none border-border p-5 md:p-6 bg-gradient-to-r from-primary/12 via-card to-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[2px] font-barlow text-primary">
              <Sparkles className="h-4 w-4" />
              Insight principal
            </div>
            <p className="text-2xl md:text-3xl font-bebas tracking-[1px] text-foreground">
              {metricMode === 'reps'
                ? `${periodSummary.totalReps} reps`
                : metricMode === 'mixed'
                  ? `${periodSummary.totalReps} reps • ${formatVolume(periodSummary.totalVolume)}`
                : periodSummary.totalVolume > 0
                  ? formatVolume(periodSummary.totalVolume)
                  : 'Sin volumen registrado'}
            </p>
            <p className="text-sm font-barlow text-muted-foreground">{primaryInsight}</p>
          </div>

          <div className="space-y-1 text-right">
            <p className="text-xs uppercase tracking-[2px] font-barlow text-muted-foreground">
              Período actual ({rangeDays} días)
            </p>
            <p className="text-2xl font-bebas tracking-[1px] text-foreground">{recentSessions.length} sesiones</p>
            <p className={`text-xs uppercase tracking-[1px] font-barlow ${getDeltaTone(comparison.sessions.delta)}`}>
              {formatDelta(comparison.sessions.delta)} sesiones • {formatPercent(comparison.sessions.deltaPercent)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4 rounded-none border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[2px] font-barlow">
            <Activity className="h-4 w-4" />
            Sesiones ({rangeDays}D)
          </div>
          <p className="text-3xl font-bebas tracking-[2px] text-foreground">{recentSessions.length}</p>
          <p className={`text-xs uppercase tracking-[1px] font-barlow ${getDeltaTone(comparison.sessions.delta)}`}>
            {formatDelta(comparison.sessions.delta)} vs anterior
          </p>
        </Card>

        <Card className="p-4 rounded-none border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[2px] font-barlow">
            {metricMode === 'reps' ? <Dumbbell className="h-4 w-4" /> : <Flame className="h-4 w-4" />}
            {metricMode === 'reps'
              ? `Repeticiones (${rangeDays}D)`
              : metricMode === 'mixed'
                ? `Carga mixta (${rangeDays}D)`
                : `Volumen (${rangeDays}D)`}
          </div>
          {metricMode === 'reps' ? (
            <>
              <p className="text-3xl font-bebas tracking-[2px] text-foreground">{periodSummary.totalReps}</p>
              <p className={`text-xs uppercase tracking-[1px] font-barlow ${getDeltaTone(comparison.reps.delta)}`}>
                {formatPercent(comparison.reps.deltaPercent)}
              </p>
            </>
          ) : metricMode === 'mixed' ? (
            <>
              <p className="text-2xl font-bebas tracking-[2px] text-foreground">{periodSummary.totalReps} reps</p>
              <p className="text-xl font-bebas tracking-[1px] text-muted-foreground">{formatVolume(periodSummary.totalVolume)}</p>
              <p className="text-xs uppercase tracking-[1px] font-barlow text-muted-foreground">
                {formatPercent(comparison.reps.deltaPercent)} reps • {formatPercent(comparison.volume.deltaPercent)} kg
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bebas tracking-[2px] text-foreground">{formatVolume(periodSummary.totalVolume)}</p>
              <p className={`text-xs uppercase tracking-[1px] font-barlow ${getDeltaTone(comparison.volume.delta)}`}>
                {formatPercent(comparison.volume.deltaPercent)}
              </p>
            </>
          )}
        </Card>

        <Card className="p-4 rounded-none border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[2px] font-barlow">
            <Clock3 className="h-4 w-4" />
            Duración ({rangeDays}D)
          </div>
          <p className="text-3xl font-bebas tracking-[2px] text-foreground">{periodSummary.totalDuration} min</p>
          <p className={`text-xs uppercase tracking-[1px] font-barlow ${getDeltaTone(comparison.duration.delta)}`}>
            {formatDelta(comparison.duration.delta)} min
          </p>
        </Card>

        <Card className="p-4 rounded-none border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[2px] font-barlow">
            <CalendarCheck className="h-4 w-4" />
            Consistencia
          </div>
          <p className="text-3xl font-bebas tracking-[2px] text-foreground">{consistency.score}%</p>
          <p className="text-xs uppercase tracking-[1px] font-barlow text-muted-foreground">
            {consistency.trainedDays}/{rangeDays} días • racha {consistency.currentStreak}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-4 rounded-none border-border xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bebas tracking-[2px] uppercase text-foreground">
              {metricMode === 'reps'
                ? 'Tendencia de Repeticiones'
                : metricMode === 'mixed'
                  ? 'Tendencia Mixta'
                  : 'Tendencia de Volumen'}
            </h2>
            <span className="text-xs text-muted-foreground uppercase tracking-[2px] font-barlow">Por semana</span>
          </div>

          {metricMode === 'mixed' ? (
            <div className="flex items-center gap-4 text-xs uppercase tracking-[2px] font-barlow text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 bg-primary" />
                Reps
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 bg-amber-400/80" />
                Kg
              </span>
            </div>
          ) : null}

          {trends.length === 0 ? (
            <p className="text-sm text-muted-foreground font-barlow">No hay datos suficientes para mostrar tendencia.</p>
          ) : trendsFiltered.length === 0 ? (
            <p className="text-sm text-muted-foreground font-barlow">
              {metricMode === 'reps'
                ? 'Hay sesiones en este período, pero sin repeticiones registradas.'
                : metricMode === 'mixed'
                  ? 'Hay sesiones en este período, pero faltan repeticiones y carga para tendencia mixta.'
                : 'Hay sesiones en este período, pero sin volumen de carga registrado.'}
            </p>
          ) : (
            <div className="space-y-3">
              {trendsFiltered.map((point) => {
                const value = metricMode === 'reps' ? point.reps : point.volume;
                const width = maxTrendValue > 0 ? (value / maxTrendValue) * 100 : 0;
                const repsWidth = maxTrendReps > 0 ? (point.reps / maxTrendReps) * 100 : 0;
                const volumeWidth = maxTrendVolume > 0 ? (point.volume / maxTrendVolume) * 100 : 0;

                return (
                  <div key={point.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-barlow uppercase tracking-wide">
                      <span className="text-muted-foreground">{point.label}</span>
                      <span className="text-foreground">
                        {metricMode === 'mixed'
                          ? `${point.reps} reps • ${formatVolume(point.volume)} - ${point.sessions} sesiones`
                          : `${metricMode === 'reps' ? `${point.reps} reps` : formatVolume(point.volume)} - ${point.sessions} sesiones`}
                      </span>
                    </div>
                    {metricMode === 'mixed' ? (
                      <div className="space-y-1">
                        <div className="h-2 bg-muted/20">
                          <div className="h-2 bg-primary transition-all" style={{ width: `${Math.max(repsWidth, 3)}%` }} />
                        </div>
                        <div className="h-2 bg-muted/20">
                          <div className="h-2 bg-amber-400/80 transition-all" style={{ width: `${Math.max(volumeWidth, 3)}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-2 bg-muted/20">
                        <div
                          className="h-2 bg-primary transition-all"
                          style={{ width: `${Math.max(width, 3)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4 rounded-none border-border space-y-4">
            <h2 className="text-lg font-bebas tracking-[2px] uppercase text-foreground">Ritmo semanal</h2>

            <div className="space-y-3">
              {weekdayDistribution.map((day) => {
                const width = maxWeekdaySessions > 0 ? (day.sessions / maxWeekdaySessions) * 100 : 0;

                return (
                  <div key={day.day} className="space-y-1">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[2px] font-barlow">
                      <span className="text-muted-foreground">{day.day}</span>
                      <span className="text-foreground">{day.sessions} sesiones</span>
                    </div>
                    <div className="h-2 bg-muted/20">
                      <div className="h-2 bg-primary/80" style={{ width: `${Math.max(width, 3)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4 rounded-none border-border space-y-4">
            <h2 className="text-lg font-bebas tracking-[2px] uppercase text-foreground">Top plantillas</h2>

            {topTemplates.length ? (
              <div className="space-y-3">
                {topTemplates.map((template, index) => (
                  <div key={template.name} className="border border-border p-3 space-y-1">
                    <p className="text-sm uppercase tracking-[2px] font-barlow text-muted-foreground">#{index + 1}</p>
                    <p className="font-bebas text-xl tracking-[1px] uppercase text-foreground">{template.name}</p>
                    <p className="text-sm font-barlow text-muted-foreground">
                      {template.sessions} sesiones • {metricMode === 'reps'
                        ? `${template.reps} reps`
                        : metricMode === 'mixed'
                          ? `${template.reps} reps • ${formatVolume(template.volume)}`
                          : formatVolume(template.volume)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-barlow">Sin datos de plantillas todavía.</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 rounded-none border-border space-y-4">
          <h2 className="text-lg font-bebas tracking-[2px] uppercase text-foreground">Sesiones Recientes</h2>

          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground font-barlow">No hay sesiones en este periodo.</p>
          ) : (
            <>
              <div className="space-y-3">
                {visibleRecentSessions.map((session) => (
                  <div key={session.id} className="border border-border p-3 space-y-1">
                    <p className="font-bebas text-lg tracking-[1px] uppercase text-foreground">{session.title}</p>
                    <p className="text-xs text-muted-foreground font-barlow uppercase tracking-[2px]">
                      {format(new Date(session.sessionDate), "d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-sm font-barlow text-foreground">
                      {session.totalSets} sets - {session.totalReps || 0} reps - {formatVolume(session.totalVolumeKg || 0)}
                    </p>
                  </div>
                ))}
              </div>

              {recentSessions.length > 3 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllRecent((prev) => !prev)}
                  className="uppercase tracking-[2px] text-xs font-barlow"
                >
                  {showAllRecent ? 'Ver menos' : `Ver más (${recentSessions.length - 3})`}
                </Button>
              ) : null}
            </>
          )}
        </Card>

        <Card className="p-4 rounded-none border-border space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bebas tracking-[2px] uppercase text-foreground">PRs Recientes</h2>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[2px] font-barlow text-muted-foreground">
              <Trophy className="h-4 w-4" />
              {prStats?.total || 0} totales
            </div>
          </div>

          {prStats?.recentRecords?.length ? (
            <div className="space-y-3">
              {prStats.recentRecords.map((record) => {
                const value =
                  record.maxWeight ?? record.maxReps ?? record.maxDurationSeconds ?? 0;

                const unit = record.maxWeight
                  ? 'kg'
                  : record.maxReps
                    ? 'reps'
                    : 'seg';

                return (
                  <div key={record.id} className="border border-border p-3 space-y-1">
                    <p className="font-bebas text-lg tracking-[1px] uppercase text-foreground">
                      {record.exerciseName}
                    </p>
                    <p className="text-sm font-barlow text-foreground">
                      {value} {unit}
                    </p>
                    <p className="text-xs text-muted-foreground font-barlow uppercase tracking-[2px]">
                      {format(new Date(record.achievedAt), "d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-dashed border-border p-4 space-y-2">
              <p className="text-sm text-muted-foreground font-barlow">Aún no tienes PRs registrados.</p>
              <p className="text-xs uppercase tracking-[2px] font-barlow text-muted-foreground">
                Completa series con carga para generar nuevos récords.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 rounded-none border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[2px] font-barlow">
            <Dumbbell className="h-4 w-4" />
            Repeticiones ({rangeDays}D)
          </div>
          <p className="text-3xl font-bebas tracking-[2px] text-foreground">{periodSummary.totalReps}</p>
          <p className={`text-xs uppercase tracking-[1px] font-barlow ${getDeltaTone(comparison.reps.delta)}`}>
            {formatDelta(comparison.reps.delta)} vs anterior
          </p>
        </Card>

        <Card className="p-4 rounded-none border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[2px] font-barlow">
            <Target className="h-4 w-4" />
            Sets ({rangeDays}D)
          </div>
          <p className="text-3xl font-bebas tracking-[2px] text-foreground">{periodSummary.totalSets}</p>
          <p className="text-xs uppercase tracking-[1px] font-barlow text-muted-foreground">
            Promedio {Math.round(periodSummary.totalReps / Math.max(recentSessions.length, 1))} reps por sesión
          </p>
        </Card>

        <Card className="p-4 rounded-none border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[2px] font-barlow">
            <TrendingUp className="h-4 w-4" />
            Estado del ciclo
          </div>
          <p className="text-3xl font-bebas tracking-[2px] text-foreground">{consistency.targetDays}d meta</p>
          <p className="text-xs uppercase tracking-[1px] font-barlow text-muted-foreground">
            {consistency.trainedDays >= consistency.targetDays ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <ArrowUpRight className="h-3 w-3" />
                Meta de consistencia cumplida
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <ArrowDownRight className="h-3 w-3" />
                Te faltan {consistency.targetDays - consistency.trainedDays} días para cumplir meta
              </span>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
