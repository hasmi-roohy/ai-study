export function AdminPanel({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-[#232A38] bg-[#12161F] p-5">
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#E7EAF0]">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function AdminStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-mono text-2xl text-[#E7EAF0]">{value}</div>
      <div className="text-xs text-[#7C8598]">{label}</div>
    </div>
  );
}

export function AdminButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-[#4FB3C6] px-3 py-1.5 text-[13px] font-semibold text-[#0A0D12] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function AdminTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[#7C8598]">
          {head.map((h) => (
            <th key={h} className="py-1.5 font-normal">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="font-mono">{children}</tbody>
    </table>
  );
}
