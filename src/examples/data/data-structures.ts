import type { Example } from "../types";

/**
 * Hand-built data structures: a LIFO stack, a FIFO queue, and a
 * singly-linked list walked through object `next` pointers.
 */
export const DATA_STRUCTURE_EXAMPLES: readonly Example[] = [
  {
    id: "stack-life",
    title: "Stack Life",
    description:
      "Push three items and pop them one at a time to see last-in, first-out behavior in the heap array.",
    difficulty: "beginner",
    category: "data-structures",
    tags: ["stack", "arrays"],
    concepts: ["LIFO order", "push", "pop", "Empty stack"],
    learningObjectives: [
      "Confirm pops return items in reverse push order",
      "Watch the array shrink with each pop",
      "Check the stack is empty via length",
    ],
    sourceCode: `let stack = [];
stack.push("first");
stack.push("second");
stack.push("third");
console.log(stack.pop());
console.log(stack.pop());
console.log(stack.pop());
console.log("Empty: " + (stack.length === 0));`,
    estimatedRuntimeSteps: 9,
    order: 1,
    featured: true,
  },
  {
    id: "queue-life",
    title: "Queue Life",
    description:
      "Enqueue three items and drain the queue with a head pointer to keep first-in, first-out order.",
    difficulty: "beginner",
    category: "data-structures",
    tags: ["queue", "arrays"],
    concepts: ["FIFO order", "Head pointer", "Enqueue", "Dequeue"],
    learningObjectives: [
      "Confirm items leave in the order they arrived",
      "See the head pointer advance without shifting",
      "Watch the loop drain the queue completely",
    ],
    sourceCode: `let queue = [];
let head = 0;
queue.push("a");
queue.push("b");
queue.push("c");
while (head < queue.length) {
  let next = queue[head];
  head = head + 1;
  console.log(next);
}`,
    estimatedRuntimeSteps: 19,
    order: 2,
  },
  {
    id: "linked-list-traversal",
    title: "Linked List Traversal",
    description:
      "Three nodes linked by next pointers are walked from the head, summing values as it goes.",
    difficulty: "intermediate",
    category: "data-structures",
    tags: ["linked-list", "objects", "loops"],
    concepts: ["Nodes and pointers", "next references", "Traversal", "Tail sentinel"],
    learningObjectives: [
      "See each node as its own heap object",
      "Follow next pointers across the heap",
      "Watch the loop stop at the \"end\" tail sentinel",
    ],
    sourceCode: `let head = { value: 1, next: "end" };
let second = { value: 2, next: "end" };
let third = { value: 3, next: "end" };
head.next = second;
second.next = third;
let current = head;
let total = 0;
while (current !== "end") {
  total = total + current.value;
  console.log(current.value);
  current = current.next;
}
console.log("Sum: " + total);`,
    estimatedRuntimeSteps: 22,
    order: 3,
  },
];
