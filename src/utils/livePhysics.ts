import { Person, Connection } from '@/types/network';

export interface PhysicsNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const REPULSION = 2500;
const ATTRACTION = 0.004;
const IDEAL_LENGTH = 160;
const DAMPING = 0.82;
const MAX_SPEED = 6;
const MIN_MOVEMENT = 0.05;
const MAX_REPULSION_DIST = 500; // Skip repulsion beyond this distance

export function stepPhysics(
  nodes: PhysicsNode[],
  connections: Connection[],
  draggedIds: Set<string>
): { settled: boolean } {
  if (nodes.length < 2) return { settled: true };

  // Build connected set and adjacency map once
  const connectedIds = new Set<string>();
  connections.forEach((c) => {
    if ((c.fromType || 'person') === 'person') connectedIds.add(c.fromId);
    if ((c.toType || 'person') === 'person') connectedIds.add(c.toId);
  });

  const activeNodes = nodes.filter((n) => connectedIds.has(n.id));
  const len = activeNodes.length;
  if (len < 2) return { settled: true };

  // Index nodes by id for O(1) lookup
  const nodeById = new Map<string, PhysicsNode>();
  for (let i = 0; i < len; i++) nodeById.set(activeNodes[i].id, activeNodes[i]);

  const maxDistSq = MAX_REPULSION_DIST * MAX_REPULSION_DIST;

  // Repulsion - skip pairs beyond threshold
  for (let i = 0; i < len; i++) {
    const a = activeNodes[i];
    for (let j = i + 1; j < len; j++) {
      const b = activeNodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq) continue;
      const dist = Math.max(Math.sqrt(distSq), 1);
      const force = REPULSION / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!draggedIds.has(a.id)) { a.vx += fx; a.vy += fy; }
      if (!draggedIds.has(b.id)) { b.vx -= fx; b.vy -= fy; }
    }
  }

  // Attraction along edges
  for (let i = 0; i < connections.length; i++) {
    const c = connections[i];
    if ((c.fromType || 'person') === 'group' || (c.toType || 'person') === 'group') continue;
    const a = nodeById.get(c.fromId);
    const b = nodeById.get(c.toId);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const displacement = dist - IDEAL_LENGTH;
    const force = displacement * ATTRACTION;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (!draggedIds.has(a.id)) { a.vx += fx; a.vy += fy; }
    if (!draggedIds.has(b.id)) { b.vx -= fx; b.vy -= fy; }
  }

  // Apply velocities
  let totalMovement = 0;
  for (let i = 0; i < len; i++) {
    const node = activeNodes[i];
    if (draggedIds.has(node.id)) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > MAX_SPEED) {
      node.vx = (node.vx / speed) * MAX_SPEED;
      node.vy = (node.vy / speed) * MAX_SPEED;
    }
    node.x += node.vx;
    node.y += node.vy;
    totalMovement += Math.abs(node.vx) + Math.abs(node.vy);
    node.vx *= DAMPING;
    node.vy *= DAMPING;
  }

  return { settled: totalMovement < MIN_MOVEMENT * len };
}

