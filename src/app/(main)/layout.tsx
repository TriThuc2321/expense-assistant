type MainLayoutProps = {
  children: React.ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="bg-background flex min-h-screen flex-col">{children}</div>
  );
}
