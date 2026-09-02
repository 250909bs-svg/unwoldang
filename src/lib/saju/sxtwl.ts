// Saju calendar facade for solar/lunar conversion and Ganzhi calculations.
// Solar-term instants come from the dedicated production astronomical engine.

import type { GZ } from './types';
import { getSolarTermInstantForGregorianYear } from './solarTerms';

export { getSolarTermInstantForGregorianYear } from './solarTerms';

// Data for lunar calendar (1900-2099)
const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0xea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252
];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;


export class DayUtil {
    private readonly birthDate: Date; // Stored as absolute UTC after all corrections
    private readonly solarDateArray: [number, number, number];
    private readonly lunarInputString: string | null = null;
    private readonly astrologicalYear: number;
    private readonly ipchunDate: Date;
    private readonly kstBirthHour: number;

    constructor(y: number, m: number, d: number, h: number | null, minute: number | null, cal: 'solar' | 'lunar', lp: 'normal' | 'leap', tc: boolean) {
        let solarY = y, solarM = m, solarD = d;
        const birthHour = h ?? 12;
        const birthMinute = minute ?? 0; // Use precise minute if provided

        if (cal === 'lunar') {
            this.lunarInputString = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')} (${lp === 'leap' ? '윤달' : '평달'})`;
            [solarY, solarM, solarD] = this.lunarToSolar(y, m, d, lp === 'leap');
        }
        this.solarDateArray = [solarY, solarM, solarD];

        // 1. Create a timestamp assuming the input components are KST.
        // Date.UTC creates a timestamp from UTC components. To get the correct UTC timestamp
        // for a KST time, we must subtract the KST offset.
        const pseudoUtcTimestamp = Date.UTC(solarY, solarM - 1, solarD, birthHour, birthMinute);
        
        // 2. Adjust for time correction (Dong-gyeong-si) if applicable.
        // Example: User inputs 09:36. tc=true.
        // 09:36 - 30m = 09:06.
        const correctedKstTimestamp = tc ? pseudoUtcTimestamp - (30 * 60 * 1000) : pseudoUtcTimestamp;
        
        // 3. Convert the KST-based timestamp to a true UTC timestamp.
        const utcTimestamp = correctedKstTimestamp - KST_OFFSET_MS;
        this.birthDate = new Date(utcTimestamp);
        this.kstBirthHour = new Date(correctedKstTimestamp).getUTCHours();

        // 4. Determine the calendar year *in KST* to find the correct Ipchun.
        const calendarYearForIpchun = new Date(correctedKstTimestamp).getUTCFullYear();
        
        // 5. Calculate Ipchun date in UTC.
        this.ipchunDate = getSolarTermInstantForGregorianYear(calendarYearForIpchun, 315);
        
        // 6. Compare the absolute birth time (UTC) with the absolute Ipchun time (UTC).
        if (this.birthDate < this.ipchunDate) {
            this.astrologicalYear = calendarYearForIpchun - 1;
        } else {
            this.astrologicalYear = calendarYearForIpchun;
        }
        
    }
    
    private getSolarTermsForYear(year: number): Date[] {
        const terms: Date[] = [];
        // Astrological year starts from Ipchun (315 deg)
        const termAngles = [
            315, 330, 345, 0, 15, 30, 45, 60, 75, 90, 105, 120,
            135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300
        ];

        for (const angle of termAngles) {
            // An astrological year starts at Lichun. Xiaohan/Daehan therefore
            // fall in the following Gregorian year; every other term belongs
            // to the Gregorian year in which this Lichun occurred.
            const calculationYear = (angle >= 285 && angle < 315) ? year + 1 : year;
            terms.push(getSolarTermInstantForGregorianYear(calculationYear, angle));
        }
        return terms;
    }

    private getMajorSolarTermsForYear(year: number): Date[] {
        return this.getSolarTermsForYear(year).filter((_, index) => index % 2 === 0);
    }

    private lunarToSolar(year: number, month: number, day: number, isLeap: boolean): [number, number, number] {
        // Base date: 1900-01-01 lunar is 1900-01-31 solar
        const baseDate = new Date(Date.UTC(1900, 0, 31));
        const firstSupportedYear = 1900;
        const lastSupportedYear = firstSupportedYear + LUNAR_INFO.length - 1;
        if (!Number.isInteger(year) || year < firstSupportedYear || year > lastSupportedYear) {
            throw new Error(`음력 변환은 ${firstSupportedYear}년부터 ${lastSupportedYear}년까지 지원합니다.`);
        }
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            throw new Error('음력 월은 1월부터 12월 사이여야 합니다.');
        }

        const monthDays = (data: number, targetMonth: number) =>
            (data & (0x10000 >> targetMonth)) ? 30 : 29;
        const leapMonthOf = (data: number) => data & 0xf;
        const leapDays = (data: number) => leapMonthOf(data) ? ((data & 0x10000) ? 30 : 29) : 0;

        let dayOffset = 0;
        for (let y = 1900; y < year; y++) {
            const data = LUNAR_INFO[y - 1900];
            for (let m = 1; m <= 12; m++) {
                dayOffset += monthDays(data, m);
            }
            dayOffset += leapDays(data);
        }

        const data = LUNAR_INFO[year - 1900];
        const leapMonth = leapMonthOf(data);
        for (let m = 1; m < month; m++) {
            dayOffset += monthDays(data, m);
            if (m === leapMonth) {
                 dayOffset += leapDays(data);
            }
        }

