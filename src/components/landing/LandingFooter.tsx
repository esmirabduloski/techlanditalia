import { Link } from 'react-router-dom';

export function LandingFooter() {
  return (
    <footer className="py-8 px-4 bg-muted/50 border-t">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-bold">
            <span className="text-primary">TECH</span>
            <span className="text-tech-teal">LAND</span>
          </span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/termini" className="hover:text-foreground transition-colors">Termini</Link>
          <Link to="/" className="hover:text-foreground transition-colors">Sito web</Link>
        </div>
      </div>
    </footer>
  );
}
