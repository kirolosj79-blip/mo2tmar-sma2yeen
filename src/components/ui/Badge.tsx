export default function Badge({
  children,
  color = "#F2B84B",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {children}
    </span>
  );
}
