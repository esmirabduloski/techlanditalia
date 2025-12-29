import { Link } from 'react-router-dom';

export function TechlandLogo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`text-2xl font-bold ${className}`}>
      <span className="text-primary">TECH</span>
      <span className="text-tech-teal">LAND</span>
    </Link>
  );
}
