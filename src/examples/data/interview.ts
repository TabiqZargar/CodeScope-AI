import type { Example } from "../types";

/**
 * Classic interview questions: two-sum, string reversal, palindrome checking,
 * and memoized Fibonacci.
 */
export const INTERVIEW_EXAMPLES: readonly Example[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    description:
      "Scan a small array with nested loops to find the two indices that add up to a target.",
    difficulty: "intermediate",
    category: "interview",
    tags: ["two-sum", "arrays", "loops"],
    concepts: ["Pair scanning", "Nested loops", "Target matching", "Index tracking"],
    learningObjectives: [
      "Follow the nested-loop pair enumeration",
      "See when the condition finds the matching pair",
      "Confirm the returned indices reference the right elements",
    ],
    sourceCode: `let numbers = [2, 7, 11, 15];
let target = 9;
let result = [-1, -1];
for (let i = 0; i < numbers.length; i++) {
  for (let j = i + 1; j < numbers.length; j++) {
    if (numbers[i] + numbers[j] === target) {
      result[0] = i;
      result[1] = j;
    }
  }
}
console.log("Indices: " + result[0] + ", " + result[1]);`,
    estimatedRuntimeSteps: 43,
    order: 1,
    featured: true,
  },
  {
    id: "reverse-string",
    title: "Reverse String",
    description:
      "A character array reversed in place with two pointers swapping from both ends toward the middle.",
    difficulty: "beginner",
    category: "interview",
    tags: ["reverse-string", "arrays"],
    concepts: ["Two pointers", "In-place swap", "Character arrays", "String immutability"],
    learningObjectives: [
      "Watch left and right converge on the center",
      "See each swap mutate the heap array",
      "Understand why strings are modeled as char arrays",
    ],
    sourceCode: `let chars = ["h", "e", "l", "l", "o"];
let left = 0;
let right = chars.length - 1;
while (left < right) {
  let temp = chars[left];
  chars[left] = chars[right];
  chars[right] = temp;
  left = left + 1;
  right = right - 1;
}
console.log(chars);`,
    estimatedRuntimeSteps: 18,
    order: 2,
  },
  {
    id: "palindrome-check",
    title: "Palindrome Check",
    description:
      "Two pointers walk toward each other comparing characters and flagging any mismatch.",
    difficulty: "beginner",
    category: "interview",
    tags: ["palindrome", "arrays"],
    concepts: ["Two pointers", "Symmetric comparison", "Boolean accumulation"],
    learningObjectives: [
      "Compare mirrored positions in the array",
      "See the flag stay true for a symmetric word",
      "Confirm the pointers cross at the middle",
    ],
    sourceCode: `let letters = ["r", "a", "c", "e", "c", "a", "r"];
let isPalindrome = true;
let i = 0;
let j = letters.length - 1;
while (i < j) {
  if (letters[i] !== letters[j]) {
    isPalindrome = false;
  }
  i = i + 1;
  j = j - 1;
}
console.log("Is palindrome: " + isPalindrome);`,
    estimatedRuntimeSteps: 19,
    order: 3,
  },
  {
    id: "memoized-fibonacci",
    title: "Memoized Fibonacci",
    description:
      "Recursive Fibonacci with an object cache that skips recomputation once a value has been stored.",
    difficulty: "advanced",
    category: "interview",
    tags: ["memoization", "recursion", "objects"],
    concepts: ["Dynamic programming", "Cache lookups", "Overlapping subproblems", "Reference cache"],
    learningObjectives: [
      "See the cache object fill with each computed value",
      "Spot cached lookups that skip recursion",
      "Count how many times each fib(n) actually runs",
    ],
    sourceCode: `let cache = {};
function fibonacci(n) {
  if (n < 2) {
    return n;
  }
  if (cache[n] !== undefined) {
    return cache[n];
  }
  let value = fibonacci(n - 1) + fibonacci(n - 2);
  cache[n] = value;
  return value;
}
console.log(fibonacci(10));`,
    estimatedRuntimeSteps: 132,
    order: 4,
  },
];
