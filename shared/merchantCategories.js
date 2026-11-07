// Best-guess categories for common Singapore merchants, used when importing statements
// and the user has no rule for the name. Checked in order; first match wins.
// Only built-in categories are used, so this works for every account.
const HINTS = [
  ["food", /GRAB ?FOOD|FOODPANDA|DELIVEROO|NTUC|FAIRPRICE|FAIR PRICE|COLD STORAGE|SHENG SIONG|GIANT|DON DON DONKI|DONKI|MCDONALD|KFC|BURGER KING|STARBUCKS|TOAST BOX|YA KUN|KOPITIAM|KOUFU|FOOD|CAFE|COFFEE|RESTAURANT|BAKERY|BREADTALK|7-ELEVEN|7 ELEVEN|CHEERS|BUBBLE TEA|KOI|LIHO|PRIME SUPERMARKET|SUPERMARKET/],
  ["transport", /GRAB|GOJEK|COMFORT|CDG|TADA|ZIG\b|BUS\/MRT|SMRT|SBS TRANSIT|TRANSIT|SIMPLYGO|EZ-?LINK|SHELL|ESSO|CALTEX|\bSPC\b|PARKING|CARPARK|\bERP\b|\bLTA\b/],
  ["housing", /SP SERVICES|SP DIGITAL|SPSERVICES|\bHDB\b|TOWN COUNCIL|CITY GAS|SENOKO|GENECO|TUAS POWER|KEPPEL ELECTRIC|PACIFICLIGHT/],
];

export function categoryFromMerchant(name) {
  const upper = String(name || "").toUpperCase();
  const hit = HINTS.find(([, re]) => re.test(upper));
  return hit ? hit[0] : null;
}
