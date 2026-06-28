export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
        Copenhagen · Atelier
      </p>
      <h1 className="mt-6 font-editorial text-6xl tracking-tightest text-foreground sm:text-8xl">
        Bella Nails
      </h1>
      <p className="mt-5 max-w-md font-functional text-base text-muted-foreground sm:text-lg">
        A premium nail atelier. Online booking opens soon.
      </p>
      <div className="mt-10 h-px w-16 bg-border" aria-hidden />
    </main>
  );
}
