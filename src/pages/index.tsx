import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { NetworkCanvas } from '@/components/NetworkCanvas';
import { useNetworkState } from '@/hooks/useNetworkState';
import { useIsMobile } from '@/hooks/use-mobile';

export interface CanvasVisibility {
  connectors: boolean;
  names: boolean;
  groups: boolean;
  minimap: boolean;
  hoverFocus: boolean;
}

const Index = () => {
  const {
    state,
    importExcel,
    addPerson,
    updatePerson,
    updatePersonPosition,
    batchUpdatePositions,
    removePerson,
    addConnection,
    removeConnection,
    updateConnection,
    addConnectorType,
    updateConnectorType,
    removeConnectorType,
    addGroup,
    updateGroup,
    removeGroup,
    applyForceSort,
    exportState,
    importState,
    clearAll,
  } = useNetworkState();

  const [selectedConnectorType, setSelectedConnectorType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibility, setVisibility] = useState<CanvasVisibility>({
    connectors: true,
    names: true,
    groups: true,
    minimap: false,
    hoverFocus: true,
  });
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [hiddenConnectorTypeIds, setHiddenConnectorTypeIds] = useState<Set<string>>(new Set());
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [livePhysics, setLivePhysics] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleVisibility = useCallback((key: keyof CanvasVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleConnectorTypeVisibility = useCallback((id: string) => {
    setHiddenConnectorTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleGroupVisibility = useCallback((id: string) => {
    setHiddenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleGroupCollapse = useCallback((id: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleNodeSelection = useCallback((id: string) => {
    setSelectedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedNodes(new Set()), []);

  const groupSelectedNodes = useCallback((label: string, color: string) => {
    if (selectedNodes.size < 2) return;
    addGroup(label, Array.from(selectedNodes), color);
    setSelectedNodes(new Set());
  }, [selectedNodes, addGroup]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        isMobile={!!isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        people={state.people}
        connections={state.connections}
        connectorTypes={state.connectorTypes}
        groups={state.groups}
        selectedConnectorType={selectedConnectorType}
        onSelectConnectorType={setSelectedConnectorType}
        onImportExcel={importExcel}
        onAddPerson={addPerson}
        onUpdatePerson={updatePerson}
        onRemovePerson={removePerson}
        onAddConnection={addConnection}
        onRemoveConnection={removeConnection}
        onUpdateConnection={updateConnection}
        onAddConnectorType={addConnectorType}
        onUpdateConnectorType={updateConnectorType}
        onRemoveConnectorType={removeConnectorType}
        onAddGroup={addGroup}
        onUpdateGroup={updateGroup}
        onRemoveGroup={removeGroup}
        onClearAll={clearAll}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        visibility={visibility}
        onToggleVisibility={toggleVisibility}
        selectedNodes={selectedNodes}
        onGroupSelectedNodes={groupSelectedNodes}
        onClearSelection={clearSelection}
        hiddenConnectorTypeIds={hiddenConnectorTypeIds}
        onToggleConnectorTypeVisibility={toggleConnectorTypeVisibility}
        hiddenGroupIds={hiddenGroupIds}
        onToggleGroupVisibility={toggleGroupVisibility}
        collapsedGroupIds={collapsedGroupIds}
        onToggleGroupCollapse={toggleGroupCollapse}
        onApplyForceSort={applyForceSort}
        onExportState={exportState}
        onImportState={importState}
        livePhysics={livePhysics}
        onToggleLivePhysics={() => setLivePhysics((p) => !p)}
      />
      <NetworkCanvas
        isMobile={!!isMobile}
        onOpenSidebar={() => setSidebarOpen(true)}
        people={state.people}
        connections={state.connections}
        connectorTypes={state.connectorTypes}
        groups={state.groups}
        selectedConnectorType={selectedConnectorType}
        onUpdatePosition={updatePersonPosition}
        onBatchUpdatePositions={batchUpdatePositions}
        onAddConnection={addConnection}
        onRemoveConnection={removeConnection}
        onRemovePerson={removePerson}
        visibility={visibility}
        searchQuery={searchQuery}
        selectedNodes={selectedNodes}
        onToggleNodeSelection={toggleNodeSelection}
        onClearSelection={clearSelection}
        hiddenConnectorTypeIds={hiddenConnectorTypeIds}
        hiddenGroupIds={hiddenGroupIds}
        collapsedGroupIds={collapsedGroupIds}
        livePhysics={livePhysics}
      />
    </div>
  );
};

export default Index;

