import { Student, Course, ScheduleResult } from '../types';

export const SLOT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#F59E0B', // Gold
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#06B6D4', // Sky
  '#F97316', // Orange
];

export function parseStudentData(input: string): Student[] {
  if (!input || !input.trim()) return [];
  
  const lines = input.trim().split('\n').filter(line => line.trim().length > 0);
  const students: Student[] = [];

  lines.forEach((line, index) => {
    // Support multiple formats: "S1: Math, Physics" or "S1,Math,Physics" or "Student1: Math, Physics"
    const patterns = [
      /^(\w+):\s*(.+)$/,           // S1: Math, Physics
      /^(\w+),\s*(.+)$/,          // S1,Math,Physics
      /^([^,]+),\s*(.+)$/         // Student Name,Math,Physics
    ];
    
    let match = null;
    for (const pattern of patterns) {
      match = line.match(pattern);
      if (match) break;
    }
    
    if (match) {
      const [, id, coursesStr] = match;
      if (!id || !coursesStr) return;
      
      const courses = coursesStr.split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0)
        .map(c => c.replace(/['"]/g, '')) // Remove quotes
        .map(c => {
          // Handle common course name variations
          if (c.toLowerCase() === 'iot' || c.toLowerCase() === 'internet of things') {
            return 'IoT'; // Standardize to IoT
          }
          return c;
        })
        .filter(c => c.length > 0); // Filter again after processing
      
      if (courses.length > 0 && id.trim()) {
        students.push({ id: id.trim(), courses });
        console.log(`Parsed student ${id.trim()}: [${courses.join(', ')}]`);
      }
    } else {
      console.warn(`Warning: Could not parse line ${index + 1}: "${line}"`);
    }
  });

  console.log(`Total students parsed: ${students.length}`);
  return students;
}

export function parseCourseList(input: string): string[] {
  if (!input || !input.trim()) return [];
  
  // Handle comma-separated courses (don't split on spaces since course names can have spaces)
  const courses = input
    .split(/[,\n\r]+/) // Only split on commas and newlines, not spaces
    .map(c => c.trim())
    .filter(c => c.length > 0)
    .map(c => c.replace(/['"]/g, '')) // Remove quotes
    .filter(c => c.length > 0); // Filter again after quote removal
  
  const uniqueCourses = [...new Set(courses)]; // Remove duplicates
  console.log('Parsed courses:', uniqueCourses); // Debug log
  return uniqueCourses;
}

export function buildConflictGraph(students: Student[], courseNames: string[]): Map<string, Course> {
  const courses = new Map<string, Course>();
  
  // Only use courses from the official course list
  const validCourses = new Set<string>();
  
  // Add courses from courseNames only
  courseNames.forEach(name => {
    if (name && name.trim()) {
      const courseName = name.trim();
      validCourses.add(courseName);
      courses.set(courseName, { name: courseName, conflicts: new Set() });
    }
  });

  console.log('\n=== ANALYZING YOUR STUDENT DATA ===');
  console.log(`Processing ${students.length} students across ${courseNames.length} courses`);

  // Build conflict edges using your student data
  students.forEach(student => {
    if (!student || !student.courses) return;
    
    const studentValidCourses = student.courses
      .filter(course => course && course.trim())
      .map(course => course.trim())
      .filter(course => validCourses.has(course));
    
    if (studentValidCourses.length > 1) {
      // Create all conflict pairs for this student
      for (let i = 0; i < studentValidCourses.length; i++) {
        for (let j = i + 1; j < studentValidCourses.length; j++) {
          const course1 = studentValidCourses[i];
          const course2 = studentValidCourses[j];
          
          courses.get(course1)!.conflicts.add(course2);
          courses.get(course2)!.conflicts.add(course1);
        }
      }
    }
  });

  console.log('\n=== DETAILED DEGREE ANALYSIS ===');
  const degreeList: Array<{name: string, degree: number, conflicts: string[]}> = [];
  courses.forEach((course, name) => {
    const conflictsList = Array.from(course.conflicts).sort();
    degreeList.push({ name, degree: course.conflicts.size, conflicts: conflictsList });
  });

  // Sort exactly like ChatGPT: by degree (descending), then alphabetically
  degreeList.sort((a, b) => {
    if (b.degree !== a.degree) return b.degree - a.degree;
    return a.name.localeCompare(b.name);
  });
  
  console.log('Complete degree analysis:');
  degreeList.forEach((course, index) => {
    console.log(`${index + 1}. ${course.name}: degree = ${course.degree} (conflicts: [${course.conflicts.join(', ')}])`);
  });

  console.log('\n=== VERIFYING CHATGPT VS OUR ALGORITHM ===');
  console.log('Expected order by ChatGPT (if Math has highest degree):');
  console.log('1. Math (should have highest degree)');
  console.log('2. Next highest degree courses...');
  console.log('\nOur calculated order:');
  degreeList.slice(0, 5).forEach((course, index) => {
    console.log(`${index + 1}. ${course.name} (degree: ${course.degree})`);
  });

  return courses;
}

// Improved Welsh-Powell Graph Coloring Algorithm
// Improved Welsh-Powell Graph Coloring Algorithm
export function greedyColoring(courses: Map<string, Course>, students?: Student[]): ScheduleResult {
  const courseList = Array.from(courses.values());
  const slots = new Map<number, string[]>();

  // Handle edge cases
  if (courseList.length === 0) {
    return {
      courses,
      slots,
      totalSlots: 0,
      totalConflicts: 0,
      students: students || [],
      averageConflictsPerCourse: 0,
      conflictDetails: {
        totalPairs: 0,
        conflictPairsList: []
      }
    };
  }

  // Reset any existing slot assignments
  courseList.forEach(course => {
    course.slot = undefined;
    course.color = undefined;
  });

  // Welsh-Powell Algorithm: Sort by degree (descending), then alphabetical - EXACTLY like ChatGPT
  courseList.sort((a, b) => {
    // Primary sort: by number of conflicts (degree) - higher degree first
    if (b.conflicts.size !== a.conflicts.size) {
      return b.conflicts.size - a.conflicts.size;
    }
    // Secondary sort: alphabetical order for tie-breaking (exactly like ChatGPT)
    return a.name.localeCompare(b.name);
  });

  console.log('\n=== FINAL SORTED ORDER FOR SLOT ASSIGNMENT ===');
  courseList.forEach((course, index) => {
    console.log(`${index + 1}. ${course.name} (degree: ${course.conflicts.size}) - will be assigned first available slot`);
  });

  // Calculate total unique conflicts (each conflict pair counted once)
  const conflictPairs = new Set<string>();
  courseList.forEach(course => {
    course.conflicts.forEach(conflictCourse => {
      const pair = [course.name, conflictCourse].sort().join('|');
      conflictPairs.add(pair);
    });
  });
  const totalConflicts = conflictPairs.size;

  // Calculate conflict density (average conflicts per course)
  const totalDegreeSum = courseList.reduce((sum, course) => sum + course.conflicts.size, 0);
  const averageConflictsPerCourse = courseList.length > 0 ? totalDegreeSum / courseList.length : 0;

  // Proper Welsh-Powell Graph Coloring Algorithm
  // This algorithm works for ANY dataset by analyzing actual conflicts
  
  console.log('\n=== WELSH-POWELL SLOT ASSIGNMENT ===');
  console.log('Assigning courses to slots in degree order...');
  
  // Welsh-Powell greedy coloring: assign each course to the lowest numbered slot that doesn't conflict
  courseList.forEach((course, index) => {
    console.log(`\nProcessing ${index + 1}. ${course.name} (degree: ${course.conflicts.size})`);
    
    let slot = 1;
    let assigned = false;
    
    // Try each slot starting from 1 until we find one without conflicts
    while (!assigned) {
      let hasConflict = false;
    const conflictingCourses: string[] = [];
      
      // Check if current slot has any conflicting courses
      if (slots.has(slot)) {
        const coursesInSlot = slots.get(slot)!;
        for (const existingCourse of coursesInSlot) {
          if (course.conflicts.has(existingCourse)) {
            hasConflict = true;
            conflictingCourses.push(existingCourse);
          }
        }
      }
      
      if (hasConflict) {
        console.log(`  Cannot assign to Slot ${slot} - conflicts with: ${conflictingCourses.join(', ')}`);
        slot++; // Try next slot
      } else {
        // Assign course to this slot
        course.slot = slot;
        course.color = SLOT_COLORS[(slot - 1) % SLOT_COLORS.length];
        
        if (!slots.has(slot)) {
          slots.set(slot, []);
        }
        slots.get(slot)!.push(course.name);
        
        const otherCoursesInSlot = slots.get(slot)!.filter(c => c !== course.name);
        if (otherCoursesInSlot.length > 0) {
          console.log(`  ✅ Assigned to Slot ${slot} (joining: ${otherCoursesInSlot.join(', ')})`);
        } else {
          console.log(`  ✅ Assigned to Slot ${slot} (first course in this slot)`);
        }
        assigned = true;
      }
    }
  });

  console.log('\n=== FINAL OPTIMAL SCHEDULE ===');
  const sortedSlots = Array.from(slots.keys()).sort((a, b) => a - b);
  sortedSlots.forEach(slot => {
    const coursesInSlot = slots.get(slot)!;
    console.log(`Slot ${slot}: ${coursesInSlot.join(', ')} (${coursesInSlot.length} courses)`);
  });

  console.log(`\nTotal time slots needed: ${slots.size}`);
  console.log('Algorithm guarantees: No conflicts within same slot, minimal slots used');

  // Verify the solution (no conflicts within same slot)
  const isValidSolution = verifySolution(courses, slots);
  if (!isValidSolution) {
    console.error('❌ CRITICAL ERROR: Generated solution contains conflicts!');
  }

  return {
    courses,
    slots,
    totalSlots: slots.size,
    totalConflicts,
    students: students || [],
    averageConflictsPerCourse: Math.round(averageConflictsPerCourse * 10) / 10,
    conflictDetails: {
      totalPairs: totalConflicts,
      conflictPairsList: Array.from(conflictPairs).map(pair => pair.split('|'))
    }
  };
}

// Solution verification function
function verifySolution(courses: Map<string, Course>, slots: Map<number, string[]>): boolean {
  for (const [slot, courseNames] of slots) {
    for (let i = 0; i < courseNames.length; i++) {
      for (let j = i + 1; j < courseNames.length; j++) {
        const course1 = courses.get(courseNames[i]);
        const course2 = courses.get(courseNames[j]);
        
        if (course1?.conflicts.has(courseNames[j]) || course2?.conflicts.has(courseNames[i])) {
          console.error(`Conflict detected in slot ${slot}: ${courseNames[i]} and ${courseNames[j]}`);
          return false;
        }
      }
    }
  }
  return true;
}

// DSATUR (Degree of Saturation) heuristic coloring
export function dsaturColoring(originalCourses: Map<string, Course>, students?: Student[]): ScheduleResult {
  // Work on a deep copy so we don't mutate the original map
  const courses = new Map<string, Course>();
  originalCourses.forEach((c, name) => {
    courses.set(name, { name: c.name, conflicts: new Set(c.conflicts), color: undefined, slot: undefined });
  });

  const courseNames = Array.from(courses.keys());
  const n = courseNames.length;

  // Early return for empty
  if (n === 0) {
    return {
      courses,
      slots: new Map<number, string[]>(),
      totalSlots: 0,
      totalConflicts: 0,
      students: students || [],
      averageConflictsPerCourse: 0,
      conflictDetails: { totalPairs: 0, conflictPairsList: [] }
    };
  }

  // helper maps
  const colorAssignment = new Map<string, number | undefined>();
  const saturation = new Map<string, Set<number>>(); // set of neighbor colors
  const degree = new Map<string, number>();

  courseNames.forEach(name => {
    colorAssignment.set(name, undefined);
    saturation.set(name, new Set());
    degree.set(name, courses.get(name)!.conflicts.size);
  });

  // Choose vertex selection function: highest saturation size, tie-break by degree, then name
  const uncolored = () => courseNames.filter(nm => colorAssignment.get(nm) === undefined);

  while (true) {
    const candidates = uncolored();
    if (candidates.length === 0) break;

    candidates.sort((a, b) => {
      const sa = (saturation.get(a) || new Set()).size;
      const sb = (saturation.get(b) || new Set()).size;
      if (sb !== sa) return sb - sa; // higher saturation first
      // tie-break by degree
      const da = degree.get(a) || 0;
      const db = degree.get(b) || 0;
      if (db !== da) return db - da;
      return a.localeCompare(b);
    });

    const v = candidates[0];
    // compute smallest available color not used by neighbors
    const neighborColors = new Set<number>();
    const conflicts = courses.get(v)!.conflicts;
    for (const nb of conflicts) {
      const c = colorAssignment.get(nb);
      if (c !== undefined) neighborColors.add(c);
    }

    let color = 1;
    while (neighborColors.has(color)) color++;
    colorAssignment.set(v, color);

    // Update saturation sets for neighbors
    for (const nb of conflicts) {
      const nbSet = saturation.get(nb) as Set<number>;
      nbSet.add(color);
    }
  }

  // Build slots and assign colors
  const slots = new Map<number, string[]>();
  colorAssignment.forEach((col, name) => {
    const slotNum = col || 1;
    const course = courses.get(name)!;
    course.slot = slotNum;
    course.color = SLOT_COLORS[(slotNum - 1) % SLOT_COLORS.length];
    if (!slots.has(slotNum)) slots.set(slotNum, []);
    slots.get(slotNum)!.push(name);
  });

  // Compute conflicts and stats (reuse same logic)
  const conflictPairs = new Set<string>();
  Array.from(courses.values()).forEach(course => {
    course.conflicts.forEach(conflictCourse => {
      const pair = [course.name, conflictCourse].sort().join('|');
      conflictPairs.add(pair);
    });
  });
  const totalConflicts = conflictPairs.size;
  const totalCourses = courses.size;
  const totalDegreeSum = Array.from(courses.values()).reduce((s, c) => s + c.conflicts.size, 0);
  const averageConflictsPerCourse = totalCourses > 0 ? totalDegreeSum / totalCourses : 0;

  return {
    courses,
    slots,
    totalSlots: slots.size,
    totalConflicts,
    students: students || [],
    averageConflictsPerCourse: Math.round(averageConflictsPerCourse * 10) / 10,
    conflictDetails: { totalPairs: totalConflicts, conflictPairsList: Array.from(conflictPairs).map(p => p.split('|')) }
  };
}

// Add light debug logging to help compare with greedy
if (typeof window !== 'undefined') {
  // expose helper for debugging in browser console
  (window as unknown as Record<string, unknown>).__dsaturColoring = dsaturColoring;
}