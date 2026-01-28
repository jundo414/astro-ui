declare module 'suncalc' {
  interface SunPosition {
    azimuth: number;
    altitude: number;
  }

  interface MoonPosition {
    azimuth: number;
    altitude: number;
    distance: number;
    parallacticAngle: number;
  }

  interface MoonIllumination {
    fraction: number;
    phase: number;
    angle: number;
  }

  interface SunTimes {
    sunrise: Date;
    sunset: Date;
    dawn: Date;
    dusk: Date;
    [key: string]: Date;
  }

  interface MoonTimes {
    rise?: Date;
    set?: Date;
    alwaysUp?: boolean;
    alwaysDown?: boolean;
  }

  interface SunCalc {
    getPosition(date: Date, latitude: number, longitude: number): SunPosition;
    getMoonPosition(date: Date, latitude: number, longitude: number): MoonPosition;
    getMoonIllumination(date: Date): MoonIllumination;
    getTimes(date: Date, latitude: number, longitude: number): SunTimes;
    getMoonTimes(date: Date, latitude: number, longitude: number, inUTC?: boolean): MoonTimes;
  }

  const SunCalc: SunCalc;
  export default SunCalc;
}

declare module 'luxon' {
  export interface DateTimeOptions {
    zone?: string | { name: string };
    locale?: string;
    numberingSystem?: string;
    outputCalendar?: string;
  }

  export class DateTime {
    static fromISO(iso: string, options?: DateTimeOptions): DateTime;
    static fromJSDate(date: Date, options?: DateTimeOptions): DateTime;
    setZone(zone: string | { name: string }): DateTime;
    hour: number;
    minute: number;
    zoneName?: string;
    startOf(unit: string): DateTime;
    plus(duration: { days?: number; hours?: number; minutes?: number; seconds?: number }): DateTime;
    toJSDate(): Date;
    toFormat(format: string): string;
    toISO(): string | null;
    valueOf(): number;
    [Symbol.toPrimitive](hint: string): number | string;
  }
}

declare module 'tz-lookup' {
  function tzLookup(latitude: number, longitude: number): string;
  export default tzLookup;
}
