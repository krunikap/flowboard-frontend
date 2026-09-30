"use client";

export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100 text-xl text-amber-700" aria-hidden="true">!</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">This page ran into a problem</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your workspace is still available. Try loading this page again.</p>
        <button type="button" onClick={() => retry()} className="mt-6 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Try again</button>
      </section>
    </main>
  );
}
