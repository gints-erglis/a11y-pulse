export default function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 90 ? '#0c0' : score >= 70 ? '#fc0' : '#f44';

  return (
    <div className="progress-ring">
      <svg viewBox="0 0 36 36" className="progress-ring__ring">
        <path
          className="text-gray-300"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          d="M18 2.0845
             a 15.9155 15.9155 0 0 1 0 31.831
             a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          stroke={color}
          strokeWidth="4"
          fill="none"
          d="M18 2.0845
             a 15.9155 15.9155 0 0 1 0 31.831
             a 15.9155 15.9155 0 0 1 0 -31.831"
          strokeDasharray={`${score}, 100`}
        />
      </svg>
      <span className="progress-ring__text">
        {score}
      </span>
    </div>
  );
}
