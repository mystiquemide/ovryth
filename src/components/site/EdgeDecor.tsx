/**
 * Hero edge decoration: real money imagery tilted and bleeding off the viewport
 * edges, sitting behind the centered product card. Decorative only, hidden below
 * xl so the 880px content column never collides with them.
 */
export function EdgeDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden xl:block">
      <Img
        src="/hero/coins.jpg"
        alt=""
        className="left-0 top-[44%] w-[520px] -translate-x-[30%] -rotate-[7deg]"
      />
      <Img
        src="/hero/cash.jpg"
        alt=""
        className="right-0 top-[50%] w-[500px] translate-x-[30%] rotate-[8deg]"
      />
      <Img
        src="/hero/rain.jpg"
        alt=""
        className="right-[1%] top-[10%] w-[330px] rotate-[-8deg]"
      />
    </div>
  );
}

function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`absolute overflow-hidden rounded-[18px] shadow-[var(--shadow-artifact)] ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block h-auto w-full object-cover" loading="eager" decoding="async" />
    </div>
  );
}
