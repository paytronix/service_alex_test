export interface LocationOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface CalendarOption {
  id: string;
  name: string;
  locationId: string | null;
}

interface LocationCalendarSelectorProps {
  locations: LocationOption[];
  calendars: CalendarOption[];
  locationId: string | null;
  calendarId: string | null;
  onLocationChange: (locationId: string | null) => void;
  onCalendarChange: (calendarId: string | null) => void;
}

export function LocationCalendarSelector({
  locations,
  calendars,
  locationId,
  calendarId,
  onLocationChange,
  onCalendarChange,
}: LocationCalendarSelectorProps) {
  if (locations.length === 0 && calendars.length === 0) return null;
  const visibleCalendars = locationId
    ? calendars.filter((calendar) => calendar.locationId === locationId || calendar.locationId === null)
    : calendars;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {locations.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Location</span>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={locationId ?? ""}
            onChange={(event) => {
              onLocationChange(event.target.value || null);
              onCalendarChange(null);
            }}
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
                {location.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {visibleCalendars.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Calendar</span>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={calendarId ?? ""}
            onChange={(event) => onCalendarChange(event.target.value || null)}
          >
            <option value="">All calendars</option>
            {visibleCalendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
