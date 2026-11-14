export default function Loading() {
  return (
    <div
      className="container page-space"
      aria-busy="true"
      aria-label="Loading your next experience"
    >
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-line" />
      <div className="event-grid">
        {[1, 2, 3].map((item) => (
          <div key={item} className="skeleton-card">
            <div className="skeleton skeleton-image" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
