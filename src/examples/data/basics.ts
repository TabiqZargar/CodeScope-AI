import type { Example } from "../types";

/**
 * JavaScript fundamentals: variables, scope, closures, control flow,
 * functions, recursion, objects, arrays, and reference-vs-primitive memory.
 */
export const BASIC_EXAMPLES: readonly Example[] = [
  {
    id: "hello-variables",
    title: "Hello, Variables",
    description:
      "Declare, reassign, and concatenate variables while watching each binding change on the heap and in scope.",
    difficulty: "beginner",
    category: "basics",
    tags: ["variables"],
    concepts: ["let and const", "Reassignment", "String concatenation"],
    learningObjectives: [
      "See how let bindings change over time",
      "Compare const vs let semantics",
      "Read console output built from variables",
    ],
    sourceCode: `let name = "Ada";
const language = "JavaScript";
let year = 1980;
name = "Grace";
year = year + 60;
console.log(name + " wrote " + language);
console.log("Year: " + year);`,
    estimatedRuntimeSteps: 8,
    order: 1,
    featured: true,
  },
  {
    id: "scope-and-lookups",
    title: "Scope & Lookups",
    description:
      "Global and block scope, function-local variables, and how name lookup finds the right binding.",
    difficulty: "intermediate",
    category: "basics",
    tags: ["scope"],
    concepts: ["Block scope", "Function scope", "Shadowing", "Name lookup"],
    learningObjectives: [
      "Watch the call stack grow when a function runs",
      "Distinguish block-scoped z from function-scoped y",
      "See a global variable updated from inside a function",
    ],
    sourceCode: `let x = 10;
function show() {
  let y = 5;
  x = x + y;
  console.log(x);
}
show();
if (x > 10) {
  let z = 1;
  x = x + z;
}
console.log(x);`,
    estimatedRuntimeSteps: 11,
    order: 2,
  },
  {
    id: "closure-scope",
    title: "Closure Scope",
    description:
      "A nested function that remembers and mutates a variable in its enclosing function, call after call.",
    difficulty: "intermediate",
    category: "basics",
    tags: ["closures", "scope", "functions"],
    concepts: ["Nested functions", "Lexical scope", "Persistent state"],
    learningObjectives: [
      "Observe the inner function reading outer state",
      "Trace how count persists across invocations",
      "Spot the frames on the call stack during each call",
    ],
    sourceCode: `function createCounter() {
  let count = 0;
  function tick() {
    count = count + 1;
    console.log("count: " + count);
  }
  tick();
  tick();
}
createCounter();`,
    estimatedRuntimeSteps: 12,
    order: 3,
  },
  {
    id: "conditional-branches",
    title: "Conditional Branches",
    description:
      "A grading program that walks an if / else-if / else chain and records the outcome of each condition.",
    difficulty: "beginner",
    category: "basics",
    tags: ["conditionals"],
    concepts: ["if / else-if / else", "Comparison operators", "Decision snapshots"],
    learningObjectives: [
      "Read TRUE / FALSE branch decisions on the timeline",
      "Predict which branch executes for a given score",
      "See the variable assigned inside the taken branch",
    ],
    sourceCode: `let score = 85;
let grade;
if (score >= 90) {
  grade = "A";
} else if (score >= 80) {
  grade = "B";
} else if (score >= 70) {
  grade = "C";
} else {
  grade = "F";
}
console.log("Grade: " + grade);`,
    estimatedRuntimeSteps: 7,
    order: 4,
  },
  {
    id: "loop-summary",
    title: "Loop Summary",
    description:
      "The same accumulation written as a for, a while, and a do-while, so you can compare their iteration patterns.",
    difficulty: "beginner",
    category: "basics",
    tags: ["loops"],
    concepts: ["for", "while", "do-while", "Iteration counts", "Accumulators"],
    learningObjectives: [
      "Count iterations across all three loop forms",
      "Spot loop back-edges in the execution graph",
      "Verify the final accumulated total",
    ],
    sourceCode: `let total = 0;
for (let i = 1; i <= 5; i++) {
  total = total + i;
}
let j = 0;
while (j < 5) {
  total = total + 1;
  j++;
}
let k = 0;
do {
  total = total + 1;
  k++;
} while (k < 3);
console.log(total);`,
    estimatedRuntimeSteps: 47,
    order: 5,
  },
  {
    id: "function-journey",
    title: "Function Journey",
    description:
      "Two small functions call each other in sequence, so you can watch parameters, return values, and stack frames.",
    difficulty: "beginner",
    category: "basics",
    tags: ["functions", "scope"],
    concepts: ["Function declarations", "Parameters", "Return values", "Call stack"],
    learningObjectives: [
      "Watch frames push and pop as calls enter and return",
      "See parameters bound to the passed arguments",
      "Trace the returned value flowing into the next call",
    ],
    sourceCode: `function multiply(a, b) {
  return a * b;
}
function add(x, y) {
  return x + y;
}
let base = add(3, 4);
let result = multiply(base, 2);
console.log(result);`,
    estimatedRuntimeSteps: 14,
    order: 6,
    featured: true,
  },
  {
    id: "recursive-factorial",
    title: "Recursive Factorial",
    description:
      "The classic 5! computation with one frame per pending call, ending in a chain of returns.",
    difficulty: "intermediate",
    category: "basics",
    tags: ["recursion", "functions"],
    concepts: ["Recursion", "Base case", "Stack depth", "Unwinding"],
    learningObjectives: [
      "Count the frames at peak recursion depth",
      "Identify the base case that stops the recursion",
      "Follow each return as the stack unwinds",
    ],
    sourceCode: `function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}
console.log(factorial(5));`,
    estimatedRuntimeSteps: 27,
    order: 7,
  },
  {
    id: "object-shape",
    title: "Object Shape",
    description:
      "Create an object literal, mutate its properties, and add a brand-new key while watching the heap node grow.",
    difficulty: "beginner",
    category: "basics",
    tags: ["objects"],
    concepts: ["Object literals", "Property reads", "Property writes", "Adding keys"],
    learningObjectives: [
      "Identify the object's heap node and its properties",
      "See a property value change in place",
      "Add a new key and confirm the heap node updates",
    ],
    sourceCode: `let user = {
  name: "Maya",
  age: 28,
  active: true
};
user.age = user.age + 1;
user.role = "developer";
console.log(user.name + " is " + user.age);
console.log("Role: " + user.role);`,
    estimatedRuntimeSteps: 6,
    order: 8,
  },
  {
    id: "array-lifecycle",
    title: "Array Lifecycle",
    description:
      "Indexed reads, in-place writes, push, and pop over a small array, with the heap array changing each step.",
    difficulty: "beginner",
    category: "basics",
    tags: ["arrays"],
    concepts: ["Array literals", "Indexed access", "push / pop", "length"],
    learningObjectives: [
      "Read and write elements by index",
      "See push and pop resize the heap array",
      "Confirm length updates after each mutation",
    ],
    sourceCode: `let fruits = ["apple", "banana", "cherry"];
let first = fruits[0];
fruits[0] = "apricot";
fruits.push("date");
let last = fruits.pop();
console.log(first);
console.log(fruits.length);
console.log("Removed: " + last);`,
    estimatedRuntimeSteps: 9,
    order: 9,
  },
  {
    id: "heap-and-references",
    title: "Heap & References",
    description:
      "Primitives copy by value; objects share one heap node. Two aliases mutate the same object.",
    difficulty: "intermediate",
    category: "basics",
    tags: ["memory", "objects"],
    concepts: ["Copy by value", "Copy by reference", "Aliasing", "Heap identity"],
    learningObjectives: [
      "See primitives stay independent when copied",
      "Watch two variables point at the same heap node",
      "Understand why alias.count also changes original",
    ],
    sourceCode: `let a = 5;
let b = a;
b = b + 1;
let original = { count: 1 };
let alias = original;
alias.count = 99;
console.log("Primitives: a=" + a + " b=" + b);
console.log("Reference: " + original.count);`,
    estimatedRuntimeSteps: 9,
    order: 10,
    featured: true,
  },
];
