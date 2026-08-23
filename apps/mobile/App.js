import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";

// Imported for its side effect and before anything else: the background
// location task must be registered as the bundle evaluates, because the OS
// relaunches this app to deliver locations and expects the task to already
// exist. Registering it inside a component would be too late.
import "./src/tracking/task";

import { OrbitProvider, useOrbit } from "./src/context/OrbitContext";
import { DashboardProvider } from "./src/context/DashboardContext";
import { RootNavigator, ThisDeviceNavigator, navTheme } from "./src/navigation/RootNavigator";
import { SignInScreen } from "./src/screens/SignInScreen";
import { RegisterDeviceScreen } from "./src/screens/RegisterDeviceScreen";
import { OrbitMark } from "./src/components/ui";
import { colors } from "./src/theme";

/**
 * Which shell to show is decided entirely by the credentials this phone holds.
 *
 * The two are deliberately independent: the device token outlives the user
 * session, so a phone whose session expired keeps reporting rather than going
 * silent until someone signs in again.
 */
const Root = () => {
  const { booting, user, device } = useOrbit();

  if (booting) {
    return (
      <SafeAreaView style={styles.splash}>
        <OrbitMark size={48} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  if (!device && !user) {
    return (
      <SafeAreaView style={styles.root}>
        <SignInScreen />
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.root}>
        <RegisterDeviceScreen />
      </SafeAreaView>
    );
  }

  // Registered but signed out: this phone can still report its own position,
  // but the dashboard tabs need a user session to show anything, so they are
  // not offered rather than shown empty.
  if (!user) {
    return (
      <NavigationContainer theme={navTheme}>
        <ThisDeviceNavigator />
      </NavigationContainer>
    );
  }

  return (
    <DashboardProvider>
      <RootNavigator />
    </DashboardProvider>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <OrbitProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.void} />
        <View style={styles.root}>
          <Root />
        </View>
      </OrbitProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
});
