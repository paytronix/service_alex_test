import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocationCalendarSelector } from "./LocationCalendarSelector";

const locations = [
  { id: "loc-1", name: "Main street", isDefault: true },
  { id: "loc-2", name: "Riverside", isDefault: false },
];

const calendars = [
  { id: "cal-1", name: "Hall", locationId: "loc-1" },
  { id: "cal-2", name: "Bar", locationId: "loc-2" },
  { id: "cal-3", name: "Shared", locationId: null },
];

describe("LocationCalendarSelector", () => {
  it("renders nothing without locations and calendars", () => {
    const { container } = render(
      <LocationCalendarSelector
        locations={[]}
        calendars={[]}
        locationId={null}
        calendarId={null}
        onLocationChange={vi.fn()}
        onCalendarChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("resets the calendar when the location changes", () => {
    const onLocationChange = vi.fn();
    const onCalendarChange = vi.fn();
    render(
      <LocationCalendarSelector
        locations={locations}
        calendars={calendars}
        locationId={null}
        calendarId="cal-1"
        onLocationChange={onLocationChange}
        onCalendarChange={onCalendarChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "loc-2" } });
    expect(onLocationChange).toHaveBeenCalledWith("loc-2");
    expect(onCalendarChange).toHaveBeenCalledWith(null);
  });

  it("only offers calendars of the selected location plus shared ones", () => {
    render(
      <LocationCalendarSelector
        locations={locations}
        calendars={calendars}
        locationId="loc-1"
        calendarId={null}
        onLocationChange={vi.fn()}
        onCalendarChange={vi.fn()}
      />,
    );

    const options = Array.from(
      screen.getByLabelText("Calendar").querySelectorAll("option"),
    ).map((option) => option.textContent);
    expect(options).toEqual(["All calendars", "Hall", "Shared"]);
  });
});
