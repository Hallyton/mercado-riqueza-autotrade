import "./autotrade-landing.css";

export default function AutotradeLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="autotrade-landing">{children}</div>;
}
