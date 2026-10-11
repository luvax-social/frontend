export default function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader__dot" />
      <p>{label}</p>
    </div>
  );
}
