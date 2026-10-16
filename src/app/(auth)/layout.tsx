type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="bg-background flex h-screen w-screen items-center justify-center">
      <div className="bg-surface w-full max-w-lg rounded-3xl p-10 shadow">
        {children}
      </div>
    </div>
  );
}
