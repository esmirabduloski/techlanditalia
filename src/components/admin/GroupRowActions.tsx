import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Archive, ArrowRightLeft, Calendar, Copy, Edit, GitMerge, ListTree, MoreHorizontal, RotateCcw, Trash2,
} from 'lucide-react';

interface Props {
  groupId: string;
  groupTitle: string;
  isActive: boolean;
  onEdit: () => void;
  onCalendar: () => void;
  onTimeline: () => void;
  onTransfer: () => void;
  onMergeSplit: () => void;
  onResetAttendance: () => void;
  onArchive: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  /** Pulsanti a tutta larghezza (schede da telefono). */
  fullWidth?: boolean;
}

/** Azioni di un gruppo: le due più usate in vista, le altre nel menu "Altro". */
export function GroupRowActions({
  groupId, groupTitle, isActive, onEdit, onCalendar, onTimeline, onTransfer, onMergeSplit,
  onResetAttendance, onArchive, onReactivate, onDelete, fullWidth,
}: Props) {
  const { toast } = useToast();

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(groupId);
      toast({ title: 'ID copiato', description: groupId });
    } catch {
      toast({ title: 'ID del gruppo', description: groupId });
    }
  };

  const grow = fullWidth ? 'flex-1' : '';

  return (
    <div className={`flex items-center gap-2 ${fullWidth ? 'w-full' : 'justify-end'}`}>
      <Button variant="outline" size="sm" className={grow} onClick={onEdit}>
        <Edit className="w-4 h-4 mr-1.5" />
        Modifica
      </Button>
      <Button variant="outline" size="sm" className={grow} onClick={onCalendar}>
        <Calendar className="w-4 h-4 mr-1.5" />
        Calendario
      </Button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Altre azioni per ${groupTitle}`}>
            <MoreHorizontal className="w-4 h-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Altro</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Programma</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onTimeline}>
            <ListTree className="w-4 h-4 mr-2" />
            Timeline programma
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Studenti</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onTransfer}>
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Trasferisci studenti
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onMergeSplit}>
            <GitMerge className="w-4 h-4 mr-2" />
            Unisci / Dividi gruppo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={copyId}>
            <Copy className="w-4 h-4 mr-2" />
            Copia ID del gruppo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onResetAttendance} className="text-orange-600 focus:text-orange-600">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset presenze
          </DropdownMenuItem>
          {isActive ? (
            <DropdownMenuItem onSelect={onArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Archivia gruppo
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={onReactivate} className="text-green-700 focus:text-green-700">
              <RotateCcw className="w-4 h-4 mr-2" />
              Riattiva gruppo
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Elimina gruppo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
