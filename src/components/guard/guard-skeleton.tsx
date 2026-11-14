export function GuardSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      <div className="mx-auto h-20 w-full max-w-sm animate-pulse rounded-2xl bg-white/10" />
      <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-3">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/10" />
        ))}
      </div>
    </div>
  );
}
