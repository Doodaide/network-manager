import { useState, useCallback, useEffect } from 'react';
import { NetworkState, Person, Connection, ConnectorType, Group, DEFAULT_CONNECTOR_TYPES } from '@/types/network';
import * as XLSX from 'xlsx';
import { applyForceLayout } from '@/utils/forceLayout';

const STORAGE_KEY = 'network-chart-state';
const EXPORT_VERSION = 1;

const createInitialState = (): NetworkState => ({
  people: [],
  connections: [],
  connectorTypes: [...DEFAULT_CONNECTOR_TYPES],
  groups: [],
});

const loadState = (): NetworkState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...createInitialState(),
        ...parsed,
        connectorTypes: parsed.connectorTypes?.length
          ? parsed.connectorTypes
          : [...DEFAULT_CONNECTOR_TYPES],
      };
    }
  } catch {}
  return createInitialState();
};

let saveTimeout: ReturnType<typeof setTimeout>;
const saveState = (state: NetworkState) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, 300);
};

export function useNetworkState() {
  const [state, setState] = useState<NetworkState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const generateId = () => Math.random().toString(36).substring(2, 10);

  const importExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      const people: Person[] = rows.map((row, i) => {
        const familyName = row['family name'] || row['Family Name'] || row['familyName'] || row['Family name'] || row['Surname'] || row['surname'] || row['Last Name'] || row['last name'] || row['lastName'] || '';
        const firstName = row['first name'] || row['First Name'] || row['firstName'] || row['First name'] || row['Given Name'] || row['given name'] || row['Name'] || row['name'] || '';
        const angle = (2 * Math.PI * i) / rows.length;
        const radius = Math.min(300, rows.length * 20);
        return {
          id: generateId(),
          familyName: String(familyName).trim(),
          firstName: String(firstName).trim(),
          x: 500 + Math.cos(angle) * radius,
          y: 400 + Math.sin(angle) * radius,
        };
      });

      setState((prev) => ({
        ...prev,
        people: [...prev.people, ...people],
      }));
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const updatePersonPosition = useCallback((id: string, x: number, y: number) => {
    setState((prev) => ({
      ...prev,
      people: prev.people.map((p) => (p.id === id ? { ...p, x, y } : p)),
    }));
  }, []);

  const batchUpdatePositions = useCallback((updates: { id: string; x: number; y: number }[]) => {
    setState((prev) => ({
      ...prev,
      people: prev.people.map((p) => {
        const u = updates.find((up) => up.id === p.id);
        return u ? { ...p, x: u.x, y: u.y } : p;
      }),
    }));
  }, []);

  const addPerson = useCallback((firstName: string, familyName: string) => {
    const angle = Math.random() * 2 * Math.PI;
    const radius = 150 + Math.random() * 100;
    setState((prev) => ({
      ...prev,
      people: [
        ...prev.people,
        {
          id: generateId(),
          firstName: firstName.trim(),
          familyName: familyName.trim(),
          x: 500 + Math.cos(angle) * radius,
          y: 400 + Math.sin(angle) * radius,
        },
      ],
    }));
  }, []);

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    setState((prev) => ({
      ...prev,
      people: prev.people.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, []);

  const removePerson = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p.id !== id),
      connections: prev.connections.filter((c) => c.fromId !== id && c.toId !== id),
      groups: prev.groups.map((g) => ({
        ...g,
        memberIds: g.memberIds.filter((mid) => mid !== id),
      })),
    }));
  }, []);

  const addConnection = useCallback((
    fromId: string, toId: string, connectorTypeId: string,
    fromType: 'person' | 'group' = 'person', toType: 'person' | 'group' = 'person'
  ) => {
    setState((prev) => {
      const exists = prev.connections.some(
        (c) =>
          (c.fromId === fromId && c.toId === toId && c.connectorTypeId === connectorTypeId) ||
          (c.fromId === toId && c.toId === fromId && c.connectorTypeId === connectorTypeId)
      );
      if (exists) return prev;
      return {
        ...prev,
        connections: [
          ...prev.connections,
          { id: generateId(), fromId, toId, fromType, toType, connectorTypeId },
        ],
      };
    });
  }, []);

  const removeConnection = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      connections: prev.connections.filter((c) => c.id !== id),
    }));
  }, []);

  const addConnectorType = useCallback((label: string, color: string, lineStyle: 'solid' | 'dashed' | 'dotted') => {
    setState((prev) => ({
      ...prev,
      connectorTypes: [
        ...prev.connectorTypes,
        { id: generateId(), label, color, lineStyle },
      ],
    }));
  }, []);

  const updateConnectorType = useCallback((id: string, updates: Partial<ConnectorType>) => {
    setState((prev) => ({
      ...prev,
      connectorTypes: prev.connectorTypes.map((ct) => (ct.id === id ? { ...ct, ...updates } : ct)),
    }));
  }, []);

  const removeConnectorType = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      connectorTypes: prev.connectorTypes.filter((ct) => ct.id !== id),
      connections: prev.connections.filter((c) => c.connectorTypeId !== id),
    }));
  }, []);

  const addGroup = useCallback((label: string, memberIds: string[], color: string) => {
    setState((prev) => ({
      ...prev,
      groups: [
        ...prev.groups,
        { id: generateId(), label, memberIds, color },
      ],
    }));
  }, []);

  const updateGroup = useCallback((id: string, updates: Partial<Group>) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    }));
  }, []);

  const removeGroup = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== id),
      connections: prev.connections.filter((c) =>
        !((c.fromType === 'group' && c.fromId === id) || (c.toType === 'group' && c.toId === id))
      ),
    }));
  }, []);

  const updateConnection = useCallback((id: string, updates: Partial<Connection>) => {
    setState((prev) => ({
      ...prev,
      connections: prev.connections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  }, []);

  const applyForceSort = useCallback(() => {
    setState((prev) => {
      const updates = applyForceLayout(prev.people, prev.connections);
      if (updates.length === 0) return prev;
      return {
        ...prev,
        people: prev.people.map((p) => {
          const u = updates.find((up) => up.id === p.id);
          return u ? { ...p, x: u.x, y: u.y } : p;
        }),
      };
    });
  }, []);

  const exportState = useCallback(() => {
    const exportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      ...state,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-chart-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importState = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.people && data.connectorTypes) {
          setState({
            people: data.people || [],
            connections: data.connections || [],
            connectorTypes: data.connectorTypes?.length ? data.connectorTypes : [...DEFAULT_CONNECTOR_TYPES],
            groups: data.groups || [],
          });
        }
      } catch (err) {
        console.error('Failed to import state:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  const clearAll = useCallback(() => {
    setState(createInitialState());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
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
  };
}

