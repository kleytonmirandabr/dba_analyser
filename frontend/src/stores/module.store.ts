import { create } from 'zustand'

export type AppModule = 'dba' | 'devops'

interface ModuleState {
  activeModule: AppModule
  setModule: (module: AppModule) => void
}

export const useModuleStore = create<ModuleState>((set) => ({
  activeModule: (localStorage.getItem('dba-active-module') as AppModule) || 'dba',
  setModule: (module) => {
    localStorage.setItem('dba-active-module', module)
    set({ activeModule: module })
  }
}))
