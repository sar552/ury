import { StateCreator } from 'zustand';
import { AuthSlice } from './auth-slice';
import { getCombinedPosProfile, PosProfileCombined } from '../../lib/pos-profile-api';

interface RolePermission {
  name: string;
  owner: string;
  creation: string;
  modified: string;
  modified_by: string;
  docstatus: number;
  idx: number;
  role: string;
  parent: string;
  parentfield: string;
  parenttype: string;
  doctype: string;
}

export interface ConfigState {
  allowedRoles: string[];
  isLoading: boolean;
  error: string | null;
  hasAccess: boolean;
  posProfile: PosProfileCombined | null;
}

export interface ConfigActions {
  checkAccess: () => void;
  setAllowedRoles: (roles: string[]) => void;
  fetchPosProfile: (forceRefresh?: boolean) => Promise<void>;
}

export type ConfigSlice = ConfigState & ConfigActions;

const initialState: ConfigState = {
  allowedRoles: [],
  isLoading: false,
  error: null,
  hasAccess: false,
  posProfile: null,
};

export const createConfigSlice: StateCreator<
  ConfigSlice & AuthSlice,
  [],
  [],
  ConfigSlice
> = (set, get) => ({
  ...initialState,

  fetchPosProfile: async (_forceRefresh = false) => {
    try {
      set({ isLoading: true, error: null });

      // Always fetch fresh data to ensure is_waiter flag is current
      // Cache can cause issues with waiter shift status
      const profile = await getCombinedPosProfile();
      
      console.log("fetchPosProfile - profile:", profile);
      console.log("fetchPosProfile - is_waiter:", profile.is_waiter);
      
      // Cache the profile
      sessionStorage.setItem('posProfile', JSON.stringify(profile));
      set({ posProfile: profile });

      // Extract and set allowed roles from the profile
      const allowedRoles = profile.role_allowed_for_billing?.map((role: RolePermission) => role.role) || [];
      console.log("allowedRoles", allowedRoles);
      get().setAllowedRoles(allowedRoles);
      set({ isLoading: false });
    } catch (error) {
      set({ 
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  checkAccess: () => {
    const { user } = get();
    const { allowedRoles, posProfile } = get();

    console.log("checkAccess - user:", user);
    console.log("checkAccess - allowedRoles:", allowedRoles);
    console.log("checkAccess - posProfile?.is_waiter:", posProfile?.is_waiter);

    if (!user || !user.roles) {
      set({ hasAccess: false });
      return;
    }

    // If user is a waiter with an open shift, allow access
    if (posProfile?.is_waiter) {
      console.log("User is a waiter with open shift - granting access");
      set({ hasAccess: true, error: null });
      return;
    }

    // For non-waiters, check if user has any of the allowed roles
    if (!allowedRoles.length) {
      set({ hasAccess: false });
      return;
    }

    const hasAccess = user.roles.some(role => allowedRoles.includes(role));
    console.log("checkAccess - hasAccess:", hasAccess);
    set({ hasAccess });

    // If no access, we could redirect or show an error message
    if (!hasAccess) {
      set({ error: 'You do not have permission to access this application.' });
    }
  },

  setAllowedRoles: (roles) => {
    set({ allowedRoles: roles });
    // After setting new roles, recheck access
    get().checkAccess();
  },
}); 