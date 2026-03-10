import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Person, Connection, ConnectorType, Group } from '@/types/network';
import { CanvasVisibility } from '@/pages/Index';
import { Maximize, ZoomIn, ZoomOut, Crosshair, Menu } from 'lucide-react';
import { stepPhysics, PhysicsNode } from '@/utils/livePhysics';

interface Props {
  isMobile: boolean;
  onOpenSidebar: () => void;
  people: Person[];
  connections: Connection[];
  connectorTypes: ConnectorType[];
  groups: Group[];
  selectedConnectorType: string | null;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onBatchUpdatePositions: (updates: { id: string; x: number; y: number }[]) => void;
  onAddConnection: (fromId: string, toId: string, connectorTypeId: string, fromType?: 'person' | 'group', toType?: 'person' | 'group') => void;
  onRemoveConnection: (id: string) => void;
  onRemovePerson: (id: string) => void;
  visibility: CanvasVisibility;
  searchQuery: string;
  selectedNodes: Set<string>;
  onToggleNodeSelection: (id: string) => void;
  onClearSelection: () => void;
  hiddenConnectorTypeIds: Set<string>;
  hiddenGroupIds: Set<string>;
  collapsedGroupIds: Set<string>;
  livePhysics: boolean;
}

const NODE_RADIUS = 28;
const GROUP_NODE_RADIUS = 40;

