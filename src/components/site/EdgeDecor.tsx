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
        className="left-0 top-[52%] w-[310px] -translate-x-[42%] -rotate-[8deg]"
      />
      <Img
        src="/hero/cash.jpg"
        alt=""
        className="right-0 top-[54%] w-[300px] translate-x-[42%] rotate-[9deg]"
      />
      <Img
        src="/hero/rain.jpg"
        alt=""
        className="right-[2%] top-[15%] w-[200px] rotate-[-9deg]"
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