        const selectedMonthDays = isLeap ? leapDays(data) : monthDays(data, month);
        if (isLeap) {
             if (leapMonth !== month) throw new Error("Invalid leap month for the given year.");
             dayOffset += monthDays(data, month);
        }
        if (!Number.isInteger(day) || day < 1 || day > selectedMonthDays) {
             throw new Error(`해당 음력 ${isLeap ? '윤' : ''}${month}월은 ${selectedMonthDays}일까지입니다.`);
        }

        dayOffset += day - 1;

        baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset);

        return [baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, baseDate.getUTCDate()];
    }

    getYearGZ(): GZ {
        const yearOffset = this.astrologicalYear - 1864; // 1864 is a known Gapja (甲子) year
        const tg = (yearOffset % 10 + 10) % 10;
        const dz = (yearOffset % 12 + 12) % 12;
        return { tg, dz };
    }

    getMonthGZ(): GZ {
        let termIdx = -1;
        const astroYearTerms = this.getSolarTermsForYear(this.astrologicalYear);

        for (let i = astroYearTerms.length - 1; i >= 0; i--) {
            if (this.birthDate >= astroYearTerms[i]) {
                termIdx = i;
                break;
            }
        }
        
        if (termIdx === -1) { 
             const prevYearTerms = this.getSolarTermsForYear(this.astrologicalYear-1);
             termIdx = prevYearTerms.length-1;
        }

        const monthNum = Math.floor(termIdx / 2);
        const monthDzMap = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];
        const dz = monthDzMap[monthNum];

        const yearTg = this.getYearGZ().tg;
        // Correct implementation of 오호둔법 (O-ho-dun-beop)
        const firstMonthTgMap = [2, 4, 6, 8, 0]; // 丙, 戊, 庚, 壬, 甲
        const firstMonthTg = firstMonthTgMap[yearTg % 5]; // Key fix: use yearTg % 5

        const tg = (firstMonthTg + monthNum + 10) % 10;

        return { tg, dz };
    }

    getDayGZ(): GZ {
        // This method is corrected to use a robust Julian Day Number calculation,
        // resolving a bug in the previous reference-date-based implementation.
        const kstTime = this.birthDate.getTime() + KST_OFFSET_MS;
        const kstDate = new Date(kstTime);
        const y = kstDate.getUTCFullYear();
        let m = kstDate.getUTCMonth() + 1; // 1-indexed month for the formula
        const d = kstDate.getUTCDate();

        // Julian Day Number calculation for the KST date.
        // The day for Saju calculation corresponds to the civil day in KST.
        // We calculate the JDN for that day at 00:00 UT.
        const a = Math.floor((14 - m) / 12);
        const y_ = y + 4800 - a;
        const m_ = m + 12 * a - 3;
        // JDN for the day at 00:00 Universal Time.
        const jdn = d + Math.floor((153 * m_ + 2) / 5) + 365 * y_ + Math.floor(y_ / 4) - Math.floor(y_ / 100) + Math.floor(y_ / 400) - 32045;

        // Validated formulas to derive Heavenly Stem (천간) and Earthly Branch (지지) from JDN.
        // The results are 0-indexed (甲=0, 乙=1 ... | 子=0, 丑=1 ...)
        const tg = (jdn + 9) % 10;
        const dz = (jdn + 1) % 12;

        return { tg, dz };
    }

    getHourGZ(dayTg: number): GZ {
        const dz_idx = Math.floor((this.kstBirthHour + 1) / 2) % 12;
        const tg_idx = ((dayTg % 5) * 2 + dz_idx + 10) % 10;
        return { tg: tg_idx, dz: dz_idx };
    }

    getDaeyunInfo(gender: 'male' | 'female'): { start_age: number; start_instant: Date; forward: boolean; } {
        const yearGz = this.getYearGZ();
        const isYangYear = [0, 2, 4, 6, 8].includes(yearGz.tg);
        const forward = (gender === 'male' && isYangYear) || (gender === 'female' && !isYangYear);

        const astroYearTerms = this.getMajorSolarTermsForYear(this.astrologicalYear);

        let nextTerm: Date | null = null, prevTerm: Date | null = null;
        for (let i = 0; i < astroYearTerms.length; i++) {
            if (astroYearTerms[i] > this.birthDate) {
                nextTerm = astroYearTerms[i];
                prevTerm = i > 0 ? astroYearTerms[i-1] : this.getMajorSolarTermsForYear(this.astrologicalYear-1).pop()!;
                break;
            }
        }

        if(!nextTerm || !prevTerm) {
            prevTerm = astroYearTerms[astroYearTerms.length-1];
            nextTerm = this.getMajorSolarTermsForYear(this.astrologicalYear+1)[0];
        }

        const diffMillis = forward
            ? nextTerm.getTime() - this.birthDate.getTime()
            : this.birthDate.getTime() - prevTerm.getTime();

        const diffDays = diffMillis / 86400000;
        const start_age = diffDays / 3;
        const start_instant = new Date(
            this.birthDate.getTime() + start_age * 365.2422 * 86400000
        );
        return { start_age, start_instant, forward };
    }

    getCalculationBasis(): { ipchunDate: Date; birthDateAfterIpchun: boolean; } {
        return {
            ipchunDate: this.ipchunDate,
            birthDateAfterIpchun: this.birthDate >= this.ipchunDate
        };
    }

    getSolarDateArray(): [number, number, number] {
        return this.solarDateArray;
    }

    getLunarInputString(): string | null {
        return this.lunarInputString;
    }
}
