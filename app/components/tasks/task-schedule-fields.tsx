import { useState } from "react";

import { TextField } from "~/components/ui/text-field";
import { t } from "~/lib/i18n";

type TaskType = "one_off" | "recurring" | "open";
type RecurrenceUnit = "daily" | "weekly" | "monthly";

interface TaskScheduleFieldsProps {
  defaults?: {
    type?: TaskType;
    recurrenceUnit?: RecurrenceUnit | null;
    recurrenceInterval?: number | null;
    recurrenceWeekday?: number | null;
    recurrenceMonthDay?: number | null;
    openLimitCount?: number | null;
    openLimitPeriod?: "day" | "week" | "month" | null;
  };
}

const typeDescriptions: Record<TaskType, string> = {
  one_off: "Se realiza una sola vez. Ejemplo: ordenar el trastero.",
  recurring: "Se repite una vez en cada periodo. Ejemplo: hacer la cama cada día.",
  open: "Puede realizarse varias veces dentro de un periodo. Úsala para doblar ropa o poner una lavadora.",
};

export function TaskScheduleFields({ defaults }: TaskScheduleFieldsProps) {
  const [type, setType] = useState<TaskType>(defaults?.type ?? "one_off");
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>(
    defaults?.recurrenceUnit ?? "daily",
  );

  return (
    <>
      <div>
        <label className="block text-sm font-bold" htmlFor="task-type">
          {t("tasks.form.type")}
        </label>
        <select
          className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
          defaultValue={type}
          id="task-type"
          name="type"
          onChange={(event) => setType(event.target.value as TaskType)}
        >
          <option value="one_off">{t("tasks.form.oneOff")}</option>
          <option value="recurring">{t("tasks.form.recurring")}</option>
          <option value="open">{t("tasks.form.open")}</option>
        </select>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{typeDescriptions[type]}</p>
      </div>

      {type === "recurring" ? (
        <fieldset className="space-y-5 rounded-2xl border bg-muted/35 p-5">
          <legend className="px-2 text-sm font-bold">Configuración recurrente</legend>
          <div>
            <label className="block text-sm font-bold" htmlFor="recurrence-unit">
              {t("tasks.form.recurrence")}
            </label>
            <select
              className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
              defaultValue={recurrenceUnit}
              id="recurrence-unit"
              name="recurrenceUnit"
              onChange={(event) => setRecurrenceUnit(event.target.value as RecurrenceUnit)}
            >
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
            <p className="mt-2 text-sm text-muted-foreground">
              La tarea admite una realización en cada periodo configurado.
            </p>
          </div>
          <TextField
            defaultValue={defaults?.recurrenceInterval ?? 1}
            hint="1 significa cada día, semana o mes; 2 significa cada dos periodos."
            label={t("tasks.form.interval")}
            min={1}
            name="recurrenceInterval"
            type="number"
          />
          {recurrenceUnit === "weekly" ? (
            <TextField
              defaultValue={defaults?.recurrenceWeekday ?? undefined}
              hint="1 es lunes y 7 es domingo."
              label="Día de la semana"
              max={7}
              min={1}
              name="recurrenceWeekday"
              required
              type="number"
            />
          ) : null}
          {recurrenceUnit === "monthly" ? (
            <TextField
              defaultValue={defaults?.recurrenceMonthDay ?? undefined}
              hint="Entre 1 y 31. En meses más cortos se usa el último día disponible."
              label="Día del mes"
              max={31}
              min={1}
              name="recurrenceMonthDay"
              required
              type="number"
            />
          ) : null}
        </fieldset>
      ) : null}

      {type === "open" ? (
        <fieldset className="space-y-5 rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <legend className="px-2 text-sm font-bold">Varias realizaciones</legend>
          <p className="text-sm leading-6 text-muted-foreground">
            Cada realización aprobada suma la recompensa. Por ejemplo, límite 3 y periodo Día
            permite completar y cobrar “Doblar ropa” hasta tres veces cada día.
          </p>
          <TextField
            defaultValue={defaults?.openLimitCount ?? 1}
            hint="Número máximo de veces que puede completarse dentro del periodo."
            label={t("tasks.form.limit")}
            max={100}
            min={1}
            name="openLimitCount"
            required
            type="number"
          />
          <div>
            <label className="block text-sm font-bold" htmlFor="open-limit-period">
              {t("tasks.form.limitPeriod")}
            </label>
            <select
              className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
              defaultValue={defaults?.openLimitPeriod ?? "day"}
              id="open-limit-period"
              name="openLimitPeriod"
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
            <p className="mt-2 text-sm text-muted-foreground">
              Al comenzar un periodo nuevo, el contador vuelve a cero.
            </p>
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
