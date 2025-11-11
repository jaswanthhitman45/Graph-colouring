import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { StatisticsPanel } from './StatisticsPanel';
import { GraphVisualization } from './GraphVisualization';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { dsaturColoring } from '../utils/graphColoring';
import { StudentEnrollmentsDisplay } from './StudentEnrollmentsDisplay';
import { ScheduleResult } from '../types';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface ResultsPageProps {
  result: ScheduleResult;
}

export function ResultsPage({ result }: ResultsPageProps) {
  const navigate = useNavigate();
  const [optimize, setOptimize] = React.useState(false);

  // Compute optimized schedule lazily
  const optimized = React.useMemo(() => {
    if (!result) return null;
    // Use dsatur on the current courses map
    return dsaturColoring(result.courses, result.students);
  }, [result]);

  // Compute per-course differences between standard and optimized
  const diffs = React.useMemo(() => {
    if (!optimized) return { changed: [], movedCount: 0 };
    const changed: Array<{ name: string; standardSlot: number | undefined; optimizedSlot: number | undefined }> = [];
    let movedCount = 0;
    result.courses.forEach((course, name) => {
      const stdSlot = course.slot;
      const optCourse = optimized.courses.get(name);
      const optSlot = optCourse?.slot;
      if (stdSlot !== optSlot) {
        changed.push({ name, standardSlot: stdSlot, optimizedSlot: optSlot });
        movedCount++;
      }
    });
    changed.sort((a, b) => (a.optimizedSlot ?? 0) - (b.optimizedSlot ?? 0) || a.name.localeCompare(b.name));
    return { changed, movedCount };
  }, [result, optimized]);

  // Summary values
  const totalCourses = result?.courses.size ?? 0;
  const totalConflicts = result?.totalConflicts ?? 0;
  const standardSlots = result?.totalSlots ?? 0;
  const optimizedSlots = optimized?.totalSlots ?? undefined;
  const improvementPct = optimizedSlots ? Math.round(((standardSlots - optimizedSlots) / standardSlots) * 100) : 0;
  return (
    <div className="w-full flex flex-col gap-8">
      <div className="flex justify-between items-center mb-4">
        <button
          className="px-4 py-2 rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 transition"
          onClick={() => navigate('/')}
        >
          ← Back
        </button>
        <button
          className="px-4 py-2 rounded bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold hover:from-green-700 hover:to-teal-700 transition"
          onClick={() => navigate('/search')}
        >
          🔍 Student Search
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Generate CSV for students
              if (!result || !result.students || result.students.length === 0) {
                toast.error('No student data to export');
                return;
              }
              const escape = (s: string) => '"' + s.replace(/"/g, '""') + '"';
              let csv = 'student_id,courses\n';
              result.students.forEach(stu => {
                const courseStr = stu.courses.join(', ');
                csv += `${stu.id},${escape(courseStr)}\n`;
              });
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'students.csv';
              document.body.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
              a.remove();
              toast.success('Students CSV generated');
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Students CSV
          </Button>
        </div>
      </div>
      <div className="flex items-start justify-between">
        <div className="w-full pr-4">
          <StatisticsPanel result={result} />
        </div>
        <div className="flex flex-col items-end gap-3">
          {/* removed redundant View Graph button - single control below Subjects */}
        </div>
      </div>

      {/* Comparison summary panel */}
      <div className="w-full bg-white rounded-lg shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="text-sm text-gray-600">Total Courses</div>
          <div className="text-xl font-semibold">{totalCourses}</div>
          <div className="text-sm text-gray-600">Conflicts Resolved</div>
          <div className="text-xl font-semibold">{totalConflicts}</div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm text-gray-600">Standard Slots</div>
          <div className="text-xl font-semibold">{standardSlots}</div>
          <div className="text-sm text-gray-600">Optimized Slots</div>
          <div className="text-xl font-semibold">{optimizedSlots ?? '—'}</div>
          <div className="text-sm text-gray-600">Improvement</div>
          <div className={`text-xl font-semibold ${optimizedSlots && optimizedSlots < standardSlots ? 'text-green-600' : 'text-gray-600'}`}>
            {optimizedSlots ? `${improvementPct}%` : '—'}
          </div>
        </div>
      </div>
      {result.students && result.students.length > 0 && (
        <>
          <StudentEnrollmentsDisplay students={result.students} />

          {/* Moved toggle below subjects and unified Show Graph control */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <div className="flex items-center gap-3">
              <Label htmlFor="opt-toggle" className="text-sm font-medium">Optimization Mode (DSATUR)</Label>
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Switch id="opt-toggle" checked={optimize} onCheckedChange={setOptimize} />
              </motion.div>
            </div>
          </div>
        </>
      )}

      {/* Animated comparison cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <AnimatePresence mode="wait">
          <motion.div key="standard" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Standard Schedule (Welsh–Powell)</div>
              <div className="text-sm text-gray-600">Slots: <strong>{standardSlots}</strong></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th>Time Slot</th>
                    <th>Courses</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(result.slots.entries()).sort((a,b)=>a[0]-b[0]).map(([slot,courses]) => (
                    <tr key={slot} className="border-t">
                      <td className="py-3">Slot {slot}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {courses.map(c => (
                            <span key={c} className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: result.courses.get(c)?.color }}>{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3">{courses.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div key="optimized" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: optimize ? 1 : 0.6, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg ${optimize ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Optimized Schedule (DSATUR)</div>
              <div className="text-sm text-gray-600">Slots: <strong>{optimizedSlots ?? '—'}</strong></div>
            </div>
            <div className="overflow-x-auto">
              {optimized ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th>Time Slot</th>
                      <th>Courses</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(optimized.slots.entries()).sort((a,b)=>a[0]-b[0]).map(([slot,courses]) => (
                      <tr key={slot} className="border-t">
                        <td className="py-3">Slot {slot}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            {courses.map(c => (
                              <span key={c} className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: optimized.courses.get(c)?.color }}>{c}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3">{courses.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-gray-500">Optimization not prepared yet</div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Differences summary */}
      {optimized && (
        <div className="p-4 bg-white rounded-lg border mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold">Differences</div>
              {optimized.totalSlots < standardSlots ? (
                <div className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Optimized improved</div>
              ) : (
                <div className="text-sm text-gray-600 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> No improvement</div>
              )}
            </div>
            <div className="text-sm text-gray-600">Moved courses: <strong>{diffs.movedCount}</strong></div>
          </div>
          {diffs.changed.length === 0 ? (
            <div className="text-sm text-gray-600">No course moved between Standard and Optimized schedules.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {diffs.changed.map(d => (
                <div key={d.name} className="p-2 rounded border bg-gray-50">
                  <div className="text-sm font-medium">{d.name}</div>
                  <div className="text-xs text-gray-600">Standard: {d.standardSlot ?? '—'}</div>
                  <div className="text-xs text-gray-600">Optimized: {d.optimizedSlot ?? '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <GraphVisualization result={optimize && optimized ? optimized : result} />
    </div>
  );
}
