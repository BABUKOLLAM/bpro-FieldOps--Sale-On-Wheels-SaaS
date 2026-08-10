import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Keychain from 'react-native-keychain';
import { apiPostJson, clearTokens, getTokens, saveTokens } from '../api/client';

type User = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  is_field_agent: boolean;
  roles: string[];
  permission_codes: string[];
};

type LoginResponse = { access: string; refresh: string; user: User };

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEYCHAIN_SERVICE = 'vansales.user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const tokens = await getTokens();
        if (tokens) {
          const stored = await Keychain.getGenericPassword({
            service: USER_KEYCHAIN_SERVICE,
          });
          if (stored) {
            try {
              setUser(JSON.parse(stored.password));
            } catch {
              // fall through — user stays null, login screen will show
            }
          }
        }
      } catch {
        // Keychain read failed — fall through to login screen rather than
        // leaving isLoading stuck true forever.
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiPostJson<LoginResponse>('/api/auth/login/', {
      username,
      password,
    });
    await saveTokens({ access: data.access, refresh: data.refresh });
    await Keychain.setGenericPassword('user', JSON.stringify(data.user), {
      service: USER_KEYCHAIN_SERVICE,
    });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    await Keychain.resetGenericPassword({ service: USER_KEYCHAIN_SERVICE });
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (code: string) => Boolean(user?.permission_codes?.includes(code)),
    [user]
  );

  const value = useMemo(
    () => ({
      isLoading,
      isAuthenticated: Boolean(user),
      user,
      login,
      logout,
      hasPermission,
    }),
    [isLoading, user, login, logout, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
