import { Link, useNavigate } from "react-router-dom";
import { LogOut, User, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BugReportButton } from "@/components/BugReportButton";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminHeaderProps {
  /** When true, shows the "Insegnante" link button (default true). */
  showTeacherLink?: boolean;
}

export function AdminHeader({ showTeacherLink = true }: AdminHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="bg-background border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
        {/* Logo + badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link to="/" className="text-xl sm:text-2xl font-bold whitespace-nowrap">
            <span className="text-primary">TECH</span>
            <span className="text-tech-teal">LAND</span>
          </Link>
          <Badge variant="secondary" className="text-xs">Admin</Badge>
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3 lg:gap-4">
          <BugReportButton />
          <span className="text-sm text-muted-foreground hidden lg:block max-w-[180px] truncate">
            {user?.email}
          </span>
          {showTeacherLink && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/insegnante">
                <User className="w-4 h-4 mr-2" />
                Insegnante
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>

        {/* Mobile actions: bug button + menu */}
        <div className="flex md:hidden items-center gap-1">
          <BugReportButton />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreVertical className="w-4 h-4" />
                <span className="sr-only">Apri menu account</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user?.email && (
                <>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              {showTeacherLink && (
                <DropdownMenuItem asChild>
                  <Link to="/insegnante" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Area Insegnante
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
