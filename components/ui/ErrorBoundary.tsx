import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { reportError } from '../../services/monitoring';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Catches render errors anywhere below it, reports them (Sentry, when
// configured) and offers a retry instead of a blank screen.
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError(error, { componentStack: errorInfo.componentStack });
    if (__DEV__) console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app ran into a problem. Please try again. If it keeps happening, restart the app.
          </Text>
          {/* Technical details are for developers only. */}
          {__DEV__ && <Text style={styles.error}>{this.state.error?.toString()}</Text>}
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  error: {
    fontSize: 12,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
