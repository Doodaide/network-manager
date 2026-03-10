import { Person, Connection } from '@/types/network';

export function applyForceLayout(
  people: Person[],
  connections: Connection[]
): { id: string; x: number; y: number }[] {
  // Only move connected person nodes
  const connectedIds = new Set<string>();
  connections.forEach((c) => {
    if ((c.fromType || 'person') === 'person') connectedIds.add(c.fromId);
    if ((c.toType || 'person') === 'person') connectedIds.add(c.toId);
  });

  if (connectedIds.size === 0) return [];

  const positions = new Map<string, { x: number; y: number }>();
  people.forEach((p) => {
    if (connectedIds.has(p.id)) {
      positions.set(p.id, { x: p.x, y: p.y });
    }
  });

  const velocities = new Map<string, { vx: number; vy: number }>();
  positions.forEach((_, id) => velocities.set(id, { vx: 0, vy: 0 }));

  const iterations = 300;
  const repulsion = 5000;
  const attraction = 0.01;
  const idealLength = 150;
  const damping = 0.92;

  const ids = Array.from(positions.keys());

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations;

    // Repulsion between all connected nodes
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions.get(ids[i])!;
        const b = positions.get(ids[j])!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (repulsion / (dist * dist)) * temp;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        velocities.get(ids[i])!.vx += fx;
        velocities.get(ids[i])!.vy += fy;
        velocities.get(ids[j])!.vx -= fx;
        velocities.get(ids[j])!.vy -= fy;
      }
    }

    // Attraction along edges
    connections.forEach((c) => {
      if ((c.fromType || 'person') === 'group' || (c.toType || 'person') === 'group') return;
      const a = positions.get(c.fromId);
      const b = positions.get(c.toId);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const displacement = dist - idealLength;
      const force = displacement * attraction * temp;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      velocities.get(c.fromId)!.vx += fx;
      velocities.get(c.fromId)!.vy += fy;
      velocities.get(c.toId)!.vx -= fx;
      velocities.get(c.toId)!.vy -= fy;
    });

    // Apply velocities with max speed
    const maxSpeed = 10 * temp + 1;
    positions.forEach((pos, id) => {
      const vel = velocities.get(id)!;
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
      if (speed > maxSpeed) {
        vel.vx = (vel.vx / speed) * maxSpeed;
        vel.vy = (vel.vy / speed) * maxSpeed;
      }
      pos.x += vel.vx;
      pos.y += vel.vy;
      vel.vx *= damping;
      vel.vy *= damping;
    });
  }

  // Re-center around original centroid
  const originalNodes = people.filter((p) => connectedIds.has(p.id));
  const origCx = originalNodes.reduce((s, p) => s + p.x, 0) / originalNodes.length;
  const origCy = originalNodes.reduce((s, p) => s + p.y, 0) / originalNodes.length;

  const newPositions = Array.from(positions.entries());
  const newCx = newPositions.reduce((s, [, p]) => s + p.x, 0) / newPositions.length;
  const newCy = newPositions.reduce((s, [, p]) => s + p.y, 0) / newPositions.length;

  const offsetX = origCx - newCx;
  const offsetY = origCy - newCy;

  return newPositions.map(([id, pos]) => ({
    id,
    x: pos.x + offsetX,
    y: pos.y + offsetY,
  }));
}

