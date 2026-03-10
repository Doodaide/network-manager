import React, { useState } from 'react';
import { ConnectorType, Person, Group, Connection } from '@/types/network';
import { CanvasVisibility } from '@/pages/Index';
import {
  Upload, Plus, Link, Users, RotateCcw, X, UserPlus, FileText,
  ChevronDown, ChevronRight, Search, Eye, EyeOff, Map, Type, GitBranch,
  Download, FolderOpen, Shuffle, Star, StarOff, Minimize2, Maximize2, Edit3, Check,
  ChevronLeft } from
'lucide-react';

interface Props {
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  connections: Connection[];
  connectorTypes: ConnectorType[];
  groups: Group[];
  selectedConnectorType: string | null;
  onSelectConnectorType: (id: string | null) => void;
  onImportExcel: (file: File) => void;
  onAddPerson: (firstName: string, familyName: string) => void;
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onRemovePerson: (id: string) => void;
  onAddConnection: (fromId: string, toId: string, connectorTypeId: string, fromType?: 'person' | 'group', toType?: 'person' | 'group') => void;
  onRemoveConnection: (id: string) => void;
  onUpdateConnection: (id: string, updates: Partial<Connection>) => void;
  onAddConnectorType: (label: string, color: string, lineStyle: 'solid' | 'dashed' | 'dotted') => void;
  onUpdateConnectorType: (id: string, updates: Partial<ConnectorType>) => void;
  onRemoveConnectorType: (id: string) => void;
  onAddGroup: (label: string, memberIds: string[], color: string) => void;
  onUpdateGroup: (id: string, updates: Partial<Group>) => void;
  onRemoveGroup: (id: string) => void;
  onClearAll: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  visibility: CanvasVisibility;
  onToggleVisibility: (key: keyof CanvasVisibility) => void;
  selectedNodes: Set<string>;
  onGroupSelectedNodes: (label: string, color: string) => void;
  onClearSelection: () => void;
  hiddenConnectorTypeIds: Set<string>;
  onToggleConnectorTypeVisibility: (id: string) => void;
  hiddenGroupIds: Set<string>;
  onToggleGroupVisibility: (id: string) => void;
  collapsedGroupIds: Set<string>;
  onToggleGroupCollapse: (id: string) => void;
  onApplyForceSort: () => void;
  onExportState: () => void;
  onImportState: (file: File) => void;
  livePhysics: boolean;
  onToggleLivePhysics: () => void;
}

const COLOR_PRESETS = [
'174 72% 50%', '340 72% 55%', '45 80% 55%', '260 60% 60%',
'120 50% 45%', '200 80% 55%', '15 80% 55%', '300 60% 55%'];


const FEATURED_COLORS = [
'50 100% 60%', '30 100% 55%', '0 100% 60%', '280 80% 65%', '174 72% 50%'];


const LINE_STYLES: {value: 'solid' | 'dashed' | 'dotted';label: string;}[] = [
{ value: 'solid', label: 'Solid' },
{ value: 'dashed', label: 'Dashed' },
{ value: 'dotted', label: 'Dotted' }];


