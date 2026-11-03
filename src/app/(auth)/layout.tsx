import { SwitchLocale, ThemeSwitch } from '@/components/layouts';

type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="bg-app relative flex min-h-dvh flex-1 items-center justify-center p-6">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <SwitchLocale />
        <ThemeSwitch />
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