export const NetworkCanvas: React.FC<Props> = ({
  isMobile, onOpenSidebar,
  people, connections, connectorTypes, groups, selectedConnectorType,
  onUpdatePosition, onBatchUpdatePositions, onAddConnection, onRemoveConnection, onRemovePerson,
  visibility, searchQuery, selectedNodes, onToggleNodeSelection, onClearSelection,
  hiddenConnectorTypeIds, hiddenGroupIds, collapsedGroupIds, livePhysics,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<string[] | null>(null);
  const [dragLastWorld, setDragLastWorld] = useState<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ id: string; type: 'person' | 'group' } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'node' | 'connection'; id: string } | null>(null);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 600 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Physics state - decoupled from React for performance
  const physicsNodesRef = useRef<Map<string, PhysicsNode>>(new Map());
  const animFrameRef = useRef<number>(0);
  const [physicsPositions, setPhysicsPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const lastSyncRef = useRef<number>(0);
  const SYNC_INTERVAL = 200; // ms - sync to parent state every 200ms for localStorage save

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: sx, y: sy };
    return {
      x: (sx - rect.left - pan.x) / zoom,
      y: (sy - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Live physics loop - decoupled from React state for performance
  useEffect(() => {
    if (!livePhysics) {
      cancelAnimationFrame(animFrameRef.current);
      // Sync final positions to parent when turning off
      const nodeMap = physicsNodesRef.current;
      if (nodeMap.size > 0) {
        const updates = Array.from(nodeMap.values()).map((n) => ({ id: n.id, x: n.x, y: n.y }));
        onBatchUpdatePositions(updates);
      }
      setPhysicsPositions(null);
      return;
    }

    // Initialize physics nodes from people
    const nodeMap = physicsNodesRef.current;
    const peopleIds = new Set(people.map((p) => p.id));
    people.forEach((p) => {
      if (!nodeMap.has(p.id)) {
        nodeMap.set(p.id, { id: p.id, x: p.x, y: p.y, vx: 0, vy: 0 });
      }
    });
    // Remove deleted nodes
    nodeMap.forEach((_, id) => {
      if (!peopleIds.has(id)) nodeMap.delete(id);
    });

    const tick = () => {
      const draggedIds = new Set<string>();
      if (dragging) draggedIds.add(dragging);
      if (draggingGroup) draggingGroup.forEach((id) => draggedIds.add(id));

      // Sync dragged node positions from parent state into physics
      draggedIds.forEach((id) => {
        const p = people.find((pp) => pp.id === id);
        const pn = nodeMap.get(id);
        if (p && pn) { pn.x = p.x; pn.y = p.y; pn.vx = 0; pn.vy = 0; }
      });

      const nodes = Array.from(nodeMap.values());
      stepPhysics(nodes, connections, draggedIds);

      // Update local render positions (fast, no localStorage)
      const posMap = new Map<string, { x: number; y: number }>();
      nodes.forEach((n) => posMap.set(n.id, { x: n.x, y: n.y }));
      setPhysicsPositions(posMap);

      // Throttled sync to parent state (for localStorage persistence)
      const now = performance.now();
      if (now - lastSyncRef.current > SYNC_INTERVAL) {
        lastSyncRef.current = now;
        const updates = nodes
          .filter((n) => !draggedIds.has(n.id))
          .map((n) => ({ id: n.id, x: n.x, y: n.y }));
        if (updates.length > 0) onBatchUpdatePositions(updates);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  // Only re-run when physics toggle or connections change, NOT on people changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePhysics, connections]);

  // Helper to get effective position (physics override or state)
  const getPersonPos = useCallback((person: Person) => {
    if (physicsPositions) {
      const pp = physicsPositions.get(person.id);
      if (pp) return pp;
    }
    return { x: person.x, y: person.y };
  }, [physicsPositions]);

  // Compute group centroids for collapsed groups
  const groupCentroids = useMemo(() => {
    const map = new Map<string, { cx: number; cy: number }>();
    groups.forEach((g) => {
      if (!collapsedGroupIds.has(g.id)) return;
      const members = people.filter((p) => g.memberIds.includes(p.id));
      if (members.length === 0) return;
      const cx = members.reduce((s, m) => { const pos = getPersonPos(m); return s + pos.x; }, 0) / members.length;
      const cy = members.reduce((s, m) => { const pos = getPersonPos(m); return s + pos.y; }, 0) / members.length;
      map.set(g.id, { cx, cy });
    });
    return map;
  }, [groups, people, collapsedGroupIds, getPersonPos]);

  const hiddenByCollapse = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      if (collapsedGroupIds.has(g.id)) {
        g.memberIds.forEach((mid) => set.add(mid));
      }
    });
    return set;
  }, [groups, collapsedGroupIds]);

  // Hover focus: compute connected nodes and connections (only when enabled)
  const focusData = useMemo(() => {
    if (!hoveredNodeId || !visibility.hoverFocus) return null;
    const connectedNodeIds = new Set<string>();
    const connectedConnectionIds = new Set<string>();
    connections.forEach((c) => {
      const fromMatch = c.fromId === hoveredNodeId;
      const toMatch = c.toId === hoveredNodeId;
      if (fromMatch || toMatch) {
        connectedConnectionIds.add(c.id);
        connectedNodeIds.add(c.fromId);
        connectedNodeIds.add(c.toId);
      }
    });
    connectedNodeIds.add(hoveredNodeId);
    const hoveredPerson = people.find((p) => p.id === hoveredNodeId);
    return { connectedNodeIds, connectedConnectionIds, hoveredPerson };
  }, [hoveredNodeId, connections, people, visibility.hoverFocus]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setZoom((z) => {
      const nz = Math.max(0.1, Math.min(5, z * delta));
      setPan((p) => ({
        x: mx - (mx - p.x) * (nz / z),
        y: my - (my - p.y) * (nz / z),
      }));
      return nz;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as SVGElement;
    const isBackground = target === svgRef.current || target.tagName === 'rect' || target.tagName === 'pattern';
    if (e.button === 1 || (e.button === 0 && (isBackground || !target.closest('g.cursor-pointer')))) {
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
    setContextMenu(null);
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });

    if (draggingGroup && dragLastWorld) {
      const world = screenToWorld(e.clientX, e.clientY);
      const dx = world.x - dragLastWorld.x;
      const dy = world.y - dragLastWorld.y;
      const updates = draggingGroup.map((nid) => {
        const p = people.find((pp) => pp.id === nid);
        return { id: nid, x: (p?.x ?? 0) + dx, y: (p?.y ?? 0) + dy };
      });
      onBatchUpdatePositions(updates);
      // Also sync physics nodes
      updates.forEach((u) => {
        const pn = physicsNodesRef.current.get(u.id);
        if (pn) { pn.x = u.x; pn.y = u.y; pn.vx = 0; pn.vy = 0; }
      });
      setDragLastWorld(world);
    } else if (dragging) {
      const world = screenToWorld(e.clientX, e.clientY);
      onUpdatePosition(dragging, world.x, world.y);
      const pn = physicsNodesRef.current.get(dragging);
      if (pn) { pn.x = world.x; pn.y = world.y; pn.vx = 0; pn.vy = 0; }
    }

    if (connectingFrom) {
      const world = screenToWorld(e.clientX, e.clientY);
      setMousePos(world);
    }
  }, [panning, panStart, dragging, draggingGroup, dragLastWorld, connectingFrom, screenToWorld, onUpdatePosition, onBatchUpdatePositions, people]);

  const handleMouseUp = useCallback(() => {
    setPanning(false);
    setDragging(null);
    setDraggingGroup(null);
    setDragLastWorld(null);
  }, []);

  // ---- Touch support for mobile ----
  const touchRef = useRef<{ startPan: { x: number; y: number }; startDist: number; startZoom: number; touchStartTime: number; touchStartPos: { x: number; y: number } } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as SVGElement;
    const isNode = target.closest('g.cursor-pointer');

    if (e.touches.length === 2) {
      // Pinch-to-zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = {
        startPan: { ...pan },
        startDist: Math.sqrt(dx * dx + dy * dy),
        startZoom: zoom,
        touchStartTime: Date.now(),
        touchStartPos: { x: 0, y: 0 },
      };
      setPanning(false);
      setDragging(null);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchRef.current = {
        startPan: { x: touch.clientX - pan.x, y: touch.clientY - pan.y },
        startDist: 0,
        startZoom: zoom,
        touchStartTime: Date.now(),
        touchStartPos: { x: touch.clientX, y: touch.clientY },
      };

      if (isNode) {
        // Don't start panning, node mousedown will handle via click
        return;
      }
      // Single finger on background → pan
      setPanning(true);
    }
  }, [pan, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / touchRef.current.startDist;
      const newZoom = Math.max(0.1, Math.min(5, touchRef.current.startZoom * scale));
      setZoom(newZoom);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (dragging) {
        const world = screenToWorld(touch.clientX, touch.clientY);
        onUpdatePosition(dragging, world.x, world.y);
        const pn = physicsNodesRef.current.get(dragging);
        if (pn) { pn.x = world.x; pn.y = world.y; pn.vx = 0; pn.vy = 0; }
      } else if (panning && touchRef.current) {
        setPan({
          x: touch.clientX - touchRef.current.startPan.x,
          y: touch.clientY - touchRef.current.startPan.y,
        });
      }
    }
  }, [dragging, panning, screenToWorld, onUpdatePosition]);

  const handleTouchEnd = useCallback(() => {
    setPanning(false);
    setDragging(null);
    setDraggingGroup(null);
    setDragLastWorld(null);
    touchRef.current = null;
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string, entityType: 'person' | 'group' = 'person') => {
    e.stopPropagation();
    setContextMenu(null);

    if (e.shiftKey && entityType === 'person') {
      onToggleNodeSelection(id);
      return;
    }

    if (selectedConnectorType) {
      if (connectingFrom) {
        if (connectingFrom.id !== id) {
          onAddConnection(connectingFrom.id, id, selectedConnectorType, connectingFrom.type, entityType);
        }
        setConnectingFrom(null);
      } else {
        setConnectingFrom({ id, type: entityType });
        const world = screenToWorld(e.clientX, e.clientY);
        setMousePos(world);
      }
    } else {
      if (entityType === 'group') {
        const group = groups.find((g) => g.id === id);
        if (group) {
          const world = screenToWorld(e.clientX, e.clientY);
          setDraggingGroup([...group.memberIds]);
          setDragLastWorld(world);
        }
      } else if (selectedNodes.has(id) && selectedNodes.size > 1) {
        const world = screenToWorld(e.clientX, e.clientY);
        setDraggingGroup(Array.from(selectedNodes));
        setDragLastWorld(world);
      } else {
        setDragging(id);
      }
    }
  }, [selectedConnectorType, connectingFrom, onAddConnection, screenToWorld, onToggleNodeSelection, selectedNodes, groups]);

  const handleGroupLabelMouseDown = useCallback((e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    setContextMenu(null);

    if (selectedConnectorType) {
      if (connectingFrom) {
        if (connectingFrom.id !== group.id) {
          onAddConnection(connectingFrom.id, group.id, selectedConnectorType, connectingFrom.type, 'group');
        }
        setConnectingFrom(null);
      } else {
        setConnectingFrom({ id: group.id, type: 'group' });
        const world = screenToWorld(e.clientX, e.clientY);
        setMousePos(world);
      }
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);
    setDraggingGroup([...group.memberIds]);
    setDragLastWorld(world);
  }, [screenToWorld, selectedConnectorType, connectingFrom, onAddConnection]);

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'node' | 'connection', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  }, []);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const getConnectorStyle = (connectorTypeId: string) => {
    const ct = connectorTypes.find((c) => c.id === connectorTypeId);
    if (!ct) return { stroke: 'hsl(215 12% 55%)', dashArray: '', color: '215 12% 55%' };
    return {
      stroke: `hsl(${ct.color})`,
      dashArray: ct.lineStyle === 'dashed' ? '8 4' : ct.lineStyle === 'dotted' ? '3 3' : '',
      color: ct.color,
    };
  };

  const getGroupBounds = (group: Group) => {
    const members = people.filter((p) => group.memberIds.includes(p.id));
    if (members.length === 0) return null;
    const cx = members.reduce((s, m) => { const pos = getPersonPos(m); return s + pos.x; }, 0) / members.length;
    const cy = members.reduce((s, m) => { const pos = getPersonPos(m); return s + pos.y; }, 0) / members.length;
    const maxDist = Math.max(...members.map((m) => { const pos = getPersonPos(m); return Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2); }), 60);
    return { cx, cy, r: maxDist + 50 };
  };

  const getEndpointPos = (id: string, type: string) => {
    if (type === 'group') {
      const centroid = groupCentroids.get(id);
      if (centroid) return centroid;
      const group = groups.find((g) => g.id === id);
      if (group) {
        const bounds = getGroupBounds(group);
        if (bounds) return { cx: bounds.cx, cy: bounds.cy };
      }
      return null;
    }
    const person = people.find((p) => p.id === id);
    if (!person) return null;
    const pos = getPersonPos(person);
    return { cx: pos.x, cy: pos.y };
  };

  const connectingFromPos = useMemo(() => {
    if (!connectingFrom) return null;
    return getEndpointPos(connectingFrom.id, connectingFrom.type);
  }, [connectingFrom, people, groups, groupCentroids]);

  const matchingIds = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return new Set(
      people.filter((p) =>
        p.firstName.toLowerCase().includes(q) || p.familyName.toLowerCase().includes(q) ||
        (p.descriptor || '').toLowerCase().includes(q) || (p.notes || '').toLowerCase().includes(q)
      ).map((p) => p.id)
    );
  }, [searchQuery, people]);

  const fitToView = useCallback(() => {
    if (people.length === 0) return;
    const xs = people.map((p) => getPersonPos(p).x);
    const ys = people.map((p) => getPersonPos(p).y);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 60;
    const maxY = Math.max(...ys) + 60;
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const newZoom = Math.min(svgSize.w / w, svgSize.h / h, 2) * 0.9;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(newZoom);
    setPan({ x: svgSize.w / 2 - cx * newZoom, y: svgSize.h / 2 - cy * newZoom });
  }, [people, svgSize, getPersonPos]);

  const centerView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const minimapData = useMemo(() => {
    if (people.length === 0) return null;
    const xs = people.map((p) => getPersonPos(p).x);
    const ys = people.map((p) => getPersonPos(p).y);
    const padding = 80;
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;
    const vpX = -pan.x / zoom;
    const vpY = -pan.y / zoom;
    const vpW = svgSize.w / zoom;
    const vpH = svgSize.h / zoom;
    return { minX, minY, worldW, worldH, vpX, vpY, vpW, vpH };
  }, [people, pan, zoom, svgSize, getPersonPos]);

  const visibleConnections = useMemo(() => {
    return connections.filter((c) => !hiddenConnectorTypeIds.has(c.connectorTypeId));
  }, [connections, hiddenConnectorTypeIds]);

  const visibleGroups = useMemo(() => {
    return groups.filter((g) => !hiddenGroupIds.has(g.id));
  }, [groups, hiddenGroupIds]);

  // Compute arrowhead endpoint with offset for node radius
  const getArrowLine = (fromPos: { cx: number; cy: number }, toPos: { cx: number; cy: number }, toRadius: number) => {
    const dx = toPos.cx - fromPos.cx;
    const dy = toPos.cy - fromPos.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x2: toPos.cx, y2: toPos.cy };
    const offset = toRadius + 4;
    return {
      x2: toPos.cx - (dx / dist) * offset,
      y2: toPos.cy - (dy / dist) * offset,
    };
  };

  const MINIMAP_W = 160;
  const MINIMAP_H = 100;

  return (
    <div className="relative flex-1 overflow-hidden bg-canvas">
      {/* Mobile hamburger */}
      {isMobile && (
        <button
          onClick={onOpenSidebar}
          className="absolute top-3 left-3 z-30 bg-card/90 backdrop-blur border border-border rounded-md p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu size={18} />
        </button>
      )}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <defs>
          <pattern id="grid" width={40 * zoom} height={40 * zoom} patternUnits="userSpaceOnUse"
            x={pan.x % (40 * zoom)} y={pan.y % (40 * zoom)}>
            <circle cx={1} cy={1} r={0.8} fill="hsl(220 14% 16%)" />
          </pattern>
          <filter id="featured-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="focus-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Arrow markers per connector type */}
          {connectorTypes.map((ct) => (
            <marker key={ct.id} id={`arrow-${ct.id}`} viewBox="0 0 10 6" refX="10" refY="3"
              markerWidth="10" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3 L 0 6 z" fill={`hsl(${ct.color})`} />
            </marker>
          ))}
          {/* Featured arrow */}
          <marker id="arrow-featured" viewBox="0 0 10 6" refX="10" refY="3"
            markerWidth="10" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(50 100% 60%)" />
          </marker>
          {/* Focus arrow */}
          <marker id="arrow-focus" viewBox="0 0 10 6" refX="10" refY="3"
            markerWidth="10" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(var(--primary))" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Expanded Groups */}
          {visibility.groups && visibleGroups.map((group) => {
            if (collapsedGroupIds.has(group.id)) return null;
            const bounds = getGroupBounds(group);
            if (!bounds) return null;
            const isFeatured = group.featured;
            return (
              <g key={group.id}>
                <circle cx={bounds.cx} cy={bounds.cy} r={bounds.r}
                  fill={`hsl(${group.color} / 0.06)`}
                  stroke={isFeatured ? `hsl(${group.featuredColor || '50 100% 60%'})` : `hsl(${group.color} / 0.3)`}
                  strokeWidth={isFeatured ? 3 : 2} strokeDasharray={isFeatured ? '' : '6 3'}
                  filter={isFeatured ? 'url(#featured-glow)' : undefined} />
                <text x={bounds.cx} y={bounds.cy - bounds.r - 8} textAnchor="middle"
                  fill={isFeatured ? `hsl(${group.featuredColor || '50 100% 60%'})` : `hsl(${group.color})`}
                  fontSize={12} fontFamily="var(--font-display)" fontWeight={600}
                  className="cursor-grab select-none"
                  onMouseDown={(e) => handleGroupLabelMouseDown(e, group)}>
                  {group.label}
                </text>
              </g>
            );
          })}

          {/* Collapsed Groups as nodes */}
          {visibility.groups && visibleGroups.map((group) => {
            if (!collapsedGroupIds.has(group.id)) return null;
            const centroid = groupCentroids.get(group.id);
            if (!centroid) return null;
            const isFeatured = group.featured;
            return (
              <g key={`collapsed-${group.id}`}
                onMouseDown={(e) => handleNodeMouseDown(e, group.id, 'group')}
                onContextMenu={(e) => handleContextMenu(e, 'node', group.id)}
                className="cursor-pointer select-none">
                <circle cx={centroid.cx} cy={centroid.cy} r={GROUP_NODE_RADIUS}
                  fill={`hsl(${group.color} / 0.25)`}
                  stroke={isFeatured ? `hsl(${group.featuredColor || '50 100% 60%'})` : `hsl(${group.color})`}
                  strokeWidth={isFeatured ? 3 : 2}
                  filter={isFeatured ? 'url(#featured-glow)' : undefined} />
                <text x={centroid.cx} y={centroid.cy - 4} textAnchor="middle"
                  fill={`hsl(${group.color})`} fontSize={10} fontFamily="var(--font-display)" fontWeight={700}>
                  {group.label}
                </text>
                <text x={centroid.cx} y={centroid.cy + 10} textAnchor="middle"
                  fill="hsl(var(--muted-foreground))" fontSize={8} fontFamily="var(--font-body)">
                  {group.memberIds.length} members
                </text>
              </g>
            );
          })}

          {/* Connections with directional arrows */}
          {visibility.connectors && visibleConnections.map((conn) => {
            const fromType = conn.fromType || 'person';
            const toType = conn.toType || 'person';
            const fromPos = getEndpointPos(conn.fromId, fromType);
            const toPos = getEndpointPos(conn.toId, toType);
            if (!fromPos || !toPos) return null;

            const style = getConnectorStyle(conn.connectorTypeId);
            const isFeatured = conn.featured;
            const isFocused = focusData && focusData.connectedConnectionIds.has(conn.id);
            const isDimmedByFocus = focusData && !isFocused;
            const toRadius = toType === 'group' ? GROUP_NODE_RADIUS : NODE_RADIUS;
            const arrow = getArrowLine(fromPos, toPos, toRadius);
            const mx = (fromPos.cx + arrow.x2) / 2;
            const my = (fromPos.cy + arrow.y2) / 2;
            const ct = connectorTypes.find((c) => c.id === conn.connectorTypeId);
            const markerId = isFeatured ? 'arrow-featured' : isFocused ? `arrow-${conn.connectorTypeId}` : `arrow-${conn.connectorTypeId}`;
            return (
              <g key={conn.id} opacity={isDimmedByFocus ? 0.1 : 1}>
                <line x1={fromPos.cx} y1={fromPos.cy} x2={arrow.x2} y2={arrow.y2}
                  stroke={isFeatured ? `hsl(${conn.featuredColor || '50 100% 60%'})` : isFocused ? `hsl(${style.color})` : style.stroke}
                  strokeWidth={isFeatured ? 3 : isFocused ? 3 : 2} strokeDasharray={style.dashArray}
                  strokeOpacity={isFeatured ? 1 : 0.7}
                  filter={isFeatured ? 'url(#featured-glow)' : isFocused ? 'url(#focus-glow)' : undefined}
                  markerEnd={`url(#${markerId})`} />
                <line x1={fromPos.cx} y1={fromPos.cy} x2={toPos.cx} y2={toPos.cy}
                  stroke="transparent" strokeWidth={12} className="cursor-pointer"
                  onContextMenu={(e) => handleContextMenu(e, 'connection', conn.id)} />
                <text x={mx} y={my - 6} textAnchor="middle" fill={style.stroke} fontSize={9}
                  fontFamily="var(--font-display)" opacity={0.7}>
                  {ct?.label}
                </text>
              </g>
            );
          })}

          {/* Connecting line preview */}
          {connectingFromPos && (
            <line x1={connectingFromPos.cx} y1={connectingFromPos.cy} x2={mousePos.x} y2={mousePos.y}
              stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.5} pointerEvents="none" />
          )}

          {/* Person Nodes */}
          {people.map((person) => {
            if (hiddenByCollapse.has(person.id)) return null;
            const pos = getPersonPos(person);
            const isConnecting = connectingFrom?.id === person.id && connectingFrom?.type === 'person';
            const isSelected = selectedNodes.has(person.id);
            const isSearchMatch = matchingIds ? matchingIds.has(person.id) : true;
            const dimmed = matchingIds !== null && !isSearchMatch;
            const hasDescriptor = !!person.descriptor;
            const isFeatured = person.featured;
            const isHovered = hoveredNodeId === person.id;
            const isFocusConnected = focusData && focusData.connectedNodeIds.has(person.id);
            const isDimmedByFocus = focusData && !isFocusConnected;
            return (
              <g
                key={person.id}
                onMouseDown={(e) => handleNodeMouseDown(e, person.id, 'person')}
                onMouseEnter={() => setHoveredNodeId(person.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onContextMenu={(e) => handleContextMenu(e, 'node', person.id)}
                className="cursor-pointer select-none"
                opacity={dimmed ? 0.2 : isDimmedByFocus ? 0.15 : 1}
              >
                {isFeatured && (
                  <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 8}
                    fill="none" stroke={`hsl(${person.featuredColor || '50 100% 60%'})`}
                    strokeWidth={2} opacity={0.6} filter="url(#featured-glow)"
                    className="animate-featured-pulse" />
                )}
                {isHovered && visibility.hoverFocus && (
                  <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 10}
                    fill="none" stroke="hsl(var(--primary))"
                    strokeWidth={2} opacity={0.8} filter="url(#focus-glow)"
                    className="animate-focus-pulse" />
                )}
                {isFocusConnected && !isHovered && focusData && (
                  <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 6}
                    fill="none" stroke="hsl(var(--primary))"
                    strokeWidth={1.5} opacity={0.4} strokeDasharray="4 2" />
                )}
                <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS}
                  fill="hsl(var(--node))"
                  stroke={isFeatured ? `hsl(${person.featuredColor || '50 100% 60%'})` : isHovered ? 'hsl(var(--primary))' : isSelected ? 'hsl(var(--primary))' : isConnecting ? 'hsl(var(--primary))' : 'hsl(var(--node-border))'}
                  strokeWidth={isFeatured ? 2.5 : isHovered ? 3 : isSelected ? 3 : isConnecting ? 2.5 : 1.5} />
                {isSelected && !isFeatured && (
                  <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 5}
                    fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.6} />
                )}
                {isConnecting && (
                  <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 4}
                    fill="none" stroke="hsl(var(--primary))" strokeWidth={1} opacity={0.4} className="animate-pulse-glow" />
                )}
                {person.notes && (
                  <circle cx={pos.x + NODE_RADIUS - 4} cy={pos.y - NODE_RADIUS + 4} r={4} fill="hsl(var(--primary))" />
                )}
                {visibility.names && (
                  <>
                    <text x={pos.x} y={hasDescriptor ? pos.y - 6 : pos.y - 3} textAnchor="middle"
                      fill="hsl(var(--node-foreground))" fontSize={10} fontFamily="var(--font-body)" fontWeight={600}>
                      {person.firstName}
                    </text>
                    <text x={pos.x} y={hasDescriptor ? pos.y + 5 : pos.y + 10} textAnchor="middle"
                      fill="hsl(var(--muted-foreground))" fontSize={8} fontFamily="var(--font-body)">
                      {person.familyName}
                    </text>
                    {hasDescriptor && (
                      <text x={pos.x} y={pos.y + 15} textAnchor="middle"
                        fill="hsl(var(--primary))" fontSize={7} fontFamily="var(--font-display)" opacity={0.8}>
                        {person.descriptor}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover info panel */}
      {focusData?.hoveredPerson && (
        <div className="absolute top-3 right-3 bg-card/95 backdrop-blur border border-border rounded-lg p-3 w-56 shadow-lg animate-fade-in pointer-events-none z-40">
          <div className="font-display text-sm font-bold text-foreground">
            {focusData.hoveredPerson.firstName} {focusData.hoveredPerson.familyName}
          </div>
          {focusData.hoveredPerson.descriptor && (
            <div className="text-xs text-primary mt-0.5 font-display">{focusData.hoveredPerson.descriptor}</div>
          )}
          {focusData.hoveredPerson.notes && (
            <div className="text-xs text-muted-foreground mt-1.5 border-t border-border pt-1.5 whitespace-pre-wrap">
              {focusData.hoveredPerson.notes}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground/60 mt-1.5">
            {focusData.connectedNodeIds.size - 1} connection{focusData.connectedNodeIds.size - 1 !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Empty state */}
      {people.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-muted-foreground font-display text-lg">No data loaded</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Upload an Excel file or load a saved network</p>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div className="absolute z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          {contextMenu.type === 'node' && (
            <button className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-secondary transition-colors"
              onClick={() => { onRemovePerson(contextMenu.id); setContextMenu(null); }}>
              Remove person
            </button>
          )}
          {contextMenu.type === 'connection' && (
            <button className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-secondary transition-colors"
              onClick={() => { onRemoveConnection(contextMenu.id); setContextMenu(null); }}>
              Remove connection
            </button>
          )}
        </div>
      )}

      {/* Connection mode indicator */}
      {selectedConnectorType && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur border border-border rounded-full px-4 py-1.5 text-xs font-display text-primary">
          {connectingFrom ? 'Click target node or group' : 'Click source node or group'} · {connectorTypes.find(c => c.id === selectedConnectorType)?.label}
        </div>
      )}

      {/* Selection hint */}
      {!selectedConnectorType && selectedNodes.size === 0 && people.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-card/70 backdrop-blur border border-border rounded-full px-3 py-1 text-[10px] font-display text-muted-foreground">
          Shift+Click to select nodes
        </div>
      )}

      {/* Live physics indicator */}
      {livePhysics && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-primary/10 backdrop-blur border border-primary/30 rounded-full px-3 py-0.5 text-[10px] font-display text-primary animate-pulse">
          ⚡ Live Physics
        </div>
      )}

      {/* Navigation controls */}
      <div className={`absolute bottom-3 flex gap-1 ${isMobile ? 'left-1/2 -translate-x-1/2' : 'left-3'}`}>
        <button onClick={fitToView} title="Fit to view"
          className={`bg-card/80 backdrop-blur border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors ${isMobile ? 'p-2.5' : 'p-1.5'}`}>
          <Maximize size={isMobile ? 18 : 14} />
        </button>
        <button onClick={centerView} title="Reset view"
          className={`bg-card/80 backdrop-blur border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors ${isMobile ? 'p-2.5' : 'p-1.5'}`}>
          <Crosshair size={isMobile ? 18 : 14} />
        </button>
        <button onClick={() => setZoom((z) => Math.min(5, z * 1.2))} title="Zoom in"
          className={`bg-card/80 backdrop-blur border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors ${isMobile ? 'p-2.5' : 'p-1.5'}`}>
          <ZoomIn size={isMobile ? 18 : 14} />
        </button>
        <button onClick={() => setZoom((z) => Math.max(0.1, z * 0.8))} title="Zoom out"
          className={`bg-card/80 backdrop-blur border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors ${isMobile ? 'p-2.5' : 'p-1.5'}`}>
          <ZoomOut size={isMobile ? 18 : 14} />
        </button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 bg-card/80 backdrop-blur border border-border rounded-md px-2 py-1 text-xs font-display text-muted-foreground">
        {Math.round(zoom * 100)}%
      </div>

      {/* Minimap */}
      {visibility.minimap && minimapData && (
        <div className="absolute top-3 right-3 bg-card/90 backdrop-blur border border-border rounded-md overflow-hidden"
          style={{ width: MINIMAP_W, height: MINIMAP_H }}>
          <svg width={MINIMAP_W} height={MINIMAP_H} viewBox={`${minimapData.minX} ${minimapData.minY} ${minimapData.worldW} ${minimapData.worldH}`} preserveAspectRatio="xMidYMid meet">
            {visibility.connectors && visibleConnections.map((conn) => {
              const fromPos = getEndpointPos(conn.fromId, conn.fromType || 'person');
              const toPos = getEndpointPos(conn.toId, conn.toType || 'person');
              if (!fromPos || !toPos) return null;
              const style = getConnectorStyle(conn.connectorTypeId);
              return <line key={conn.id} x1={fromPos.cx} y1={fromPos.cy} x2={toPos.cx} y2={toPos.cy} stroke={style.stroke} strokeWidth={3} strokeOpacity={0.4} />;
            })}
            {people.filter(p => !hiddenByCollapse.has(p.id)).map((p) => {
              const pos = getPersonPos(p);
              return <circle key={p.id} cx={pos.x} cy={pos.y} r={8} fill="hsl(var(--primary))" opacity={0.7} />;
            })}
            {visibleGroups.filter(g => collapsedGroupIds.has(g.id)).map((g) => {
              const c = groupCentroids.get(g.id);
              if (!c) return null;
              return <circle key={g.id} cx={c.cx} cy={c.cy} r={12} fill={`hsl(${g.color})`} opacity={0.5} />;
            })}
            <rect x={minimapData.vpX} y={minimapData.vpY} width={minimapData.vpW} height={minimapData.vpH}
              fill="hsl(var(--primary) / 0.08)" stroke="hsl(var(--primary))" strokeWidth={4} />
          </svg>
        </div>
      )}
    </div>
  );
};

