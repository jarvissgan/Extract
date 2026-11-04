// A mode illustrations: an original drawing of classic Pooh (the 1926 book version,
// public domain in the US; deliberately not Disney's design, e.g. no red shirt)
// and his "HUNNY" pot. Plain shapes, no gradients.
import { useId } from "react";

const FUR = "#e8a83a";
const FUR_DARK = "#c8862a";
const FUR_LIGHT = "#f6d38f";
const INK = "#4a3426";
const POT = "#d48a52";
const POT_DARK = "#b06d3a";
const LABEL = "#fff6dc";
const HONEY = "#f5b52e";

interface PotProps {
  size?: number;
  // 0-100: how full of honey the pot is (shown through a window in the pot)
  fill?: number;
  title?: string;
}

// Earthenware honey pot with a "HUNNY" label. With `fill`, honey rises inside it.
export const HoneyPot = ({ size = 64, fill, title }: PotProps) => {
  const clipId = useId();
  const level = fill === undefined ? null : Math.max(0, Math.min(100, fill));
  // pot body spans y=34..104
  const honeyTop = level === null ? 0 : 104 - (70 * level) / 100;

  return (
    <svg width={size} height={(size * 112) / 100} viewBox="0 0 100 112" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <clipPath id={clipId}>
          <path d="M22 36 Q8 58 16 84 Q26 106 50 106 Q74 106 84 84 Q92 58 78 36 Z" />
        </clipPath>
      </defs>
      {/* body */}
      <path d="M22 36 Q8 58 16 84 Q26 106 50 106 Q74 106 84 84 Q92 58 78 36 Z" fill={level === null ? POT : "#f3d9b8"} stroke={POT_DARK} strokeWidth="3" />
      {level !== null && (
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y={honeyTop} width="100" height="112" fill={HONEY} />
          {level > 0 && level < 100 && (
            <path d={`M0 ${honeyTop} Q 25 ${honeyTop - 4} 50 ${honeyTop} T 100 ${honeyTop}`} fill="none" stroke="#e39b12" strokeWidth="2" />
          )}
        </g>
      )}
      {level !== null && (
        <path d="M22 36 Q8 58 16 84 Q26 106 50 106 Q74 106 84 84 Q92 58 78 36 Z" fill="none" stroke={POT_DARK} strokeWidth="3" />
      )}
      {/* rim */}
      <rect x="18" y="24" width="64" height="14" rx="7" fill={POT} stroke={POT_DARK} strokeWidth="3" />
      {/* honey drip over the rim */}
      <path d="M30 30 Q30 46 35 46 Q40 46 39 34 Q42 40 46 38 Q48 31 44 28 Z" fill={HONEY} />
      {/* label */}
      <g transform="rotate(-5 50 66)">
        <rect x="27" y="56" width="46" height="20" rx="3" fill={LABEL} stroke={POT_DARK} strokeWidth="1.5" />
        <text x="50" y="71" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="12" fill={INK} letterSpacing="0.5">
          HUNNY
        </text>
      </g>
    </svg>
  );
};

// Pooh sitting, hugging his honey pot.
export const PoohBear = ({ size = 120, title = "Winnie-the-Pooh" }: { size?: number; title?: string }) => (
  <svg width={size} height={(size * 132) / 120} viewBox="0 0 120 132" role="img" aria-label={title}>
    {/* feet */}
    <ellipse cx="34" cy="120" rx="16" ry="9" fill={FUR} stroke={FUR_DARK} strokeWidth="2.5" />
    <ellipse cx="86" cy="120" rx="16" ry="9" fill={FUR} stroke={FUR_DARK} strokeWidth="2.5" />
    {/* body */}
    <ellipse cx="60" cy="94" rx="36" ry="30" fill={FUR} stroke={FUR_DARK} strokeWidth="2.5" />
    <ellipse cx="60" cy="98" rx="22" ry="20" fill={FUR_LIGHT} />
    {/* ears */}
    <circle cx="35" cy="22" r="11" fill={FUR} stroke={FUR_DARK} strokeWidth="2.5" />
    <circle cx="85" cy="22" r="11" fill={FUR} stroke={FUR_DARK} strokeWidth="2.5" />
    <circle cx="35" cy="22" r="5" fill={FUR_DARK} opacity="0.45" />
    <circle cx="85" cy="22" r="5" fill={FUR_DARK} opacity="0.45" />
    {/* head */}
    <circle cx="60" cy="46" r="30" fill={FUR} stroke={FUR_DARK} strokeWidth="2.5" />
    <ellipse cx="60" cy="58" rx="15" ry="11" fill={FUR_LIGHT} />
    {/* face */}
    <circle cx="49" cy="42" r="2.8" fill={INK} />
    <circle cx="71" cy="42" r="2.8" fill={INK} />
    <path d="M45 35 Q49 32 53 35" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M67 35 Q71 32 75 35" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    <ellipse cx="60" cy="53" rx="6" ry="4.2" fill={INK} />
    <path d="M60 57 L60 61 M52 61 Q60 68 68 61" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="44" cy="55" rx="5" ry="3" fill="#f2a07b" opacity="0.5" />
    <ellipse cx="76" cy="55" rx="5" ry="3" fill="#f2a07b" opacity="0.5" />
    {/* honey pot held in front */}
    <g transform="translate(38 78) scale(0.44)">
      <path d="M22 36 Q8 58 16 84 Q26 106 50 106 Q74 106 84 84 Q92 58 78 36 Z" fill={POT} stroke={POT_DARK} strokeWidth="5" />
      <rect x="18" y="24" width="64" height="14" rx="7" fill={POT} stroke={POT_DARK} strokeWidth="5" />
      <path d="M30 30 Q30 46 35 46 Q40 46 39 34 Q42 40 46 38 Q48 31 44 28 Z" fill={HONEY} />
      <rect x="27" y="56" width="46" height="20" rx="3" fill={LABEL} />
    </g>
    {/* arms around the pot */}
    <ellipse cx="33" cy="96" rx="10" ry="15" transform="rotate(-25 33 96)" fill={FUR} stroke={FUR_DARK} strokeWidth="2.5" />
    <ellipse cx="87" cy="96" rx="10" ry="15" transform="rotate(25 87 96)" fill={FUR} stroke={FUR_DARK} strokeWidth="2.5" />
    {/* a little honey on his nose */}
    <circle cx="64" cy="50" r="1.6" fill={HONEY} />
  </svg>
);
