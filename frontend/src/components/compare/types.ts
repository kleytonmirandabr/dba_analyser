export interface Connection { id: string; name: string; environment: string; databaseName: string; dbType: string; }

export interface ColumnDiff { column: string; field: string; sourceValue: string; targetValue: string; }
export interface TableDiff { name: string; status: string; columnsOnlyInSource: string[]; columnsOnlyInTarget: string[]; columnDifferences: ColumnDiff[]; indexesOnlyInSource: string[]; indexesOnlyInTarget: string[]; }
export interface ObjectDiff { name: string; status: string; sourceDefinition?: string; targetDefinition?: string; }
export interface FullDiff {
  summary: { tables: number; columns: number; triggers: number; procedures: number; functions: number; views: number; indexes: number; total: number };
  tables: TableDiff[]; triggers: ObjectDiff[]; procedures: ObjectDiff[]; functions: ObjectDiff[]; views: ObjectDiff[];
}

export interface AlignedPair {
  type: 'same' | 'add' | 'remove' | 'changed'
  srcIdx?: number
  tgtIdx?: number
}
