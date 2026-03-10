export interface Person {
  id: string;
  familyName: string;
  firstName: string;
  x: number;
  y: number;
  notes?: string;
  descriptor?: string;
  featured?: boolean;
  featuredColor?: string;
}

export interface ConnectorType {
  id: string;
  label: string;
  color: string; // HSL string like "174 72% 50%"
  lineStyle: 'solid' | 'dashed' | 'dotted';
  isDefault?: boolean;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  fromType?: 'person' | 'group'; // defaults to 'person'
  toType?: 'person' | 'group';   // defaults to 'person'
  connectorTypeId: string;
  featured?: boolean;
  featuredColor?: string;
}

export interface Group {
  id: string;
  label: string;
  memberIds: string[];
  color: string;
  collapsed?: boolean;
  featured?: boolean;
  featuredColor?: string;
}

export interface NetworkState {
  people: Person[];
  connections: Connection[];
  connectorTypes: ConnectorType[];
  groups: Group[];
}

export const DEFAULT_CONNECTOR_TYPES: ConnectorType[] = [
  { id: 'friend', label: 'Friend', color: '174 72% 50%', lineStyle: 'solid', isDefault: true },
  { id: 'relationship', label: 'Relationship', color: '340 72% 55%', lineStyle: 'solid', isDefault: true },
  { id: 'acquaintance', label: 'Acquaintance', color: '45 80% 55%', lineStyle: 'dashed', isDefault: true },
];

