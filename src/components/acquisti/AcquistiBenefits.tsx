import { Shield, Users, Award, Sparkles } from "lucide-react";

const benefits = [
  {
    icon: Users,
    title: "Piccoli gruppi",
    description: "Max 4 studenti per classe per attenzione personalizzata",
  },
  {
    icon: Award,
    title: "Insegnanti esperti",
    description: "Docenti qualificati e appassionati di tecnologia",
  },
  {
    icon: Shield,
    title: "Soddisfatti o rimborsati",
    description: "Garanzia di rimborso entro 14 giorni",
  },
  {
    icon: Sparkles,
    title: "Progetti reali",
    description: "I ragazzi creano giochi, siti web e app vere",
  },
];

export function AcquistiBenefits() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      {benefits.map((b) => (
        <div
          key={b.title}
          className="flex flex-col items-center text-center p-4 rounded-2xl bg-primary/5 border border-primary/10"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <b.icon className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{b.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{b.description}</p>
        </div>
      ))}
    </div>
  );
}