const ToggleButton: React.FC<{active: boolean;onClick: () => void;icon: React.ReactNode;label: string;}> = ({ active, onClick, icon, label }) =>
<button
  onClick={onClick}
  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${active ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground hover:text-secondary-foreground'}`}>

    {icon}
    {label}
  </button>;


export const Sidebar: React.FC<Props> = ({
  isMobile, isOpen, onClose,
  people, connections, connectorTypes, groups, selectedConnectorType,
  onSelectConnectorType, onImportExcel, onAddPerson, onUpdatePerson, onRemovePerson,
  onAddConnection, onRemoveConnection, onUpdateConnection,
  onAddConnectorType, onUpdateConnectorType, onRemoveConnectorType,
  onAddGroup, onUpdateGroup, onRemoveGroup,
  onClearAll, searchQuery, onSearchChange, visibility, onToggleVisibility,
  selectedNodes, onGroupSelectedNodes, onClearSelection,
  hiddenConnectorTypeIds, onToggleConnectorTypeVisibility,
  hiddenGroupIds, onToggleGroupVisibility,
  collapsedGroupIds, onToggleGroupCollapse,
  onApplyForceSort, onExportState, onImportState,
  livePhysics, onToggleLivePhysics
}) => {
  const [showNewConnector, setShowNewConnector] = useState(false);
  const [newConnLabel, setNewConnLabel] = useState('');
  const [newConnColor, setNewConnColor] = useState(COLOR_PRESETS[0]);
  const [newConnLine, setNewConnLine] = useState<'solid' | 'dashed' | 'dotted'>('solid');

  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(COLOR_PRESETS[0]);
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');

  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [expandedConnectorId, setExpandedConnectorId] = useState<string | null>(null);

  const [selectionGroupLabel, setSelectionGroupLabel] = useState('');
  const [selectionGroupColor, setSelectionGroupColor] = useState(COLOR_PRESETS[0]);

  // Editing state for connectors
  const [editConnLabel, setEditConnLabel] = useState('');
  const [editConnColor, setEditConnColor] = useState('');
  const [editConnLine, setEditConnLine] = useState<'solid' | 'dashed' | 'dotted'>('solid');

  // Editing state for groups
  const [editGroupLabel, setEditGroupLabel] = useState('');
  const [editGroupColor, setEditGroupColor] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportExcel(file);
    e.target.value = '';
  };

  const handleImportState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportState(file);
    e.target.value = '';
  };

  const handleAddConnector = () => {
    if (!newConnLabel.trim()) return;
    onAddConnectorType(newConnLabel.trim(), newConnColor, newConnLine);
    setNewConnLabel('');
    setShowNewConnector(false);
  };

  const handleAddGroup = () => {
    if (!newGroupLabel.trim() || newGroupMembers.length === 0) return;
    onAddGroup(newGroupLabel.trim(), newGroupMembers, newGroupColor);
    setNewGroupLabel('');
    setNewGroupMembers([]);
    setShowNewGroup(false);
  };

  const handleAddPerson = () => {
    if (!newFirstName.trim()) return;
    onAddPerson(newFirstName.trim(), newFamilyName.trim());
    setNewFirstName('');
    setNewFamilyName('');
    setShowAddPerson(false);
  };

  const toggleGroupMember = (id: string) => {
    setNewGroupMembers((prev) =>
    prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleGroupSelected = () => {
    if (!selectionGroupLabel.trim()) return;
    onGroupSelectedNodes(selectionGroupLabel.trim(), selectionGroupColor);
    setSelectionGroupLabel('');
  };

  const startEditConnector = (ct: ConnectorType) => {
    setExpandedConnectorId(ct.id);
    setEditConnLabel(ct.label);
    setEditConnColor(ct.color);
    setEditConnLine(ct.lineStyle);
  };

  const saveEditConnector = (id: string) => {
    onUpdateConnectorType(id, { label: editConnLabel, color: editConnColor, lineStyle: editConnLine });
    setExpandedConnectorId(null);
  };

  const startEditGroup = (g: Group) => {
    setExpandedGroupId(g.id);
    setEditGroupLabel(g.label);
    setEditGroupColor(g.color);
  };

  const saveEditGroup = (id: string) => {
    onUpdateGroup(id, { label: editGroupLabel, color: editGroupColor });
  };

  const filteredPeople = searchQuery.trim() ?
  people.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.familyName.toLowerCase().includes(q) ||
      (p.descriptor || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q));

  }) :
  people;

  const sidebarClasses = isMobile
    ? `fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col h-full overflow-hidden transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
    : 'w-72 bg-sidebar border-r border-sidebar-border flex flex-col h-full overflow-hidden';

  return (
    <div className={sidebarClasses}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between">
        <div>
          <h1 className="font-display text-sm font-bold text-sidebar-foreground tracking-wider uppercase">
            Network chart      
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Designer</p>
        </div>
        {isMobile && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-sidebar-border">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search names, descriptors..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-secondary border border-border rounded pl-7 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />

          {searchQuery &&
          <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={10} />
            </button>
          }
        </div>
      </div>

      {/* Visibility Toggles */}
      <div className="px-4 py-2 border-b border-sidebar-border">
        <h2 className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Visibility</h2>
        <div className="flex flex-wrap gap-1">
          <ToggleButton active={visibility.names} onClick={() => onToggleVisibility('names')} icon={<Type size={10} />} label="Names" />
          <ToggleButton active={visibility.connectors} onClick={() => onToggleVisibility('connectors')} icon={<GitBranch size={10} />} label="Lines" />
          <ToggleButton active={visibility.groups} onClick={() => onToggleVisibility('groups')} icon={<Users size={10} />} label="Groups" />
          <ToggleButton active={visibility.minimap} onClick={() => onToggleVisibility('minimap')} icon={<Map size={10} />} label="Minimap" />
          <ToggleButton active={visibility.hoverFocus} onClick={() => onToggleVisibility('hoverFocus')} icon={<Eye size={10} />} label="Focus" />
        </div>
      </div>

      {/* Selection grouping */}
      {selectedNodes.size >= 2 &&
      <div className="px-4 py-2 border-b border-sidebar-border bg-primary/5">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="font-display text-[10px] font-semibold text-primary uppercase tracking-wider">
              {selectedNodes.size} nodes selected
            </h2>
            <button onClick={onClearSelection} className="text-muted-foreground hover:text-foreground text-[10px]">Clear</button>
          </div>
          <div className="space-y-1.5">
            <input type="text" placeholder="Group name" value={selectionGroupLabel} onChange={(e) => setSelectionGroupLabel(e.target.value)}
          className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            <div className="flex gap-1 flex-wrap">
              {COLOR_PRESETS.map((c) =>
            <button key={c} className={`w-4 h-4 rounded-full transition-transform ${selectionGroupColor === c ? 'scale-125 ring-1 ring-foreground' : ''}`}
            style={{ backgroundColor: `hsl(${c})` }} onClick={() => setSelectionGroupColor(c)} />
            )}
            </div>
            <button onClick={handleGroupSelected} disabled={!selectionGroupLabel.trim()}
          className="w-full py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
              Group Selected
            </button>
          </div>
        </div>
      }

      <div className="flex-1 overflow-y-auto">
        {/* Upload & Tools Section */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Data</h2>
          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-md cursor-pointer transition-colors text-sm text-secondary-foreground">
              <Upload size={14} />
              Import
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <button onClick={() => setShowAddPerson(!showAddPerson)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors text-sm text-secondary-foreground">
              <UserPlus size={14} />
              Add
            </button>
          </div>

          {showAddPerson &&
          <div className="mt-2 p-2 bg-secondary rounded-md space-y-2">
              <input type="text" placeholder="First name *" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <input type="text" placeholder="Family name" value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={handleAddPerson} disabled={!newFirstName.trim()}
            className="w-full py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
                Add Person
              </button>
            </div>
          }

          {people.length > 0 && <p className="text-xs text-muted-foreground mt-2">{people.length} people loaded</p>}

          {/* Tools row */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <button onClick={onApplyForceSort} title="Auto-arrange connected nodes"
            className="flex items-center gap-1 px-2 py-1.5 bg-secondary hover:bg-secondary/80 rounded text-xs text-secondary-foreground transition-colors">
              <Shuffle size={12} /> Sort
            </button>
            <button onClick={onToggleLivePhysics} title="Toggle live physics simulation"
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${livePhysics ? 'bg-primary/20 text-primary ring-1 ring-primary/30' : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'}`}>
              ⚡ Physics
            </button>
            <button onClick={onExportState} title="Export network as JSON"
            className="flex items-center gap-1 px-2 py-1.5 bg-secondary hover:bg-secondary/80 rounded text-xs text-secondary-foreground transition-colors">
              <Download size={12} /> Save
            </button>
            <label title="Load a saved network JSON"
            className="flex items-center gap-1 px-2 py-1.5 bg-secondary hover:bg-secondary/80 rounded text-xs text-secondary-foreground transition-colors cursor-pointer">
              <FolderOpen size={12} /> Load
              <input type="file" accept=".json" onChange={handleImportState} className="hidden" />
            </label>
          </div>
        </div>

        {/* Connectors Section */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Link size={12} />Connectors
            </h2>
            <button onClick={() => setShowNewConnector(!showNewConnector)} className="text-muted-foreground hover:text-primary transition-colors">
              <Plus size={14} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mb-2">Select a connector, then click two nodes/groups to connect them.</p>
          <div className="space-y-0.5">
            {connectorTypes.map((ct) => {
              const isEditing = expandedConnectorId === ct.id;
              const isHidden = hiddenConnectorTypeIds.has(ct.id);
              return (
                <div key={ct.id} className="rounded-md overflow-hidden">
                  <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all text-sm ${selectedConnectorType === ct.id ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-secondary'}`}>
                    <button onClick={(e) => {e.stopPropagation();onToggleConnectorTypeVisibility(ct.id);}}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                    </button>
                    <div className="flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => onSelectConnectorType(selectedConnectorType === ct.id ? null : ct.id)}>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `hsl(${ct.color})` }} />
                      <span className={`truncate text-sidebar-foreground ${isHidden ? 'opacity-40' : ''}`}>{ct.label}</span>
                      <span className="text-[10px] text-muted-foreground">{ct.lineStyle}</span>
                    </div>
                    <button onClick={(e) => {e.stopPropagation();isEditing ? setExpandedConnectorId(null) : startEditConnector(ct);}}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                      <Edit3 size={10} />
                    </button>
                    <button onClick={(e) => {e.stopPropagation();onRemoveConnectorType(ct.id);}}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                  {isEditing &&
                  <div className="px-2 pb-2 pt-1 bg-secondary/50 space-y-1.5">
                      <input type="text" value={editConnLabel} onChange={(e) => setEditConnLabel(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <div className="flex gap-1 flex-wrap">
                        {COLOR_PRESETS.map((c) =>
                      <button key={c} className={`w-4 h-4 rounded-full transition-transform ${editConnColor === c ? 'scale-125 ring-1 ring-foreground' : ''}`}
                      style={{ backgroundColor: `hsl(${c})` }} onClick={() => setEditConnColor(c)} />
                      )}
                      </div>
                      <div className="flex gap-1">
                        {LINE_STYLES.map((ls) =>
                      <button key={ls.value}
                      className={`px-2 py-0.5 rounded text-[10px] transition-colors ${editConnLine === ls.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                      onClick={() => setEditConnLine(ls.value)}>
                            {ls.label}
                          </button>
                      )}
                      </div>
                      <button onClick={() => saveEditConnector(ct.id)}
                    className="w-full py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1">
                        <Check size={10} /> Save
                      </button>
                    </div>
                  }
                </div>);

            })}
          </div>

          {showNewConnector &&
          <div className="mt-2 p-2 bg-secondary rounded-md space-y-2">
              <input type="text" placeholder="Connector name" value={newConnLabel} onChange={(e) => setNewConnLabel(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <div className="flex gap-1 flex-wrap">
                {COLOR_PRESETS.map((c) =>
              <button key={c} className={`w-5 h-5 rounded-full transition-transform ${newConnColor === c ? 'scale-125 ring-1 ring-foreground' : ''}`}
              style={{ backgroundColor: `hsl(${c})` }} onClick={() => setNewConnColor(c)} />
              )}
              </div>
              <div className="flex gap-1">
                {LINE_STYLES.map((ls) =>
              <button key={ls.value}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${newConnLine === ls.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setNewConnLine(ls.value)}>
                    {ls.label}
                  </button>
              )}
              </div>
              <button onClick={handleAddConnector}
            className="w-full py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 transition-opacity">
                Add Connector
              </button>
            </div>
          }
        </div>

        {/* Groups Section */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users size={12} />Groups
            </h2>
            <button onClick={() => setShowNewGroup(!showNewGroup)} className="text-muted-foreground hover:text-primary transition-colors" disabled={people.length === 0}>
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-0.5">
            {groups.map((g) => {
              const isExpanded = expandedGroupId === g.id;
              const isHidden = hiddenGroupIds.has(g.id);
              const isCollapsed = collapsedGroupIds.has(g.id);
              const members = people.filter((p) => g.memberIds.includes(p.id));
              return (
                <div key={g.id} className="rounded-md overflow-hidden">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm hover:bg-secondary cursor-pointer">
                    <button onClick={(e) => {e.stopPropagation();onToggleGroupVisibility(g.id);}}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                    </button>
                    <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => isExpanded ? setExpandedGroupId(null) : startEditGroup(g)}>
                      {isExpanded ? <ChevronDown size={10} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={10} className="shrink-0 text-muted-foreground" />}
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `hsl(${g.color})` }} />
                      <span className={`truncate flex-1 text-sidebar-foreground ${isHidden ? 'opacity-40' : ''}`}>{g.label}</span>
                      <span className="text-[10px] text-muted-foreground">{g.memberIds.length}</span>
                    </div>
                    <button onClick={(e) => {e.stopPropagation();onToggleGroupCollapse(g.id);}} title={isCollapsed ? 'Expand on canvas' : 'Collapse on canvas'}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                      {isCollapsed ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
                    </button>
                    <button onClick={(e) => {e.stopPropagation();onUpdateGroup(g.id, { featured: !g.featured, featuredColor: g.featuredColor || FEATURED_COLORS[0] });}}
                    className={`transition-colors shrink-0 ${g.featured ? 'text-featured' : 'text-muted-foreground hover:text-featured'}`}>
                      {g.featured ? <Star size={10} /> : <StarOff size={10} />}
                    </button>
                    <button onClick={(e) => {e.stopPropagation();onRemoveGroup(g.id);}}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                  {isExpanded &&
                  <div className="px-2 pb-2 pt-1 bg-secondary/50 space-y-1.5">
                      {/* Edit name & color */}
                      <input type="text" value={editGroupLabel} onChange={(e) => {setEditGroupLabel(e.target.value);}}
                    onBlur={() => saveEditGroup(g.id)}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <div className="flex gap-1 flex-wrap">
                        {COLOR_PRESETS.map((c) =>
                      <button key={c} className={`w-4 h-4 rounded-full transition-transform ${editGroupColor === c ? 'scale-125 ring-1 ring-foreground' : ''}`}
                      style={{ backgroundColor: `hsl(${c})` }}
                      onClick={() => {setEditGroupColor(c);onUpdateGroup(g.id, { color: c });}} />
                      )}
                      </div>
                      {/* Featured color */}
                      {g.featured &&
                    <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Featured color</label>
                          <div className="flex gap-1 flex-wrap mt-0.5">
                            {FEATURED_COLORS.map((c) =>
                        <button key={c} className={`w-4 h-4 rounded-full transition-transform ${g.featuredColor === c ? 'scale-125 ring-1 ring-foreground' : ''}`}
                        style={{ backgroundColor: `hsl(${c})` }}
                        onClick={() => onUpdateGroup(g.id, { featuredColor: c })} />
                        )}
                          </div>
                        </div>
                    }
                      {/* Members */}
                      {members.length === 0 ?
                    <p className="text-[10px] text-muted-foreground italic px-1">No members</p> :

                    members.map((m) =>
                    <div key={m.id} className="flex items-center gap-2 px-1 py-0.5 text-xs text-sidebar-foreground rounded hover:bg-muted">
                            <span className="flex-1 truncate">{m.firstName} {m.familyName}</span>
                            <button onClick={() => onUpdateGroup(g.id, { memberIds: g.memberIds.filter((mid) => mid !== m.id) })}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                              <X size={10} />
                            </button>
                          </div>
                    )
                    }
                      {people.filter((p) => !g.memberIds.includes(p.id)).length > 0 &&
                    <details className="mt-1">
                          <summary className="text-[10px] text-primary cursor-pointer hover:underline">+ Add members</summary>
                          <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                            {people.filter((p) => !g.memberIds.includes(p.id)).map((p) =>
                        <button key={p.id}
                        onClick={() => onUpdateGroup(g.id, { memberIds: [...g.memberIds, p.id] })}
                        className="flex items-center gap-1 w-full text-left px-1 py-0.5 text-xs text-muted-foreground hover:text-sidebar-foreground hover:bg-muted rounded">
                                <Plus size={8} /> {p.firstName} {p.familyName}
                              </button>
                        )}
                          </div>
                        </details>
                    }
                    </div>
                  }
                </div>);

            })}
          </div>

          {showNewGroup && people.length > 0 &&
          <div className="mt-2 p-2 bg-secondary rounded-md space-y-2">
              <input type="text" placeholder="Group name" value={newGroupLabel} onChange={(e) => setNewGroupLabel(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <div className="flex gap-1 flex-wrap">
                {COLOR_PRESETS.map((c) =>
              <button key={c} className={`w-5 h-5 rounded-full transition-transform ${newGroupColor === c ? 'scale-125 ring-1 ring-foreground' : ''}`}
              style={{ backgroundColor: `hsl(${c})` }} onClick={() => setNewGroupColor(c)} />
              )}
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {people.map((p) =>
              <label key={p.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted cursor-pointer text-xs text-sidebar-foreground">
                    <input type="checkbox" checked={newGroupMembers.includes(p.id)} onChange={() => toggleGroupMember(p.id)} className="rounded border-border" />
                    {p.firstName} {p.familyName}
                  </label>
              )}
              </div>
              <button onClick={handleAddGroup}
            className="w-full py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 transition-opacity">
                Add Group
              </button>
            </div>
          }
        </div>

        {/* People list */}
        {people.length > 0 &&
        <div className="px-4 py-3">
            <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText size={12} />
              People ({filteredPeople.length}{searchQuery ? ` / ${people.length}` : ''})
            </h2>
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {filteredPeople.map((p) => {
              const isExpanded = expandedPersonId === p.id;
              return (
                <div key={p.id} className="rounded-md overflow-hidden">
                    <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground px-2 py-1.5 hover:bg-secondary cursor-pointer"
                  onClick={() => setExpandedPersonId(isExpanded ? null : p.id)}>
                      {isExpanded ? <ChevronDown size={10} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={10} className="shrink-0 text-muted-foreground" />}
                      <span className="flex-1 truncate">{p.firstName} {p.familyName}</span>
                      {p.featured && <Star size={10} className="text-featured shrink-0" />}
                      {(p.notes || p.descriptor) && <FileText size={10} className="text-primary shrink-0" />}
                      <button onClick={(e) => {e.stopPropagation();onRemovePerson(p.id);if (expandedPersonId === p.id) setExpandedPersonId(null);}}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X size={10} />
                      </button>
                    </div>
                    {isExpanded &&
                  <div className="px-2 pb-2 pt-1 bg-secondary/50 space-y-1.5">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Descriptor</label>
                          <input type="text" placeholder="e.g. CEO, Teacher, Neighbor..." value={p.descriptor || ''} onChange={(e) => onUpdatePerson(p.id, { descriptor: e.target.value })}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary mt-0.5" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Notes</label>
                          <textarea placeholder="Add notes about this person..." value={p.notes || ''} onChange={(e) => onUpdatePerson(p.id, { notes: e.target.value })} rows={2}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary mt-0.5 resize-none" />
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => onUpdatePerson(p.id, { featured: !p.featured, featuredColor: p.featuredColor || FEATURED_COLORS[0] })}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${p.featured ? 'bg-featured/20 text-featured' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                            {p.featured ? <Star size={10} /> : <StarOff size={10} />}
                            {p.featured ? 'Featured' : 'Feature'}
                          </button>
                          {p.featured &&
                      <div className="flex gap-1">
                              {FEATURED_COLORS.map((c) =>
                        <button key={c} className={`w-3 h-3 rounded-full transition-transform ${p.featuredColor === c ? 'scale-125 ring-1 ring-foreground' : ''}`}
                        style={{ backgroundColor: `hsl(${c})` }}
                        onClick={() => onUpdatePerson(p.id, { featuredColor: c })} />
                        )}
                            </div>
                      }
                        </div>
                      </div>
                  }
                  </div>);

            })}
            </div>
          </div>
        }
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        <button onClick={onClearAll} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors">
          <RotateCcw size={12} />Clear all data
        </button>
      </div>
    </div>);

};
