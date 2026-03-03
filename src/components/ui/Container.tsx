interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
