export type IplTeamCode =
  | "CSK"
  | "DC"
  | "GT"
  | "KKR"
  | "LSG"
  | "MI"
  | "PBKS"
  | "RR"
  | "RCB"
  | "SRH"
  | "TBD";

export type IplFixture = {
  matchNo: number;
  home: IplTeamCode;
  away: IplTeamCode;
  startsAt: string;
  venue: string;
  label?: string;
};

export const IPL_TEAMS: Record<IplTeamCode, { name: string; short: string; colors: string }> = {
  CSK: { name: "Chennai Super Kings", short: "CSK", colors: "from-[#ffe55c] to-[#f5b51b]" },
  DC: { name: "Delhi Capitals", short: "DC", colors: "from-[#1f74d4] to-[#e42f3a]" },
  GT: { name: "Gujarat Titans", short: "GT", colors: "from-[#101d3b] to-[#c7a253]" },
  KKR: { name: "Kolkata Knight Riders", short: "KKR", colors: "from-[#34105f] to-[#d5a332]" },
  LSG: { name: "Lucknow Super Giants", short: "LSG", colors: "from-[#29a9e8] to-[#ef7d22]" },
  MI: { name: "Mumbai Indians", short: "MI", colors: "from-[#005da8] to-[#19a8e0]" },
  PBKS: { name: "Punjab Kings", short: "PBKS", colors: "from-[#d71920] to-[#f4b2b2]" },
  RR: { name: "Rajasthan Royals", short: "RR", colors: "from-[#e91e8f] to-[#234aa8]" },
  RCB: { name: "Royal Challengers Bengaluru", short: "RCB", colors: "from-[#d71920] to-[#111827]" },
  SRH: { name: "Sunrisers Hyderabad", short: "SRH", colors: "from-[#f97316] to-[#111827]" },
  TBD: { name: "TBD", short: "TBD", colors: "from-[#64748b] to-[#1e293b]" },
};

export const IPL_2026_REMAINING_FIXTURES: IplFixture[] = [
  { matchNo: 50, home: "LSG", away: "RCB", startsAt: "2026-05-07T14:00:00.000Z", venue: "Ekana Cricket Stadium, Lucknow" },
  { matchNo: 51, home: "DC", away: "KKR", startsAt: "2026-05-08T14:00:00.000Z", venue: "Arun Jaitley Stadium, Delhi" },
  { matchNo: 52, home: "RR", away: "GT", startsAt: "2026-05-09T14:00:00.000Z", venue: "Sawai Mansingh Stadium, Jaipur" },
  { matchNo: 53, home: "CSK", away: "LSG", startsAt: "2026-05-10T10:00:00.000Z", venue: "MA Chidambaram Stadium, Chennai" },
  { matchNo: 54, home: "RCB", away: "MI", startsAt: "2026-05-10T14:00:00.000Z", venue: "Shaheed Veer Narayan Singh International Stadium, Raipur" },
  { matchNo: 55, home: "PBKS", away: "DC", startsAt: "2026-05-11T14:00:00.000Z", venue: "HPCA Stadium, Dharamsala" },
  { matchNo: 56, home: "GT", away: "SRH", startsAt: "2026-05-12T14:00:00.000Z", venue: "Narendra Modi Stadium, Ahmedabad" },
  { matchNo: 57, home: "RCB", away: "KKR", startsAt: "2026-05-13T14:00:00.000Z", venue: "Shaheed Veer Narayan Singh International Stadium, Raipur" },
  { matchNo: 58, home: "PBKS", away: "MI", startsAt: "2026-05-14T14:00:00.000Z", venue: "HPCA Stadium, Dharamsala" },
  { matchNo: 59, home: "LSG", away: "CSK", startsAt: "2026-05-15T14:00:00.000Z", venue: "Ekana Cricket Stadium, Lucknow" },
  { matchNo: 60, home: "KKR", away: "GT", startsAt: "2026-05-16T14:00:00.000Z", venue: "Eden Gardens, Kolkata" },
  { matchNo: 61, home: "PBKS", away: "RCB", startsAt: "2026-05-17T10:00:00.000Z", venue: "HPCA Stadium, Dharamsala" },
  { matchNo: 62, home: "DC", away: "RR", startsAt: "2026-05-17T14:00:00.000Z", venue: "Arun Jaitley Stadium, Delhi" },
  { matchNo: 63, home: "CSK", away: "SRH", startsAt: "2026-05-18T14:00:00.000Z", venue: "MA Chidambaram Stadium, Chennai" },
  { matchNo: 64, home: "RR", away: "LSG", startsAt: "2026-05-19T14:00:00.000Z", venue: "Sawai Mansingh Stadium, Jaipur" },
  { matchNo: 65, home: "KKR", away: "MI", startsAt: "2026-05-20T14:00:00.000Z", venue: "Eden Gardens, Kolkata" },
  { matchNo: 66, home: "CSK", away: "GT", startsAt: "2026-05-21T14:00:00.000Z", venue: "MA Chidambaram Stadium, Chennai" },
  { matchNo: 67, home: "SRH", away: "RCB", startsAt: "2026-05-22T14:00:00.000Z", venue: "Rajiv Gandhi International Stadium, Hyderabad" },
  { matchNo: 68, home: "LSG", away: "PBKS", startsAt: "2026-05-23T14:00:00.000Z", venue: "Ekana Cricket Stadium, Lucknow" },
  { matchNo: 69, home: "MI", away: "RR", startsAt: "2026-05-24T10:00:00.000Z", venue: "Wankhede Stadium, Mumbai" },
  { matchNo: 70, home: "KKR", away: "DC", startsAt: "2026-05-24T14:00:00.000Z", venue: "Eden Gardens, Kolkata" },
  { matchNo: 71, home: "TBD", away: "TBD", startsAt: "2026-05-27T14:00:00.000Z", venue: "Narendra Modi Stadium, Ahmedabad", label: "Qualifier 1" },
  { matchNo: 72, home: "TBD", away: "TBD", startsAt: "2026-05-28T14:00:00.000Z", venue: "Narendra Modi Stadium, Ahmedabad", label: "Eliminator" },
  { matchNo: 73, home: "TBD", away: "TBD", startsAt: "2026-05-29T14:00:00.000Z", venue: "Eden Gardens, Kolkata", label: "Qualifier 2" },
  { matchNo: 74, home: "TBD", away: "TBD", startsAt: "2026-05-31T14:00:00.000Z", venue: "Narendra Modi Stadium, Ahmedabad", label: "Final" },
];

export function teamName(code: IplTeamCode) {
  return IPL_TEAMS[code]?.name || code;
}

export function teamShort(code: string | null | undefined) {
  return (code && IPL_TEAMS[code as IplTeamCode]?.short) || code || "";
}
