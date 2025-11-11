// components/GradientBackground.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type GradientBackgroundProps = {
  children: React.ReactNode;
};

export function GradientBackground({ children }: GradientBackgroundProps) {
  const { theme } = useTheme();

  return (
    <LinearGradient
      colors={theme.colors.bgGradient}
      locations={theme.colors.bgGradient.length === 3 ? [0, 0.3, 1] : [0, 1]}
      style={styles.gradient}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 0.8 }}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});
