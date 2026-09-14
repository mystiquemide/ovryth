/**
 * Hero edge decoration: real photographed objects cut out to transparent PNGs and
 * placed directly on the canvas, tilted, partly entering from outside the viewport.
 * No card frames or image boundaries. Each gets a soft contact shadow via a
 * drop-shadow filter that follows the object's silhouette. Decorative only, hidden
 * below xl so the centered content column never collides with them.
 */
export function EdgeDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden xl:block">
      {/* Smartphone: the Telegram surface */}
      <Obj
        src="/hero/phone.png"
        className="left-0 top-[52%] w-[230px] -translate-x-[38%] -rotate-[10deg]"
      />
      {/* Crypto coin stack: the Base / USDC payout */}
      <Obj
        src="/hero/coins.png"
        className="right-0 top-[46%] w-[185px] translate-x-[31%] rotate-[7deg]"
      />
      {/* Bank card: payments */}
      <Obj
        src="/hero/card.png"
        className="right-[2%] top-[12%] w-[185px] rotate-[13deg]"
      />
      {/* Calculator: the weekly budget */}
      <Obj
        src="/hero/calc.png"
        className="left-[3%] top-[26%] w-[125px] rotate-[-9deg]"
      />
    </div>
  );
}

function Obj({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="eager"
      decoding="async"
      className={`absolute object-contain drop-shadow-[0_22px_30px_rgb(13_17_27/0.16)] ${className ?? ""}`}
    />
  );
}
