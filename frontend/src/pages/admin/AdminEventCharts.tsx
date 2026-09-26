const colors = ['#3167ee', '#09a888', '#df5365', '#f1a41b', '#8d65da', '#45a8c6'];

export function AdminEventDistribution({ values }: { values: [string, number][] }) {
  const total = values.reduce((sum, [, count]) => sum + count, 0);
  if (!total) return <p className="adminEmpty">No events available for analysis.</p>;
  const segments = values.map(([, count], index) => {
    const start = values.slice(0, index).reduce((sum, [, value]) => sum + value, 0) / total * 100;
    return `${colors[index % colors.length]} ${start}% ${start + count / total * 100}%`;
  });
  return <div className="adminDonutLayout">
    <div className="adminDonut" style={{ background: `conic-gradient(${segments.join(',')})` }} role="img" aria-label={`${total} loaded events; category counts listed alongside`}>
      <div><strong>{total}</strong><span>Loaded events</span></div>
    </div>
    <ul className="adminChartLegend">{values.map(([label, count], index) => <li key={label}><span className="adminLegendDot" style={{ background: colors[index % colors.length] }} aria-hidden="true" /><span>{label}</span><strong>{count}</strong></li>)}</ul>
  </div>;
}

export function AdminEventTrend({ values }: { values: [string, number][] }) {
  if (!values.length) return <p className="adminEmpty">No recorded dates available.</p>;
  const max = Math.max(...values.map(([, count]) => count), 1);
  const points = values.map(([date, count], index) => ({ date, count, x: values.length === 1 ? 160 : 24 + index / (values.length - 1) * 272, y: 116 - count / max * 92 }));
  return <div>
    <svg className="adminTrendChart" viewBox="0 0 320 144" role="img" aria-label="Event counts by recorded date. Exact values are listed below; intervening dates are not inferred.">
      {[0, 0.5, 1].map(ratio => <g key={ratio}><line x1="24" x2="304" y1={116 - ratio * 92} y2={116 - ratio * 92} stroke="#dce5f2" /><text x="0" y={120 - ratio * 92} fontSize="9" fill="#526785">{Math.round(max * ratio)}</text></g>)}
      <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#3167ee" strokeWidth="2" />
      {points.map(point => <circle key={point.date} cx={point.x} cy={point.y} r="3" fill="white" stroke="#3167ee" strokeWidth="2"><title>{`${point.date}: ${point.count} events`}</title></circle>)}
    </svg>
    <ul className="adminTrendValues">{values.map(([date, count]) => <li key={date}><span>{date}</span><strong>{count}</strong></li>)}</ul>
  </div>;
}
