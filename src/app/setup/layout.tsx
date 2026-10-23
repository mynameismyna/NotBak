// Setup pages bypass the setup check - no layout wrapper needed
export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
