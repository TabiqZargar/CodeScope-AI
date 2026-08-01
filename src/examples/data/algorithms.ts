import type { Example } from "../types";

/**
 * Classic algorithms: bubble sort, binary search, and graph traversal
 * (recursive DFS and queue-based BFS).
 */
export const ALGORITHM_EXAMPLES: readonly Example[] = [
  {
    id: "bubble-sort",
    title: "Bubble Sort",
    description:
      "Adjacent pairs are compared and swapped across nested loops until the array is sorted.",
    difficulty: "intermediate",
    category: "algorithms",
    tags: ["sorting", "arrays", "loops"],
    concepts: ["Nested loops", "Adjacent swaps", "Sinking max", "In-place mutation"],
    learningObjectives: [
      "Trace how the largest value bubbles to the end",
      "Count comparisons across the outer and inner loops",
      "Watch each swap mutate the heap array",
    ],
    sourceCode: `let values = [5, 2, 9, 1, 6];
let n = values.length;
for (let i = 0; i < n - 1; i++) {
  for (let j = 0; j < n - 1 - i; j++) {
    if (values[j] > values[j + 1]) {
      let temp = values[j];
      values[j] = values[j + 1];
      values[j + 1] = temp;
    }
  }
}
console.log(values);`,
    estimatedRuntimeSteps: 67,
    order: 1,
    featured: true,
  },
  {
    id: "binary-search",
    title: "Binary Search",
    description:
      "Halve a sorted range at each step until the target is found or the range collapses.",
    difficulty: "intermediate",
    category: "algorithms",
    tags: ["search", "arrays", "loops"],
    concepts: ["Divide and conquer", "Loop invariants", "Index arithmetic", "O(log n)"],
    learningObjectives: [
      "Watch low and high converge on the target",
      "Verify mid is always an integer index",
      "See the loop exit when the range empties",
    ],
    sourceCode: `let values = [2, 5, 8, 12, 16, 23, 38, 56];
let target = 23;
let low = 0;
let high = values.length - 1;
let foundIndex = -1;
while (low <= high) {
  let mid = (low + high - (low + high) % 2) / 2;
  let guess = values[mid];
  if (guess === target) {
    foundIndex = mid;
    low = high + 1;
  } else if (guess < target) {
    low = mid + 1;
  } else {
    high = mid - 1;
  }
}
console.log("Found at: " + foundIndex);`,
    estimatedRuntimeSteps: 20,
    order: 2,
  },
  {
    id: "depth-first-search",
    title: "Depth-First Search",
    description:
      "A recursive walk of a small adjacency-list graph that descends as deep as possible before backtracking.",
    difficulty: "advanced",
    category: "algorithms",
    tags: ["dfs", "recursion", "arrays"],
    concepts: ["Graphs as adjacency lists", "Visited set", "Recursive backtracking", "Discovery order"],
    learningObjectives: [
      "Match the DFS visit order to the recursion tree",
      "See the visited array flip to true in place",
      "Count stack frames at the deepest descent",
    ],
    sourceCode: `let graph = [
  [1, 2],
  [0, 3],
  [0, 4],
  [1],
  [2]
];
let visited = [false, false, false, false, false];
function dfs(node) {
  visited[node] = true;
  console.log("Visit " + node);
  let neighbors = graph[node];
  let i = 0;
  while (i < neighbors.length) {
    let next = neighbors[i];
    if (visited[next] === false) {
      dfs(next);
    }
    i = i + 1;
  }
}
dfs(0);`,
    estimatedRuntimeSteps: 75,
    order: 3,
  },
  {
    id: "breadth-first-search",
    title: "Breadth-First Search",
    description:
      "A queue-driven, level-by-level traversal of the same graph using push and a moving head pointer.",
    difficulty: "advanced",
    category: "algorithms",
    tags: ["bfs", "queue", "arrays"],
    concepts: ["FIFO ordering", "Frontier expansion", "Visited set", "Levels"],
    learningObjectives: [
      "Match the BFS visit order to queue order",
      "Watch the queue grow, drain, and re-fill",
      "Contrast BFS ordering with the DFS walk",
    ],
    sourceCode: `let graph = [
  [1, 2],
  [0, 3],
  [0, 4],
  [1],
  [2]
];
let visited = [false, false, false, false, false];
let queue = [];
queue.push(0);
visited[0] = true;
let head = 0;
while (head < queue.length) {
  let node = queue[head];
  head = head + 1;
  console.log("Visit " + node);
  let neighbors = graph[node];
  let i = 0;
  while (i < neighbors.length) {
    let next = neighbors[i];
    if (visited[next] === false) {
      visited[next] = true;
      queue.push(next);
    }
    i = i + 1;
  }
}`,
    estimatedRuntimeSteps: 83,
    order: 4,
  },
];
