import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Users, BookOpen, Target, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CourseInfoData {
  description: string;
  longDescription: string;
  age: string;
  level: string;
  duration: string;
  tags: string[];
  topics: string[];
  modules: { title: string; result: string }[];
}

interface LandingCourseInfoProps {
  courseInfo: CourseInfoData;
  courseName?: string;
  courseEmoji?: string;
}

export function LandingCourseInfo({ courseInfo, courseName, courseEmoji }: LandingCourseInfoProps) {
  if (!courseInfo) return null;

  return (
    <>
      {/* Course Info Section */}
      <section className="py-16 sm:py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground mb-4">
              {courseEmoji && <span className="mr-2">{courseEmoji}</span>}
              Informazioni sul corso
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
              {courseInfo.longDescription}
            </p>
          </motion.div>

          {/* Meta badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-10"
          >
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-5 py-3 shadow-sm">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Età</p>
                <p className="font-bold text-foreground text-sm">{courseInfo.age}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-5 py-3 shadow-sm">
              <Target className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Livello</p>
                <p className="font-bold text-foreground text-sm">{courseInfo.level}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-5 py-3 shadow-sm">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Durata</p>
                <p className="font-bold text-foreground text-sm">{courseInfo.duration}</p>
              </div>
            </div>
          </motion.div>

          {/* Tags */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {courseInfo.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-sm px-3 py-1">
                {tag}
              </Badge>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Topics Section */}
      <section className="py-16 sm:py-20 px-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground mb-4">
              Cosa imparerà tuo figlio
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Competenze concrete che acquisirà durante il corso
            </p>
          </motion.div>

          <div className="grid gap-4">
            {courseInfo.topics.map((topic, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="flex items-start gap-4 p-4 sm:p-5 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <p className="text-foreground text-sm sm:text-base leading-relaxed">{topic}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Curriculum Section */}
      <section className="py-16 sm:py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-5 py-2 mb-4">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Programma del corso</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground mb-4">
              Il percorso di apprendimento
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              {courseInfo.modules.length} moduli progettati per un apprendimento graduale e coinvolgente
            </p>
          </motion.div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-6">
              {courseInfo.modules.map((mod, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="relative pl-12 sm:pl-16"
                >
                  {/* Timeline dot */}
                  <div className="absolute left-2 sm:left-4 top-4 w-5 h-5 sm:w-5 sm:h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold z-10 shadow-md shadow-primary/30">
                    {index + 1}
                  </div>

                  <div className="p-5 sm:p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all">
                    <h3 className="font-bold text-foreground text-sm sm:text-base mb-2">{mod.title}</h3>
                    <div className="flex items-start gap-2">
                      <GraduationCap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{mod.result}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
