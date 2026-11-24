export function CubeIcon({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <polygon points="32,6 58,19 32,32 6,19" fill="#ffcb05" stroke="#00274c" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="6,19 32,32 32,59 6,46" fill="#d9ab00" stroke="#00274c" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="58,19 32,32 32,59 58,46" fill="#a7d3ff" stroke="#00274c" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <CubeIcon />
      <span className="font-display text-lg leading-none text-maize sm:text-xl">
        Roblox <span className="text-white">at</span> UM
      </span>
    </span>
  );
}
